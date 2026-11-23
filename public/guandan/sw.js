/* HHgames v1.22.2 legacy Guandan compatibility worker.
 * The main /sw.js now owns all pages. This one only keeps older installed
 * Guandan shortcuts working until the old nested registration is removed. */
const CACHE='guandan-hhgames-v1.22.2-migrate';
const FILES=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install',e=>e.waitUntil((async()=>{
  const c=await caches.open(CACHE);
  await Promise.all(FILES.map(async p=>{
    try{const u=new URL(p,self.registration.scope).href;const r=await fetch(u);if(r.ok)await c.put(u,r.clone());}catch(e){}
  }));
  await self.skipWaiting();
})()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
  const req=e.request,u=new URL(req.url);
  if(req.method!=='GET'||u.origin!==location.origin||/(?:^|\/)(?:relay|room)(?:\/|$)/.test(u.pathname))return;
  e.respondWith((async()=>{
    let cached=await caches.match(req,{ignoreSearch:true});
    if(!cached && req.mode==='navigate')cached=await caches.match(new URL('./index.html',self.registration.scope).href);
    if(cached)return cached;
    try {const r=await fetch(req);if(r.ok) e.waitUntil(caches.open(CACHE).then(c=>c.put(req,r.clone())));return r;}
    catch(err){return Response.error();}
  })());
});
