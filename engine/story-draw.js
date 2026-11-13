'use strict';
// engine/story-draw.js: Build 1c drawing for the story screens. Chapter select, title and end cards, the objective line,
// the speech box, and the four close-ups. Every screen fills the window; the D-pad and A overlay it (nothing is reserved).
const SCOLOR={bg:'#1b2321',card:'#3b4541',cardTop:'#8f8f8f',text:'#eef3ef',dim:'#8c9692',hot:'#e8e3c8',object:'#b5b0a4',slot:'#2c3532',dimmer:'rgba(10,14,13,.74)'};

function wrapText(text,maxW) {
  const words=text.split(' '), lines=[];
  let line='';
  for(const w of words) {
    const test=line?line+' '+w:w;
    if(line&&ctx.measureText(test).width>maxW) { lines.push(line); line=w; } else line=test;
  }
  if(line) lines.push(line);
  return lines;
}

// ---------- Chapter select ----------
function chapterRects() {
  const w=Math.min(320,game.LW-32), x=(game.LW-w)/2, top=game.LH/2-60;
  return CHAPTERS.map((c,i)=>({x,y:top+i*76,w,h:64,n:c.n}));
}
function chapterTap(px,py) {
  const hit=chapterRects().find(r=>px>=r.x&&px<=r.x+r.w&&py>=r.y&&py<=r.y+r.h);
  if(hit) startChapter(hit.n);
}
function chapterConfirm() { startChapter(CHAPTERS[game.chapterCursor].n); }
function drawChapters() {
  ctx.fillStyle=SCOLOR.bg; ctx.fillRect(0,0,game.LW,game.LH);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle=SCOLOR.text; ctx.font='bold 16px monospace';
  ctx.fillText('CHAPTER SELECT',game.LW/2,game.LH/2-92);
  chapterRects().forEach((r,i)=>{
    const done=!!STORY.done[r.n], on=i===game.chapterCursor;
    ctx.fillStyle=SCOLOR.card; ctx.fillRect(r.x,r.y,r.w,r.h);
    ctx.fillStyle=on?SCOLOR.hot:SCOLOR.cardTop; ctx.fillRect(r.x,r.y,r.w,on?4:2);
    ctx.textAlign='left'; ctx.fillStyle=SCOLOR.text; ctx.font='bold 14px monospace';
    ctx.fillText(r.n+'  '+CHAPTERS[i].title,r.x+14,r.y+24);
    ctx.font='10px monospace'; ctx.fillStyle=SCOLOR.dim;
    ctx.fillText(CHAPTERS[i].blurb,r.x+14,r.y+46);
    ctx.textAlign='right'; ctx.font='bold 11px monospace'; ctx.fillStyle=done?SCOLOR.hot:SCOLOR.dim;
    ctx.fillText(done?'DONE':'NEW',r.x+r.w-14,r.y+24);
  });
  ctx.textAlign='center'; ctx.font='10px monospace'; ctx.fillStyle=SCOLOR.dim;
  ctx.fillText('Press A or tap a chapter to start',game.LW/2,game.LH/2+50);
}

// ---------- Cards ----------
function drawCard() {
  const c=game.card; if(!c) return;
  const cx=game.LW/2, cy=game.LH/2;
  ctx.fillStyle='#161d1b'; ctx.fillRect(0,0,game.LW,game.LH);
  ctx.fillStyle=SCOLOR.cardTop; ctx.fillRect(cx-60,cy-44,120,3);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle=SCOLOR.dim; ctx.font='bold 12px monospace'; ctx.fillText(c.lines[0],cx,cy-28);
  ctx.fillStyle=SCOLOR.text; ctx.font='bold 24px monospace'; ctx.fillText(c.lines[1],cx,cy+2);
  ctx.fillStyle=SCOLOR.dim; ctx.font='10px monospace'; ctx.fillText(c.lines[2]||'',cx,cy+34);
  ctx.fillStyle=SCOLOR.cardTop; ctx.fillRect(cx-60,cy+50,120,3);
}

// ---------- Objective and speech ----------
function drawObjective() {
  if(!STORY.objective) return;
  ctx.font='bold 9px monospace'; ctx.textAlign='left'; ctx.textBaseline='top';
  const label='GOAL: '+STORY.objective, w=Math.min(game.LW-12,ctx.measureText(label).width+12);
  ctx.fillStyle='rgba(12,18,16,.7)'; ctx.fillRect(6,26,w,14);
  ctx.fillStyle=SCOLOR.hot; ctx.fillText(label,12,29);
}
function drawSay() {
  const s=game.scene; if(!s||!s.say) return;
  const bw=game.LW-16, x=8, y=48;
  ctx.font='11px monospace';
  const lines=wrapText(s.say.text,bw-20), h=lines.length*14+30;
  ctx.fillStyle='rgba(20,28,26,.94)'; ctx.fillRect(x,y,bw,h);
  ctx.fillStyle=SCOLOR.cardTop; ctx.fillRect(x,y,bw,3);
  const a=sceneActor(s.say.who), name=s.say.who==='hero'?'HERO':a?a.label:'';
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillStyle=SCOLOR.hot; ctx.font='bold 10px monospace'; ctx.fillText(name,x+10,y+8);
  ctx.fillStyle=SCOLOR.text; ctx.font='11px monospace';
  lines.forEach((l,i)=>ctx.fillText(l,x+10,y+22+i*14));
  ctx.textAlign='right'; ctx.fillStyle=SCOLOR.dim; ctx.font='9px monospace';
  ctx.fillText('A',x+bw-8,y+h-12);
}

