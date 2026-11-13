'use strict';
// engine/world.js: Build 1a placeholder world. Three grey areas, each with a walk mask and portals. No names, no art.
// Walk mask legend: '#' blocked, '.' walkable, 'D' door (walk onto it to go in), 'M' mat (walk onto it to go out),
// 'E' edge (walk onto it to go on to the next area). Doors, mats and edges are portals; each portal says where it leads.
const T=16;                                             // logical pixels per tile
const MOVE_TIME=0.13;                                   // seconds per tile step
const PORTAL_CHARS='DME';

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
  return {id,name,w,h,grid:g,portals,spawn:opts.spawn,indoor:!!opts.indoor};
}

const AREAS={
  town:boxedArea('town','TOWN A',22,40,{
    stamps:[
      {x:3,y:3,rows:['#####','#####','##D##']},          // house with a door
      {x:14,y:3,rows:['#####','#####','#####']},          // house without one
      {x:3,y:15,rows:['####','####','####']},             // pond
      {x:9,y:26,rows:['###','###']},                      // fence block
      {x:20,y:20,rows:['E']}                              // east edge
    ],
    portals:[
      {x:5,y:5,to:'room',spawn:{x:5,y:6}},
      {x:20,y:20,to:'field',spawn:{x:2,y:20}}
    ],
    spawn:{x:10,y:31}
  }),
  field:boxedArea('field','FIELD B',22,40,{
    stamps:[
      {x:8,y:8,rows:['###','###']},
      {x:14,y:24,rows:['####','####']},
      {x:1,y:20,rows:['E']}                               // west edge back to town
    ],
    portals:[{x:1,y:20,to:'town',spawn:{x:19,y:20}}],
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
  })
};

function inside(area,x,y) { return x>=0&&y>=0&&x<area.w&&y<area.h; }
function walkable(area,x,y) { return inside(area,x,y)&&area.grid[y][x]!=='#'; }
function portalAt(area,x,y) { return area.portals.get(x+','+y)||null; }

// Checks the world tables. Returns a list of problems (empty when the world is sound).
function validateWorld() {
  const out=[];
  for(const id in AREAS) {
    const a=AREAS[id];
    for(let y=0;y<a.h;y++) for(let x=0;x<a.w;x++) {
      const c=a.grid[y][x], k=x+','+y, p=a.portals.get(k);
      if(PORTAL_CHARS.includes(c)&&!p) out.push(id+' '+k+' '+c+' has no portal entry');
      if(p&&!PORTAL_CHARS.includes(c)) out.push(id+' '+k+' portal entry on a '+c+' tile');
    }
    for(const [k,p] of a.portals) {
      const t=AREAS[p.to];
      if(!t) out.push(id+' '+k+' leads to unknown area '+p.to);
      else if(!walkable(t,p.spawn.x,p.spawn.y)) out.push(id+' '+k+' spawn blocked in '+p.to);
    }
    if(!walkable(a,a.spawn.x,a.spawn.y)) out.push(id+' spawn blocked');
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
