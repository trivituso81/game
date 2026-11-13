'use strict';
// engine/main.js: Build 1a shell. Layout (portrait and landscape), input (keys, gamepad, on-screen D-pad and A, tap to walk),
// walking, doors and edges, fades, and the frame loop. Loaded last; shares one scope with world.js and draw.js.
const KEYS={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
const DIRS={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
const STORE_KEY='ffiv-layout';
const FADE_TIME=0.25;

const view=document.getElementById('view');
const ctx=view.getContext('2d');
const input={keys:new Map(),touch:null,pad:null};
const game={
  mode:'title', area:null, walker:{x:0,y:0,fromX:0,fromY:0,toX:0,toY:0,moving:false,t:0,face:'down'},
  path:null, trans:null, camX:0, camY:0, LW:360, LH:640, k:1, faults:[]
};

// ---------- Layout ----------
let override=null;
try { override=localStorage.getItem(STORE_KEY); } catch(e) { override=null; }
function isLandscape() { return override==='landscape'?true:override==='portrait'?false:innerWidth>innerHeight; }
// The stage fills the whole window, one logical pixel per screen pixel. The D-pad and A are drawn over the map (index.html),
// as in the first game, so nothing is reserved for them. The portrait or landscape class only moves the controls.
function layout() {
  const land=isLandscape(), vw=innerWidth, vh=innerHeight;
  document.documentElement.classList.toggle('landscape',land);
  document.documentElement.classList.toggle('portrait',!land);
  game.LW=Math.max(1,Math.round(vw)); game.LH=Math.max(1,Math.round(vh));
  game.k=Math.min(3,Math.max(1,Math.ceil(window.devicePixelRatio||1)));
  view.width=game.LW*game.k; view.height=game.LH*game.k;
}
function toggleLayout() {
  const next=isLandscape()?'portrait':'landscape';
  override=next;
  try { localStorage.setItem(STORE_KEY,next); } catch(e) {}
  layout();
  toast('Layout: '+next);
}

// ---------- Messages ----------
const toastEl=document.getElementById('toast');
let toastTimer=null;
function toast(msg,ms) {
  toastEl.textContent=msg; toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toastEl.classList.remove('on'),ms||1600);
}

// ---------- Walking ----------
function setArea(id,spawn) {
  game.area=AREAS[id];
  const w=game.walker;
  w.x=w.fromX=w.toX=spawn.x; w.y=w.fromY=w.toY=spawn.y;
  w.moving=false; w.t=0;
  game.path=null;
}
// Where the walker is drawn, in tiles (fractional while a step is under way).
function walkerPos() {
  const w=game.walker;
  if(!w.moving) return {x:w.x,y:w.y};
  const t=Math.min(1,w.t);
  return {x:w.fromX+(w.toX-w.fromX)*t, y:w.fromY+(w.toY-w.fromY)*t};
}
function tryStep(dirName) {
  const w=game.walker, d=DIRS[dirName], nx=w.x+d.x, ny=w.y+d.y;
  w.face=dirName;
  if(!walkable(game.area,nx,ny)) return false;
  w.fromX=w.x; w.fromY=w.y; w.toX=nx; w.toY=ny; w.moving=true; w.t=0;
  return true;
}
function heldDir() {
  if(input.touch) return input.touch;
  if(input.pad) return input.pad;
  const last=Array.from(input.keys.values());
  return last.length?last[last.length-1]:null;
}
function startTrans(to,spawn) { game.path=null; game.trans={phase:'out',t:0,to,spawn}; }
function updateTrans(dt) {
  const tr=game.trans; tr.t+=dt;
  if(tr.phase==='out') {
    if(tr.t>=FADE_TIME) { setArea(tr.to,tr.spawn); tr.phase='in'; tr.t=0; }
  } else if(tr.t>=FADE_TIME) game.trans=null;
}
// A step just ended. Standing on a portal starts the trip through it.
function arrive() {
  const p=portalAt(game.area,game.walker.x,game.walker.y);
  if(p) startTrans(p.to,p.spawn);
}
function update(dt) {
  if(game.mode!=='play') return;
  if(game.trans) { updateTrans(dt); return; }
  const w=game.walker;
  if(w.moving) {
    w.t+=dt/MOVE_TIME;
    if(w.t<1) return;
    w.x=w.toX; w.y=w.toY; w.moving=false; w.t=0;
    arrive();
    if(game.trans) return;
  }
  const held=heldDir();
  if(held) { game.path=null; tryStep(held); return; }
  if(game.path&&game.path.length) {
    const next=game.path.shift();
    const dx=next.x-w.x, dy=next.y-w.y;
    const name=dx===1?'right':dx===-1?'left':dy===1?'down':'up';
    if(!tryStep(name)) game.path=null;
  }
}

// ---------- Actions and taps ----------
function startGame() {
  if(game.mode!=='title') return;
  game.mode='play';
  setArea('town',AREAS.town.spawn);
  toast('Walk with the D-pad or arrow keys, or tap the map.',2600);
}
function action() {
  if(game.mode==='title') { startGame(); return; }
  if(game.trans) return;
  const w=game.walker, d=DIRS[w.face];
  if(portalAt(game.area,w.x+d.x,w.y+d.y)) { toast('Walk onto it to go through.'); return; }
  toast('Placeholder. Nothing here yet.');
}
function tapTile(tx,ty) {
  if(game.mode==='title') { startGame(); return; }
  if(game.trans) return;
  if(!walkable(game.area,tx,ty)) { toast('Cannot go there.'); return; }
  const path=findPath(game.area,game.walker.x,game.walker.y,tx,ty);
  if(!path) { toast('Cannot get there.'); return; }
  game.path=path;
}
function clientToTile(cx,cy) {
  const r=view.getBoundingClientRect();
  const lx=(cx-r.left)*(game.LW/r.width), ly=(cy-r.top)*(game.LH/r.height);
  return {tx:Math.floor((lx+game.camX)/T), ty:Math.floor((ly+game.camY)/T)};
}
function tileToClient(tx,ty) {
  const r=view.getBoundingClientRect();
  const lx=tx*T+T/2-game.camX, ly=ty*T+T/2-game.camY;
  return {x:r.left+lx*(r.width/game.LW), y:r.top+ly*(r.height/game.LH)};
}
view.addEventListener('click',e=>{ const t=clientToTile(e.clientX,e.clientY); tapTile(t.tx,t.ty); });

// ---------- Camera ----------
function updateCamera() {
  if(!game.area) return;
  const p=walkerPos(), mw=game.area.w*T, mh=game.area.h*T;
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  game.camX=mw<=game.LW?-(game.LW-mw)/2:clamp(p.x*T+T/2-game.LW/2,0,mw-game.LW);
  game.camY=mh<=game.LH?-(game.LH-mh)/2:clamp(p.y*T+T/2-game.LH/2,0,mh-game.LH);
}

// ---------- Input wiring ----------
addEventListener('keydown',e=>{
  if(e.code==='KeyL'&&!e.repeat) { e.preventDefault(); toggleLayout(); return; }
  if(KEYS[e.code]) { e.preventDefault(); input.keys.set(e.code,KEYS[e.code]); return; }
  if((e.code==='Enter'||e.code==='Space')&&!e.repeat) { e.preventDefault(); action(); }
});
addEventListener('keyup',e=>{ input.keys.delete(e.code); });
addEventListener('blur',()=>{ input.keys.clear(); input.touch=null; });

document.querySelectorAll('.dir[data-dir]').forEach(b=>{
  const d=b.dataset.dir;
  const off=()=>{ if(input.touch===d) input.touch=null; b.classList.remove('active'); };
  b.addEventListener('pointerdown',e=>{ e.preventDefault(); input.touch=d; b.classList.add('active'); });
  b.addEventListener('pointerup',off);
  b.addEventListener('pointercancel',off);
  b.addEventListener('pointerleave',off);
});
const actBtn=document.getElementById('act');
actBtn.addEventListener('pointerdown',e=>{ e.preventDefault(); actBtn.classList.add('pressed'); action(); });
['pointerup','pointercancel','pointerleave'].forEach(t=>actBtn.addEventListener(t,()=>actBtn.classList.remove('pressed')));
document.getElementById('rotate').addEventListener('click',toggleLayout);
document.addEventListener('contextmenu',e=>e.preventDefault());

const padPrev={};
function pollPad() {
  const pads=navigator.getGamepads?navigator.getGamepads():[];
  let g=null;
  for(const p of pads) if(p&&p.connected) { g=p; break; }
  if(!g) { input.pad=null; return; }
  const b=i=>!!(g.buttons[i]&&g.buttons[i].pressed), ax=g.axes[0]||0, ay=g.axes[1]||0;
  input.pad=(b(12)||ay<-.5)?'up':(b(13)||ay>.5)?'down':(b(14)||ax<-.5)?'left':(b(15)||ax>.5)?'right':null;
  const a=b(0); if(a&&!padPrev.a) action(); padPrev.a=a;
  const l=b(4); if(l&&!padPrev.l) toggleLayout(); padPrev.l=l;
}

// ---------- Frame loop ----------
const faults=game.faults;
function guard(name,fn) {
  try { fn(); } catch(err) { if(faults.length<50) faults.push(name+': '+err.message); console.error(name,err); }
}
let last=performance.now();
function frame(now) {
  const dt=Math.min(0.05,Math.max(0,(now-last)/1000));
  last=now;
  guard('pad',pollPad);
  guard('update',()=>update(dt));
  guard('camera',updateCamera);
  guard('draw',()=>{ ctx.setTransform(game.k,0,0,game.k,0,0); drawFrame(now/1000); });
  requestAnimationFrame(frame);
}

addEventListener('resize',layout);
layout();
document.documentElement.classList.add('js-running');
requestAnimationFrame(frame);

// Debug handle for tools/smoke.py and for checking a build by hand in the console.
window.__FFIV={
  get mode(){ return game.mode; },
  get area(){ return game.area?game.area.id:null; },
  get walker(){ const p=walkerPos(); return {x:game.walker.x,y:game.walker.y,rx:p.x,ry:p.y}; },
  get landscape(){ return isLandscape(); },
  get busy(){ return !!game.trans||game.walker.moving||!!(game.path&&game.path.length); },
  get faults(){ return faults.slice(); },
  get problems(){ return validateWorld(); },
  startGame, tapTile, tileToClient, toggleLayout
};
