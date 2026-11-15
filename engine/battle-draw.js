'use strict';
// engine/battle-draw.js: Build 1g.1 battle screen. Classic side view: monsters on the left, the four heroes on the right.
// The battlefield fills the whole window. The command menu (bottom left) and party status (bottom right) are drawn over it,
// inside the safe area (Dynamic Island, home bar). Sizes follow the window's shape, so the screen re-lays out on every
// resize: fold, unfold, rotate. In a fight the D-pad and A are hidden, because every choice is a tap; keys and gamepad still work.
// Grey placeholders only. Reads state from battle.js.
const BCOLOR={
  sky:'#232b29', ground:'#323c38', groundLine:'#3d4844', shadow:'rgba(0,0,0,.3)',
  panel:'rgba(22,30,28,.86)', panelEdge:'rgba(160,190,180,.25)', cell:'rgba(58,74,69,.92)', cellOn:'#7d9a92', cellOff:'rgba(40,46,44,.7)',
  text:'#eef3ef', dim:'#8c9692', hp:'#9fc3a8', hpLow:'#c98a6e', bar:'#141a19', pip:'#ffe27a',
  skin:'#d8d4cc', ink:'#232826', cursor:'#ffe27a', heal:'#9fe0b0', hurt:'#ffffff', shield:'#c9d6e6'
};

function clamp(v,lo,hi) { return Math.max(lo,Math.min(hi,v)); }
function bfont(px,bold) { ctx.font=(bold?'bold ':'')+Math.round(px)+'px monospace'; }

// Every rectangle on the battle screen, in logical pixels, for the current window and safe area.
function battleLayout() {
  const LW=game.LW, LH=game.LH, S=game.safe||{t:0,r:0,b:0,l:0}, land=isLandscape();
  const u=clamp(Math.min(LW,LH)/420,.85,1.5), pad=Math.round(8*u), gap=Math.round(4*u), ip=Math.round(6*u);
  const L=S.l+pad, R=LW-S.r-pad, T=S.t+pad, B=LH-S.b-pad;
  const cellH=Math.round(40*u), head=Math.round(20*u);
  const panelH=ip+head+cellH*2+gap+ip;
  const out={u,land,pad,gap,ip,cellH,head};
  // The SOUND and ROTATE buttons sit at the top right, so the message bar stops short of them in landscape and sits below them in portrait.
  if(land) out.msg={x:L,y:T,w:Math.max(160,Math.min(R-L-170,Math.round(560*u))),h:Math.round(30*u)};
  else out.msg={x:L,y:S.t+48,w:R-L,h:Math.round(34*u)};
  if(land) {
    const mw=Math.round(Math.min(250*u,(R-L)*.44)), sw=Math.round(Math.min(300*u,(R-L)*.52));
    out.menu={x:L,y:B-panelH,w:mw,h:panelH};
    out.status={x:R-sw,y:B-panelH,w:sw,h:panelH,cards:false};
    out.field={x:L,y:out.msg.y+out.msg.h+pad,w:R-L,h:out.menu.y-pad-(out.msg.y+out.msg.h+pad)};
  } else {
    const cardH=Math.round(38*u), sh=ip*2+cardH*2+gap;
    out.menu={x:L,y:B-panelH,w:R-L,h:panelH};
    out.status={x:L,y:out.menu.y-gap*2-sh,w:R-L,h:sh,cards:true,cardH};
    out.field={x:L,y:out.msg.y+out.msg.h+pad,w:R-L,h:out.status.y-pad-(out.msg.y+out.msg.h+pad)};
  }
  const F=out.field;
  // Figures keep a strip at the top of the field clear, so the yellow arrow over a figure never hides under the message bar.
  const top=Math.round(16*u), G={x:F.x,y:F.y+top,w:F.w,h:F.h-top};
  // Command cells, 2 by 2 under a header line.
  const m=out.menu, cw=(m.w-ip*2-gap)/2, cy0=m.y+ip+head;
  out.cells={};
  COMMAND_GRID.forEach((row,r)=>row.forEach((k,c)=>{ out.cells[k]={x:m.x+ip+c*(cw+gap),y:cy0+r*(cellH+gap),w:cw,h:cellH}; }));
  out.back={x:m.x+ip,y:cy0+cellH+gap,w:m.w-ip*2,h:cellH};
  // Status rows (landscape) or cards (portrait), one per hero, in party order.
  const s=out.status;
  out.rows=game.party.map((_,i)=>{
    if(s.cards) { const w=(s.w-ip*2-gap)/2; return {x:s.x+ip+(i%2)*(w+gap),y:s.y+ip+Math.floor(i/2)*(s.cardH+gap),w,h:s.cardH}; }
    const h=(s.h-ip*2-gap*3)/4; return {x:s.x+ip,y:s.y+ip+i*(h+gap),w:s.w-ip*2,h};
  });
  // Heroes: four slots down the right side, each a little further right, as in a classic side view.
  const slotH=G.h/4, fh=Math.max(24,Math.min(slotH*.9,92*u));
  out.heroes=game.party.map((_,i)=>({
    cx:G.x+G.w*(land?.70:.64)+i*G.w*(land?.035:.05), base:G.y+slotH*(i+1)-slotH*.05, h:fh, w:fh*.55
  }));
  // Monsters: one in the middle of the left side, or two stacked with the lower one further right. Name and HP bar sit under each.
  const lb=Math.round(26*u), n=BATTLE?BATTLE.foes.length:1;
  if(n<=1) {
    const sz=Math.max(32,Math.min(G.h-lb-8*u,G.w*.34,270*u));
    out.foes=[{cx:G.x+G.w*.28,base:G.y+(G.h-lb+sz)/2,s:sz}];
  } else {
    const sz=Math.max(28,Math.min(G.h/2-lb-4*u,G.w*.24,200*u));
    out.foes=[0,1].map(i=>({cx:G.x+G.w*(i?.34:.19),base:G.y+i*G.h/2+(G.h/2-lb+sz)/2,s:sz}));
  }
  return out;
}

