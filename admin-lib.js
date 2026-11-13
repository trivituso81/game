'use strict';
// admin-lib.js: shared by the phone admin pages (art.html, heads.html, portraits.html, areas.html).
// One setup for all of them: the GitHub token and repo are saved on this phone by art.html under ffiv-gh-token and ffiv-repo. Nothing is written to the repo but game files.
const $=id=>document.getElementById(id);
const LS={get:k=>{try{return localStorage.getItem('ffiv-'+k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem('ffiv-'+k,v)}catch(e){}}};
function say(msg,err){ const s=$('status'); s.textContent=msg; s.className=err?'err':''; }
function ghHeaders(){ return {'Authorization':'Bearer '+LS.get('gh-token'),'Accept':'application/vnd.github+json','Content-Type':'application/json'}; }
function repoUrl(path){ return 'https://api.github.com/repos/'+LS.get('repo')+'/contents/'+path.split('/').map(encodeURIComponent).join('/'); }
async function ghGet(path){
  const r=await fetch(repoUrl(path)+'?ref=main&t='+Date.now(),{headers:ghHeaders()});
  if(r.status===404) return null;
  if(!r.ok) throw new Error('GitHub said '+r.status+' reading '+path);
  return r.json();
}
async function ghPut(path,b64,message){
  const cur=await ghGet(path);
  const body={message,content:b64,branch:'main'}; if(cur&&cur.sha) body.sha=cur.sha;
  const r=await fetch(repoUrl(path),{method:'PUT',headers:ghHeaders(),body:JSON.stringify(body)});
  if(!r.ok){ const t=await r.text(); throw new Error('GitHub said '+r.status+' writing '+path+': '+t.slice(0,160)); }
  return r.json();
}
const toB64=s=>btoa(unescape(encodeURIComponent(s)));
function blobToB64(blob){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(String(r.result).split(',')[1]); r.onerror=()=>rej(r.error); r.readAsDataURL(blob); }); }
async function readJson(path,fallback){
  const cur=await ghGet(path); if(!cur) return fallback;
  try{ return JSON.parse(decodeURIComponent(escape(atob(cur.content.replace(/\n/g,''))))); }catch(e){ return fallback; }
}
function needGh(){ if(!LS.get('gh-token')||!LS.get('repo')){ say('Enter the GitHub token and repo in Setup on the Art Library page first (one setup serves every admin page).',true); return false; } return true; }
async function testGh(){
  if(!needGh()) return;
  try{ const r=await fetch('https://api.github.com/repos/'+LS.get('repo'),{headers:ghHeaders()}); if(!r.ok) throw new Error('GitHub said '+r.status); const j=await r.json(); say('GitHub works. Push access: '+(j.permissions&&j.permissions.push?'yes':'NO, the token cannot write.'),!(j.permissions&&j.permissions.push)); }
  catch(e){ say(e.message,true); }
}
// Fetches a file of the live game by relative path (the Pages copy), bypassing the cache. Returns json or null.
async function siteJson(path){ try{ const r=await fetch(path+'?t='+Date.now(),{cache:'no-store'}); return r.ok?await r.json():null; }catch(e){ return null; } }
// Shared look for the admin pages.
const ADMIN_CSS=`*{box-sizing:border-box}
body{margin:0;background:#161d1b;color:#e2e8e4;font:15px/1.4 system-ui,-apple-system,sans-serif;padding:12px 12px 60px;max-width:640px;margin:0 auto}
h1{font-size:20px;margin:4px 0 4px}h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#9fb0a8;margin:18px 0 6px}
.box{background:#222c29;border-radius:10px;padding:10px;margin-bottom:10px}
label{display:block;font-size:12px;color:#9fb0a8;margin:8px 0 2px}
input,textarea,select{width:100%;background:#12181a;color:#e2e8e4;border:1px solid #3a4a45;border-radius:8px;padding:9px;font:inherit}
button{background:#3f5c54;color:#fff;border:0;border-radius:8px;padding:11px 14px;font:inherit;font-weight:600;margin:6px 6px 0 0}
button.alt{background:#2e3b37}button.go{background:#2f7a4f}button.no{background:#8a4040}button.on{outline:2px solid #6fb99d}button:disabled{opacity:.4}
.row{display:flex;gap:6px;flex-wrap:wrap}
#status{position:sticky;top:0;background:#0e1311;border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:13px;min-height:36px;z-index:2}
#status.err{color:#ffb4a8}.muted{color:#9fb0a8;font-size:12px}
.nav{font-size:12px;margin:0 0 8px}.nav a{color:#9fd6bf;margin-right:10px}`;
const ADMIN_NAV='<div class="nav"><a href="art.html">Art Library</a><a href="heads.html">Head Sizes</a><a href="portraits.html">Portraits</a><a href="areas.html">Areas</a><a href="index.html">Game</a></div>';
async function ghDelete(path,message){
  const cur=await ghGet(path); if(!cur) return false;
  const r=await fetch(repoUrl(path),{method:'DELETE',headers:ghHeaders(),body:JSON.stringify({message,sha:cur.sha,branch:'main'})});
  if(!r.ok){ const t=await r.text(); throw new Error('GitHub said '+r.status+' deleting '+path+': '+t.slice(0,160)); }
  return true;
}
