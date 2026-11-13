'use strict';
// engine/battle-draw.js: Build 1b battle screen. Grey placeholders only. The battle fills the window; the D-pad and A are
// drawn over it (index.html), so the command cross sits clear of them in both orientations. Reads state from battle.js.
const BCOLOR={
  bg:'#2b3330', band:'#38423e', foe:'#8d938f', foeDark:'#4a4f4c', boss:'#b5b0a4', shadow:'rgba(0,0,0,.28)',
  card:'rgba(46,59,55,.9)', cardOn:'#55706a', cell:'rgba(46,59,55,.82)', cellOn:'#7d9a92', cellOff:'rgba(40,46,44,.6)',
  text:'#eef3ef', dim:'#8c9692', hp:'#9fc3a8', hpLow:'#c98a6e', bar:'#1d2422', pip:'#ffe27a', pipOff:'#4a4030'
};
const CELL=52, GAP=4;

// Where each piece of the screen sits, in logical pixels, for the current orientation.
function battleRects() {
  const LW=game.LW, LH=game.LH, cross=CELL*3+GAP*2;
  if(isLandscape()) {
    return {
      ribbon:{x:12,y:10,w:LW-24,h:20},
      enemy:{cx:LW/2,cy:Math.round(LH*0.3),s:64},
      msg:{x:LW/2-210,y:LH*0.3+46,w:420,h:30},
      cards:[{x:172,y:214,w:150,h:50},{x:172,y:272,w:150,h:50}],
      cross:{x:LW/2-cross/2,y:LH-12-cross,w:cross,h:cross}
    };
  }
  return {
    ribbon:{x:12,y:14,w:LW-24,h:22},
    enemy:{cx:LW/2,cy:Math.round(LH*0.2),s:96},
    msg:{x:16,y:Math.round(LH*0.4)+80,w:LW-32,h:44},
    cards:[{x:16,y:Math.round(LH*0.4),w:(LW-40)/2,h:64},{x:24+(LW-40)/2,y:Math.round(LH*0.4),w:(LW-40)/2,h:64}],
    cross:{x:LW/2-cross/2,y:LH-185-cross,w:cross,h:cross}
  };
}

// The command cross: special up, bag left, guard right, attack down. The centre shows whose turn it is.
function crossCells(R) {
  const x0=R.cross.x, y0=R.cross.y;
  return {
    special:{x:x0+CELL+GAP,y:y0,w:CELL,h:CELL,label:'SPECIAL'},
    bag:{x:x0,y:y0+CELL+GAP,w:CELL,h:CELL,label:'BAG'},
    guard:{x:x0+2*(CELL+GAP),y:y0+CELL+GAP,w:CELL,h:CELL,label:'GUARD'},
    attack:{x:x0+CELL+GAP,y:y0+2*(CELL+GAP),w:CELL,h:CELL,label:'ATTACK'}
  };
}

function crossCellAt(x,y) {
  const cells=crossCells(battleRects());
  for(const k in cells) {
    const c=cells[k];
    if(x>=c.x&&x<c.x+c.w&&y>=c.y&&y<c.y+c.h) return k;
  }
  return null;
}

// Taps: the cross picks and confirms a command; a tap during a message skips it; a tap on the result leaves the fight.
function battleTap(x,y) {
  if(!BATTLE) return;
  if(BATTLE.phase==='menu') {
    const c=crossCellAt(x,y);
    if(c) chooseCommand(c);
    return;
  }
  battleConfirm();
}

function drawBar(x,y,w,h,ratio,hot) {
  ctx.fillStyle=BCOLOR.bar; ctx.fillRect(x,y,w,h);
  ctx.fillStyle=hot?BCOLOR.hpLow:BCOLOR.hp; ctx.fillRect(x,y,Math.round(w*Math.max(0,Math.min(1,ratio))),h);
}

function drawRibbon(R) {
  const r=R.ribbon, chips=game.party.map((m,i)=>({label:'G'+(i+1),on:BATTLE.acting===i&&BATTLE.phase!=='over',off:m.hp<=0}));
  chips.push({label:BATTLE.enemy.boss?'BOSS':'MON',on:BATTLE.acting==='enemy',off:BATTLE.enemy.hp<=0});
  const w=Math.min(64,(r.w-8)/chips.length);
  chips.forEach((c,i)=>{
    const x=r.x+4+i*w;
    ctx.fillStyle=c.on?BCOLOR.cardOn:BCOLOR.card; ctx.fillRect(x,r.y,w-4,r.h);
    ctx.fillStyle=c.off?BCOLOR.dim:BCOLOR.text; ctx.font='bold 10px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(c.label,x+(w-4)/2,r.y+r.h/2+.5);
  });
  // Beside the chips, not at the right edge, where the ROTATE button sits.
  ctx.fillStyle=BCOLOR.dim; ctx.font='9px monospace'; ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText('TURN '+BATTLE.turn,r.x+4+chips.length*w+6,r.y+r.h/2+.5);
}

