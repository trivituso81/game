'use strict';
// engine/world.js: Build 1d.1 placeholder world plus installed areas (engine/areas-data.js, written by tools/install_area.py). Three grey areas, each with a walk mask, portals and (field only) grey fights. No names, no art.
// Walk mask legend: '#' blocked, '.' walkable, 'D' door (walk onto it to go in), 'M' mat (walk onto it to go out),
// 'E' edge (walk onto it to go on to the next area), 'L' locked door (a door that is a wall until its flag is set).
// Doors, mats, edges and locked doors are portals; each portal says where it leads. Triggers (not drawn in the mask) start a scene.
const T=16;                                             // logical pixels per tile
const MOVE_TIME=0.13;                                   // seconds per tile step
const PORTAL_CHARS='DMEL';

function makeGrid(w,h,fill){ return Array.from({length:h},()=>Array(w).fill(fill)); }
function stamp(g,x,y,rows){ rows.forEach((r,j)=>[...r].forEach((c,i)=>{ if(c!==' ') g[y+j][x+i]=c; })); }

// Builds one area: a walled rectangle, the stamped shapes, and the portal table keyed by "x,y".
function boxedArea(id,name,w,h,opts) {
  const g=makeGrid(w,h,'.');
  for(let x=0;x<w;x++) { g[0][x]='#'; g[h-1][x]='#'; }
  for(let y=0;y<h;y++) { g[y][0]='#'; g[y][w-1]='#'; }
  for(const s of opts.stamps) stamp(g,s.x,s.y,s.rows);
  const portals=new Map();
  for(const p of opts.portals) portals.set(p.x+','+p.y,{to:p.to,spawn:p.spawn});
  const monsters=(opts.monsters||[]).map(m=>({id:m.id,kind:m.kind,x:m.x,y:m.y,alive:true}));
  const triggers=new Map(), locks=new Map();
  for(const t of (opts.triggers||[])) triggers.set(t.x+','+t.y,t.scene);
  for(const l of (opts.locks||[])) locks.set(l.x+','+l.y,l.flag);
  return {id,name,w,h,grid:g,portals,monsters,triggers,locks,spawn:opts.spawn,indoor:!!opts.indoor};
}

const AREAS={
  town:boxedArea('town','TOWN A',22,40,{
    stamps:[
      {x:3,y:3,rows:['#####','#####','##D##']},          // house with a door
      {x:14,y:3,rows:['#####','#####','##L##']},          // house with a locked door (opens when the flag door-open is set)
      {x:3,y:15,rows:['####','####','####']},             // pond
      {x:9,y:26,rows:['###','###']},                      // fence block
      {x:20,y:20,rows:['E']}                              // east edge
    ],
    portals:[
      {x:5,y:5,to:'room',spawn:{x:5,y:6}},
      {x:16,y:5,to:'roomb',spawn:{x:5,y:6}},
      {x:20,y:20,to:'field',spawn:{x:2,y:20}}
    ],
    locks:[{x:16,y:5,flag:'door-open'}],
    triggers:[{x:15,y:30,scene:'opening'}],
    spawn:{x:10,y:31}
  }),
  field:boxedArea('field','FIELD B',22,40,{
    stamps:[
      {x:8,y:8,rows:['###','###']},
      {x:14,y:24,rows:['####','####']},
      {x:1,y:20,rows:['E']}                               // west edge back to town
    ],
    portals:[{x:1,y:20,to:'town',spawn:{x:19,y:20}}],
    monsters:[
      {id:'field-monster',kind:'monster',x:14,y:14},   // test fight: a grey monster
      {id:'field-boss',kind:'boss',x:18,y:34}          // a grey boss with a shield
    ],
    spawn:{x:2,y:20}
  }),
  room:boxedArea('room','ROOM A',10,8,{
    indoor:true,
    stamps:[
      {x:2,y:2,rows:['###']},                             // table
      {x:5,y:7,rows:['M']}                                // mat by the door
    ],
    portals:[{x:5,y:7,to:'town',spawn:{x:5,y:6}}],
    spawn:{x:5,y:6}
  }),
  roomb:boxedArea('roomb','ROOM B',10,8,{
    indoor:true,
    stamps:[{x:5,y:7,rows:['M']}],
    portals:[{x:5,y:7,to:'town',spawn:{x:16,y:6}}],
    triggers:[{x:5,y:3,scene:'closeups'}],
    spawn:{x:5,y:6}
  })
};

