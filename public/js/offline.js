/* HHgames v1.22.3 offline setup, verified against the same manifest as sw.js. */
(()=>{'use strict';
const VERSION='1.22.3',CACHE_NAME='hhgames-v1.22.3-offline-20261123',FILES=["./","./index.html","./style.css","./js/engine.js","./js/bot.js","./js/friends.js","./js/app.js","./js/offline.js","./assets/hh.svg","./assets/icon-192.png","./assets/icon-512.png","./manifest.webmanifest","./hh-theme.css","./hh-tractor.css","./hh-v06.css","./hh-v07.css","./hh-v08.css","./hh-v10.css","./hh-v12.css","./hh-v13.css","./hh-v14.css","./hh-v17.css","./hh-v19.css","./hh-v112.css","./hh-v115.css","./hh-v116.css","./hh-v117.css","./hh-v118.css","./hh-v120.css","./hh-v122.css","./assets/avatars/mr-q.webp","./assets/avatars/prof-wang.webp","./assets/avatars/hh-boy.webp","./assets/avatars/hh-girl.webp","./guandan/index.html","./guandan/sw.js","./guandan/manifest.webmanifest","./guandan/icon-192.png","./guandan/icon-512.png","./guandan/apple-touch-icon.png"];
const panel=document.getElementById('offlineInstallPanel'),button=document.getElementById('offlinePrepareBtn'),display=document.getElementById('offlineInstallStatus');
if(!panel||!button||!display)return;
const zh=(navigator.language||'').toLowerCase().startsWith('zh');
const say=(cn,en)=>zh?cn:en;
const scopeURL=new URL('./',document.baseURI);
let busy=false,timer=null,lastProblem='';
const report=(state,msg)=>{panel.dataset.state=state;display.textContent=msg;};
const workerVersion=w=>{try{return new URL(w?.scriptURL||'').searchParams.get('v')}catch(e){return null}};
async function localStatus(){
  const c=await caches.open(CACHE_NAME),missing=[];
  for(const p of FILES)if(!await c.match(new URL(p,scopeURL)))missing.push(p);
  return {cached:FILES.length-missing.length,total:FILES.length,ready:!missing.length,missing};
}
async function displayStatus(s){
  if(!s)return;
  if(s.ready){
    const active=await navigator.serviceWorker.getRegistration(scopeURL.href);
    const current=workerVersion(navigator.serviceWorker.controller)===VERSION && workerVersion(active?.active)===VERSION;
    if(current){
      report('ready',say('✓ 离线可用：'+s.cached+'/'+s.total+' 个文件已保存。关闭 Wi-Fi 后也可启动游戏。',
        '✓ Offline ready: '+s.cached+'/'+s.total+' files saved. You can launch with Wi-Fi off.'));
    }else{
      report('partial',say('所有文件已保存，但新离线程序尚未接管。请保持联网刷新网页一次。',
        'All files cached; reload once online so the new offline controller takes over.'));
    }
    return;
  }
  const first=(s.errors?.[0]||s.missing?.[0]||'');
  const detail=first?' · '+first:'';
  report('partial',say('离线缓存未完成：'+s.cached+'/'+s.total+'。缺少 '+(s.total-s.cached)+' 个文件'+detail+'。保持联网点击「下载」。',
    'Offline incomplete: '+s.cached+'/'+s.total+'; '+(s.total-s.cached)+' missing'+detail+'. Stay online and click Download.'));
}
async function unregisterLegacy(){
  try{
    const inner=new URL('./guandan/',scopeURL);
    const r=await navigator.serviceWorker.getRegistration(inner.href);
    if(r&&r.scope===inner.href)await r.unregister();
  }catch(e){}
}
async function setupWorker(){
  if(!('serviceWorker' in navigator)||!('caches' in window))throw Error('Service workers/CacheStorage unavailable');
  if(location.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(location.hostname))throw Error('Use the HTTPS website');
  await unregisterLegacy();
  const reg=await navigator.serviceWorker.register('./sw.js?v='+VERSION,{scope:'./',updateViaCache:'none'});
  if(workerVersion(reg.active)!==VERSION){
    await Promise.race([new Promise((resolve,reject)=>{
       const t=setTimeout(()=>reject(Error('Offline worker update timed out')),18000);
       const check=()=>{if(workerVersion(reg.active)===VERSION){clearTimeout(t);reg.removeEventListener('updatefound',check);resolve();}};
       check();reg.addEventListener('updatefound',check);
       const installing=reg.installing||reg.waiting;
       installing?.addEventListener('statechange',check);
       navigator.serviceWorker.addEventListener('controllerchange',check,{once:true});
       const poll=setInterval(()=>{if(workerVersion(reg.active)===VERSION){clearInterval(poll);check();}},250);
       setTimeout(()=>clearInterval(poll),18500);
    }),navigator.serviceWorker.ready]);
    if(workerVersion(reg.active)!==VERSION){
      // navigator.serviceWorker.ready may refer to an old controller; wait for
      // the new one rather than posting to an outdated manifest.
      let i=0;while(i++<65&&workerVersion(reg.active)!==VERSION)await new Promise(r=>setTimeout(r,200));
    }
  }
  if(workerVersion(reg.active)!==VERSION)throw Error('New offline worker not active; refresh online');
  return reg.active;
}
async function refresh(){try{await displayStatus(await localStatus())}catch(e){report('error',String(e))}}
function setIdle(){busy=false;button.disabled=false;if(timer){clearTimeout(timer);timer=null}}
async function prepare(){
 if(busy||location.protocol==='file:')return;
 busy=true;button.disabled=true;lastProblem='';
 report('loading',say('下载离线文件中…请保持联网','Downloading offline files… Keep Wi-Fi on'));
 try{
   const sw=await setupWorker();
   const s=await localStatus();
   if(s.ready){setIdle();await displayStatus(s);return;}
   sw.postMessage({type:'HH_PREPARE_OFFLINE'});
   timer=setTimeout(async()=>{setIdle();await refresh();},60000);
 }catch(e){setIdle();lastProblem=String(e);report('error',say('离线程序安装失败：','Offline installation failed: ')+lastProblem)}
}
function message(ev){
 const s=ev.data;
 if(s?.type==='HH_OFFLINE_PROGRESS'&&busy){
  report('loading',say('正在缓存游戏：'+s.done+'/'+s.totalJobs+' 文件…','Caching games: '+s.done+'/'+s.totalJobs+' files…'));
 } else if(s?.type==='HH_OFFLINE_STATUS'){
  setIdle();displayStatus(s);
 }
}
button.addEventListener('click',prepare);
if(location.protocol==='file:'){panel.classList.add('hidden');return}
if(!('serviceWorker' in navigator)||!('caches' in window)){
 report('error',say('此浏览器无法安装离线网站','Browser cannot install this offline website'));button.disabled=true;return;
}
navigator.serviceWorker.addEventListener('message',message);
navigator.serviceWorker.addEventListener('controllerchange',refresh);
window.addEventListener('online',refresh);
window.addEventListener('offline',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
async function start(){
 await refresh();
 try{
   // Register even if the previous version was fully cached.
   await setupWorker();
   const s=await localStatus();
   if(!s.ready&&navigator.onLine)await prepare();else await displayStatus(s);
 }catch(e){report('error',say('请保持联网并点击「下载离线游戏」：','Connect online then click Save Offline: ')+String(e))}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