function unitBox(Lo,side,i) {
  if(side==='foe') { const f=Lo.foes[i]; return {x:f.cx-f.s/2,y:f.base-f.s,w:f.s,h:f.s}; }
  const h=Lo.heroes[i], dx=heroStep(i)*Lo.u;
  return {x:h.cx-h.w/2-8*Lo.u-dx,y:h.base-h.h,w:h.w+16*Lo.u,h:h.h};
}
// A hero steps forward while it is choosing or acting, as in classic side-view fights.
function heroStep(i) {
  if(!BATTLE||game.party[i].hp<=0) return 0;
  const choosing=(BATTLE.phase==='menu'||BATTLE.phase==='target')&&BATTLE.actor===i;
  const acting=BATTLE.phase==='busy'&&BATTLE.acting===i;
  return choosing||acting?16:0;
}

function inRect(x,y,r) { return x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h; }

// Taps. Menu: a command cell picks it. Target: tap the monster or hero, or BACK. During messages: skip. Result: leave.
function battleTap(x,y) {
  if(!BATTLE) return;
  const Lo=battleLayout();
  if(BATTLE.phase==='menu') {
    for(const k in Lo.cells) if(inRect(x,y,Lo.cells[k])) { chooseCommand(k); return; }
    return;
  }
  if(BATTLE.phase==='target') {
    if(inRect(x,y,Lo.back)) { battleBack(); return; }
    const opts=targetOptions(), kind=targetKind(BATTLE.pending,game.party[BATTLE.actor]);
    const units=kind==='foe'?BATTLE.foes:game.party, side=kind==='foe'?'foe':'hero';
    for(let i=0;i<units.length;i++) {
      if(opts.indexOf(units[i])<0) continue;
      const b=unitBox(Lo,side,i), m=10*Lo.u;
      if(inRect(x,y,{x:b.x-m,y:b.y-m,w:b.w+2*m,h:b.h+2*m})) { confirmTarget(units[i]); return; }
    }
    for(let i=0;i<Lo.rows.length;i++) if(side==='hero'&&inRect(x,y,Lo.rows[i])&&opts.indexOf(game.party[i])>=0) { confirmTarget(game.party[i]); return; }
    return;
  }
  battleConfirm();
}

function drawBar(x,y,w,h,ratio,hot) {
  ctx.fillStyle=BCOLOR.bar; ctx.fillRect(x,y,w,h);
  ctx.fillStyle=hot?BCOLOR.hpLow:BCOLOR.hp; ctx.fillRect(x,y,Math.round(w*clamp(ratio,0,1)),h);
}
function shown(u) { return u.shownHp===undefined?u.hp:u.shownHp; }
function panel(r) {
  ctx.fillStyle=BCOLOR.panel; ctx.fillRect(r.x,r.y,r.w,r.h);
  ctx.strokeStyle=BCOLOR.panelEdge; ctx.lineWidth=1; ctx.strokeRect(r.x+.5,r.y+.5,r.w-1,r.h-1);
}

