'use strict';
// engine/draw.js: Build 1a drawing. Grey tiles, the placeholder walker, the title card and the fade. Reads the game state from main.js.
const COLOR={
  floor:'#8d938f', floorAlt:'#868c88', block:'#4a4f4c', blockTop:'#5f6663',
  roomFloor:'#7d7a72', roomAlt:'#77746c', door:'#d2d2d2', mat:'#b8b8b8', edge:'#a9b4af',
  walkerBody:'#8f8f8f', walkerHead:'#c9c9c9', ink:'#2a2e2c', label:'#eeeeee', shade:'rgba(0,0,0,.25)'
};
const TILE_TAG={D:'IN',M:'OUT',E:'EDGE'};

function drawTile(area,x,y,ch) {
  const px=x*T, py=y*T, alt=(x+y)%2===1;
  if(ch==='#') {
    ctx.fillStyle=COLOR.block; ctx.fillRect(px,py,T,T);
    ctx.fillStyle=COLOR.blockTop; ctx.fillRect(px,py,T,4);
    return;
  }
  ctx.fillStyle=area.indoor?(alt?COLOR.roomAlt:COLOR.roomFloor):(alt?COLOR.floorAlt:COLOR.floor);
  ctx.fillRect(px,py,T,T);
  if(ch==='D') { ctx.fillStyle=COLOR.door; ctx.fillRect(px+2,py+2,T-4,T-4); }
  if(ch==='M') { ctx.fillStyle=COLOR.mat; ctx.fillRect(px+1,py+1,T-2,T-2); }
  if(ch==='E') { ctx.fillStyle=COLOR.edge; ctx.fillRect(px+1,py+1,T-2,T-2); }
  if(TILE_TAG[ch]) {
    ctx.fillStyle=COLOR.ink; ctx.font='bold 5px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(TILE_TAG[ch],px+T/2,py+T/2+.5);
  }
}

function drawArea(area) {
  const x0=Math.max(0,Math.floor(game.camX/T)), x1=Math.min(area.w-1,Math.floor((game.camX+game.LW)/T));
  const y0=Math.max(0,Math.floor(game.camY/T)), y1=Math.min(area.h-1,Math.floor((game.camY+game.LH)/T));
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++) drawTile(area,x,y,area.grid[y][x]);
}

function drawWalker(time) {
  const p=walkerPos(), cx=p.x*T+T/2, cy=p.y*T+T/2;
  ctx.fillStyle=COLOR.shade; ctx.beginPath(); ctx.ellipse(cx,cy+4,5,2.5,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=COLOR.walkerBody; ctx.fillRect(cx-4,cy-3,8,8);
  ctx.fillStyle=COLOR.walkerHead; ctx.beginPath(); ctx.arc(cx,cy-6,3.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=COLOR.label; ctx.font='bold 7px monospace'; ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  ctx.fillText('HERO',cx,cy-13);
}

function drawAreaName() {
  const label=game.area.name;
  ctx.font='bold 10px monospace'; ctx.textAlign='left'; ctx.textBaseline='top';
  const w=ctx.measureText(label).width+12;
  ctx.fillStyle='rgba(12,18,16,.7)'; ctx.fillRect(6,6,w,16);
  ctx.fillStyle=COLOR.label; ctx.fillText(label,12,10);
}

function drawTitle(time) {
  const cx=game.LW/2, cy=game.LH/2;
  ctx.fillStyle='#3b4541'; ctx.fillRect(cx-70,cy-70,140,96);
  ctx.fillStyle='#8f8f8f'; ctx.fillRect(cx-70,cy-70,140,6);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle=COLOR.label; ctx.font='bold 22px monospace';
  ctx.fillText('[TITLE]',cx,cy-12);
  ctx.font='12px monospace'; ctx.fillStyle='#cfd6d2';
  ctx.fillText('Press A or Enter, or tap, to start',cx,cy+14);
  ctx.font='10px monospace'; ctx.fillStyle='#8c9692';
  ctx.fillText('Build 1a, placeholder',cx,game.LH-22);
}

function fadeAlpha() {
  const tr=game.trans; if(!tr) return 0;
  return tr.phase==='out'?Math.min(1,tr.t/FADE_TIME):Math.max(0,1-tr.t/FADE_TIME);
}

function drawFrame(time) {
  // Outside the map's walls the screen is filled with wall grey, so no black bars show on a tall or wide phone.
  ctx.fillStyle=game.mode==='title'?'#1b2321':'#4a4f4c'; ctx.fillRect(0,0,game.LW,game.LH);
  if(game.mode==='title') { drawTitle(time); return; }
  ctx.save();
  ctx.translate(-Math.round(game.camX),-Math.round(game.camY));
  drawArea(game.area);
  drawWalker(time);
  ctx.restore();
  drawAreaName();
  const a=fadeAlpha();
  if(a>0) { ctx.fillStyle='rgba(10,14,13,'+a.toFixed(3)+')'; ctx.fillRect(0,0,game.LW,game.LH); }
}
