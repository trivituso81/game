'use strict';
// engine/story.js: Build 1c story engine. Story state (chapter, flags, objective), the chapter list, the cutscene runner
// and the scene scripts. A scene is a list of plain steps; each step has an op from SCENE_OPS. The runner plays them in order.
// Everything here is a grey placeholder: names, lines and layout come with the intake rounds.
const STORY={chapter:0,flags:{},objective:'',done:{}};
function resetStory(n) { STORY.chapter=n; STORY.flags={}; STORY.objective=''; }
function setFlag(k,v) { if(v===false||v==null) delete STORY.flags[k]; else STORY.flags[k]=v; }
function setObjective(text) { STORY.objective=text||''; }

const CHAPTERS=[
  {n:1,title:'PLACEHOLDER',blurb:'Grey test chapter'}
];

// ---------- Actors ----------
// A scene actor has the same shape as the walker, so one walk routine moves both. 'hero' is the walker itself.
function makeActor(id,label,x,y) {
  return {id,label,x,y,fromX:x,fromY:y,toX:x,toY:y,moving:false,t:0,face:'down'};
}
function sceneActor(id) { return id==='hero'?game.walker:game.actors.find(a=>a.id===id)||null; }
function actorPos(a) {
  if(!a.moving) return {x:a.x,y:a.y};
  const t=Math.min(1,a.t);
  return {x:a.fromX+(a.toX-a.fromX)*t, y:a.fromY+(a.toY-a.fromY)*t};
}
function scenePosOf(who) { const a=sceneActor(who); return a?{x:a.x,y:a.y}:null; }

// ---------- Scene ops ----------
// Each op has start(step,scene) returning its own state, and update(step,state,dt) returning true when the step is over.
const instant=fn=>({start:(st,sc)=>{ fn(st,sc); return {}; }, update:()=>true});
const SCENE_OPS={
  wait:{ start:()=>({t:0}), update:(st,x,dt)=>{ x.t+=dt; return x.t>=(st.time||.5); } },
  walk:{
    start:(st)=>{
      const a=sceneActor(st.who);
      const path=a?findPath(game.area,a.x,a.y,st.to[0],st.to[1]):null;
      if(!path) { game.faults.push('scene walk: no path for '+st.who); return {a:null,path:[],idx:0,begun:false}; }
      return {a,path,idx:0,begun:false};
    },
    update:(st,x,dt)=>{
      const a=x.a, step=(st.speed||MOVE_TIME);
      if(!a||x.idx>=x.path.length) return true;
      const n=x.path[x.idx];
      if(!x.begun) {
        a.fromX=a.x; a.fromY=a.y; a.toX=n.x; a.toY=n.y; a.moving=true; a.t=0; x.begun=true;
        a.face=n.x>a.x?'right':n.x<a.x?'left':n.y>a.y?'down':'up';
      }
      a.t+=dt/step;
      if(a.t>=1) { a.x=n.x; a.y=n.y; a.moving=false; a.t=0; x.idx++; x.begun=false; }
      return x.idx>=x.path.length;
    }
  },
  face:instant(st=>{ const a=sceneActor(st.who); if(a) a.face=st.dir; }),
  say:{
    start:(st,sc)=>{ sc.say={who:st.who,text:st.text}; sc.advance=false; return {}; },
    update:(st,x)=>{ const sc=game.scene; if(sc.advance) { sc.advance=false; sc.say=null; return true; } return false; }
  },
  camera:{
    start:(st)=>{ game.camFocus=st.on==='hero'?null:st.on; return {t:0}; },
    update:(st,x,dt)=>{ x.t+=dt; return x.t>=(st.time||.6); }
  },
  fade:{
    start:()=>({t:0,a0:game.sceneFade}),
    update:(st,x,dt)=>{
      x.t+=dt; const u=Math.min(1,x.t/(st.time||.4));
      game.sceneFade=x.a0+((st.to==='out'?1:0)-x.a0)*u;
      return u>=1;
    }
  },
  spawn:instant(st=>{ game.actors=game.actors.filter(a=>a.id!==st.id); game.actors.push(makeActor(st.id,st.label,st.at[0],st.at[1])); }),
  remove:instant(st=>{ game.actors=game.actors.filter(a=>a.id!==st.id); }),
  flag:instant(st=>setFlag(st.name,st.value===undefined?true:st.value)),
  objective:instant(st=>setObjective(st.text)),
  // A fight inside a scene. A lost fight restores the party and starts again, so a scene never skips its fight.
  battle:{
    start:(st)=>{ lastResult=null; startBattle(st.kind); return {}; },
    update:(st)=>{
      if(lastResult==='win') return true;
      lastResult=null; startBattle(st.kind); return false;
    }
  },
  closeup:{
    start:(st)=>{ startCloseup(st.mode); return {}; },
    update:()=>game.mode==='play'
  },
  end:instant(()=>endChapter())
};

