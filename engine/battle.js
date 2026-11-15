'use strict';
// engine/battle.js: Build 1g.1 battle rules and state. Drawing and taps are in battle-draw.js.
// A party of four placeholders (HERO 1 to 4) against one or two monsters, or one boss with a shield.
// Commands: ATTACK, DEFEND, SPECIAL (one each, once per fight), ITEM. Turn order: each standing hero picks in turn, then each
// standing monster acts. No randomness, so the same choices give the same fight. Level-up and difficulty are in place.
// Second-layer rules sit behind SECOND_LAYER switches, all off. Names, numbers and rules are placeholders until intake round 2.

const PARTY_START={hp:30,atk:7,def:1};
const LEVEL_UP={hp:5,atk:1};
const BAG_HEAL=12;
const BAG_START=2;
const HEAL_AMOUNT=16;
const RALLY_BONUS=2;
const MSG_TIME=0.8;                                     // seconds each message stays up before the next one
const DIFFICULTY=[
  {label:'EASY',enemyDmg:0.5},
  {label:'NORMAL',enemyDmg:1},
  {label:'HARD',enemyDmg:1.5}
];
const SECOND_LAYER={weakness:false,statusEffects:false,combos:false};   // all off until intake round 2

// The four placeholder heroes. tint tells the grey figures apart; special is a key of SPECIALS.
const PARTY_DEF=[
  {name:'HERO 1',tint:'#9fb0d0',special:'bighit'},
  {name:'HERO 2',tint:'#d0a99a',special:'sweep'},
  {name:'HERO 3',tint:'#9fd0ae',special:'heal'},
  {name:'HERO 4',tint:'#d6cc98',special:'rally'}
];
// target: foe (pick one monster), allFoes, ally (pick one standing hero), party (every standing hero).
const SPECIALS={
  bighit:{label:'BIG HIT',target:'foe',note:'Double damage on one monster'},
  sweep:{label:'SWEEP',target:'allFoes',note:'Hits every monster'},
  heal:{label:'HEAL',target:'ally',note:'Heals one hero for '+HEAL_AMOUNT},
  rally:{label:'RALLY',target:'party',note:'Every standing hero gains '+RALLY_BONUS+' attack for this fight'}
};
const FOES={
  a:{name:'MONSTER A',hp:20,atk:4,def:0,shield:0,xp:10,boss:false,tint:'#8d938f'},
  b:{name:'MONSTER B',hp:16,atk:5,def:0,shield:0,xp:8,boss:false,tint:'#9a8f94'},
  boss:{name:'BOSS',hp:60,atk:7,def:1,shield:2,xp:40,boss:true,tint:'#b5b0a4'}
};
// A fight kind is a list of foes. Map fights and scene fights name a kind (the Area editor lists these keys).
const ENEMY_TYPES={monster:['a'],pair:['a','b'],boss:['boss']};
// The command menu is a 2 by 2 grid. A direction moves the cursor inside it.
const COMMAND_GRID=[['attack','special'],['defend','item']];

let BATTLE=null;                                        // null outside a fight
let lastResult=null;                                    // 'win' or 'lose' after the last fight (debug handle reads it)

function makeParty() {
  return PARTY_DEF.map(d=>({
    name:d.name, tint:d.tint, special:d.special, lv:1, xp:0,
    hp:PARTY_START.hp, maxHp:PARTY_START.hp, atk:PARTY_START.atk, def:PARTY_START.def,
    specialUsed:false, defend:false, boost:0
  }));
}
function levelCost(lv) { return lv*12; }
function aliveParty() { return game.party.filter(m=>m.hp>0); }
function aliveFoes() { return BATTLE.foes.filter(f=>f.hp>0); }
function nextActor(from) {
  for(let i=from;i<game.party.length;i++) if(game.party[i].hp>0) return i;
  return -1;
}
function specialOf(m) { return SPECIALS[m.special]; }

