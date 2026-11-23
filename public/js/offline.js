/* HHgames offline setup: show an accurate ready status in the hub.
 * Important on iPad: Home Screen apps may have separate storage from Safari. */
(function(){'use strict';
const CACHE_NAME="hhgames-v1.22.2-offline-20261123a";
const FILES=["./","./index.html","./style.css","./js/engine.js","./js/bot.js","./js/friends.js","./js/app.js","./js/offline.js","./assets/hh.svg","./assets/icon-192.png","./assets/icon-512.png","./manifest.webmanifest","./hh-theme.css","./hh-tractor.css","./hh-v06.css","./hh-v07.css","./hh-v08.css","./hh-v10.css","./hh-v12.css","./hh-v13.css","./hh-v14.css","./hh-v17.css","./hh-v19.css","./hh-v112.css","./hh-v115.css","./hh-v116.css","./hh-v117.css","./hh-v118.css","./hh-v120.css","./hh-v122.css","./assets/avatars/mr-q.webp","./assets/avatars/prof-wang.webp","./assets/avatars/hh-boy.webp","./assets/avatars/hh-girl.webp","./guandan/","./guandan/index.html","./guandan/sw.js","./guandan/manifest.webmanifest","./guandan/icon-192.png","./guandan/icon-512.png","./guandan/apple-touch-icon.png"];
const panel=document.getElementById('offlineInstallPanel');
const button=document.getElementById('offlinePrepareBtn');
const display=document.getElementById('offlineInstallStatus');
if(!panel||!button||!display)return;
const zh=(navigator.language||'').toLowerCase().startsWith('zh');
const say=(cn,en)=>zh?cn:en;
let busy=false,registration=null,lastError='';
function report(state,msg){panel.dataset.state=state;display.textContent=msg;}
function modeReady(r){
  if(!r.ready)return false;
  busy=false;button.disabled=false;
  const controller=navigator.serviceWorker.controller;
  const expected=new URL('./sw.js?v=1.22.2',document.baseURI);
  if(!controller || new URL(controller.scriptURL).pathname!==expected.pathname || new URL(controller.scriptURL).searchParams.get('v')!=='1.22.2' || r.total!==FILES.length){
    report('partial',say('文件已经缓存，但页面尚未由正确的离线程序控制。请保持联网并刷新一次。','Files cached, but the correct offline controller is not active. Reload once while online.'));
    return true;
  }
  report('ready',say('✓ 已准备好离线玩（'+r.cached+'/'+r.total+' 个文件），可关闭 Wi-Fi 测试。',
    '✓ Offline ready and controlled ('+r.cached+'/'+r.total+' files). Test with Wi-Fi off.'));
  button.textContent=say('重新检查 / 下载','Check / Download Again');
  return true;
}
async function localStatus(){
  if(!('caches' in window))return {cached:0,total:FILES.length,ready:false};
  const cache=await caches.open(CACHE_NAME);let cached=0;
  for(const file of FILES)if(await cache.match(new URL(file,new URL('./',document.baseURI))))cached++;
  return {cached,total:FILES.length,ready:cached===FILES.length};
}
async function refresh(){
  try{
    const state=await localStatus();
    if(modeReady(state))return;
    if(busy)return;
    report('partial',say('尚未缓存完整：'+state.cached+'/'+state.total+' 个文件。请联网后点击右侧按钮。',
      'Not fully saved: '+state.cached+'/'+state.total+' files. Connect to internet, then use the button.'));
  }catch(err){report('error',say('无法读取本机缓存：','Cannot check device cache: ')+String(err));}
}

async function removeLegacyGuandanWorker(){
  // Guandan used to register a separate /guandan/sw.js (network-first).
  // Its fetch listener could block game navigation when offline. Remove it.
  try {
    const url=new URL('./guandan/',document.baseURI);
    const reg=await navigator.serviceWorker.getRegistration(url.href);
    if(reg && reg.scope===url.href) await reg.unregister();
  } catch(e){}
}

async function ensureRegistration(){
  if(!('serviceWorker' in navigator))throw new Error(say('此浏览器不支持离线安装','Browser does not support service workers'));
  if(location.protocol!=='https:' && location.hostname!=='localhost'&&location.hostname!=='127.0.0.1')
    throw new Error(say('请使用 Cloudflare HTTPS 网站','Use the Cloudflare HTTPS site'));
  await removeLegacyGuandanWorker();
  registration=await navigator.serviceWorker.register('./sw.js?v=1.22.2',{scope:'./',updateViaCache:'none'});
  registration.update().catch(()=>{});
  // The previous worker can remain active while V1.22.2 is installing.
  // Never send offline downloads to the older 40-file controller.
  const until=Date.now()+20000;
  while(Date.now()<until){
    const active=registration.active;
    if(active && new URL(active.scriptURL).searchParams.get('v')==='1.22.2')return active;
    await new Promise(resolve=>setTimeout(resolve,160));
  }
  throw new Error('Offline engine update not active yet; reload once online.');
}
function handleMessage(event){
  if(event.data?.type!=='HH_OFFLINE_STATUS')return;
  busy=false;button.disabled=false;
  const s=event.data;
  if(modeReady(s))return;
  const details=(s.errors&&s.errors.length)?' ('+s.errors[0]+')':'';
  report('error',say('离线下载不完整：','Offline download incomplete: ')+s.cached+'/'+s.total+details+
    say('。请联网重试。','. Retry while connected.'));
}
async function prepare(auto=false){
  if(busy||location.protocol==='file:')return;
  busy=true;button.disabled=true;
  report('loading',say('正在保存游戏文件，请保持联网…','Saving game files; keep the internet connected…'));
  try{
    const sw=await ensureRegistration();
    if(!sw)throw new Error('Service worker not activated');
    sw.postMessage({type:'HH_PREPARE_OFFLINE'});
    // Retry stays possible if iPadOS suspends the worker before it replies.
    setTimeout(async()=>{if(!busy)return;busy=false;button.disabled=false;await refresh();},60000);
  }catch(err){
    lastError=String(err);busy=false;button.disabled=false;
    report('error',say('离线安装失败：','Offline setup failed: ')+lastError);
  }
}
button.addEventListener('click',()=>prepare(false));
if(location.protocol==='file:'){
  panel.classList.add('hidden');return;
}
if(!('serviceWorker' in navigator)){
  report('error',say('此浏览器不支持离线安装','This browser does not support offline installation'));
  button.disabled=true;return;
}
navigator.serviceWorker.addEventListener('message',handleMessage);
navigator.serviceWorker.addEventListener('controllerchange',refresh);
window.addEventListener('online',refresh);
window.addEventListener('offline',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
async function start(){
  await refresh();
  try{
    await ensureRegistration();
    const state=await localStatus();
    if(!state.ready&&navigator.onLine)await prepare(true);
    else await refresh();
  }catch(err){
    report('error',say('离线程序尚未就绪，请点击下载按钮。','Offline engine not ready. Use Download button.')+' '+String(err));
  }
}
// Defer setup until initial UI scripts have finished loading.
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
