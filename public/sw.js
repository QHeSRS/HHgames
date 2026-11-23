/* HHgames shared offline controller v1.22.3 (hub + Guandan).
 * Only actual files are in the 40-file manifest; a directory URL is an alias,
 * not a required download. All room/relay requests bypass this worker. */
const VERSION='1.22.3';
const CACHE_NAME='hhgames-v1.22.3-offline-20261123';
const ASSETS=["./","./index.html","./style.css","./js/engine.js","./js/bot.js","./js/friends.js","./js/app.js","./js/offline.js","./assets/hh.svg","./assets/icon-192.png","./assets/icon-512.png","./manifest.webmanifest","./hh-theme.css","./hh-tractor.css","./hh-v06.css","./hh-v07.css","./hh-v08.css","./hh-v10.css","./hh-v12.css","./hh-v13.css","./hh-v14.css","./hh-v17.css","./hh-v19.css","./hh-v112.css","./hh-v115.css","./hh-v116.css","./hh-v117.css","./hh-v118.css","./hh-v120.css","./hh-v122.css","./assets/avatars/mr-q.webp","./assets/avatars/prof-wang.webp","./assets/avatars/hh-boy.webp","./assets/avatars/hh-girl.webp","./guandan/index.html","./guandan/sw.js","./guandan/manifest.webmanifest","./guandan/icon-192.png","./guandan/icon-512.png","./guandan/apple-touch-icon.png"];
const CORE=['./index.html','./guandan/index.html','./style.css','./js/engine.js','./js/bot.js','./js/friends.js','./js/app.js','./js/offline.js'];
const urlFor=path=>new URL(path,self.registration.scope).href;
const isRelay=url=>/(?:^|\/)(?:relay|room)(?:\/|$)/.test(url.pathname);
const canonicalPage=url=>{
  const base=new URL(self.registration.scope);
  if(url.origin!==base.origin || !url.pathname.startsWith(base.pathname))return null;
  const tail=url.pathname.slice(base.pathname.length);
  if(!tail || tail==='index.html')return urlFor('./index.html');
  if(tail==='guandan' || tail==='guandan/' || tail==='guandan/index.html')return urlFor('./guandan/index.html');
  return null;
};
async function status(){
 const c=await caches.open(CACHE_NAME),missing=[];
 for(const p of ASSETS)if(!await c.match(urlFor(p)))missing.push(p);
 return {cached:ASSETS.length-missing.length,total:ASSETS.length,ready:missing.length===0,missing,version:VERSION};
}
function send(client,msg){try{client?.postMessage(msg)}catch(e){}}
async function download(paths,client){
 const c=await caches.open(CACHE_NAME),items=[...new Set(paths)];
 let next=0,done=0,errors=[];
 async function one(){
  while(next<items.length){
   const path=items[next++],u=urlFor(path);
   try{
    if(!await c.match(u)){
     // A direct asset URL is used so /guandan/ directory auto-indexing
     // cannot block installation on Cloudflare or GitHub Pages.
     const r=await fetch(new Request(u,{cache:'reload',credentials:'same-origin'}));
     if(!r.ok || r.type==='opaque')throw new Error('HTTP '+r.status);
     if(path.endsWith('.html')){
       const body=await r.clone().text();
       if(!/<!doctype html|<html\b/i.test(body))throw new Error('not HTML');
       if(path.includes('guandan/')&&!body.includes('newRound'))throw new Error('wrong Guandan page');
     }
     await c.put(u,r.clone());
    }
   }catch(e){errors.push(path+': '+String(e).slice(0,90));}
   done++;
   if(client&&(done%4===0||done===items.length))send(client,{type:'HH_OFFLINE_PROGRESS',done,totalJobs:items.length});
  }
 }
 await Promise.all(Array.from({length:Math.min(3,items.length)},one));
 let result=await status();
 result.errors=errors.slice(0,12);
 send(client,{type:'HH_OFFLINE_STATUS',...result});
 if(result.ready){
   // Keep any installed Guandan PWA data and other unrelated CacheStorage entries.
   const keys=await caches.keys();
   await Promise.all(keys.filter(k=>k.startsWith('hhgames-v') && k!==CACHE_NAME).map(k=>caches.delete(k)));
 }
 return result;
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 // A missing decorative file must never leave the old worker in charge.
 await download(CORE);
 const c=await caches.open(CACHE_NAME);
 for(const p of CORE)if(!await c.match(urlFor(p)))throw new Error('Required offline file missing '+p);
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
 const client=event.source;
 if(event.data?.type==='HH_PREPARE_OFFLINE')event.waitUntil(download(ASSETS,client));
 if(event.data?.type==='HH_CHECK_OFFLINE')event.waitUntil(status().then(s=>send(client,{type:'HH_OFFLINE_STATUS',...s})));
});
self.addEventListener('fetch',event=>{
 const req=event.request,u=new URL(req.url);
 if(req.method!=='GET'||u.origin!==self.location.origin||isRelay(u))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE_NAME);
  const page=req.mode==='navigate'?canonicalPage(u):null;
  // Cached pages launch instantly even with airplane mode enabled. In
  // particular, never call fetch() before checking the Guandan cache.
  let hit=page?await cache.match(page):await cache.match(req,{ignoreSearch:true});
  if(hit)return hit;
  // Upgrade migration: use an older cached route when the new version is
  // still downloading, but never declare offline-ready until all 40 are saved.
  hit=page?await caches.match(page,{ignoreSearch:true}):await caches.match(req,{ignoreSearch:true});
  if(hit)return hit;
  try{
   const fresh=await fetch(req);
   if(fresh.ok && fresh.type!=='opaque'){
     const key=page||req;
     event.waitUntil(cache.put(key,fresh.clone()).catch(()=>{}));
   }
   return fresh;
  }catch(e){return Response.error()}
 })());
});
