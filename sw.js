'use strict';
// sw.js: service worker for the game page only. It makes the game start with no network after one online visit and never holds back an update.
// Rules (docs/ARCHITECTURE.md, "Cache tags and the service worker"):
//   index.html           network first (never the browser's own cache), saved copy only when the network fails
//   engine/*.js?v=TAG    saved copy first; a tagged address never changes its content
//   art/...?v=TAG        saved copy first, kept after the first view; an older tag of the same picture is dropped
//   data/*.json          network first, saved copy only when the network fails
//   everything else      not touched: audio, admin pages, admin-lib.js, any address without a ?v= tag, other sites, anything that is not a GET
// SW_TAG must equal the ?v= tag on the script tags in index.html, and ENGINE must list the same files in the same order. tools/check_repo.py checks both.
const SW_TAG='1f';
const ENGINE=['world','audio','draw','battle','battle-draw','story','story-draw','main'];
const SHELL_CACHE='ffiv-shell-'+SW_TAG, DATA_CACHE='ffiv-data', ART_STORE='ffiv-art';
const SHELL=['index.html'].concat(ENGINE.map(n=>'engine/'+n+'.js?v='+SW_TAG));
const BASE=new URL('./',self.location.href);

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(SHELL_CACHE)
    .then(c=>Promise.all(SHELL.map(u=>fetch(new URL(u,BASE).href,{cache:'no-store'}).then(r=>{ if(!r.ok) throw new Error(u+' '+r.status); return c.put(new URL(u,BASE).href,r); }))))
    .then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k.startsWith('ffiv-shell-')&&k!==SHELL_CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});

async function networkFirst(req,cacheName,key) {
  const c=await caches.open(cacheName);
  try {
    const r=await fetch(req);
    if(r.ok) await c.put(key,r.clone());
    return r;
  } catch(err) {
    const hit=await c.match(key);
    if(hit) return hit;
    throw err;
  }
}
async function savedFirst(req,cacheName,dropOlder) {
  const hit=await caches.match(req.url);
  if(hit) return hit;
  const r=await fetch(req.url);
  if(r.ok) {
    const c=await caches.open(cacheName);
    if(dropOlder) { const old=await c.keys(req.url,{ignoreSearch:true}); await Promise.all(old.map(k=>c.delete(k))); }
    await c.put(req.url,r.clone());
  }
  return r;
}

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET'||req.headers.has('range')) return;
  const url=new URL(req.url);
  if(url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname)) return;
  const rel=url.pathname.slice(BASE.pathname.length), tagged=url.searchParams.has('v');
  if(rel===''||rel==='index.html') { e.respondWith(networkFirst(new Request(req.url,{cache:'no-store'}),SHELL_CACHE,new URL('index.html',BASE).href)); return; }
  if(rel.startsWith('engine/')&&tagged) { e.respondWith(savedFirst(req,SHELL_CACHE,false)); return; }
  if(rel.startsWith('art/')&&tagged) { e.respondWith(savedFirst(req,ART_STORE,true)); return; }
  if(rel.startsWith('data/')&&rel.endsWith('.json')) { e.respondWith(networkFirst(req,DATA_CACHE,url.origin+url.pathname)); return; }
});