function drawField(Lo) {
  const F=Lo.field, horizon=F.y+F.h*.32;
  ctx.fillStyle=BCOLOR.sky; ctx.fillRect(0,0,game.LW,game.LH);
  ctx.fillStyle=BCOLOR.ground; ctx.fillRect(0,horizon,game.LW,game.LH-horizon);
  ctx.fillStyle=BCOLOR.groundLine;
  for(let k=1;k<6;k++) { const y=horizon+(game.LH-horizon)*(k*k/36); ctx.fillRect(0,Math.round(y),game.LW,1); }
}

// A placeholder monster: a tinted block with eyes on the side facing the party.
function drawFoe(Lo,i) {
  const f=BATTLE.foes[i], p=Lo.foes[i], s=p.s, x=p.cx-s/2, y=p.base-s, u=Lo.u, down=shown(f)<=0;
  ctx.save();
  if(down) ctx.globalAlpha=.22;
  ctx.fillStyle=BCOLOR.shadow; ctx.beginPath(); ctx.ellipse(p.cx,p.base+2,s*.48,Math.max(3,s*.07),0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=f.tint; ctx.fillRect(x,y,s,s);
  ctx.fillStyle='rgba(0,0,0,.22)'; ctx.fillRect(x,y,s,Math.max(4,s*.08));
  ctx.fillStyle=BCOLOR.ink;
  const e=Math.max(3,s*.07);
  ctx.fillRect(x+s*.62,y+s*.3,e,e); ctx.fillRect(x+s*.8,y+s*.3,e,e);
  if(f.flash>0) { ctx.globalAlpha=Math.min(1,f.flash/.3)*.8; ctx.fillStyle=BCOLOR.hurt; ctx.fillRect(x,y,s,s); }
  ctx.restore();
  // Name and HP bar under the monster.
  ctx.fillStyle=down?BCOLOR.dim:BCOLOR.text; bfont(11*u,true); ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText(f.name,p.cx,p.base+6*u);
  const bw=Math.max(70*u,s*.8);
  drawBar(p.cx-bw/2,p.base+19*u,bw,Math.max(4,5*u),shown(f)/f.maxHp,false);
  if(f.shield>0) {
    for(let k=0;k<f.shield;k++) { const px=p.cx-(f.shield-1)*9*u+k*18*u; ctx.fillStyle=BCOLOR.pip; ctx.fillRect(px-5*u,y-14*u,10*u,10*u); }
  } else if(f.boss&&!down) { ctx.fillStyle=BCOLOR.dim; bfont(9*u,false); ctx.textBaseline='bottom'; ctx.fillText('SHIELD DOWN',p.cx,y-4*u); }
}

// A placeholder hero facing left: legs, tinted body, head, and a short blade held forward. Lies down when fallen.
function drawHero(Lo,i) {
  const m=game.party[i], p=Lo.heroes[i], u=Lo.u, h=p.h, w=p.w, down=shown(m)<=0;
  const cx=p.cx-heroStep(i)*u, base=p.base;
  ctx.save();
  ctx.fillStyle=BCOLOR.shadow; ctx.beginPath(); ctx.ellipse(cx,base,w*.6,Math.max(2,h*.05),0,0,Math.PI*2); ctx.fill();
  if(down) {
    ctx.globalAlpha=.55;
    ctx.fillStyle=m.tint; ctx.fillRect(cx-h*.45,base-w*.45,h*.65,w*.4);
    ctx.fillStyle=BCOLOR.skin; ctx.beginPath(); ctx.arc(cx-h*.45-w*.18,base-w*.25,w*.24,0,Math.PI*2); ctx.fill();
    ctx.restore();
    return;
  }
  const headR=w*.3, bodyTop=base-h+headR*2, legH=h*.26;
  ctx.fillStyle=BCOLOR.ink;
  ctx.fillRect(cx-w*.28,base-legH,w*.2,legH); ctx.fillRect(cx+w*.08,base-legH,w*.2,legH);
  ctx.fillStyle=m.tint; ctx.fillRect(cx-w*.42,bodyTop,w*.84,base-legH-bodyTop+2);
  ctx.fillStyle=BCOLOR.skin; ctx.beginPath(); ctx.arc(cx,bodyTop-headR+1,headR,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=BCOLOR.ink; ctx.fillRect(cx-headR*.7,bodyTop-headR-1,Math.max(2,headR*.25),Math.max(2,headR*.25));
  // Arm and blade forward (to the left).
  ctx.fillStyle=m.tint; ctx.fillRect(cx-w*.75,bodyTop+h*.12,w*.4,Math.max(3,w*.16));
  ctx.fillStyle='#c7cdd0'; ctx.fillRect(cx-w*1.15,bodyTop+h*.12-1,w*.42,Math.max(2,w*.08));
  if(m.defend) {
    ctx.fillStyle=BCOLOR.shield; ctx.globalAlpha=.85;
    ctx.beginPath(); ctx.ellipse(cx-w*.62,bodyTop+h*.22,w*.2,h*.22,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  }
  if(m.flash>0) { ctx.globalAlpha=Math.min(1,m.flash/.3)*.8; ctx.fillStyle=BCOLOR.hurt; ctx.fillRect(cx-w*.45,base-h,w*.9,h); }
  ctx.restore();
}

// The bobbing yellow arrow over whoever is choosing, or over the target being picked.
function drawCursor(x,y,u) {
  const b=Math.sin(BATTLE.time*6)*3*u, s=7*u;
  ctx.fillStyle=BCOLOR.cursor; ctx.beginPath();
  ctx.moveTo(x-s,y-s*1.4+b); ctx.lineTo(x+s,y-s*1.4+b); ctx.lineTo(x,y+b); ctx.closePath(); ctx.fill();
}
function drawCursors(Lo) {
  const u=Lo.u;
  if(BATTLE.phase==='menu') { const b=unitBox(Lo,'hero',BATTLE.actor); drawCursor(b.x+b.w/2,b.y-4*u,u); }
  if(BATTLE.phase==='target') {
    const t=targetOptions()[BATTLE.target]; if(!t) return;
    const fi=BATTLE.foes.indexOf(t), side=fi>=0?'foe':'hero', b=unitBox(Lo,side,fi>=0?fi:game.party.indexOf(t));
    drawCursor(b.x+b.w/2,b.y-(side==='foe'&&t.shield>0?20:4)*u,u);
  }
}

// Floating numbers: damage in white, healing and boosts in green. They rise and fade over one second.
function drawPops(Lo) {
  const u=Lo.u;
  BATTLE.pops.forEach(p=>{
    const b=unitBox(Lo,p.side,p.i), y=b.y+b.h*.3-p.t*28*u;
    ctx.globalAlpha=clamp(1.6-p.t*1.6,0,1);
    bfont(18*u,true); ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillText(p.text,b.x+b.w/2+1.5,y+1.5);
    ctx.fillStyle=p.heal?BCOLOR.heal:BCOLOR.hurt; ctx.fillText(p.text,b.x+b.w/2,y);
    ctx.globalAlpha=1;
  });
}

function drawMessageBar(Lo) {
  const m=Lo.msg, u=Lo.u;
  let text='';
  if(BATTLE.queue.length) text=BATTLE.queue[0].text;
  else if(BATTLE.phase==='menu') text=game.party[BATTLE.actor].name+': choose a command.';
  else if(BATTLE.phase==='target') text=targetKind(BATTLE.pending,game.party[BATTLE.actor])==='foe'?'Choose a monster.':'Choose a hero.';
  panel(m);
  ctx.fillStyle=BCOLOR.dim; bfont(9*u,false); ctx.textAlign='right'; ctx.textBaseline='middle';
  ctx.fillText('TURN '+BATTLE.turn,m.x+m.w-8*u,m.y+m.h/2+.5);
  ctx.fillStyle=BCOLOR.text; ctx.textAlign='left';
  let px=12*u; bfont(px,true);
  const room=m.w-62*u;
  while(px>8&&ctx.measureText(text).width>room) { px-=.5; bfont(px,true); }
  ctx.fillText(text,m.x+8*u,m.y+m.h/2+.5);
}

function drawMenu(Lo) {
  const m=Lo.menu, u=Lo.u, actor=game.party[BATTLE.actor], live=BATTLE.phase==='menu'||BATTLE.phase==='target';
  panel(m);
  ctx.textBaseline='middle'; ctx.textAlign='left';
  ctx.fillStyle=live?BCOLOR.text:BCOLOR.dim; bfont(11*u,true);
  const headY=m.y+Lo.ip+Lo.head/2;
  if(BATTLE.phase==='target') {
    const sp=BATTLE.pending==='special'?specialOf(actor).label:BATTLE.pending.toUpperCase();
    ctx.fillText(actor.name+'  '+sp,m.x+Lo.ip+2*u,headY);
    ctx.fillStyle=BCOLOR.dim; bfont(10*u,false);
    ctx.fillText('Tap a target, or move and press A.',m.x+Lo.ip+2*u,Lo.cells.attack.y+Lo.cellH/2);
    const b=Lo.back;
    ctx.fillStyle=BCOLOR.cell; ctx.fillRect(b.x,b.y,b.w,b.h);
    ctx.fillStyle=BCOLOR.text; bfont(12*u,true); ctx.textAlign='center';
    ctx.fillText('BACK',b.x+b.w/2,b.y+b.h/2+.5);
    return;
  }
  ctx.fillText(live?actor.name:(typeof BATTLE.acting==='number'&&BATTLE.acting>=0?game.party[BATTLE.acting].name:'...'),m.x+Lo.ip+2*u,headY);
  const labels={attack:'ATTACK',defend:'DEFEND',special:specialOf(actor).label,item:'ITEM x'+game.bag};
  for(const k in Lo.cells) {
    const c=Lo.cells[k], off=(k==='special'&&actor.specialUsed)||(k==='item'&&game.bag<=0);
    ctx.fillStyle=!live||off?BCOLOR.cellOff:(BATTLE.cursor===k?BCOLOR.cellOn:BCOLOR.cell);
    ctx.fillRect(c.x,c.y,c.w,c.h);
    ctx.fillStyle=!live||off?BCOLOR.dim:BCOLOR.text; ctx.textAlign='center';
    let px=12*u; bfont(px,true);
    while(px>7&&ctx.measureText(labels[k]).width>c.w-8) { px-=.5; bfont(px,true); }
    ctx.fillText(labels[k],c.x+c.w/2,c.y+c.h/2+.5);
  }
}

function drawStatus(Lo) {
  const u=Lo.u;
  panel(Lo.status);
  game.party.forEach((m,i)=>{
    const r=Lo.rows[i], on=(BATTLE.phase==='menu'||BATTLE.phase==='target')&&BATTLE.actor===i, down=shown(m)<=0;
    if(on) { ctx.fillStyle='rgba(125,154,146,.35)'; ctx.fillRect(r.x,r.y,r.w,r.h); }
    const sw=Math.max(4,5*u);
    ctx.fillStyle=m.tint; ctx.fillRect(r.x+2*u,r.y+3*u,sw,r.h-6*u);
    const tx=r.x+sw+7*u, barH=Math.max(3,4*u), barY=r.y+r.h-barH-3*u;
    const fs=clamp((r.h-barH-4*u)*.75,9,14*u);
    ctx.textBaseline='middle'; ctx.textAlign='left';
    ctx.fillStyle=down?BCOLOR.dim:BCOLOR.text; bfont(fs,true);
    const ty=r.y+(barY-r.y)/2+1;
    ctx.fillText(m.name,tx,ty);
    let tags=[];
    if(m.defend) tags.push('DEF');
    if(m.boost) tags.push('ATK+'+m.boost);
    if(down) tags.push('DOWN');
    const nameW=ctx.measureText(m.name).width;
    bfont(fs*.75,false); ctx.fillStyle=BCOLOR.dim;
    if(tags.length) ctx.fillText(tags.join(' '),tx+nameW+6*u,ty);
    ctx.textAlign='right'; ctx.fillStyle=down?BCOLOR.dim:BCOLOR.text; bfont(fs,true);
    ctx.fillText(shown(m)+'/'+m.maxHp,r.x+r.w-4*u,ty);
    drawBar(tx,barY,r.x+r.w-4*u-tx,barH,shown(m)/m.maxHp,shown(m)/m.maxHp<.3);
  });
}

function drawResult(Lo) {
  const cx=game.LW/2, cy=game.LH/2, u=Lo.u, w=240*u, h=96*u;
  ctx.fillStyle='rgba(10,14,13,.6)'; ctx.fillRect(0,0,game.LW,game.LH);
  panel({x:cx-w/2,y:cy-h/2,w,h});
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle=BCOLOR.text; bfont(22*u,true);
  ctx.fillText(BATTLE.result==='win'?'VICTORY':'DEFEAT',cx,cy-14*u);
  bfont(10*u,false); ctx.fillStyle=BCOLOR.dim;
  ctx.fillText('Tap or press A to continue',cx,cy+20*u);
}

function drawBattle(time) {
  const Lo=battleLayout();
  drawField(Lo);
  BATTLE.foes.forEach((_,i)=>drawFoe(Lo,i));
  game.party.forEach((_,i)=>drawHero(Lo,i));
  drawCursors(Lo);
  drawPops(Lo);
  drawMessageBar(Lo);
  drawMenu(Lo);
  drawStatus(Lo);
  if(BATTLE.phase==='over') drawResult(Lo);
}