// Starts a fight. kind is a key of ENEMY_TYPES. opts (used by the debug handle and by smoke tests):
// ref: the field monster record to remove on a win; enemyHp, enemyAtk: overrides for every foe; partyHp: caps current party HP.
function startBattle(kind,opts) {
  opts=opts||{};
  const list=ENEMY_TYPES[kind];
  if(!list||game.mode!=='play') return false;
  const foes=list.map(k=>{
    const t=FOES[k];
    return {name:t.name, hp:opts.enemyHp||t.hp, maxHp:opts.enemyHp||t.hp, atk:opts.enemyAtk||t.atk, def:t.def,
      shield:t.shield, xp:t.xp, boss:t.boss, tint:t.tint, flash:0};
  });
  game.party.forEach(m=>{
    m.specialUsed=false; m.defend=false; m.boost=0; m.flash=0;
    if(opts.partyHp) m.hp=Math.min(m.maxHp,opts.partyHp);
  });
  BATTLE={foes, ref:opts.ref||null, phase:'busy', actor:0, acting:-1, cursor:'attack', pending:null, target:0,
    queue:[], qt:0, n:0, heard:-1, then:null, result:null, turn:1, pops:[], time:0};
  musicFor(foes.some(f=>f.boss)&&AUDIO.music.use.boss?'boss':'battle');
  game.mode='battle';
  game.path=null;
  clearToast();
  say(foes.length>1?foes.map(f=>f.name).join(' and ')+' appear.':foes[0].name+' appears.');
  after(()=>openMenu(nextActor(0)));
  return true;
}

// A message, and what happens on screen when it shows: apply changes HP and starts the hit flash and number,
// so the bars move with the words. A message skipped by a tap still applies before the next one.
function say(text,apply) { BATTLE.queue.push({text,apply:apply||null,done:false}); }
function showMsg(q) { if(!q.done) { q.done=true; if(q.apply) q.apply(); } }
function nextMsg() { if(BATTLE.queue.length) showMsg(BATTLE.queue[0]); BATTLE.queue.shift(); BATTLE.qt=0; BATTLE.n++; }
function after(fn) { BATTLE.then=fn; }
function popup(side,i,text,heal) { BATTLE.pops.push({side,i,text,heal:!!heal,t:0}); }

function openMenu(i) {
  BATTLE.phase='menu';
  BATTLE.actor=i;
  BATTLE.acting=i;
  BATTLE.cursor='attack';
  BATTLE.pending=null;
}

// Damage to one foe. The new HP is worked out now and shown when the message shows.
function hitFoe(m,f,mult) {
  const fi=BATTLE.foes.indexOf(f);
  let dmg=Math.max(1,(m.atk+m.boost)*mult-f.def);
  if(SECOND_LAYER.weakness&&mult>1&&f.weakTo==='special') dmg=Math.round(dmg*1.5);
  if(f.shield>0) {
    f.shield--;
    const left=f.shield;
    say('The shield takes the hit. '+(left>0?left+' left.':'Shield down.'),()=>{ f.flash=.3; popup('foe',fi,'BLOCK'); });
    return;
  }
  const before=f.hp;
  f.hp=Math.max(0,f.hp-dmg);
  const now=f.hp;
  f.shownHp=before;
  say(f.name+' takes '+dmg+'.',()=>{ f.flash=.3; f.shownHp=now; popup('foe',fi,String(dmg)); });
  if(now<=0) say(f.name+' is down.');
}
function healHero(t,amount,line) {
  const ti=game.party.indexOf(t), before=t.hp;
  t.hp=Math.min(t.maxHp,t.hp+amount);
  const gained=t.hp-before, now=t.hp;
  t.shownHp=before;
  say(line+' '+t.name+' recovers '+gained+'.',()=>{ t.shownHp=now; popup('hero',ti,'+'+gained,true); });
}

// What a command needs before it can run: a monster, a hero, or nothing.
function targetKind(cmd,m) {
  if(cmd==='attack') return 'foe';
  if(cmd==='item') return 'ally';
  if(cmd==='special') { const t=specialOf(m).target; return t==='foe'||t==='ally'?t:null; }
  return null;
}
function targetList(kind) { return kind==='foe'?BATTLE.foes.filter(f=>f.hp>0):aliveParty(); }

