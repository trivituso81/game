'use strict';
// engine/areacheck.js: the area spec check, in JavaScript, for the Area editor (areas.html). It is a port of check() in tools/install_area.py
// and of validateWorld() in engine/world.js; tools/test_tools.py runs the same specs through the Python and the JavaScript version and compares.
// env: {ids: every area id a portal may lead to (built-in plus installed), scenes: scene names or null to skip that check,
//       kinds: allowed monster kinds, maskOf: optional function id -> mask rows, used to check a portal's arrival tile}
const AREA_LEGEND='#.DMEL', AREA_PORTAL_CHARS='DMEL';
function checkAreaSpec(spec,env) {
  const out=[], rows=spec.mask||[];
  if(!/^[a-z0-9-]+$/.test(String(spec.id||''))||spec.id==='index') out.push('id must be made of a-z, 0-9 and dashes, and cannot be "index"');
  if(!rows.length) return out.concat(['mask is empty']);
  const w=rows[0].length;
  rows.forEach((r,i)=>{
    if(r.length!==w) out.push('mask row '+i+' has width '+r.length+', expected '+w);
    for(const c of r) if(!AREA_LEGEND.includes(c)) out.push('mask row '+i+' has unknown character '+JSON.stringify(c));
  });
  if(out.some(o=>o.startsWith('mask'))) return out;
  const h=rows.length, ids=new Set([...env.ids,spec.id]);
  const walk=(x,y)=>x>=0&&x<w&&y>=0&&y<h&&rows[y][x]!=='#';
  const portals=new Map((spec.portals||[]).map(p=>[p.x+','+p.y,p]));
  const locks=new Map((spec.locks||[]).map(l=>[l.x+','+l.y,l.flag]));
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
    const c=rows[y][x], k=x+','+y;
    if(AREA_PORTAL_CHARS.includes(c)&&!portals.has(k)) out.push(k+' '+c+' has no portal entry');
    if(c==='L'&&!locks.has(k)) out.push(k+' locked door has no lock entry');
  }
  for(const [k,p] of portals) {
    const [x,y]=k.split(',').map(Number);
    if(!(x>=0&&x<w&&y>=0&&y<h)||!AREA_PORTAL_CHARS.includes(rows[y][x])) out.push('portal at '+k+' is not on a door, mat, edge or locked door tile');
    if(!ids.has(p.to)) out.push('portal at '+k+' leads to unknown area '+p.to);
    else if(env.maskOf) {
      const m=p.to===spec.id?rows:env.maskOf(p.to), sp=p.spawn||{};
      if(m&&!(sp.y>=0&&sp.y<m.length&&sp.x>=0&&sp.x<m[0].length&&m[sp.y][sp.x]!=='#')) out.push('portal at '+k+' arrives on a blocked tile in '+p.to);
    }
  }
  for(const [k,f] of locks) if(!f) out.push('lock at '+k+' has no flag');
  for(const t of (spec.triggers||[])) {
    if(!walk(t.x,t.y)) out.push('trigger at '+t.x+','+t.y+' is not on a walkable tile');
    if(env.scenes&&env.scenes.length&&!env.scenes.includes(t.scene)) out.push('trigger at '+t.x+','+t.y+' names unknown scene '+t.scene);
  }
  const s=spec.spawn||{};
  if(!walk(s.x===undefined?-1:s.x,s.y===undefined?-1:s.y)) out.push('spawn is blocked');
  for(const m of (spec.monsters||[])) {
    if(!walk(m.x,m.y)) out.push(m.id+' stands on a wall');
    if(!env.kinds.includes(m.kind)) out.push(m.id+' has unknown kind '+m.kind);
  }
  return out;
}