// Areas written by tools/install_area.py. Each has an explicit mask (rows of the legend above) and a picture path (area.art).
function areaFromData(d) {
  const g=d.mask.map(r=>[...r]);
  const portals=new Map(), triggers=new Map(), locks=new Map();
  for(const p of (d.portals||[])) portals.set(p.x+','+p.y,{to:p.to,spawn:p.spawn});
  for(const t of (d.triggers||[])) triggers.set(t.x+','+t.y,t.scene);
  for(const l of (d.locks||[])) locks.set(l.x+','+l.y,l.flag);
  const monsters=(d.monsters||[]).map(m=>({id:m.id,kind:m.kind,x:m.x,y:m.y,alive:true}));
  return {id:d.id,name:d.name,w:g[0].length,h:g.length,grid:g,portals,monsters,triggers,locks,spawn:d.spawn,indoor:!!d.indoor,art:d.art||null};
}
for(const d of INSTALLED_AREAS) AREAS[d.id]=areaFromData(d);

function inside(area,x,y) { return x>=0&&y>=0&&x<area.w&&y<area.h; }
function lockOpen(area,x,y) { const f=area.locks.get(x+','+y); return !!(f&&STORY.flags[f]); }
function walkable(area,x,y) {
  if(!inside(area,x,y)) return false;
  const c=area.grid[y][x];
  return c==='L'?lockOpen(area,x,y):c!=='#';
}
// A new chapter starts with every fight standing again.
function resetWorld() { for(const id in AREAS) AREAS[id].monsters.forEach(m=>{ m.alive=true; }); }
function portalAt(area,x,y) { return area.portals.get(x+','+y)||null; }
// The live fight standing on a tile, if any. Defeated monsters stay in the list with alive false, so they do not come back.
function monsterAt(area,x,y) { return area.monsters.find(m=>m.alive&&m.x===x&&m.y===y)||null; }

// Checks the world tables. Returns a list of problems (empty when the world is sound).
function validateWorld() {
  const out=[];
  for(const id in AREAS) {
    const a=AREAS[id];
    for(let y=0;y<a.h;y++) for(let x=0;x<a.w;x++) {
      const c=a.grid[y][x], k=x+','+y, p=a.portals.get(k);
      if(PORTAL_CHARS.includes(c)&&!p) out.push(id+' '+k+' '+c+' has no portal entry');
      if(p&&!PORTAL_CHARS.includes(c)) out.push(id+' '+k+' portal entry on a '+c+' tile');
      if(c==='L'&&!a.locks.has(k)) out.push(id+' '+k+' locked door has no lock entry');
    }
    for(const [k,f] of a.locks) if(!f) out.push(id+' '+k+' lock has no flag');
    for(const [k,sc] of a.triggers) {
      const [tx,ty]=k.split(',').map(Number);
      if(!walkable(a,tx,ty)) out.push(id+' '+k+' trigger is not on a walkable tile');
      if(!SCENES[sc]) out.push(id+' '+k+' trigger names unknown scene '+sc);
    }
    for(const [k,p] of a.portals) {
      const t=AREAS[p.to];
      if(!t) out.push(id+' '+k+' leads to unknown area '+p.to);
      else if(!walkable(t,p.spawn.x,p.spawn.y)) out.push(id+' '+k+' spawn blocked in '+p.to);
    }
    if(!walkable(a,a.spawn.x,a.spawn.y)) out.push(id+' spawn blocked');
    for(const m of a.monsters) {
      if(!walkable(a,m.x,m.y)) out.push(id+' '+m.id+' stands on a wall');
      if(!ENEMY_TYPES[m.kind]) out.push(id+' '+m.id+' has an unknown kind '+m.kind);
    }
  }
  return out;
}

// Shortest walk from (sx,sy) to (gx,gy). Portals are walls except the goal itself, so a walk never leaves an area by accident.
// Returns the tiles to step on in order (start excluded), or null when there is no way.
function findPath(area,sx,sy,gx,gy) {
  if(sx===gx&&sy===gy) return [];
  const prev=new Map(), start=sx+','+sy, goal=gx+','+gy;
  const queue=[{x:sx,y:sy}];
  prev.set(start,null);
  for(let qi=0;qi<queue.length;qi++) {
    const cur=queue[qi];
    for(const d of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]) {
      const nx=cur.x+d.x, ny=cur.y+d.y, k=nx+','+ny;
      if(prev.has(k)||!walkable(area,nx,ny)) continue;
      if(portalAt(area,nx,ny)&&k!==goal) continue;
      prev.set(k,cur.x+','+cur.y);
      if(k===goal) {
        const path=[];
        let at=k;
        while(at!==start) { const [px,py]=at.split(',').map(Number); path.unshift({x:px,y:py}); at=prev.get(at); }
        return path;
      }
      queue.push({x:nx,y:ny});
    }
  }
  return null;
}