// ---------- Runner ----------
function startScene(id) {
  const def=SCENES[id];
  if(!def||game.scene) return false;
  setFlag('seen:'+id,true);
  game.path=null;
  game.scene={id,steps:def.steps,i:-1,cur:null,state:null,say:null,advance:false};
  game.camSmooth=true; game.camFocus=null;
  return true;
}
function endScene() {
  game.scene=null; game.camSmooth=false; game.camFocus=null; game.sceneFade=0;
}
function sceneUpdate(dt) {
  const s=game.scene;
  for(let guard=0;guard<16&&game.scene===s;guard++) {
    if(!s.cur) {
      s.i++;
      if(s.i>=s.steps.length) { endScene(); return; }
      const st=s.steps[s.i];
      s.cur=SCENE_OPS[st.op];
      if(!s.cur) { game.faults.push('unknown scene op '+st.op); continue; }
      s.state=s.cur.start(st,s);
      if(game.mode!=='play') return;                  // the step opened a fight or a close-up; it resumes when play returns
    }
    if(s.cur.update(s.steps[s.i],s.state,dt)) { s.cur=null; s.state=null; dt=0; continue; }
    return;
  }
}
// A press while a scene runs only moves a line of speech on.
function sceneAction() {
  const s=game.scene;
  if(s&&s.say) s.advance=true;
}

// ---------- Chapter flow ----------
function startChapter(n) {
  const ch=CHAPTERS.find(c=>c.n===n);
  if(!ch) return;
  resetStory(n);
  game.party=makeParty(); game.bag=BAG_START;
  resetWorld();
  game.actors=[]; game.scene=null; game.camSmooth=false; game.camFocus=null; game.sceneFade=0; game.trans=null;
  startCard({lines:['CHAPTER '+n,ch.title,ch.blurb],time:2.4,then:beginChapter});
}
function beginChapter() {
  game.mode='play';
  game.walker.face='down';
  setArea('town',AREAS.town.spawn);
  setObjective('Walk to the GO tile in the south of TOWN A.');
  toast('Walk with the D-pad or arrow keys, or tap the map.',2600);
}
function endChapter() {
  STORY.done[STORY.chapter]=true;
  endScene();
  startCard({lines:['CHAPTER '+STORY.chapter,'COMPLETE','Press A to return to chapter select'],time:0,then:toChapters});
}
function toChapters() { game.mode='chapters'; game.path=null; }

// Cards (title card, end card): lines[0] small, lines[1] large, lines[2] small. time 0 waits for A.
function startCard(c) {
  game.card={lines:c.lines,t:0,time:c.time,then:c.then};
  game.mode='card'; game.path=null; game.sceneFade=0;
}
function finishCard() {
  const c=game.card; game.card=null;
  if(c&&c.then) c.then();
}
function cardUpdate(dt) {
  const c=game.card; if(!c) return;
  c.t+=dt;
  if(c.time&&c.t>=c.time) finishCard();
}
function cardSkip() {
  const c=game.card;
  if(c&&c.t>=.5) finishCard();
}