// ---------- Close-ups ----------
const ease=u=>u<0?0:u>1?1:u*u*(3-2*u);
function closeupRects() {
  const w=Math.min(320,game.LW-20), h=Math.min(250,game.LH-130);
  const x=(game.LW-w)/2, y=(game.LH-h)/2;
  const c=CLOSEUP, n=c?c.tray.length:0, tw=44, gap=10;
  const trayX0=x+(w-(n*tw+(n-1)*gap))/2;
  return {plate:{x,y,w,h}, tray:Array.from({length:n},(_,i)=>({x:trayX0+i*(tw+gap),y:y+h-98,s:tw})),
          slots:Array.from({length:3},(_,i)=>({x:x+(w-(3*tw+2*gap))/2+i*(tw+gap),y:y+60,s:tw}))};
}
function closeupTap(px,py) {
  const c=CLOSEUP; if(!c) return;
  if(c.mode==='ORDERED'&&!c.ready) {
    const R=closeupRects(), i=R.tray.findIndex(t=>px>=t.x&&px<=t.x+t.s&&py>=t.y&&py<=t.y+t.s);
    if(i>=0) { c.cursor=i; closeupPlace(); }
    return;
  }
  closeupConfirm();
}
function drawToken(x,y,s,label,hot) {
  ctx.fillStyle=SCOLOR.object; ctx.fillRect(x,y,s,s);
  if(hot) { ctx.strokeStyle=SCOLOR.hot; ctx.lineWidth=3; ctx.strokeRect(x-2,y-2,s+4,s+4); }
  ctx.fillStyle='#2a2e2c'; ctx.font='bold 16px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(label,x+s/2,y+s/2+1);
}
function drawCloseup() {
  const c=CLOSEUP; if(!c) return;
  const R=closeupRects(), P=R.plate, cx=P.x+P.w/2, cy=P.y+P.h/2;
  ctx.fillStyle=SCOLOR.dimmer; ctx.fillRect(0,0,game.LW,game.LH);
  ctx.fillStyle=SCOLOR.card; ctx.fillRect(P.x,P.y,P.w,P.h);
  ctx.fillStyle=SCOLOR.cardTop; ctx.fillRect(P.x,P.y,P.w,4);
  ctx.textAlign='left'; ctx.textBaseline='top'; ctx.fillStyle=SCOLOR.text; ctx.font='bold 12px monospace';
  ctx.fillText(c.mode,P.x+12,P.y+14);
  let caption='';
  if(c.mode==='REVEAL') {
    const s=Math.min(P.w,P.h)*.5*(0.4+0.6*ease(c.t/.5));
    ctx.fillStyle=SCOLOR.object; ctx.fillRect(cx-s/2,cy-s/2+6,s,s);
    ctx.fillStyle='#2a2e2c'; ctx.font='bold 12px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('OBJECT',cx,cy+6);
    caption='One object, shown large.';
  } else if(c.mode==='WATCH') {
    const u=ease(c.t/WATCH_TIME), x0=P.x+44, x1=P.x+P.w-44, px=x0+(x1-x0)*u;
    ctx.fillStyle=SCOLOR.slot; ctx.fillRect(P.x+24,cy+22,P.w-48,6);
    ctx.fillStyle=SCOLOR.cardTop; ctx.fillRect(P.x+24,cy+22,(P.w-48)*u,6);
    ctx.save(); ctx.translate(px,cy-14); ctx.rotate(u*Math.PI*2);
    ctx.fillStyle=SCOLOR.object; ctx.fillRect(-18,-18,36,36); ctx.restore();
    caption=c.t<WATCH_TIME?'It plays once.':'It played once.';
  } else if(c.mode==='PLACE') {
    const sx=cx-24, sy=cy+30, u=ease(c.t/PLACE_TIME), landed=c.t>=PLACE_TIME;
    ctx.fillStyle=landed?SCOLOR.hot:SCOLOR.slot; ctx.fillRect(sx,sy,48,48);
    ctx.strokeStyle=SCOLOR.cardTop; ctx.lineWidth=2; ctx.strokeRect(sx,sy,48,48);
    const oy=(P.y+44)+(sy-(P.y+44))*u;
    ctx.fillStyle=SCOLOR.object; ctx.fillRect(sx+2,oy+2-(landed?0:0),44,44);
    caption=landed?'Placed. The spot lights up.':'The object lowers onto the spot.';
  } else {
    R.slots.forEach((s,i)=>{
      ctx.fillStyle=SCOLOR.slot; ctx.fillRect(s.x,s.y,s.s,s.s);
      ctx.strokeStyle=SCOLOR.cardTop; ctx.lineWidth=2; ctx.strokeRect(s.x,s.y,s.s,s.s);
      if(c.slots[i]) drawToken(s.x,s.y,s.s,c.slots[i],false);
      else { ctx.fillStyle=SCOLOR.dim; ctx.font='bold 14px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(ORDERED_ANSWER[i],s.x+s.s/2,s.y+s.s/2); }
    });
    R.tray.forEach((t,i)=>drawToken(t.x,t.y,t.s,c.tray[i],!c.ready&&i===c.cursor));
    caption=c.ready?'In order.':c.msgT>0?c.msg:'Put A, B, C in order. LEFT, RIGHT, then A.';
  }
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=SCOLOR.dim; ctx.font='10px monospace';
  ctx.fillText(caption,cx,P.y+P.h-34);
  ctx.fillStyle=c.ready?SCOLOR.hot:SCOLOR.dim; ctx.font='bold 10px monospace';
  ctx.fillText(c.ready?'Press A to go on':'',cx,P.y+P.h-16);
}