// The A button on a command. Opens target picking when the command needs a target and there is a choice.
function chooseCommand(cmd) {
  if(!BATTLE||BATTLE.phase!=='menu') return;
  const m=game.party[BATTLE.actor];
  if(cmd==='special'&&m.specialUsed) { toast(specialOf(m).label+' is used up for this fight.'); return; }
  if(cmd==='item'&&game.bag<=0) { toast('The bag is empty.'); return; }
  BATTLE.cursor=cmd;
  const kind=targetKind(cmd,m);
  if(!kind) { runCommand(cmd,null); return; }
  const list=targetList(kind);
  if(kind==='foe'&&list.length===1) { runCommand(cmd,list[0]); return; }
  BATTLE.pending=cmd;
  BATTLE.phase='target';
  // A heal or item starts on the hurt hero with the lowest HP; an attack starts on the first standing monster.
  BATTLE.target=kind==='ally'?list.indexOf(list.reduce((a,b)=>(b.hp/b.maxHp<a.hp/a.maxHp?b:a))):0;
}
function targetOptions() { return BATTLE&&BATTLE.pending?targetList(targetKind(BATTLE.pending,game.party[BATTLE.actor])):[]; }
function targetMove(step) {
  const n=targetOptions().length;
  if(n) BATTLE.target=(BATTLE.target+step+n)%n;
}
function confirmTarget(t) {
  if(!BATTLE||BATTLE.phase!=='target') return;
  const list=targetOptions();
  const pick=t||list[BATTLE.target];
  if(!pick||list.indexOf(pick)<0) return;
  runCommand(BATTLE.pending,pick);
}
// Back out of target picking to the command menu.
function battleBack() {
  if(BATTLE&&BATTLE.phase==='target') { BATTLE.phase='menu'; BATTLE.pending=null; }
}

function runCommand(cmd,t) {
  const m=game.party[BATTLE.actor];
  BATTLE.phase='busy';
  BATTLE.pending=null;
  if(cmd==='attack') { say(m.name+' attacks.'); hitFoe(m,t,1); }
  else if(cmd==='defend') { m.defend=true; say(m.name+' defends. Damage is halved until their next turn.'); }
  else if(cmd==='item') { game.bag--; healHero(t,BAG_HEAL,'ITEM:'); }
  else if(cmd==='special') {
    const sp=specialOf(m);
    m.specialUsed=true;
    say(m.name+' uses '+sp.label+'.');
    if(m.special==='bighit') hitFoe(m,t,2);
    else if(m.special==='sweep') aliveFoes().forEach(f=>hitFoe(m,f,1));
    else if(m.special==='heal') healHero(t,HEAL_AMOUNT,'HEAL:');
    else if(m.special==='rally') {
      aliveParty().forEach(p=>{ p.boost+=RALLY_BONUS; });
      say('Every standing hero gains '+RALLY_BONUS+' attack for this fight.',()=>{
        game.party.forEach((p,i)=>{ if(p.hp>0) popup('hero',i,'ATK +'+RALLY_BONUS,true); });
      });
    }
  }
  after(afterPartyAction);
}

function afterPartyAction() {
  if(!aliveFoes().length) return winBattle();
  const next=nextActor(BATTLE.actor+1);
  if(next>=0) openMenu(next);
  else foeAct(0);
}

// Each standing foe acts in turn. Targets rotate through the standing heroes by turn and by foe, so no one hero takes every hit
// and the fight still has no randomness. A hero who chose DEFEND takes half.
function foeAct(i) {
  BATTLE.phase='busy';
  while(i<BATTLE.foes.length&&BATTLE.foes[i].hp<=0) i++;
  if(i>=BATTLE.foes.length||!aliveParty().length) return afterFoes();
  BATTLE.acting='foe'+i;
  const f=BATTLE.foes[i], alive=aliveParty();
  const target=alive[(BATTLE.turn-1+i)%alive.length], ti=game.party.indexOf(target);
  let dmg=Math.max(1,Math.round(f.atk*DIFFICULTY[game.difficulty].enemyDmg)-target.def);
  if(target.defend) dmg=Math.max(1,Math.floor(dmg/2));
  const before=target.hp;
  target.hp=Math.max(0,target.hp-dmg);
  const now=target.hp;
  target.shownHp=before;
  say(f.name+' hits '+target.name+' for '+dmg+(target.defend?' (defended).':'.'),()=>{ target.flash=.3; target.shownHp=now; popup('hero',ti,String(dmg)); });
  if(now<=0) say(target.name+' falls.');
  after(()=>foeAct(i+1));
}