// ---------- Close-ups ----------
// Four placeholder modes. REVEAL: one object shown large. WATCH: a short animation that plays once. PLACE: an object lowers
// onto a marked spot and the spot lights up. ORDERED: the player puts the items into the slots in the right order.
let CLOSEUP=null;
const ORDERED_ANSWER=['A','B','C'];
const ORDERED_TRAY=['B','C','A'];
const WATCH_TIME=2, PLACE_TIME=1.4;
function startCloseup(mode) {
  CLOSEUP={mode,t:0,ready:false,msg:'',msgT:0,tray:mode==='ORDERED'?ORDERED_TRAY.slice():[],slots:[],cursor:0};
  game.mode='closeup'; game.path=null;
}
function closeupExpected() { return ORDERED_ANSWER[CLOSEUP.slots.length]; }
function closeupFinish() { CLOSEUP=null; game.mode='play'; }
function closeupUpdate(dt) {
  const c=CLOSEUP; if(!c) return;
  c.t+=dt;
  if(c.msgT>0) c.msgT-=dt;
  if(c.mode==='REVEAL') c.ready=c.t>=.5;
  else if(c.mode==='WATCH') c.ready=c.t>=WATCH_TIME+.3;
  else if(c.mode==='PLACE') c.ready=c.t>=PLACE_TIME+.4;
}
function closeupPlace() {
  const c=CLOSEUP, tok=c.tray[c.cursor];
  if(tok===closeupExpected()) {
    c.tray.splice(c.cursor,1); c.slots.push(tok);
    c.cursor=Math.min(c.cursor,Math.max(0,c.tray.length-1));
    c.msg=''; c.msgT=0;
    if(c.slots.length===ORDERED_ANSWER.length) c.ready=true;
  } else { c.msg='Not that one. Next slot wants '+closeupExpected()+'.'; c.msgT=1.6; }
}
function closeupConfirm() {
  const c=CLOSEUP; if(!c) return;
  if(c.mode==='ORDERED'&&!c.ready) { closeupPlace(); return; }
  if(c.ready) closeupFinish();
}
function closeupDir(d) {
  const c=CLOSEUP;
  if(!c||c.mode!=='ORDERED'||c.ready||!c.tray.length) return;
  if(d==='left') c.cursor=(c.cursor+c.tray.length-1)%c.tray.length;
  if(d==='right') c.cursor=(c.cursor+1)%c.tray.length;
}

// ---------- Scenes ----------
// Scene 'opening': walking onto the GO tile on TOWN A. Uses every step type, and opens the locked door.
// Scene 'closeups': walking onto the tile in ROOM B. Shows the four close-ups, then ends the chapter.
const SCENES={
  opening:{steps:[
    {op:'fade',to:'out',time:.3},
    {op:'spawn',id:'guide',label:'GUIDE',at:[15,25]},
    {op:'camera',on:'guide',time:.5},
    {op:'fade',to:'in',time:.3},
    {op:'say',who:'guide',text:'This is a placeholder cutscene. Every kind of step runs here.'},
    {op:'walk',who:'guide',to:[15,28]},
    {op:'face',who:'guide',dir:'down'},
    {op:'face',who:'hero',dir:'up'},
    {op:'camera',on:'hero',time:.8},
    {op:'say',who:'guide',text:'A grey monster is in the way. Fight it.'},
    {op:'spawn',id:'foe',label:'MON',at:[15,24]},
    {op:'battle',kind:'monster'},
    {op:'remove',id:'foe'},
    {op:'say',who:'guide',text:'Done. The locked door on the plain house in the north is open now.'},
    {op:'flag',name:'door-open'},
    {op:'objective',text:'Go through the unlocked door on the plain house.'},
    {op:'remove',id:'guide'}
  ]},
  closeups:{steps:[
    {op:'objective',text:'Look at the four close-ups.'},
    {op:'say',who:'hero',text:'Four close-ups follow: REVEAL, WATCH, PLACE, ORDERED.'},
    {op:'closeup',mode:'REVEAL'},
    {op:'closeup',mode:'WATCH'},
    {op:'closeup',mode:'PLACE'},
    {op:'closeup',mode:'ORDERED'},
    {op:'flag',name:'closeups-done'},
    {op:'objective',text:'Chapter complete.'},
    {op:'fade',to:'out',time:.4},
    {op:'end'}
  ]}
};
