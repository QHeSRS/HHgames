/* HHgames offline engine v1.22.1. All pages and game assets saved on-device.
 * The offline-ready status is only shown once EVERY listed asset is cached.
 * This worker never caches room/relay network messages. */
const CACHE_NAME = "hhgames-v1.22.1-offline-20261123";
const ASSETS = ["./","./index.html","./style.css","./js/engine.js","./js/bot.js","./js/friends.js","./js/app.js","./js/offline.js","./assets/hh.svg","./assets/icon-192.png","./assets/icon-512.png","./manifest.webmanifest","./hh-theme.css","./hh-tractor.css","./hh-v06.css","./hh-v07.css","./hh-v08.css","./hh-v10.css","./hh-v12.css","./hh-v13.css","./hh-v14.css","./hh-v17.css","./hh-v19.css","./hh-v112.css","./hh-v115.css","./hh-v116.css","./hh-v117.css","./hh-v118.css","./hh-v120.css","./hh-v122.css","./assets/avatars/mr-q.webp","./assets/avatars/prof-wang.webp","./assets/avatars/hh-boy.webp","./assets/avatars/hh-girl.webp","./guandan/index.html","./guandan/sw.js","./guandan/manifest.webmanifest","./guandan/icon-192.png","./guandan/icon-512.png","./guandan/apple-touch-icon.png"];
const CORE = ["./","./index.html","./style.css","./js/engine.js","./js/bot.js","./js/friends.js","./js/app.js","./js/offline.js","./guandan/index.html"];
const assetURL = (s) => new URL(s,self.registration.scope).href;
const isRelay = (url) => /^\/(?:relay$|room\/)/.test(url.pathname);

async function cacheStatus() {
  const cache=await caches.open(CACHE_NAME);
  let complete=0,missing=[];
  for(const path of ASSETS){if(await cache.match(assetURL(path)))complete++;else missing.push(path);}
  return {cached:complete,total:ASSETS.length,ready:missing.length===0,missing};
}
async function downloadAssets(paths,client=null) {
  const cache=await caches.open(CACHE_NAME);
  const unique=Array.from(new Set(paths));
  let next=0,failed=[];
  async function worker(){
    while(next<unique.length){
      const path=unique[next++],url=assetURL(path);
      try {
        if(await cache.match(url)) continue;
        const response=await fetch(new Request(url,{cache:'reload'}));
        if(!response.ok || response.type==='opaque') throw new Error('HTTP '+response.status);
        await cache.put(url,response.clone());
      } catch(err){ failed.push(path+': '+String(err).slice(0,120)); }
    }
  }
  await Promise.all(Array.from({length:Math.min(4,unique.length)},worker));
  const s=await cacheStatus();
  if(client && client.postMessage) client.postMessage({type:'HH_OFFLINE_STATUS',...s,errors:failed.slice(0,5)});
  if(s.ready){
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('hhgames-')&&k!==CACHE_NAME).map(k=>caches.delete(k)));
  }
  return s;
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const s=await downloadAssets(CORE);
  const cache=await caches.open(CACHE_NAME);
  for(const path of CORE)if(!await cache.match(assetURL(path)))throw new Error('HHgames offline core asset missing: '+path);
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  // Retain any older working offline cache until this version is fully downloaded.
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{
  if(event.data?.type==='HH_PREPARE_OFFLINE'){
    event.waitUntil(downloadAssets(ASSETS,event.source));
  } else if(event.data?.type==='HH_CHECK_OFFLINE'){
    event.waitUntil(cacheStatus().then(s=>event.source?.postMessage({type:'HH_OFFLINE_STATUS',...s})));
  }
});
const cacheMatch=async(req)=>caches.match(req,{ignoreSearch:true});
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin||isRelay(url))return;
  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        // Online deployment updates remain fresh. If offline, use stored pages.
        const live=await fetch(req);
        if(live.ok){const copy=live.clone();event.waitUntil(caches.open(CACHE_NAME).then(c=>c.put(req,copy)));return live;}
      }catch(err){}
      const exact=await cacheMatch(req);
      if(exact)return exact;
      if(url.pathname.includes('/guandan')){
        const game=await cacheMatch(assetURL('./guandan/index.html'));
        if(game)return game;
      }
      const hub=await cacheMatch(assetURL('./index.html'));
      if(hub)return hub;
      return Response.error();
    })());
    return;
  }
  event.respondWith((async()=>{
    const hit=await cacheMatch(req);
    if(hit)return hit;
    try{
      const live=await fetch(req);
      if(live.ok)event.waitUntil(caches.open(CACHE_NAME).then(c=>c.put(req,live.clone())));
      return live;
    }catch(err){return Response.error();}
  })());
});