function afterFoes() {
  if(!aliveParty().length) return loseBattle();
  game.party.forEach(m=>{ m.defend=false; });
  BATTLE.turn++;
  openMenu(nextActor(0));
}

function winBattle() {
  BATTLE.acting=-1;
  const xp=BATTLE.foes.reduce((s,f)=>s+f.xp,0);
  say('Victory. Each standing hero gains '+xp+' XP.');
  game.party.forEach(m=>{
    if(m.hp<=0) return;
    m.xp+=xp;
    while(m.xp>=levelCost(m.lv)) {
      m.xp-=levelCost(m.lv);
      m.lv++;
      m.maxHp+=LEVEL_UP.hp; m.hp=Math.min(m.maxHp,m.hp+LEVEL_UP.hp); m.atk+=LEVEL_UP.atk;
      m.shownHp=m.hp;
      say(m.name+' reaches level '+m.lv+'.');
    }
  });
  after(()=>{ BATTLE.result='win'; BATTLE.phase='over'; });
}

function loseBattle() {
  BATTLE.acting=-1;
  say('The party falls.');
  after(()=>{ BATTLE.result='lose'; BATTLE.phase='over'; });
}

// Closes the fight. A win removes the field monster; a loss restores the party and leaves the monster in place.
// A fallen hero gets up with 1 HP after a win, so the next fight never starts with someone already down.
function endBattle() {
  const r=BATTLE.result;
  if(r==='win'&&BATTLE.ref) BATTLE.ref.alive=false;
  game.party.forEach(m=>{
    if(r==='lose') m.hp=m.maxHp; else if(m.hp<=0) m.hp=1;
    m.defend=false; m.boost=0; delete m.shownHp; m.flash=0;
  });
  lastResult=r;
  BATTLE=null;
  stopVoice();
  game.mode='play';
  musicFor('area:'+game.area.id);
}

// The A button (or Enter) and taps on the message box. Menu: confirm. Target: confirm. Busy: skip the message. Over: leave the fight.
function battleConfirm() {
  if(!BATTLE) return;
  if(BATTLE.phase==='menu') chooseCommand(BATTLE.cursor);
  else if(BATTLE.phase==='target') confirmTarget(null);
  else if(BATTLE.phase==='busy') { if(BATTLE.queue.length) nextMsg(); }
  else if(BATTLE.phase==='over') endBattle();
}

// A direction moves the menu cursor in the 2 by 2 grid, or moves between targets.
function battleDir(d) {
  if(!BATTLE) return;
  if(BATTLE.phase==='target') { targetMove(d==='up'||d==='left'?-1:1); return; }
  if(BATTLE.phase!=='menu') return;
  let r=0,c=0;
  COMMAND_GRID.forEach((row,ri)=>row.forEach((k,ci)=>{ if(k===BATTLE.cursor) { r=ri; c=ci; } }));
  if(d==='up'||d==='down') r=1-r; else c=1-c;
  BATTLE.cursor=COMMAND_GRID[r][c];
}

// Per-frame: hit flashes and numbers, message timing, then whatever step was waiting for the message box to empty.
function battleUpdate(dt) {
  if(!BATTLE) return;
  BATTLE.time+=dt;
  BATTLE.pops.forEach(p=>{ p.t+=dt; });
  BATTLE.pops=BATTLE.pops.filter(p=>p.t<1);
  BATTLE.foes.concat(game.party).forEach(u=>{ if(u.flash>0) u.flash=Math.max(0,u.flash-dt); });
  if(BATTLE.queue.length) {
    const q=BATTLE.queue[0];
    if(BATTLE.heard!==BATTLE.n) { BATTLE.heard=BATTLE.n; showMsg(q); playVoice('battle',q.text,false); }   // a fight line plays only if it has a file
    BATTLE.qt+=dt;
    if(BATTLE.qt>=MSG_TIME) nextMsg();
    return;
  }
  if(BATTLE.then) { const f=BATTLE.then; BATTLE.then=null; f(); }
}