function drawEnemy(R) {
  const e=BATTLE.enemy, en=R.enemy, s=en.s, x=en.cx-s/2, y=en.cy-s/2, down=e.hp<=0;
  ctx.save();
  if(down) ctx.globalAlpha=.25;
  ctx.fillStyle=BCOLOR.shadow; ctx.beginPath(); ctx.ellipse(en.cx,y+s+4,s*.45,5,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=e.boss?BCOLOR.boss:BCOLOR.foe; ctx.fillRect(x,y,s,s);
  ctx.fillStyle=e.boss?'#8f8a7f':BCOLOR.foeDark; ctx.fillRect(x,y,s,5);
  ctx.restore();
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=BCOLOR.text; ctx.font='bold 11px monospace';
  ctx.fillText(e.name,en.cx,y-10);
  const bw=Math.max(90,s);
  drawBar(en.cx-bw/2,y+s+12,bw,6,e.hp/e.maxHp,false);
  if(e.shield>0) {
    // One pip per hit still needed to break the shield, as the reference does.
    for(let i=0;i<e.shield;i++) {
      const px=en.cx-(e.shield-1)*9+i*18, py=y-24;
      ctx.fillStyle=BCOLOR.pip; ctx.fillRect(px-5,py-5,10,10);
    }
  } else if(e.boss&&e.hp>0) {
    ctx.fillStyle=BCOLOR.dim; ctx.font='9px monospace'; ctx.fillText('SHIELD DOWN',en.cx,y-24);
  }
}

function drawCards(R) {
  game.party.forEach((m,i)=>{
    const c=R.cards[i], on=BATTLE.phase==='menu'&&BATTLE.actor===i;
    ctx.fillStyle=on?BCOLOR.cardOn:BCOLOR.card; ctx.fillRect(c.x,c.y,c.w,c.h);
    ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillStyle=m.hp<=0?BCOLOR.dim:BCOLOR.text; ctx.font='bold 10px monospace';
    ctx.fillText(m.name+'  LV '+m.lv,c.x+8,c.y+7);
    ctx.font='9px monospace'; ctx.fillStyle=BCOLOR.dim;
    ctx.fillText('HP '+m.hp+' / '+m.maxHp+(m.specialUsed?'   SPECIAL USED':'')+(m.guard?'   GUARD':''),c.x+8,c.y+21);
    drawBar(c.x+8,c.y+c.h-14,c.w-16,6,m.hp/m.maxHp,m.hp/m.maxHp<.3);
  });
}

function drawMessage(R) {
  const m=R.msg;
  let text;
  if(BATTLE.queue.length) text=BATTLE.queue[0];
  else if(BATTLE.phase==='menu') text=game.party[BATTLE.actor].name+': CHOOSE';
  else text='';
  ctx.fillStyle=BCOLOR.card; ctx.fillRect(m.x,m.y,m.w,m.h);
  ctx.fillStyle=BCOLOR.text; ctx.font='bold 11px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(text,m.x+m.w/2,m.y+m.h/2+.5);
}

function drawCross(R) {
  const cells=crossCells(R), actor=game.party[BATTLE.actor];
  for(const k in cells) {
    const c=cells[k];
    const off=(k==='special'&&actor.specialUsed)||(k==='bag'&&game.bag<=0);
    ctx.fillStyle=off?BCOLOR.cellOff:(BATTLE.cursor===k?BCOLOR.cellOn:BCOLOR.cell);
    ctx.fillRect(c.x,c.y,c.w,c.h);
    ctx.fillStyle=off?BCOLOR.dim:BCOLOR.text; ctx.font='bold 8px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(c.label,c.x+c.w/2,c.y+c.h/2+.5);
  }
  ctx.fillStyle=BCOLOR.dim; ctx.font='bold 8px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(game.bag>0?'BAG '+game.bag:'BAG 0',cells.bag.x+CELL/2,cells.bag.y+CELL+8);
}

function drawResult() {
  const cx=game.LW/2, cy=game.LH/2;
  ctx.fillStyle='rgba(10,14,13,.6)'; ctx.fillRect(0,0,game.LW,game.LH);
  ctx.fillStyle=BCOLOR.card; ctx.fillRect(cx-110,cy-46,220,92);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle=BCOLOR.text; ctx.font='bold 20px monospace';
  ctx.fillText(BATTLE.result==='win'?'VICTORY':'DEFEAT',cx,cy-14);
  ctx.font='10px monospace'; ctx.fillStyle=BCOLOR.dim;
  ctx.fillText('Press A or tap to continue',cx,cy+18);
}

function drawBattle(time) {
  const R=battleRects();
  ctx.fillStyle=BCOLOR.bg; ctx.fillRect(0,0,game.LW,game.LH);
  ctx.fillStyle=BCOLOR.band; ctx.fillRect(0,R.enemy.cy+R.enemy.s/2+18,game.LW,R.cards[0].y-(R.enemy.cy+R.enemy.s/2+18)-8);
  drawRibbon(R);
  drawEnemy(R);
  drawCards(R);
  drawMessage(R);
  if(BATTLE.phase==='menu') drawCross(R);
  if(BATTLE.phase==='over') drawResult();
}
