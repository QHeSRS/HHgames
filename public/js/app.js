(function(){'use strict';
const E=window.HHEngine,B=window.HHBot,F=window.HHFriends;
const $=id=>document.getElementById(id);const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// V1.13: Separate profiles and resumable games, shared Tractor renderer and rules.
const legacySettings=load('HHgames.settings.v3',E.DEFAULTS);
const legacyNames=load('HHgames.playerNames.v1',null);
const FRIEND_PRESETS={4:{players:4,friendCount:1,decks:2,kitty:8},5:{players:5,friendCount:1,decks:3,kitty:7},6:{players:6,friendCount:2,decks:3,kitty:6},7:{players:7,friendCount:2,decks:3,kitty:8},8:{players:8,friendCount:3,decks:4,kitty:8},9:{players:9,friendCount:3,decks:4,kitty:9}};
const FRIEND_AUTO_NAMES=['林远','陈舟','王岳','赵宁','周岚','刘川','孙逸','李青','吴桐','郑枫','许衡','高月','宋杰','方晨','顾明','何川','沈知','唐雨','陆辰','秦安'];
const FRIEND_CITY_NAMES=['北京','上海','香港','广州','杭州','南京','苏州','成都','纽约','巴黎','伦敦','东京','罗马','柏林','悉尼','首尔','波士顿','温哥华','深圳','厦门'];
const OLD_FRIEND_NAMES=['Mr. Q','HH Boy','Prof. Wang','HH Girl','HH Mate','HH Star','HH Fox','HH Ace','HH King'];
function freshFriendNames(existing){
 const available=[...FRIEND_CITY_NAMES].sort(()=>Math.random()-.5);
 const tractor=load('HHgames.tractor.settings.v1',null);
 const originalFour=(Array.isArray(legacyNames)&&legacyNames.length===4?legacyNames:tractor?.names?.slice(0,4))||E.DEFAULTS.names;
 return Array.from({length:9},(_,i)=>{
  const old=existing?.[i];
  if(i<4)return (!old||FRIEND_AUTO_NAMES.includes(old)||OLD_FRIEND_NAMES.includes(old)||/^Player \d+$/.test(old))?(originalFour[i]||E.DEFAULTS.names[i]):old;
  return old&&!FRIEND_AUTO_NAMES.includes(old)&&!OLD_FRIEND_NAMES.includes(old)&&!/^Player \d+$/.test(old)?old:available[i-4];
 });
}

function profile(mode){
 const existing=load(mode==='friends'?'HHgames.friends.settings.v1':'HHgames.tractor.settings.v1',null);
 const src={...E.clone(E.DEFAULTS),...E.clone(existing||legacySettings||{})};
 if(!existing&&Array.isArray(legacyNames)&&legacyNames.length===4)src.names=[...legacyNames];
 if(!Array.isArray(src.names))src.names=[...E.DEFAULTS.names];
 src.names=Array.from({length:9},(_,i)=>src.names[i]||OLD_FRIEND_NAMES[i]);
 if(mode==='friends')src.names=freshFriendNames(src.names);
 src.gameMode=mode;src.friendCount=Math.min(4,Math.max(1,Number(src.friendCount)||1));
 if(mode==='friends'){if(!existing)Object.assign(src,FRIEND_PRESETS[5]);src.players=Math.min(9,Math.max(4,Number(src.players)||5));const preset=FRIEND_PRESETS[src.players];src.decks=[2,3,4].includes(Number(src.decks))?Number(src.decks):preset.decks;src.kitty=Number.isInteger(Number(src.kitty))?Number(src.kitty):preset.kitty;if(!((54*src.decks-src.kitty)%src.players===0&&src.kitty>=1&&src.kitty<=12))src.kitty=F.kittyOptions(src.players,src.decks).includes(preset.kitty)?preset.kitty:F.kittyOptions(src.players,src.decks)[0]||preset.kitty;src.dealerMode='bidder';src.counterbidTakesDealer=true;}
 return src;
}
const profiles={classic:profile('classic'),friends:profile('friends')};
// V1.22.0: one-time upgrade of historical v1.21 defaults. Later user choices
// stay intact; this migration does not re-enable options on every load.
if(!load('HHgames.defaults-migrated.v1.22.0',false)){
 for(const mode of ['classic','friends']){
  Object.assign(profiles[mode],{bonusOnTakeover:true,allowThrows:true,jMustDefend:true});
  save(mode==='friends'?'HHgames.friends.settings.v1':'HHgames.tractor.settings.v1',profiles[mode]);
 }
 save('HHgames.defaults-migrated.v1.22.0',true);
}

let activeMode=load('HHgames.activeMode.v1',legacySettings?.gameMode||'classic')==='friends'?'friends':'classic';
let settings=profiles[activeMode];
function currentKey(mode){return mode==='friends'?'HHgames.friends.current.v1':'HHgames.tractor.current.v1'}
function restoreGame(mode){
 const fromNew=load(currentKey(mode),null);
 const fromLegacy=load('HHgames.current.v4',null);
 const g=fromNew||(fromLegacy&&((fromLegacy.mode==='friends')===(mode==='friends'))?fromLegacy:null);
 return g&&g.phase&&g.hands&&((g.mode==='friends')===(mode==='friends'))?g:null;
}
function persistSettings(){settings.gameMode=activeMode;profiles[activeMode]=settings;save(activeMode==='friends'?'HHgames.friends.settings.v1':'HHgames.tractor.settings.v1',settings);save('HHgames.activeMode.v1',activeMode);}
let G=restoreGame(activeMode),match=load('HHgames.tractor.match.v1',load('HHgames.match.v4',{levels:[2,2],dealerSeat:0,handNo:0})),view='hub',selected=new Set(),lastRoundActive=false,reviewTrickNo=null,timer=null,messageText='',messageType='',toastTimer=null,feedbackCaptured=null,trickAnim=null,kittyPulseUntil=0,collectDelayTimer=null,collectCleanupTimer=null,collectLayer=null;
const SUDOKU_LEVELS={easy:{key:'easy',zh:'简单',en:'Easy',blanks:40},medium:{key:'medium',zh:'中等',en:'Medium',blanks:48},hard:{key:'hard',zh:'困难',en:'Hard',blanks:54},expert:{key:'expert',zh:'极难',en:'Extreme',blanks:58}};
let sudoku=load('HHgames.sudoku.current.v1',null),sudokuRecords=load('HHgames.sudoku.records.v1',[]),sudokuTimer=null;
function tr(zh,en){return settings.language==='en'?en:zh}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){/* Some file:// Safari configurations block storage */}}
function load(k,otherwise){try{let s=localStorage.getItem(k);return s?JSON.parse(s):E.clone(otherwise)}catch(e){return E.clone(otherwise)}}
function friendsOn(){return G?.mode==='friends'}
function fivePlayerMode(){return settings.gameMode==='friends'}
function totalSeats(){return friendsOn()?G.players:4}
function playerTitle(i){return settings.names[i]||('Player '+(i+1))}
function allFriendsFound(){return friendsOn()&&G.phase!=='bid'&&G.phase!=='dealing'&&G.phase!=='bury'&&G.phase!=='call'&&G.friendCalls?.length===G.settings.friendCount&&G.friendCalls.every(c=>c.revealed);}
function friendScore(){if(!friendsOn()||G.dealerSeat==null||!allFriendsFound())return null;return G.scoresSeat.reduce((v,n,i)=>v+(G.allies.includes(i)?0:n),0)}
function friendPointCards(){if(!friendsOn())return [];const caught=F.capturedBySeat(G);
 return caught.flatMap((cards,i)=>G.dealerSeat!==i&&!G.allies.includes(i)?cards:[]);
}

function saveGame(){if(G)save(currentKey(G.mode==='friends'?'friends':'classic'),G);if(activeMode==='classic')save('HHgames.tractor.match.v1',match)}
function toast(txt){$('toast').textContent=txt;$('toast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),2800)}
function dismissHint(){const e=$('hintExplanation');if(e){e.innerHTML='';e.classList.add('hidden')}}
function clearCollectVisuals(keepTrickHidden=false){
 clearTimeout(collectDelayTimer);clearTimeout(collectCleanupTimer);collectDelayTimer=null;collectCleanupTimer=null;
 if(collectLayer){collectLayer.remove();collectLayer=null;}
 document.querySelectorAll('.trick-collector-seat').forEach(x=>x.classList.remove('trick-collector-seat'));
 if($('trickArea')&&!keepTrickHidden)$('trickArea').classList.remove('trick-flying');
}

function say(txt,type=''){messageText=txt;messageType=type;const p=$('actionMessage');if(p){p.textContent=txt;p.className='action-message '+type}if(type==='error'&&txt)toast(txt)}
function adjustButtons(){const dealControls=$('dealSpeedControls');if(dealControls){const show=view==='game'&&G?.phase==='dealing';dealControls.classList.toggle('hidden',!show);$('dealSpeedValue').textContent=({verySlow:tr('很慢','Very Slow'),slow:tr('慢','Slow'),normal:tr('正常','Normal'),fast:tr('快','Fast'),instant:tr('极快','Very Fast')})[settings.dealSpeed||'normal'];}
 const home=$('homeBtn');home.textContent=innerWidth<650?tr('大厅','Hub'):tr('游戏大厅（返回）','Game Hub');
 $('settingsBtn').textContent=tr('设置','Settings');$('rulesBtn').textContent=tr('规则','Rules');
 $('feedbackBtn').textContent=innerWidth<650?tr('反馈','Bug'):tr('反馈 / Bug','Feedback / Bug');
 $('languageBtn').textContent=settings.language==='zh'?(innerWidth<650?'EN':'English'):'中文';
 $('brandSubtitle').textContent=view==='game'?(friendsOn()?tr('找朋友 · 单机','Find Friends · Offline'):tr('拖拉机 · 单机','Tractor · Offline')):view==='sudoku'?tr('数独 · 单机','Sudoku · Offline'):E.VERSION;
 $('offlineText').textContent=tr('单机无需网络 · 进度保存在设备','Offline games · Saved locally');
 $('versionText').textContent='HHgames · '+E.VERSION;
 const last=$('lastTrickBtn'),newBtn=$('newHandBtn');
 if(view==='game'){
  last.classList.remove('hidden');newBtn.classList.remove('hidden');
  last.textContent=tr('◀ 上一轮','◀ Previous');
  const done=completedTrickArchive();last.disabled=!done.length;last.classList.toggle('reviewing',lastRoundActive);
  $('reviewNextBtn').classList.toggle('hidden',!lastRoundActive);$('reviewCurrentBtn').classList.toggle('hidden',!lastRoundActive);
  $('reviewNextBtn').textContent=tr('下一轮 ▶','Next ▶');$('reviewCurrentBtn').textContent=tr('返回本轮','Live');
  $('reviewNextBtn').disabled=!!lastRoundActive&&reviewTrickNo===done.at(-1)?.trick;
  newBtn.textContent=tr('重新发牌','New Deal');
 }else if(view==='sudoku'){
  last.classList.add('hidden');$('reviewNextBtn').classList.add('hidden');$('reviewCurrentBtn').classList.add('hidden');newBtn.classList.remove('hidden');last.disabled=true;
  newBtn.textContent=tr('同难度新题','New Puzzle');
 }else{
  last.classList.add('hidden');$('reviewNextBtn').classList.add('hidden');$('reviewCurrentBtn').classList.add('hidden');newBtn.classList.add('hidden');last.disabled=true;
 }
}
const games=[{name:'掼蛋',english:'Guandan',online:false,active:true,action:'guandanOffline'},{name:'掼蛋',english:'Guandan',online:true,active:true,action:'guandanOnline'},{name:'拖拉机',english:'Tractor / 80 Points',online:false,active:true,action:'tractorOffline'},{name:'拖拉机',english:'Tractor / 80 Points',online:true,preview:true,action:'tractorOnline'},{name:'找朋友',english:'Find Friends',online:false,active:true,action:'friendsOffline'},{name:'找朋友',english:'Find Friends',online:true,preview:true,action:'friendsOnline'},{name:'Sudoku',english:'Sudoku',online:false,active:true,action:'sudoku'},{name:'Colonist',english:'Strategy Board Game',online:false},{name:'Bughouse',english:'Chess Variant',online:false},{name:'军棋',english:'Junqi',online:false}];
function renderHub(){
 $('hubTitle').textContent=tr('游戏大厅','Game Hub');
 $('gameCount').textContent='';$('heroAvailable').textContent='';$('hubBuildLine').textContent=E.VERSION;
 $('hubNote').textContent=tr('单机可离线玩；拖拉机、找朋友的联网房间仍在开发中。','Offline modes run locally; Tractor and Find Friends multiplayer rooms are not yet available.');$('hubIntro').textContent=tr('掼蛋、拖拉机、找朋友、数独：各游戏独立入口。','Guandan, Tractor, Find Friends and Sudoku each have their own entries.');
 $('tiles').innerHTML=games.map(x=>{
  const title=settings.language==='en'?(x.name==='拖拉机'?'Tractor':x.english):x.name;
  const sub=x.online?tr('联网','Online'):tr('单机','Offline');
  const shown=x.preview?sub+tr(' · 开发中',' · Coming soon'):sub;
  return x.active||x.preview
    ?`<button type="button" class="game-tile tile-simple ${x.preview?'online-preview':'available'}" data-action="${x.action}" aria-label="${escape(title)} ${shown}"><strong class="simple-tile-title">${escape(title)}</strong><small class="simple-tile-mode">${shown}</small></button>`
    :`<div class="game-tile tile-simple unavailable" aria-disabled="true"><strong class="simple-tile-title">${escape(title)}</strong><small class="simple-tile-mode">${sub}</small></div>`;
 }).join('');
}
function stopSudokuTicker(){if(sudokuTimer){clearInterval(sudokuTimer);sudokuTimer=null;}}
function showHub(){clearCollectVisuals();trickAnim=null;dismissHint();clearTimeout(timer);timer=null;if(view==='sudoku'){pauseSudoku();sudoku=null;}stopSudokuTicker();lastRoundActive=false;reviewTrickNo=null;view='hub';document.body.classList.remove('playing','sudoku-active');$('gameView').classList.add('hidden');$('sudokuView').classList.add('hidden');$('hubView').classList.remove('hidden');renderHub();adjustButtons();}
function showGame(){dismissHint();if(view==='sudoku'){pauseSudoku();sudoku=null;}stopSudokuTicker();view='game';document.body.classList.remove('sudoku-active');document.body.classList.add('playing');$('hubView').classList.add('hidden');$('sudokuView').classList.add('hidden');$('gameView').classList.remove('hidden');if(!G||(fivePlayerMode()!==friendsOn()))createHand(false);render();schedule();}
function enterOffline(mode){
 if(mode!=='classic'&&mode!=='friends')return;
 if(G&&view==='game')saveGame();
 clearCollectVisuals();trickAnim=null;clearTimeout(timer);timer=null;lastRoundActive=false;reviewTrickNo=null;selected.clear();
 activeMode=mode;settings=profiles[mode];G=restoreGame(mode);
 match=load('HHgames.tractor.match.v1',load('HHgames.match.v4',{levels:[2,2],dealerSeat:0,handNo:0}));
 persistSettings();showGame();
}
function onlineInfo(mode){
 const label=mode==='friends'?tr('找朋友','Find Friends'):tr('拖拉机','Tractor');
 modal(label+' · '+tr('联网','Online'),`<p>${tr('联网入口已经保留在游戏大厅，但真人房间与邀请链接尚未实现。现在可以从对应的「单机」入口使用同一套牌桌，对战 BOT。','The online lobby entry is reserved, but real multiplayer rooms and invite links are not yet implemented. The matching Offline entry uses the same Tractor table with bots.')}</p><p>${tr('此入口不会假装联网，也不会开始单机牌局。','This entry does not pretend to connect or start an offline game.')}</p>`);
}
function showSudoku(){clearTimeout(timer);timer=null;pauseSudoku();sudoku=null;view='sudoku';document.body.classList.remove('playing');document.body.classList.add('sudoku-active');$('hubView').classList.add('hidden');$('gameView').classList.add('hidden');$('sudokuView').classList.remove('hidden');renderSudoku();}
function createHand(reset=false){
 clearCollectVisuals();dismissHint();clearTimeout(timer);timer=null;selected.clear();lastRoundActive=false;reviewTrickNo=null;
 if(reset)match={levels:[2,2],dealerSeat:0,handNo:0};trickAnim=null;kittyPulseUntil=0;
 if(fivePlayerMode()){
  const previous=!reset&&friendsOn()?G:null;
  const config={...settings,players:settings.players,decks:settings.decks,kitty:settings.kitty,friendCount:settings.friendCount,playerLevels:previous?.playerLevels.length===settings.players?[...previous.playerLevels]:Array(settings.players).fill(2),handNo:previous?.handNo||0,level:2};
  G=F.make(config);G.initialHands=E.clone(G.hands);const cards=G.initialHands;G.dealPile=[];
  for(let round=0;round<cards[0].length;round++)for(let seat=0;seat<G.players;seat++)G.dealPile.push({seat,card:cards[seat][round]});
  G.totalToDeal=G.dealPile.length;G.dealCursor=0;G.hands=Array.from({length:G.players},()=>[]);G.phase='dealing';
  G.history.push({kind:'staged-deal-start',total:G.totalToDeal});
 }else{
  G=E.make(settings,match);
  const source=E.clone(G.initialHands),count=source[0].length;
  G.dealPile=[];for(let round=0;round<count;round++)for(let seat=0;seat<4;seat++)G.dealPile.push({seat,card:source[seat][round]});
  G.totalToDeal=G.dealPile.length;G.dealCursor=0;G.hands=[[],[],[],[]];G.phase='dealing';G.history.push({kind:'staged-deal-start',total:G.totalToDeal});
 }
 messageText='';messageType='';saveGame();render();schedule();
}
function maybeBotBid(seat){
 if(seat===0||!G||!['dealing','bid'].includes(G.phase))return;
 const opts=friendsOn()?F.legalBids(G,seat):E.availableBids(G,seat);
 const assessed=opts.map(b=>({b,q:E.botBidAssessment(friendsOn()?{...G,level:G.playerLevels[seat]}:G,seat,b)}))
  .filter(x=>x.q.qualified).sort((a,b)=>b.q.score-a.q.score||b.b.strength-a.b.strength);
 if(!assessed.length)return;
 const choice=assessed[0].b;
 const result=friendsOn()?F.bid(G,seat,choice.ids):E.submitBid(G,seat,choice.ids);
 if(result.ok)say(`${settings.names[seat]} ${tr('亮主','declares trump')} ${bidDescription(choice)}`,'success');
}
function dealStep(){
 if(!G||G.phase!=='dealing')return;
 const next=G.dealPile.shift();if(!next){G.phase='bid';render();saveGame();return;}
 G.hands[next.seat].push(next.card);E.sort(G.hands[next.seat],G);G.dealCursor++;
 if(next.seat!==0)maybeBotBid(next.seat);
 if(!G.dealPile.length){G.phase='bid';for(let seat=1;seat<totalSeats();seat++)maybeBotBid(seat);G.history.push({kind:'deal-complete',bids:G.bids.length,time:new Date().toISOString()});say(tr('发牌完成，请确认主牌或反主。','Dealing complete. You can counterbid before confirming trump.'),'success');}
 if(G.dealCursor%totalSeats()===0||G.phase==='bid')saveGame();render();schedule();
}
function completedTrickArchive(){
 if(!G)return[];
 const p=new Map(),out=[],cards=new Map(E.makeDeck(G.decks).map(c=>[c.id,c]));
 for(const evt of G.history){
  if(evt.kind==='play'){
   if(!p.has(evt.trick))p.set(evt.trick,[]);
   p.get(evt.trick).push({seat:evt.seat,cards:(evt.cards||[]).map(id=>cards.get(id)).filter(Boolean)});
  }else if(evt.kind==='trick-end'){
   const plays=p.get(evt.trick)||[];
   if(plays.length===totalSeats())out.push({trick:evt.trick,winner:evt.winner,points:evt.points,plays});
  }
 }
 return out;
}
function reviewPreviousTrick(){
 // Pause the live trick; returning from history replays a fresh reading interval.
 clearCollectVisuals();trickAnim=null;const done=completedTrickArchive();if(!done.length){toast(tr('尚无已完成的墩','No completed tricks yet'));return;}
 if(!lastRoundActive)reviewTrickNo=done[done.length-1].trick;
 else{const i=done.findIndex(x=>x.trick===reviewTrickNo);reviewTrickNo=done[Math.max(0,i-1)].trick;}
 lastRoundActive=true;clearTimeout(timer);timer=null;render();
}
function reviewNextTrick(){
 if(!lastRoundActive)return;const done=completedTrickArchive(),i=done.findIndex(x=>x.trick===reviewTrickNo);
 if(i<0||i===done.length-1){returnToCurrentTrick();return;}
 reviewTrickNo=done[i+1].trick;render();
}
function returnToCurrentTrick(){lastRoundActive=false;reviewTrickNo=null;render();schedule();}
function toggleLastTrick(){reviewPreviousTrick();}


function nextHand(){if(friendsOn()){if(G.handResults?.champion!==null&&G.handResults?.champion!==undefined){toast(tr('比赛已经结束，请重新开始比赛','Match finished; start a new match'));return;}if(G.phase!=='finished'&&G.trickNo>1&&!confirm(tr('放弃当前牌局重新发牌？','Abandon current deal?')))return;const previous=G;if(previous.phase==='finished'){createHand(false);showGame();return;}createHand(false);showGame();return;}if(G?.handResults?.champion!==null&&G?.handResults?.champion!==undefined){toast(tr('比赛已经结束，请选择重新开始比赛。','Match finished. Choose New Match.'));return;}if(G&&G.phase!=='finished'&&G.trickNo>1&&!confirm(tr('放弃当前手牌，重新发牌？','Abandon the current deal?')))return;if(G?.phase==='finished'&&!friendsOn())match=E.clone(G.match);createHand(false);showGame();}
function doBid(ids){const res=friendsOn()?F.bid(G,0,ids):E.submitBid(G,0,ids);if(!res.ok){say(res.error,'error');return}saveGame();render();}
function finalizeBid(){if(G.phase==='dealing'){say(tr('请等发牌完成后再确认','Wait for dealing to finish'),'error');return;}const r=friendsOn()?F.finishBids(G):E.finishBidding(G);if(!r.ok){say(r.error,'error');return}kittyPulseUntil=Date.now()+2600;if(G.dealerSeat!==0){if(friendsOn()){const auto=F.chooseBury(G);const rr=F.bury(G,G.dealerSeat,auto.map(c=>c.id));if(!rr.ok)throw Error(rr.error);const calls=F.chooseCalls(G);const cr=F.call(G,G.dealerSeat,calls);if(!cr.ok)throw Error(cr.error);}else E.autoBury(G)}say(tr('已定主。','Trump declared.'),'success');saveGame();render();schedule();}
function buryAuto(){const cards=friendsOn()?F.chooseBury(G):E.chooseKitty(G,G.dealerSeat);selected=new Set(cards.map(c=>c.id));render();say(tr('已为你选出建议扣底牌，可以调整后点击“扣底并开局”。','Recommended kitty cards selected. Adjust or confirm.'),'success');}
function burySelected(){dismissHint();const r=friendsOn()?F.bury(G,0,[...selected]):E.bury(G,0,[...selected]);if(!r.ok){say(r.error,'error');return}selected.clear();kittyPulseUntil=0;say(tr('扣底完成。开始打牌。','Kitty buried. Play begins.'),'success');saveGame();render();schedule();}
function playMove(seat,move,meta){dismissHint();let r=friendsOn()?F.play(G,seat,move.map(c=>c.id)):E.play(G,seat,move.map(c=>c.id),meta);if(!r.ok){say(r.error,'error');return false}selected.clear();if(r.trickComplete){startTrickAnim(G.plays,r.winner,r.points);say('','');}
 else{say('', '');}
 saveGame();render();schedule();return true;}
function userPlay(){if(lastRoundActive)return;if(!G||G.phase!=='play'||G.turn!==0||G.plays.length===totalSeats())return;if(!selected.size){say(tr('请先点击选择手牌。','Select cards from your hand.'),'error');return;}const hand=G.hands[0],move=hand.filter(c=>selected.has(c.id));dismissHint();playMove(0,move,null);}
function hintExplanation(d){
 const move=d.cards||[],lead=G.plays.length?G.plays[0].pattern:null;
 const pat=E.pattern(move,G,true),group=move[0]?E.group(move[0],G):'?';
 const trumpLeft=G.hands[0].filter(c=>E.group(c,G)==='T').length;
 const jokerLeft=G.hands[0].filter(c=>c.s==='J').length;
 const movePoints=move.reduce((n,c)=>n+E.points(c),0);
 const notes=[];
 const suitName=g=>g==='T'?tr('主牌','trump'):({S:'♠',H:'♥',D:'♦',C:'♣'}[g]||g);
 if(!lead){
  if(pat?.kind==='run')notes.push(tr(`先出 ${pat.length} 组连续同牌，迫使对手按相同结构跟牌，尝试争取控牌权。`,`Leading a ${pat.length}-group run forces opponents to follow the structure and can contest control.`));
  else if(pat?.kind==='group')notes.push(tr(`先出 ${move.length} 张同点数牌，测试其他玩家是否有更大的同组牌，尽量减少拆散自己剩余的对子。`,`Leading ${move.length} matching cards tests higher sets and avoids breaking other pairs unnecessarily.`));
  else if(group==='T')notes.push(tr('这里建议用主牌领牌，可能是为了争取主动权；但会消耗后期保底资源。','Leading trump may secure initiative, but spends a resource needed for the last trick.'));
  else{
    const higher=G.hands[0].filter(c=>E.group(c,G)===group&&E.ordinal(c,G)>E.ordinal(move[0],G)).length;
    const suitSize=G.hands[0].filter(c=>E.group(c,G)===group).length;
    if(higher)notes.push(tr(`这张 ${suitName(group)} 不是你手里的最高牌；先试探这门，仍保留 ${higher} 张更高同门牌。`,`This is not your highest ${suitName(group)}; testing the suit keeps ${higher} higher card(s) in reserve.`));
    else notes.push(tr(`这张是你持有的 ${suitName(group)} 较大牌，尝试拿回出牌权。该门手中共 ${suitSize} 张。`,`This is among your strongest ${suitName(group)} cards and may regain initiative. You hold ${suitSize} in that suit.`));
  }
  if(group!=='T'){
   const partner=(0+2)%4;const enemies=[1,3];
   if(G.voids[partner]?.includes(group))notes.push(tr(`已知 ${settings.names[partner]} 在 ${suitName(group)} 绝门：这一手可能为队友创造将吃机会。`,`Partner ${settings.names[partner]} is known void in ${suitName(group)}, which could create a ruffing opportunity.`));
   const n=enemies.filter(i=>G.voids[i]?.includes(group)).length;
   if(n)notes.push(tr(`但已有 ${n} 位对手在 ${suitName(group)} 绝门，存在被将吃风险。`,`However, ${n} opponent(s) are known void in ${suitName(group)} and may ruff.`));
  }
  if(jokerLeft&&!move.some(c=>c.s==='J'))notes.push(tr(`手里还保留 ${jokerLeft} 张王；不急于消耗，可用于关键抓分或最后一墩保底。`,`You preserve ${jokerLeft} joker(s) for important scoring tricks or kitty control.`));
  else if(trumpLeft&&!move.some(c=>E.group(c,G)==='T'))notes.push(tr(`仍保留 ${trumpLeft} 张主牌，方便后期控牌和守底。`,`You retain ${trumpLeft} trumps for later control and defending the kitty.`));
 }else{
  const current=E.winningPlay(G),partnerWinning=current&&E.team(current.seat)===E.team(0),canBeat=current?E.canBeat(move,current.cards,lead,G):false;
  if(partnerWinning)notes.push(tr('目前队友的牌领先，因此优先考虑低成本跟牌，不随意盖队友的牌。','Your partner is currently winning; favor an economical follow rather than overtaking them.'));
  else if(canBeat)notes.push(tr('这手有机会超过目前领先的对手，尝试拿回这一墩的分数和牌权。','This play can beat the current opponent winner, competing for points and initiative.'));
  else notes.push(tr('目前未必能拿下这墩，优先减少丢分和高价值牌损耗。','Winning this trick is uncertain; limit point loss and preserve valuable cards.'));
  const risky=[...Array(3-G.plays.length)].map((_,i)=>(G.plays[0].seat+G.plays.length+i)%4).filter(i=>E.team(i)!==E.team(0)&&G.voids[i]?.includes(lead.suit));
  if(risky.length&&lead.suit!=='T')notes.push(tr('后手对手已知在领出花色绝门，可能用主牌反吃；不宜轻易垫 5/10/K。','An opponent still to play is known void in the led suit and may overruff; avoid feeding 5/10/K points.'));
 }
 if(movePoints>0)notes.push(tr(`这手自身包含 ${movePoints} 分；如果被对手拿下，就会送出这些分数。`,`This move contributes ${movePoints} point(s); they are lost if opponents win the trick.`));
 if(!notes.length)notes.push(tr('建议以减少拆牌、节省主牌和降低送分风险为主。','Prefer to avoid breaking combinations, preserve trumps and limit point risk.'));
 return {heading:lead?tr('为什么这样跟牌','Why this follow?'):tr('为什么这样领牌','Why lead this?'),
  cards:move.map(c=>E.label(c)).join(' · '),
  notes:notes.slice(0,4),
  source:d.samples?tr(`根据当前公开信息并模拟 ${d.samples} 种可能的隐藏牌分配；不是保证最优。`,`Based on visible information and ${d.samples} sampled hidden-card scenarios; not guaranteed optimal.`):tr('根据当前牌型和可见出牌评估；不是保证最优。','Heuristic estimate from visible cards; not guaranteed optimal.')};
}
function showHintExplanation(d){
 const x=hintExplanation(d),p=$('hintExplanation');if(!p)return;
 p.innerHTML=`<div class="hint-head"><strong>💡 ${escape(x.heading)}</strong><button type="button" class="hint-close" data-action="closeHint" aria-label="Close hint">×</button></div><div class="hint-proposed">${tr('建议出牌','Suggested cards')}：<b>${escape(x.cards)}</b></div><ul>${x.notes.map(z=>`<li>${escape(z)}</li>`).join('')}</ul><p class="hint-evidence">${escape(x.source)}</p>`;
 p.classList.remove('hidden');
}
function hint(){if(lastRoundActive)return;if(!G||G.phase!=='play'||G.turn!==0||G.plays.length===totalSeats())return;
 const d=friendsOn()?F.botMove(G,0):B.choose(G,0);selected=new Set(d.cards.map(c=>c.id));render();if(friendsOn()){const box=$('hintExplanation');box.classList.remove('hidden');box.textContent=tr('找朋友提示：', 'Find Friends hint: ')+d.reason;}else showHintExplanation(d);
}

// Readable complete-trick pause BEFORE collection. Shared by Tractor and Find Friends.
// The flying-card animation runs only after this pause, and the next trick waits until it finishes.
const TRICK_READ_MS={fast:2000,normal:2700,slow:4000};
const TRICK_FLIGHT_AND_CLEANUP_MS=950;
function trickReadMs(){return TRICK_READ_MS[settings.speed]??TRICK_READ_MS.normal;}
function trickTotalMs(){return trickReadMs()+TRICK_FLIGHT_AND_CLEANUP_MS;}
const DEAL_PRESETS=[{name:'verySlow',ms:500},{name:'slow',ms:310},{name:'normal',ms:155},{name:'fast',ms:45},{name:'instant',ms:8}];
function dealDelay(){const pref=settings.dealSpeed||'normal';return DEAL_PRESETS.find(x=>x.name===pref)?.ms||155;}
function adjustDealing(delta){if(!G||G.phase!=='dealing'||view!=='game')return;const at=DEAL_PRESETS.findIndex(x=>x.name===(settings.dealSpeed||'normal'));const next=Math.max(0,Math.min(DEAL_PRESETS.length-1,at+delta));settings.dealSpeed=DEAL_PRESETS[next].name;persistSettings();render();schedule();}
function schedule(){clearTimeout(timer);timer=null;if(view!=='game'||!G||lastRoundActive||!$('dialogBackdrop').classList.contains('hidden'))return;
 if(G.phase==='dealing'){timer=setTimeout(dealStep,dealDelay());return;}
 if(G.phase==='play'&&G.plays.length===totalSeats()){
  // Never clear cards while the player is still reading them or while they fly to the winner.
  if(!trickAnim&&G.lastTrick)startTrickAnim(G.plays,G.lastTrick.winner,G.lastTrick.points);
  const anim=trickAnim;
  const remaining=Math.max(0,(anim?.totalMs??trickTotalMs())-(Date.now()-(anim?.startedAt??Date.now())));
  timer=setTimeout(()=>{if(view!=='game'||lastRoundActive||!G||G.phase!=='play'||G.plays.length!==totalSeats())return;
   if(trickAnim!==anim)return;
   clearCollectVisuals();const r=friendsOn()?F.clearTrick(G):E.clearTrick(G);trickAnim=null;
   if(r.handComplete){if(!friendsOn())match=E.clone(G.match);say(tr('本局结束，请查看结算。','Deal complete. See scoring summary.'),'success');}
   saveGame();render();schedule();
  },remaining);return;}
 if(G.phase!=='play')return;
 if(G.turn===0&&!settings.autoMrQ)return;
 timer=setTimeout(()=>{if(view!=='game'||!G||G.phase!=='play'||G.plays.length===totalSeats())return;
 try{const seat=G.turn;const choice=friendsOn()?F.botMove(G,seat):B.choose(G,seat);playMove(seat,choice.cards,choice)}catch(e){console.error('HHgames AI error',e);say(tr('机器人遇到问题，请点击反馈并导出快照：','Bot error; use Feedback to export a snapshot: ')+e.message,'error');}},settings.speed==='fast'?75:settings.speed==='slow'?750:310);
}
function toggleAuto(){settings.autoMrQ=!settings.autoMrQ;persistSettings();say(settings.autoMrQ?tr('AI 托管已开启。','AI takeover is on.'):tr('已关闭 AI 托管。','AI takeover is off.'),'success');render();schedule()}
function pickCard(id){dismissHint();if(lastRoundActive||!G||view!=='game')return;if(G.phase==='play'&&(G.turn!==0||G.plays.length===totalSeats()))return;if(G.phase==='bury'&&G.dealerSeat!==0)return;if(!['play','bury'].includes(G.phase))return;selected.has(id)?selected.delete(id):selected.add(id);render();}
function initials(name){return String(name).split(/\s+/).map(p=>p[0]||'').join('').slice(0,3).toUpperCase()}
function bidDescription(b){if(!b)return tr('待亮主','Awaiting bid');
 const n=b.count||Math.max(1,Math.floor(b.strength/10));const localLevel=friendsOn()&&b.level?` (${tr('打','Level ')}${levelName(b.level)})`:'';
 if(b.suit==='N')return `${b.kind==='red-joker'?tr('大王','Red Jokers'):tr('小王','Black Jokers')} ×${n} · ${tr('无主','No Trump')}${localLevel}`;
 return `${E.SYMBOL[b.suit]} ×${n}${localLevel}`;
}
function bankerIsSet(){return G&&(G.handNo>1||G.bids.length>0||!['dealing','bid'].includes(G.phase));}

function teamWinLabel(winner){if(friendsOn())return G.allies.includes(winner)?tr('庄家阵营赢墩','Dealer side wins trick'):tr('闲家阵营赢墩','Attackers win trick');return E.team(winner)===0?tr('我方胜','Our side wins'):tr('对方胜','Opponents win')}
function teamWinClass(winner){return (friendsOn()?G.allies.includes(winner):E.team(winner)===0)?'our-win':'their-win'}
function suitName(s){return ({S:tr('黑桃','Spades'),H:tr('红桃','Hearts'),D:tr('方块','Diamonds'),C:tr('梅花','Clubs')})[s]||'';}
function suitGlyph(s){const symbol=E.SYMBOL[s]||'';return `<span class="suit-glyph ${s==='H'||s==='D'?'suit-red':'suit-dark'}" title="${escape(suitName(s))}">${escape(symbol)}</span>`;}
function coloredSuitInfo(s){return `${suitGlyph(s)}<span class="suit-readable-name">${escape(suitName(s))}</span>`;}
function bidDescriptionHtml(b){if(!b)return escape(tr('待亮主','Awaiting bid'));const n=b.count||Math.max(1,Math.floor(b.strength/10));const level=friendsOn()&&b.level?` <span class="bid-level">(${tr('打','Level ')}${levelName(b.level)})</span>`:'';
 if(b.suit==='N')return `<span class="bid-joker ${b.kind==='red-joker'?'red':''}">${b.kind==='red-joker'?tr('🟥 大王','Red Joker'):tr('⬛ 小王','Black Joker')}</span> ×${n} · ${tr('无主','No Trump')}${level}`;
 return `${coloredSuitInfo(b.suit)} <b class="bid-count">×${n}</b>${level}`;
}
function coloredCardLabel(c){if(!c)return '';if(c.s==='J')return `<span class="colored-card-label ${c.r===17?'red':''}">${escape(E.label(c))}</span>`;return `<span class="colored-card-label ${c.s==='H'||c.s==='D'?'red':''}">${escape(E.label(c))}</span>`;}

function bidSummaryHtml(b){if(!b)return tr('等待亮主','Awaiting bid');const count=b.count||b.ids?.length||1;const suit=b.suit==='N'?(b.kind==='red-joker'?tr('🟥 大王','Red Joker'):tr('⬛ 小王','Black Joker')):coloredSuitInfo(b.suit);const level=friendsOn()&&b.level?` · ${tr('打','Level ')}${levelName(b.level)}`:'';return `<strong class="bid-visible-suit">${suit} ×${count}</strong>${level}`;}
function bidCardsHtml(bid){if(!bid?.ids?.length)return'';return `<span class="bid-card-strip">${bid.ids.map(id=>{const c=E.cardFromId(G,id);return c?cardHtml(c,true,false,'bid-card',''):''}).join('')}</span>`}
function startTrickAnim(plays,winner,points){
 clearCollectVisuals();trickAnim={winner,points,trick:G.trickNo,startedAt:Date.now(),readMs:trickReadMs(),totalMs:trickTotalMs(),launched:false,flying:false};
}
function runCollectAnimation(){
 const a=trickAnim;if(!a||a.launched||view!=='game'||lastRoundActive||!G?.lastTrick||G.lastTrick.trick!==a.trick)return;
 a.launched=true;
 // Keep every player's completed play fully visible for the configured reading pause.
 collectDelayTimer=setTimeout(()=>{
  if(trickAnim!==a||view!=='game'||lastRoundActive||G.plays.length!==totalSeats())return;
  const target=$('seat'+a.winner)?.querySelector('.seat-info')||$('seat'+a.winner);
  const stackNodes=[...$('trickArea').querySelectorAll('.trick-seat .trick-faces')];
  if(!target||stackNodes.length!==totalSeats())return;
  a.flying=true; // A later render must not hide readable cards during the pause.
  const dest=target.getBoundingClientRect();const cx=dest.left+dest.width/2,cy=dest.top+dest.height/2;
  const layer=document.createElement('div');layer.className='trick-flight-layer';layer.setAttribute('aria-hidden','true');
  document.body.appendChild(layer);collectLayer=layer;
  $('seat'+a.winner).classList.add('trick-collector-seat');
  const flash=document.createElement('div');flash.className='trick-flight-result '+teamWinClass(a.winner);
  flash.textContent=teamWinLabel(a.winner);flash.style.left=cx+'px';flash.style.top=(cy-32)+'px';layer.appendChild(flash);
  if(flash.animate)flash.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.7)'},{offset:.38,opacity:1,transform:'translate(-50%,-50%) scale(1.05)'},{offset:1,opacity:0,transform:'translate(-50%,-50%) scale(1)'}],{duration:800,fill:'forwards'});
  for(let idx=0;idx<stackNodes.length;idx++){
   const source=stackNodes[idx],r=source.getBoundingClientRect();
   const clone=source.cloneNode(true);clone.classList.add('trick-flight-stack');
   clone.style.left=r.left+'px';clone.style.top=r.top+'px';clone.style.width=r.width+'px';clone.style.height=r.height+'px';
   layer.appendChild(clone);
   const dx=cx-r.left-r.width/2,dy=cy-r.top-r.height/2;
   if(clone.animate)clone.animate([
    {transform:'translate(0px,0px) scale(1)',opacity:1},
    {offset:.54,transform:`translate(${dx*.68}px,${dy*.68}px) scale(.82)`,opacity:1},
    {transform:`translate(${dx}px,${dy}px) scale(.32)`,opacity:0}
   ],{duration:620,delay:idx*28,easing:'cubic-bezier(.16,.76,.3,1)',fill:'forwards'});
  }
  $('trickArea').classList.add('trick-flying');
  collectCleanupTimer=setTimeout(()=>{if(trickAnim===a)clearCollectVisuals(true)},820);
 },a.readMs);
}

function trickVector(seat,winner){const pos={0:[0,132],1:[160,0],2:[0,-132],3:[-160,0]};const a=pos[seat]||[0,0],b=pos[winner]||[0,0];return{tx:b[0]-a[0],ty:b[1]-a[1]}}

function cardHtml(c,mini=false,interactive=false,extraClass='',inlineStyle=''){
 let r=c.s==='J'?(c.r===17?tr('大','R'):tr('小','B')):(c.r===14?'A':c.r===13?'K':c.r===12?'Q':c.r===11?'J':String(c.r));
 const isRed=c.s==='D'||c.s==='H'||(c.s==='J'&&c.r===17),symbol=c.s==='J'?'★':E.SYMBOL[c.s];
 const isTrump=G&&E.group(c,G)==='T';
 // Broad, rounded heart lobes make hearts unambiguously different from diamonds.
 const shape=(c.s==='H')?`<svg class="heart-symbol" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.2C10.6 19.7 3 14.6 3 9.2 3 6 5.5 3.7 8.2 3.7c1.8 0 3.1 1 3.8 2.3.7-1.3 2-2.3 3.8-2.3C18.5 3.7 21 6 21 9.2c0 5.4-7.6 10.5-9 12Z"/></svg>`:escape(symbol);
 return `<button type="button" class="playing-card ${mini?'mini':''} ${isRed?'red':'black'} ${isTrump?'trump':''} ${c.s==='J'?'joker':''} ${extraClass} ${selected.has(c.id)&&interactive?'selected':''}" ${inlineStyle?`style="${inlineStyle}"`:''} ${interactive?`data-card="${escape(c.id)}" aria-pressed="${selected.has(c.id)}"`:'disabled'} title="${escape(E.label(c))}"><span class="card-index"><strong>${escape(r)}</strong><em>${shape}</em></span><span class="card-center">${shape}</span>${isTrump?`<span class="trump-signal">${tr('主','T')}</span>`:''}</button>`;
}
let handSort='smart';
let lastPackTap=null, packPress=null, suppressPackClick=null;
// Compact rank-first sorting: all doubles/triples/quads first in descending rank,
// followed by singles from largest to smallest.  Distinct physical cards remain
// independently selectable even when they are drawn as a compact visual pile.
function rankGroupSort(cards){
 const groups=[...E.counts(cards).values()].map(a=>({cards:a,n:a.length,ord:E.ordinal(a[0],G),s:a[0].s,r:a[0].r}));
 groups.sort((a,b)=>((a.n>=4?0:a.n===3?1:a.n===2?2:3)-(b.n>=4?0:b.n===3?1:b.n===2?2:3))||b.ord-a.ord||b.r-a.r||a.s.localeCompare(b.s));
 return groups;
}
function selectPackAll(key){
 dismissHint();if(lastRoundActive||!G||view!=='game'||!['play','bury'].includes(G.phase))return;
 if(G.phase==='play'&&(G.turn!==0||G.plays.length===totalSeats()))return;
 if(G.phase==='bury'&&G.dealerSeat!==0)return;
 const cards=G.hands[0].filter(c=>E.key(c)===key);
 if(!cards.length)return;
 cards.forEach(c=>selected.add(c.id));
 renderHand();
}
function handlePackClick(key){
 dismissHint();const now=Date.now();
 if(suppressPackClick&&suppressPackClick.key===key&&now<suppressPackClick.until){suppressPackClick=null;return;}
 if(lastPackTap&&lastPackTap.key===key&&now-lastPackTap.at<360){lastPackTap=null;selectPackAll(key);}
 else{lastPackTap={key,at:now};togglePack(key);}
}
function bindPackGestures(){
 // Event delegation survives renderHand(), which replaces the button after taps.
 document.addEventListener('pointerdown',e=>{
  const pack=e.target.closest('[data-pack]');if(!pack||view!=='game'||!e.isPrimary)return;
  if(e.pointerType==='mouse'&&e.button!==0)return;
  clearTimeout(packPress?.timer);
  const key=pack.dataset.pack;
  const press={key,id:e.pointerId,x:e.clientX,y:e.clientY,timer:null,done:false};
  press.timer=setTimeout(()=>{
   if(packPress!==press)return;
   press.done=true;lastPackTap=null;
   suppressPackClick={key,until:Date.now()+100000};
   selectPackAll(key);
  },440);
  packPress=press;
 });
 document.addEventListener('pointermove',e=>{
  if(!packPress||packPress.id!==e.pointerId)return;
  if(Math.hypot(e.clientX-packPress.x,e.clientY-packPress.y)>13){clearTimeout(packPress.timer);packPress=null;}
 });
 const end=e=>{if(packPress&&packPress.id===e.pointerId){clearTimeout(packPress.timer);if(packPress.done&&suppressPackClick?.key===packPress.key)suppressPackClick.until=Date.now()+230;packPress=null;}};
 document.addEventListener('pointerup',end);
 document.addEventListener('pointercancel',end);
 document.addEventListener('contextmenu',e=>{if(e.target.closest('[data-pack]'))e.preventDefault()});
 document.addEventListener('dblclick',e=>{const pack=e.target.closest('[data-pack]');if(pack){e.preventDefault();lastPackTap=null;selectPackAll(pack.dataset.pack);}});
}
function togglePack(key){
 dismissHint();if(lastRoundActive||!G||view!=='game'||!['play','bury'].includes(G.phase))return;
 if(G.phase==='play'&&(G.turn!==0||G.plays.length===totalSeats()))return;
 if(G.phase==='bury'&&G.dealerSeat!==0)return;
 const cards=G.hands[0].filter(c=>E.key(c)===key);if(!cards.length)return;
 const n=cards.filter(c=>selected.has(c.id)).length;
 // Each tap increments 0 -> 1 -> ... -> all -> 0. This supports a single
 // card, pair, triple or quad without introducing extra tiny buttons.
 cards.forEach(c=>selected.delete(c.id));
 if(n<cards.length)cards.slice(0,n+1).forEach(c=>selected.add(c.id));
 renderHand();
}
function renderHand(){
 const cards=G.hands[0]||[],g={T:[],S:[],H:[],C:[],D:[]};
 for(const c of cards)g[E.group(c,G)].push(c);
 const title={T:G.trump==='N'?tr('王·级','JOKERS + LEVEL'):tr('主','TRUMP'),S:'♠',H:'♥',C:'♣',D:'♦'};
 const html=['T','S','H','C','D'].filter(k=>g[k].length).map(k=>{
  const packs=rankGroupSort(g[k]);
  return `<div class="compact-suit-section ${k==='T'?'trump-part':''} ${k==='H'||k==='D'?'red-part':''}" data-suit="${k}" data-groups="${packs.length}"><span class="compact-suit-mark">${title[k]}</span>`+
   packs.map(p=>{
     const n=p.cards.filter(c=>selected.has(c.id)).length;
     // First card in the DOM is the readable FRONT card. Later identical
     // cards only expose lower edges; no count badge masks card faces.
     const kittyGlow=G.phase==='bury'&&G.dealerSeat===0&&p.cards.some(c=>G.kitty?.some(k=>k.id===c.id));
     const faces=p.cards.map((c,i)=>cardHtml(c,false,false,`compact-face ${i?'pile-back':''} ${i<n?'is-picked':''} ${kittyGlow?'kitty-glow-face':''}`,`--pile-index:${i};z-index:${p.n-i}`)
       .replace('<button type="button"','<span').replace(' disabled','').replace('</button>','</span>')).join('');
     return `<button type="button" class="card-pack ${n?'pack-picked':''} ${kittyGlow?'kitty-glow-pack':''}" data-pack="${E.key(p.cards[0])}" data-pile-size="${p.n}" title="${escape(E.label(p.cards[0]))} · ${p.n}${tr('张',' cards')} · ${tr('连点选择张数','tap repeatedly to select cards')}" aria-label="${escape(E.label(p.cards[0]))} ${p.n} cards, ${n} selected">${p.n>1?`<span class="pile-size-badge">${p.n}</span>`:''}${kittyGlow?`<span class="kitty-badge">${tr('底','Kitty')}</span>`:''}${faces}</button>`;
   }).join('')+'</div>';
 }).join('');
 $('handGroups').innerHTML=html;
 $('selectionCount').textContent=selected.size?`${tr('已选','Selected')} ${selected.size}`:'';
 $('handTitle').textContent=`${settings.names[0]} · ${cards.length}${tr('张',' cards')}`;
 requestAnimationFrame(layoutHandStacks);
}
function layoutHandStacks(){
 if(view!=='game'||!G)return;
 const wrap=$('handGroups'),sections=[...wrap.querySelectorAll('.compact-suit-section')];
 if(!sections.length)return;
 const rect=wrap.getBoundingClientRect(),W=rect.width,H=rect.height;
 if(W<20||H<30)return;
 const sizes=sections.map(s=>s.querySelectorAll('.card-pack').length),total=sizes.reduce((a,b)=>a+b,0);
 // Prefer more rows when that makes rank corners actually legible, especially
 // with 4 decks on a phone; retain one row on larger desktop screens.
 let rows=1;
 if(W<620&&H>195&&total>16)rows=3;
 else if((W<1100&&H>96&&total>20)||(W<1100&&H>145&&total>14))rows=2;
 rows=Math.min(rows,sections.length);
 const partitions=(n,k)=>{
  if(k===1)return [[n]];
  const out=[];for(let i=1;i<=n-k+1;i++)for(const tail of partitions(n-i,k-1))out.push([i,...tail]);return out;
 };
 let choice=null,best=Infinity;
 for(const pattern of partitions(sections.length,rows)){
   let ix=0;const loads=pattern.map(cnt=>{let sum=0;for(let j=0;j<cnt;j++)sum+=sizes[ix++];return sum;});
   const score=Math.max(...loads)*3+(Math.max(...loads)-Math.min(...loads))*.4;
   if(score<best){best=score;choice=pattern;}
 }
 const rowLists=Array.from({length:rows},()=>[]);let ix=0;
 choice.forEach((n,r)=>{for(let j=0;j<n;j++)rowLists[r].push(sections[ix++])});
 const rowH=H/rows;
 const cardH=Math.min(147,Math.max(32,rowH-(rows>1?10:15)));
 const cardW=Math.min(84,Math.max(26,cardH*.69));
 const markW=W<500?13:15,groupGap=W<500?2:4;
 rowLists.forEach((list,row)=>{
  if(!list.length)return;
  const units=list.reduce((v,s)=>v+s.querySelectorAll('.card-pack').length,0);
  const fixed=list.length*(markW+cardW+groupGap);
  const advance=Math.max(0,units-list.length);
  // Always overlap to the RIGHT: 0 < step < width, regardless of suit or pile.
  const space=Math.max(0,W-fixed-4);
  const step=advance?Math.max(6,Math.min(cardW*.74,space/advance)):0;
  const needed=fixed+advance*step;
  let x=Math.max(0,(W-needed)/2);
  const y=row*rowH+Math.max(2,(rowH-cardH)/2);
  list.forEach((section,sectionIndex)=>{
    const packs=[...section.querySelectorAll('.card-pack')],n=packs.length;
    const width=markW+cardW+Math.max(0,n-1)*step;
    section.style.cssText=`left:${x}px;top:${row*rowH}px;width:${width}px;height:${rowH}px;z-index:${sectionIndex+1};`;
    const marker=section.querySelector('.compact-suit-mark');
    marker.style.width=markW+'px';
    marker.style.top=Math.max(2,(rowH-cardH)/2)+'px';
    packs.forEach((pack,i)=>{
      pack.style.left=(markW+i*step)+'px';pack.style.top=Math.max(2,(rowH-cardH)/2)+'px';
      pack.style.width=cardW+'px';pack.style.height=cardH+'px';
      pack.style.zIndex=String(i+1);pack.style.setProperty('--pile-order',String(i+1));
      const faces=[...pack.querySelectorAll('.compact-face')];
      const edge=cardH<52?4.5:cardH<90?7:9;
      faces.forEach((face,j)=>{
        face.style.width=cardW+'px';face.style.height=(cardH-edge*(faces.length-1-j))+'px';
        face.style.left='0px';face.style.top='0px';
        face.style.zIndex=String(faces.length-j);
      });
    });
    x+=width+groupGap;
  });
 });
}
function renderSeats(){
 const n=totalSeats();$('felt').classList.toggle('friends-table',friendsOn());$('felt').dataset.players=String(n);for(let k=0;k<9;k++){const node=$('seat'+k),unused=k>=n;node.classList.toggle('hidden',unused);node.hidden=unused;node.setAttribute('aria-hidden',String(unused));if(unused){node.replaceChildren();node.style.removeProperty('--seat-x');node.style.removeProperty('--seat-y');}}
 for(let i=0;i<n;i++){
  const e=$('seat'+i),name=playerTitle(i),count=G.hands[i].length,playerLevel=friendsOn()?G.playerLevels[i]:(G.match?.levels||match.levels)[E.team(i)];
  const isDealer=bankerIsSet()&&i===G.dealerSeat;
  const isFriend=friendsOn()&&G.allies?.includes(i)&&i!==G.dealerSeat;
  const isTurn=G.phase==='play'&&!lastRoundActive&&G.turn===i&&G.plays.length<n;
  const fan=Array.from({length:Math.min(7,count)},(_,k)=>`<span class="back-card" style="--ix:${k}"></span>`).join('');
  const latestBid=G.declared&&G.declared.seat===i&&['dealing','bid'].includes(G.phase)?`<div class="seat-bid-sticker"><span class="seat-bid-text">${tr('当前亮主','Latest bid')}</span>${bidCardsHtml(G.declared)}</div>`:'';
  const kittyPickup=(i===G.dealerSeat&&Date.now()<kittyPulseUntil&&G.phase==='play')?`<span class="seat-kitty-pickup">✨ ${tr('拿底牌','Kitty picked up')} ×${friendsOn()?G.settings.kitty:E.kittySizes[G.decks]}</span>`:'';
  const unknownScore=friendsOn()&&G.dealerSeat!==null&&i!==G.dealerSeat&&!G.allies.includes(i)&&!allFriendsFound();
  const scoreChip=unknownScore?`<span class="seat-provisional-points" title="${tr('该玩家抓到的分','Points this player captured')} ${G.scoresSeat[i]}">${G.scoresSeat[i]}${tr('分',' pts')}</span>`:'';
  e.classList.toggle('seat-is-turn',isTurn);e.classList.toggle('dealer-seat',isDealer);e.classList.toggle('dealer-badge-left',isDealer&&friendsOn()&&(FRIEND_TABLE_POSITIONS[n]?.seats[i]?.[0]||0)>=60);
  const avatar=(window.HH_AVATAR_URIS&&window.HH_AVATAR_URIS[i])||(i>=4?'': 'assets/avatars/'+['mr-q','hh-boy','prof-wang','hh-girl'][i]+'.webp');
  const image=avatar?`<img class="avatar-photo" src="${avatar}" alt="" draggable="false">`:`<span class="fifth-avatar">${escape(initials(name)||String(i+1))}</span>`;
  e.innerHTML=`${isDealer?`<span class="dealer-outside-badge" aria-label="${tr('庄家','Dealer')}">♛ ${tr('庄家','DEALER')}</span>`:''}<div class="seat-info ${isDealer?'dealer-highlight':''} ${isTurn?'turn-name-highlight':''}"><span class="avatar ${friendsOn()?'team-unknown':'team'+E.team(i)} ${G.turn===i&&G.phase==='play'&&G.plays.length<n?'active':''}">${image}</span><div class="seat-words"><span class="seat-name-line"><button type="button" class="player-name" title="${escape(name)}" data-rename="${i}">${escape(name)}<span class="edit-pencil" aria-hidden="true"> ✎</span></button>${scoreChip}</span><small><span class="seat-level-chip">${tr('级','Level')} ${levelName(playerLevel)}</span>${isFriend?'<span class="friend-revealed">🤝 朋友</span>':''}</small></div></div>${latestBid}${kittyPickup}<div class="card-back-fan">${fan}</div>`;
 }
}
/* V1.15: Restore the V1.13 perimeter/oval table. Seat labels always live
   around the felt; only played cards live on top of the felt. These are not tiles. */
const FRIEND_TABLE_POSITIONS={
  4:{seats:[[50,92],[87,57],[50,9],[13,57]],plays:[[50,73,29],[75,52,28],[50,29,29],[25,52,28]]},
  5:{seats:[[50,93],[88,61],[75,9],[25,9],[12,61]],plays:[[50,75,29],[70,52,27],[74,28,27],[26,28,27],[30,52,27]]},
  6:{seats:[[50,93],[78,92],[94,31],[50,9],[6,31],[22,92]],plays:[[50,75,28],[77,75,25],[77,39,25],[50,27,28],[23,39,25],[23,75,25]]},
  7:{seats:[[50,93],[78,92],[94,54],[77,9],[23,9],[6,54],[22,92]],plays:[[50,75,26],[77,75,24],[77,50,24],[77,27,24],[23,27,24],[23,50,24],[23,75,24]]},
  8:{seats:[[50,93],[77,92],[94,66],[94,35],[67,9],[33,9],[6,35],[6,66]],plays:[[50,75,25],[77,75,23],[77,50,23],[77,27,23],[50,27,25],[23,27,23],[23,50,23],[23,75,23]]},
  9:{seats:[[50,93],[77,92],[94,67],[94,40],[75,9],[50,9],[25,9],[6,40],[6,67]],plays:[[50,75,25],[77,75,23],[50,50,25],[77,50,23],[77,27,23],[50,27,25],[23,27,23],[23,50,23],[23,75,23]]}
};
function positionFriendSeats(){
 if(!friendsOn())return;
 const pos=FRIEND_TABLE_POSITIONS[totalSeats()]||FRIEND_TABLE_POSITIONS[5];
 for(let i=0;i<totalSeats();i++){
  const node=$('seat'+i),xy=pos.seats[i];
  // Mobile/portrait gutters: avoid truncating the outermost names at the felt edge.
  const safe=innerWidth<650?10:innerWidth<980?9:6;const x=Math.max(safe,Math.min(100-safe,xy[0]));
  if(node.style?.setProperty){node.style.setProperty('--seat-x',x+'%');node.style.setProperty('--seat-y',xy[1]+'%');}
 }
}
function fitMultiPlayedCards(){
 if(!friendsOn())return;
 const area=$('trickArea');
 area.querySelectorAll('.perimeter-trick').forEach(cell=>{
  const cards=[...cell.querySelectorAll('.trick-faces .playing-card')];if(!cards.length)return;
  const wrap=cell.querySelector('.trick-faces');
  const width=Math.max(38,wrap.clientWidth||cell.clientWidth||90),height=Math.max(28,wrap.clientHeight||cell.clientHeight-15||58),
    n=cards.length,maxW=G.players<=5?54:G.players<=7?43:35;
  const smallest=innerWidth<700?9:11;
  let best=null,bestScore=-Infinity;
  for(let w=maxW;w>=smallest;w--){
   const h=Math.ceil(w*1.43);
   for(let rows=1;rows<=Math.min(n,9);rows++){
    if(rows*h+(rows-1)*2>height)continue;
    const columns=Math.ceil(n/rows),step=columns===1?w:(width-w)/(columns-1);
    if(step<Math.min(9,w*.32))continue;
    const visible=Math.min(w,step);
    // Maximize legible rank/suit (uncovered card width), not just card size.
    // Two readable rows are better than a single row of 20 nearly hidden ranks.
    const score=2*visible+.35*w-.6*rows;
    if(score>bestScore){best={w,h,rows,columns,step:Math.min(w+2,step)};bestScore=score;}
   }
  }
  // Extreme tricks get the smallest legible indices; all cards remain inside
  // their own play zone rather than clipping or overlapping a different seat.
  if(!best){const rows=Math.min(n,Math.max(1,Math.floor(height/(smallest*1.43+2))));const columns=Math.ceil(n/rows);best={w:smallest,h:Math.ceil(smallest*1.43),rows,columns,step:columns===1?smallest:(width-smallest)/(columns-1)};}
  cards.forEach((card,i)=>{
   const row=Math.floor(i/best.columns),column=i%best.columns,remaining=Math.min(best.columns,n-row*best.columns);
   const step=remaining>1?Math.min(best.w+2,(width-best.w)/(remaining-1)):0;
   const lineW=best.w+(remaining-1)*step;
   card.style.left=Math.max(0,(width-lineW)/2+column*step)+'px';
   card.style.top=(row*(best.h+2))+'px';
   card.style.width=best.w+'px';card.style.height=best.h+'px';
   card.style.setProperty('--slot-card-w',best.w+'px');card.style.zIndex=String(column+1);
  });
 });
}
function renderTrick(){
 const last=lastRoundActive?completedTrickArchive().find(x=>x.trick===reviewTrickNo):null;
 // Restore a complete trick safely after reopening an in-progress saved game.
 if(!last&&G.phase==='play'&&G.plays.length===totalSeats()&&!trickAnim&&G.lastTrick)startTrickAnim(G.plays,G.lastTrick.winner,G.lastTrick.points);
 const plays=last?last.plays:G.plays;
 const completed=!last&&G.phase==='play'&&G.plays.length===totalSeats()&&G.lastTrick;
 const title=$('centerTitle');title.className='center-title';
 if(last){title.textContent=`${tr('回看第','Review trick ')} ${last.trick} ${tr('墩','')} · ${teamWinLabel(last.winner)} · +${last.points}${tr('分',' pts')}`;title.classList.add(teamWinClass(last.winner));}
 else if(completed){title.textContent=`${tr('第','Trick ')} ${G.lastTrick.trick} ${tr('墩','')}`;}
 else{title.textContent=G.phase==='dealing'?`${tr('发牌中','Dealing')} ${G.dealCursor||0}/${G.totalToDeal||0}`:G.phase==='finished'?tr('本局结束','Deal finished'):`${tr('第','Trick ')} ${G.trickNo} ${tr('墩','')}`;}
 const area=$('trickArea'),collecting=!!(trickAnim&&!lastRoundActive&&trickAnim.trick===G.lastTrick?.trick&&plays?.length===totalSeats());
 area.className='trick-area'+(last?' reviewing':'')+(collecting?' collecting':'')+(collecting&&trickAnim.flying?' trick-flying':'');
 if(friendsOn()){
  positionFriendSeats();
  const positions=FRIEND_TABLE_POSITIONS[G.players]||FRIEND_TABLE_POSITIONS[5];
  area.innerHTML=(plays||[]).map((pl,idx)=>{
    const [x,y,w]=positions.plays[pl.seat];
    return `<div class="trick-seat perimeter-trick trick-seat-${pl.seat}" data-seat="${pl.seat}" data-card-count="${pl.cards.length}" style="--play-x:${x}%;--play-y:${y}%;--play-width:${w}%"><div class="trick-who ${last&&last.winner===pl.seat?'review-winner':''}">${escape(playerTitle(pl.seat))}${last&&last.winner===pl.seat?' ★':''}</div><div class="trick-faces">${pl.cards.map(c=>cardHtml(c,true,false)).join('')}</div>${last?`<span class="trick-order">${idx+1}</span>`:''}</div>`;
  }).join('')||`<div class="no-trick">${G.phase==='dealing'?tr('正在逐张发牌 · 可以实时亮主','Cards are being dealt · Live trump bids'):tr('等待领牌','Waiting for lead')}</div>`;
  fitMultiPlayedCards();
 }else if(!plays?.length){area.innerHTML=`<div class="no-trick">${G.phase==='dealing'?tr('正在逐张发牌 · 可以实时亮主','Cards are being dealt · Live trump bids'):tr('等待领牌','Waiting for lead')}</div>`;}
 else{area.innerHTML=plays.map((pl,idx)=>`<div class="trick-seat trick-seat-${pl.seat}">${last?`<div class="trick-order">${idx+1}</div>`:''}<div class="trick-who ${last&&last.winner===pl.seat?'review-winner':''}">${escape(playerTitle(pl.seat))}${last&&last.winner===pl.seat?' ★':''}</div><div class="trick-faces">${pl.cards.map(c=>cardHtml(c,true,false)).join('')}</div></div>`).join('');}
 if(collecting)requestAnimationFrame(()=>runCollectAnimation());
}

function fitFriendsStatus(){
 const bar=$('statusBar');if(!bar)return;
 const list=bar.querySelector('.friend-call-list');if(!list)return;
 const chips=[...list.querySelectorAll('.friend-call-progress')];
 // IMPORTANT: test rendered text, not just the chip's bounding rectangle.
 // A flex item can fit perfectly while its unshrinkable text is cut off.
 const fit=()=>{
  if(list.scrollWidth>list.clientWidth+1||list.scrollHeight>list.clientHeight+1)return false;
  return chips.every(chip=>chip.scrollWidth<=chip.clientWidth+1&&
   [...chip.querySelectorAll('.call-text,.friend-found')].every(t=>t.scrollWidth<=t.clientWidth+1));
 };
 for(const density of ['full','compact','minimal']){
  bar.dataset.callDensity=density;
  for(const font of [12,11,10,9]){
   bar.style.setProperty('--friend-text-size',font+'px');
   if(fit())return;
  }
 }
 // Even on very narrow displays, don't clip the condition. Reduce chip
 // padding before applying final scale; preserve all IDs and suits.
 bar.dataset.callDensity='minimal';
 for(const font of [9,8]){
  bar.style.setProperty('--friend-text-size',font+'px');
  if(fit())return;
 }
}
function renderStats(){
 if(friendsOn()){
  const dealer=G.dealerSeat===null?tr('等待抢主','Awaiting bid'):playerTitle(G.dealerSeat);
  const announced=G.declared,calls=G.friendCalls||[],allKnown=allFriendsFound();
  const score=friendScore(),allCards=friendPointCards(),lastCards=allCards.slice(-8);
  const rows=calls.map((c,i)=>`<div class="friend-call-progress" title="${escape(tr('第','The ')+c.n+tr('个出','th played ')+E.SYMBOL[c.s]+levelName(c.r)+(c.revealed?' → '+playerTitle(c.seat):''))}"><span class="friend-check ${c.revealed?'done':''}">${c.revealed?'✓':'○'}</span><span class="call-text"><span class="friend-call-full">${tr('第','The ')}${c.n}${tr('个出','th played ')}</span><span class="friend-call-compact">${tr('第','')}${c.n}${tr('张',' #')}</span><span class="friend-call-minimal">#${c.n}</span> ${suitGlyph(c.s)}<b>${levelName(c.r)}</b></span>${c.revealed?`<strong class="friend-found">${escape(playerTitle(c.seat))}</strong>`:''}</div>`).join('');
  const pointChips=lastCards.map(c=>`<b class="point-chip ${c.s==='H'||c.s==='D'?'red-point':'black-point'}" title="${escape(E.label(c))}">${escape(E.label(c))}</b>`).join('');
  const caughtCaption=allKnown?tr('闲家抓分','Attacker points'):tr('抓分见各家','Per-seat points');
  const chips=pointChips?`<span class="caught-cards friend-caught-cards" title="${escape(allCards.map(E.label).join(' · '))}">${pointChips}${allCards.length>lastCards.length?`<i>+${allCards.length-lastCards.length}</i>`:''}</span>`:'';
  $('statusBar').classList.add('friends-status');
  $('statusBar').innerHTML=`<div class="stat stat-dealer"><div class="banker-line">♛ ${tr('庄家','Dealer')} <strong>${escape(dealer)}</strong></div><div class="bid-line"><span class="bid-label">${G.autoFallbackBid?tr('系统定主','Auto trump'):tr('亮主','Bid')}：</span>${announced?`<span class="bid-main">${bidSummaryHtml(announced)}</span>`:tr('等待亮主','Pending')}${G.bids.length>1?`<span class="bid-history-count" title="${tr('亮主／反主次数','Bid/counterbid count')}">×${G.bids.length}</span>`:''}</div></div><div class="stat stat-captured"><span>${caughtCaption}</span>${allKnown?`<strong>${score} <small>/ ${40*G.decks}</small></strong>`:`<strong class="pending-count">${tr('待定','Pending')} ×${calls.filter(c=>!c.revealed).length}</strong>`}${chips}</div><div class="stat friends-stat"><span class="friend-call-label">${tr('本局找朋友','Find friends')}：</span><div class="friend-call-list">${rows||tr('庄家尚未叫朋友','Awaiting friend calls')}</div></div>`;
  fitFriendsStatus();return;
 }

 $('statusBar').classList.remove('friends-status');
 const attackers=1-E.team(G.dealerSeat),threshold=40*G.decks,points=G.captured?.[attackers]||[];
 const shown=points.slice(-7);const full=points.map(c=>E.label(c)).join('  ');
 const dealer=bankerIsSet()?settings.names[G.dealerSeat]:tr('待亮主','Pending bid');
 const announced=G.declared;
 const bidText=announced?`${escape(settings.names[announced.seat])} · ${bidDescription(announced)}`:tr('等待亮主','Waiting for declaration');
 const trumpLabel=G.trump==='N'?tr('无主','NT'):G.trump?coloredSuitInfo(G.trump):tr('待定','Pending');
 const chips=shown.map(c=>`<b class="point-chip ${c.s==='H'||c.s==='D'?'red-point':'black-point'}">${escape(E.label(c))}</b>`).join('');
 $('statusBar').innerHTML=`<div class="stat stat-dealer"><div class="banker-line">♛ ${tr('庄家','DEALER')} <strong>${escape(dealer)}</strong><small>${tr('级','Level')} ${levelName(G.level)}</small></div><div class="bid-line"><span class="bid-label">${G.autoFallbackBid?tr('系统定主','Auto trump'):tr('亮主／反主','Bid / Counterbid')}：</span><b>${announced?escape(settings.names[announced.seat]):tr('等待亮主','Waiting for declaration')}</b> ${announced?bidSummaryHtml(announced):''}${G.trump?' · '+tr('主','Trump')+' '+(G.trump==='N'?tr('无主','NT'):suitGlyph(G.trump)):''}</div></div>`+
 `<div class="stat stat-captured"><span>${tr('闲家抓分','ATTACKERS')}</span><strong>${G.scores[attackers]} <small>/ ${threshold}</small></strong><span class="caught-cards" title="${escape(full||tr('暂时还没有抓到分牌','No scoring cards caught yet'))}">${chips||`<i>${tr('尚无分牌','No point cards')}</i>`}${points.length>shown.length?`<i>+${points.length-shown.length}</i>`:''}</span></div>`;
}
function kittyCardFaces(){return (G?.kitty||[]).map(c=>cardHtml(c,true,false,'kitty-reveal-face')).join('')}
function kittyViewMarkup(finished=false){
 const cards=G?.kitty||[],r=G?.handResults;
 const points=cards.reduce((sum,c)=>sum+E.points(c),0);
 const summary=finished&&r?`${tr('底牌分','Kitty points')} ${points} · ×${r.factor} · ${tr('实际抠底加分','Actual kitty bonus')} +${r.kittyBonus}`:`${cards.length} ${tr('张底牌','cards')} · ${points} ${tr('分','points')}`;
 return `<div class="kitty-view"><p class="kitty-view-summary">${summary}</p><div class="kitty-card-row">${kittyCardFaces()}</div></div>`;
}
function showKitty(){
 if(!G||view!=='game'||G.phase!=='play'||G.dealerSeat!==0){toast(tr('仅本局庄家可以在打牌过程中查看底牌','Only the dealer may view the kitty during play'));return;}
 modal(tr('查看底牌 · 已扣底牌','View Kitty · Buried Cards'),kittyViewMarkup(false));
}
function levelName(n){return n>14?'✓':n===14?'A':n===13?'K':n===12?'Q':n===11?'J':String(n)}
function describePattern(p){if(settings.language!=='en')return E.describe(p);if(p.kind==='single')return'Single';if(p.kind==='group')return({2:'Pair',3:'Triple',4:'Four of a kind'}[p.width]||'Matching cards');if(p.kind==='run')return`${p.length}-group run (×${p.width})`;return'Throw'}

function findFriendCallMarkup(){
 const suits=E.SUITS.filter(s=>s!==G.trump);
 const defaultCalls=F.chooseCalls(G);
 return `<div class="friend-call-grid">${Array.from({length:G.settings.friendCount},(_,i)=>{
  const call=defaultCalls[i]||{s:suits[i%suits.length],r:14,n:1};
  return `<div class="friend-call-item"><strong>${tr('第','Friend ')} ${i+1} ${tr('位朋友','')}</strong><label>${tr('花色','Suit')} <select class="friend-call-select" id="callSuit${i}">${suits.map(s=>`<option value="${s}" ${s===call.s?'selected':''}>${E.SYMBOL[s]} ${escape(suitName(s))}</option>`).join('')}</select><span class="friend-suit-preview ${call.s==='H'||call.s==='D'?'red':'black'}" data-friend-suit-preview="${i}">${E.SYMBOL[call.s]}</span></label><label>${tr('牌点','Rank')} <select class="friend-call-select" id="callRank${i}">${Array.from({length:13},(_,x)=>x+2).filter(r=>r!==G.level&&![5,10,13].includes(r)).map(r=>`<option value="${r}" ${r===call.r?'selected':''}>${levelName(r)}</option>`).join('')}</select></label><label>${tr('第几张','Occurrence')} <select class="friend-call-select" id="callNth${i}">${Array.from({length:G.decks},(_,j)=>j+1).map(n=>`<option value="${n}" ${n===call.n?'selected':''}>${n}</option>`).join('')}</select></label></div>`;
 }).join('')}</div>`;
}
function callFriends(){
 if(!friendsOn()||G.phase!=='call'||G.dealerSeat!==0)return;
 const calls=Array.from({length:G.settings.friendCount},(_,i)=>({s:$('callSuit'+i)?.value,r:+$('callRank'+i)?.value,n:+$('callNth'+i)?.value}));
 const r=F.call(G,0,calls);if(!r.ok){say(r.error,'error');return;}say(tr('叫朋友完成，等待牌出现后认出朋友。','Friend calls registered; identities reveal as cards appear.'),'success');saveGame();render();schedule();
}


function renderBidDock(bids,dealing){
 const dock=$('bidDock');if(!dock)return;
 const active=view==='game'&&G&&['dealing','bid'].includes(G.phase);
 dock.classList.toggle('hidden',!active);
 if(!active){dock.replaceChildren();dock.dataset.renderKey='';return;}
 window.__hhBids=bids;
 const key=JSON.stringify([settings.language,G.phase,bids.map(b=>[b.ids,b.suit,b.count,b.level,b.kind])]);
 if(dock.dataset.renderKey===key)return; // Keep touch targets stable while each card is dealt.
 dock.dataset.renderKey=key;
 dock.innerHTML=`<div class="bid-dock-heading"><strong>${tr('亮主 / 反主','Declare / Counterbid')}</strong><span>${tr('点击下面大按钮选择花色；红桃/方块用红色显示。','Tap a large suit button; hearts/diamonds are red.')}</span></div>`+
  `<div class="bid-dock-actions">`+
  (bids.length?bids.map((b,i)=>`<button type="button" class="bid-big-button" data-bid="${i}" aria-label="${escape(bidDescription(b))}">${bidDescriptionHtml(b)}<span class="bid-verb">${tr('亮主','Declare')}</span></button>`).join(''):`<span class="bid-no-option">${tr('目前没有可亮的级牌','No legal declaration yet')}</span>`)+
  (!dealing?`<button type="button" class="bid-big-button bid-confirm" data-action="finishBid">${tr('确认主牌 · 扣底','Confirm Trump → Kitty')}</button>`:'')+'</div>';
}

function renderFriendsPhase(){
 if(!['dealing','bid'].includes(G.phase))renderBidDock([],false);
 let title='',help='',buttons='';const dealer=G.dealerSeat===null?tr('待定','Pending'):playerTitle(G.dealerSeat);
 if(G.phase==='dealing'||G.phase==='bid'){
  const dealing=G.phase==='dealing',progress=G.totalToDeal?Math.round(100*G.dealCursor/G.totalToDeal):100;
  title=dealing?`${tr('发牌中','Dealing')} ${progress}%`:tr('最后反主 / 定主','Last counterbid / Confirm');
  help=G.declared?`${tr('当前亮主','Current bid')}: ${escape(dealer)} ${bidDescriptionHtml(G.declared)}`:tr('每人按自己的当前级数亮主或反主；最后叫主者坐庄。','Each player bids using their own level; last valid bidder is dealer.');
  const bids=F.legalBids(G,0).slice(0,40);renderBidDock(bids,dealing);buttons='';
 }else if(G.phase==='bury'){
  title=tr('庄家扣底','Bury kitty');help=G.dealerSeat===0?tr(`请选择 ${G.settings.kitty} 张底牌，保留拖拉机原有选牌操作。`,`Choose ${G.settings.kitty} cards; Tractor card controls apply.`):`${escape(dealer)} ${tr('正在扣底','is burying')}`;
  if(G.dealerSeat===0)buttons=`<button class="ui-btn small ghost" data-action="autoBury">${tr('智能选底','Suggest Kitty')}</button><button class="ui-btn primary small" data-action="bury">${tr('确认扣底 · 叫朋友','Bury → Call Friends')}</button>`;
 }else if(G.phase==='call'){
  title=tr('庄家叫朋友 · 仅限副牌','Call Friends · Side Cards Only');help=tr('只能叫副牌且不能叫5、10、K等分牌或当前级牌。出牌时才认朋友；若叫到自己，则可能独自坐庄。','Call only non-point side-suit cards; allies reveal when played. Self-calls are allowed.');
  if(G.dealerSeat===0)buttons=findFriendCallMarkup()+`<button class="ui-btn primary small" data-action="callFriends">${tr('确认叫朋友 · 开始','Confirm & Play')}</button>`;
 }else if(G.phase==='play'){
  title=G.plays.length===G.players?tr('本墩出牌完成','Trick complete'):`${tr('轮到','Turn: ')} ${escape(playerTitle(G.turn))}`;
 }else if(G.phase==='finished'){
  const r=G.handResults;const champion=r.champion!==null&&r.champion!==undefined;title=champion?tr('比赛结束 · 打A坐庄守住！','Match won · Defended A as banker!'):tr('找朋友 · 本局结算','Find Friends · Hand Result');
  help=`${r.takeover?tr('闲家上台','Attackers take over'):tr('庄家守住','Dealer side defends')} · ${r.attackingScore}/${r.threshold} ${tr('分','pts')}`;
  const names=items=>items.map(i=>escape(playerTitle(i))).join('、');
  buttons=`<div class="friends-finish"><p><strong>${tr('庄家阵营','Dealer side')}：</strong>${names(r.allies)} · <strong>${tr('闲家','Attackers')}：</strong>${names(r.attackers)}</p><p>${tr('本局升级','Upgraded')}: ${names(r.winningSeats)} +${r.gain}；${tr('个人级数','Levels')}: ${r.newLevels.map((lv,i)=>escape(playerTitle(i))+' '+levelName(lv)).join(' / ')}</p><p>${tr('朋友公开','Friend calls')}: ${r.calls.map(c=>coloredSuitInfo(c.s)+levelName(c.r)+' #'+c.n+' → '+(c.revealed?escape(playerTitle(c.seat)):'—')).join('；')}</p></div><button class="ui-btn primary small" data-action="${champion?'restartMatch':'nextHand'}">${champion?tr('重新开始比赛','New Match'):tr('下一局（保留个人级数）','Next Deal (keep levels)')}</button>`;
 }
 const el=$('phasePanel');el.classList.toggle('muted-phase',G.phase==='play');el.classList.toggle('hidden',G.phase==='play');el.classList.toggle('deal-phase',['dealing','bid'].includes(G.phase));el.classList.toggle('friend-call-phase',G.phase==='call');
 el.innerHTML=`<div class="phase-text"><strong>${title}</strong>${help?`<p>${help}</p>`:''}</div><div class="phase-buttons">${buttons}</div>${G.phase==='finished'?`<div class="kitty-finished"><strong>${tr('本局底牌揭晓','Kitty Reveal')}</strong>${kittyViewMarkup(true)}</div>`:''}`;
 el.querySelectorAll('[id^=callSuit]').forEach(sel=>sel.addEventListener('change',()=>{const index=sel.id.slice('callSuit'.length);const preview=el.querySelector(`[data-friend-suit-preview="${index}"]`);if(preview){preview.textContent=E.SYMBOL[sel.value]||'';preview.className='friend-suit-preview '+(['H','D'].includes(sel.value)?'red':'black');}}));
}

function renderPhase(){
 if(friendsOn()){renderFriendsPhase();return;}
 if(!['dealing','bid'].includes(G.phase))renderBidDock([],false);
 let title='',help='',buttons='';$('gamePhaseLabel').textContent='';
 if(G.phase==='dealing'||G.phase==='bid'){
  const dealing=G.phase==='dealing';
  const progress=G.totalToDeal?Math.round(100*G.dealCursor/G.totalToDeal):100;
  title=dealing?`${tr('发牌中','Dealing')} · ${progress}%`:tr('最后反主 / 定主','Final Counterbid / Confirm');
  help=G.declared?`${tr('当前亮主','Current bid')}: ${escape(settings.names[G.declared.seat])} ${bidDescriptionHtml(G.declared)}`:tr('各家可以随时亮级牌；机器人会自动判断是否亮主。','Anyone can declare trump; bots can bid during the deal.');
  const bids=E.availableBids(G,0);renderBidDock(bids,dealing);buttons='';
 }else if(G.phase==='bury'){
  if(G.dealerSeat===0){title=tr('扣底牌','Bury the Kitty');help=tr(`新抓的底牌已用金色标出。请选择 ${E.kittySizes[G.decks]} 张牌重新扣底。`,`New kitty cards glow gold in your hand. Choose ${E.kittySizes[G.decks]} cards to bury.`);
    buttons=`<button class="ui-btn small ghost" data-action="autoBury">${tr('智能选底','Suggest Kitty')}</button><button class="ui-btn primary small" data-action="bury">${tr('确认扣底 · 开始','Bury & Start')}</button>`;
  }else{title=tr('电脑正在扣底','AI is burying cards');help='';}
 }else if(G.phase==='play'){
  const player=G.plays.length===totalSeats()?G.lastTrick?.winner:G.turn;
  title=G.plays.length===totalSeats()?`${tr('第','Trick ')} ${G.trickNo} ${tr('墩','')}`:`${tr('轮到','Turn: ')} ${escape(settings.names[player])}`;
  help=G.plays.length===totalSeats()?`${tr('本墩','This trick')}: +${G.lastTrick?.points}${tr('分',' pts')}`:'';
 }else if(G.phase==='finished'){
  const r=G.handResults,champ=r.champion!==null&&r.champion!==undefined;
  title=champ?(r.champion===0?tr('比赛结束 · 我方获胜！','Match Over · Your Team Wins!'):tr('比赛结束 · 对方获胜','Match Over · Opponents Win')):tr('本局结算','Deal Finished');
  help=`${tr('闲家','Attackers')} ${r.score} / ${r.threshold} ${tr('分','pts')} · ${r.takeover?tr('上台','Takeover'):tr('庄家守住','Defenders hold')}`;
  if(r.jackPenalty)help+=` · ${r.jackPenalty.kind==='main'?tr('主J抠底','Main J kitty capture'):tr('副J抠底','Side J kitty capture')} · ${tr('原庄家退到','Banker falls back to')} ${r.jackPenalty.toLevel}`;
  else if(!champ)help+=` · +${r.gain}${tr('级',' levels')}`;
  if(champ)help+=` · ${tr('打A坐庄并守住，比赛获胜','Defended A as banker; match won')}`;
  buttons=champ?`<button class="ui-btn primary small" data-action="restartMatch">${tr('重新开始比赛','New Match')}</button>`:`<button class="ui-btn primary small" data-action="nextHand">${tr('下一局','Next Deal')}</button>`;
 }
 $('phasePanel').classList.toggle('muted-phase',G.phase==='play');$('phasePanel').classList.toggle('hidden',G.phase==='play');
 $('phasePanel').classList.toggle('deal-phase',G.phase==='dealing'||G.phase==='bid');
 $('phasePanel').innerHTML=`<div class="phase-text"><strong>${title}</strong>${help?`<p>${help}</p>`:''}</div><div class="phase-buttons">${buttons}</div>${G.phase==='finished'?`<div class="kitty-finished"><strong>🂠 ${tr('本局底牌揭晓','End-of-deal Kitty Reveal')}</strong>${kittyViewMarkup(true)}</div>`:''}`;
}

function renderActions(){let actions='';if(G.phase==='play')actions=`<button id="playCardsBtn" class="ui-btn primary" data-action="play" ${G.turn===0&&G.plays.length<totalSeats()&&!settings.autoMrQ&&!lastRoundActive?'':'disabled'}>${tr('出牌','Play Cards')}</button><button class="ui-btn ghost" data-action="hint" ${G.turn===0&&G.plays.length<totalSeats()&&!settings.autoMrQ&&!lastRoundActive?'':'disabled'}>${tr('提示','Hint')}</button>${G.dealerSeat===0?`<button class="ui-btn ghost kitty-peek-btn" data-action="showKitty">${tr('查看底牌','View Kitty')}</button>`:''}<button class="ui-btn ghost" data-action="clear">${tr('清除选择','Clear Selection')}</button>`;
 else if(G.phase==='bury')actions=`<button class="ui-btn ghost" data-action="clear">${tr('清除选择','Clear Selection')}</button>`;
 else if(G.phase==='finished')actions=G.handResults?.champion!==null&&G.handResults?.champion!==undefined?`<button class="ui-btn primary" data-action="restartMatch">${tr('重新开始比赛','New Match')}</button>`:`<button class="ui-btn primary" data-action="nextHand">${tr('下一局','Next Deal')}</button>`;
 $('mainActions').innerHTML=actions;
 if(!messageText)messageText=G.phase==='play'?tr('点击卡牌选择，再点击出牌。电脑会在自己的回合自动出牌。','Select cards then click Play. AI opponents play automatically.'):'';
 $('actionMessage').textContent=messageText;$('actionMessage').className='action-message '+messageType;
 $('autoBtn').textContent=tr('AI 托管：','AI Takeover: ')+(settings.autoMrQ?tr('开','On'):tr('关','Off'));$('newHandBtn').textContent=tr('重新发牌','New Deal');}
function renderHistory(){let moves=G.history.filter(x=>x.kind==='play'||x.kind==='trick-end');$('historyTitle').textContent=tr('出牌记录','Move History');$('replayBtn').textContent=tr('查看全部','View all');$('historyContent').innerHTML=moves.slice(-16).reverse().map(x=>x.kind==='trick-end'?`<div class="history-entry"><strong>${tr('第','Trick ')} ${x.trick} ${tr('墩：','· ')}${escape(settings.names[x.winner])}</strong> +${x.points}${tr('分','pts')}</div>`:`<div class="history-entry"><strong>${escape(settings.names[x.seat])}</strong> <span class="cards">${x.cards.map(id=>coloredCardLabel(E.cardFromId(G,id))).join(' ')}</span></div>`).join('')||`<div class="history-entry">${tr('等待第一手牌','Waiting for first move')}</div>`;
 let last=(G.decisions||[]).at(-1);$('strategyTitle').textContent=tr('策略提示 · AI','Strategy · AI');$('strategyText').textContent=last?`${settings.names[last.before.seat]} · ${last.strategy.reason}`:tr('AI 会考虑队友当前是否领先、牌型价值、已知绝门与抓分目标；困难模式加入未知牌采样，不会读取对手的真实手牌。','Bots consider partner control, card structure, voids and point targets. Stronger modes sample unknown cards instead of seeing opponents’ true hands.');}

// ==================== SUDOKU 1.0: per-level sessions, fast-input table ====================
let sudokuSaves=load('HHgames.sudoku.saves.v2',{});
function bootstrapSudoku(){
 if(sudoku&&SUDOKU_LEVELS[sudoku.difficulty]&&!sudoku.completed&&!sudokuSaves[sudoku.difficulty]){
  sudokuSaves[sudoku.difficulty]={...sudoku,startedAt:null,elapsed:sudoku.elapsed||0};
  save('HHgames.sudoku.saves.v2',sudokuSaves);
 }
 sudoku=null;
}
function saveSudoku(){
 if(sudoku&&SUDOKU_LEVELS[sudoku.difficulty]&&!sudoku.completed)sudokuSaves[sudoku.difficulty]=structuredClone(sudoku);
 if(sudoku?.completed)delete sudokuSaves[sudoku.difficulty];
 save('HHgames.sudoku.saves.v2',sudokuSaves);
 save('HHgames.sudoku.current.v1',sudoku);
 save('HHgames.sudoku.records.v1',sudokuRecords);
}
function pauseSudoku(){
 if(sudoku&&!sudoku.completed&&sudoku.startedAt){sudoku.elapsed=sudokuElapsed();sudoku.startedAt=null;saveSudoku();}
 stopSudokuTicker();
}
function sudokuName(level){const d=SUDOKU_LEVELS[level]||SUDOKU_LEVELS.easy;return settings.language==='en'?d.en:d.zh}
function sudokuFmt(sec){sec=Math.max(0,Math.floor(sec||0));return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`}
function sudokuDate(d){const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`}
function sudokuElapsed(){if(!sudoku)return 0;return (sudoku.elapsed||0)+(sudoku.startedAt&&!sudoku.completed?Math.floor((Date.now()-sudoku.startedAt)/1000):0)}
function sudokuShuffle(arr){arr=arr.slice();for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}
function sudokuSolvedBoard(){const rowBands=sudokuShuffle([0,1,2]),colBands=sudokuShuffle([0,1,2]);const rows=rowBands.flatMap(g=>sudokuShuffle([0,1,2]).map(r=>g*3+r));const cols=colBands.flatMap(g=>sudokuShuffle([0,1,2]).map(c=>g*3+c));const nums=sudokuShuffle([1,2,3,4,5,6,7,8,9]);const out=[];for(let r=0;r<9;r++)for(let c=0;c<9;c++)out.push(nums[(rows[r]*3+Math.floor(rows[r]/3)+cols[c])%9]);return out}
function sudokuCandidates(grid,idx){if(grid[idx])return [];const r=Math.floor(idx/9),c=idx%9,br=Math.floor(r/3)*3,bc=Math.floor(c/3)*3;const used=new Set();for(let i=0;i<9;i++){used.add(grid[r*9+i]);used.add(grid[i*9+c]);used.add(grid[(br+Math.floor(i/3))*9+bc+i%3]);}return [1,2,3,4,5,6,7,8,9].filter(n=>!used.has(n))}
function sudokuCountSolutions(grid,limit=2){let idx=-1,cands=null;for(let i=0;i<81;i++)if(!grid[i]){const cand=sudokuCandidates(grid,i);if(!cand.length)return 0;if(!cands||cand.length<cands.length){idx=i;cands=cand;if(cand.length===1)break;}}if(idx<0)return 1;let count=0;for(const n of cands){grid[idx]=n;count+=sudokuCountSolutions(grid,limit-count);if(count>=limit)break;}grid[idx]=0;return count}
function generateSudoku(level){
 // This known unique-solution 17-clue seed is transformed by valid row/column
 // band permutations, optional transposition, and a digit bijection. Filling
 // selected empty cells with their solution values preserves uniqueness.
 // This avoids variable multi-second backtracking at game startup, especially
 // on older iPads in Extreme mode. Difficulty remains clue-count based.
 const base='000000010400000000020000000000050407008000300001090000300400200050100000000806000';
 const solved='693784512487512936125963874932651487568247391741398625319475268856129743274836159';
 const rowBands=sudokuShuffle([0,1,2]),colBands=sudokuShuffle([0,1,2]);
 const rows=rowBands.flatMap(b=>sudokuShuffle([0,1,2]).map(k=>b*3+k));
 const cols=colBands.flatMap(b=>sudokuShuffle([0,1,2]).map(k=>b*3+k));
 const digits=[0,...sudokuShuffle([1,2,3,4,5,6,7,8,9])],transpose=Math.random()<.5;
 const puzzle=[],solution=[];
 for(let r=0;r<9;r++)for(let c=0;c<9;c++){
   const ix=transpose?rows[c]*9+cols[r]:rows[r]*9+cols[c];
   puzzle.push(digits[+base[ix]]);solution.push(digits[+solved[ix]]);
 }
 const blanks=(SUDOKU_LEVELS[level]||SUDOKU_LEVELS.easy).blanks;
 const fill=sudokuShuffle([...Array(81).keys()].filter(i=>!puzzle[i])).slice(0,64-blanks);
 for(const ix of fill)puzzle[ix]=solution[ix];
 return {puzzle,solution};
}
function sudokuConflictSet(values){const bad=new Set(),check=ixs=>{const map=new Map();for(const ix of ixs){const v=values[ix];if(!v)continue;if(!map.has(v))map.set(v,[]);map.get(v).push(ix);}for(const arr of map.values())if(arr.length>1)arr.forEach(ix=>bad.add(ix));};for(let r=0;r<9;r++)check([...Array(9).keys()].map(c=>r*9+c));for(let c=0;c<9;c++)check([...Array(9).keys()].map(r=>r*9+c));for(let br=0;br<3;br++)for(let bc=0;bc<3;bc++)check([...Array(9).keys()].map(i=>(br*3+Math.floor(i/3))*9+bc*3+i%3));return bad}
function sudokuFirstBlank(values){const i=values.findIndex(v=>!v);return i<0?0:i}
function beginSudoku(level){if(!SUDOKU_LEVELS[level])level='easy';const made=generateSudoku(level);sudoku={difficulty:level,puzzle:made.puzzle,solution:made.solution,values:made.puzzle.slice(),notes:Array.from({length:81},()=>[]),selected:sudokuFirstBlank(made.puzzle),startedAt:Date.now(),elapsed:0,completed:false,assistanceUsed:false,history:[],hintCells:[],hintMessage:'',invalidCells:[]};saveSudoku();renderSudoku()}
function sudokuResume(level){const src=sudokuSaves[level];if(!src||src.completed)return beginSudoku(level);sudoku=structuredClone(src);sudoku.startedAt=Date.now();sudoku.history=sudoku.history||[];sudoku.notes=sudoku.notes||Array.from({length:81},()=>[]);sudoku.invalidCells=[];sudoku.hintCells=[];sudoku.hintMessage='';sudoku.assistanceUsed=!!sudoku.assistanceUsed;saveSudoku();renderSudoku()}
function sudokuChooseLevel(level){const existing=sudokuSaves[level];if(existing&&!existing.completed){modal(tr('继续未完成的数独？','Resume unfinished Sudoku?'),`<p><strong>${escape(sudokuName(level))}</strong> · ${tr('已用时','Elapsed')} ${sudokuFmt(existing.elapsed||0)} · ${tr('已完成','Filled')} ${existing.values.filter(Boolean).length}/81</p><p>${tr('继续保留原题目与记录；新游戏会替换此难度的未完成题目。','Resume preserves this puzzle; a new game replaces its saved progress at this difficulty.')}</p><div class="form-actions"><button id="sdResume" class="ui-btn primary">${tr('继续游戏','Resume')}</button><button id="sdNew" class="ui-btn ghost">${tr('开始新题','New Puzzle')}</button></div>`);$('sdResume').onclick=()=>{closeModal();sudokuResume(level)};$('sdNew').onclick=()=>{closeModal();beginSudoku(level)};}else beginSudoku(level)}
function sudokuReturnSelection(){pauseSudoku();sudoku=null;renderSudoku()}
function renderSudokuLobby(){const descriptions={easy:tr('轻松热身','A calm warm-up'),medium:tr('专注推理','Focused logic'),hard:tr('挑战极限','A serious challenge'),expert:tr('极限冲刺','The ultimate test')};$('sudokuLobby').innerHTML=`<div class="sdk-selection-head"><span>HH / SUDOKU</span><strong>${tr('选一个难度，开始挑战','Choose your challenge')}</strong><p>${tr('9×9 数独 · 四档挑战 · 自动计时','Classic 9×9 · Four levels · Timed')}</p></div><div class="sdk-level-grid">`+Object.values(SUDOKU_LEVELS).map((x,i)=>{const best=sudokuRecords.filter(r=>r.difficulty===x.key).sort((a,b)=>a.seconds-b.seconds)[0];const ongoing=sudokuSaves[x.key]&&!sudokuSaves[x.key].completed;return `<button class="sdk-level-card sdk-level-${i}" data-sudoku-start="${x.key}"><span class="sdk-level-index">0${i+1}</span><strong>${escape(sudokuName(x.key))}</strong><span class="sdk-level-sub">${descriptions[x.key]}</span><span class="sdk-level-best">${tr('最佳','BEST')} ${best?sudokuFmt(best.seconds):'--:--'}</span>${ongoing?`<span class="sdk-level-resume">${tr('有未完成题目','Resume available')}</span>`:''}</button>`;}).join('')+`</div><button class="sdk-history-btn" data-sudoku-history="1">${tr('查看历史成绩 · Top 20','History · Top 20')} <span>↗</span></button>`}
function renderSudokuStatsOnly(){if(view!=='sudoku'||!sudoku)return;const rows=sudokuRecords.filter(r=>r.difficulty===sudoku.difficulty).sort((a,b)=>a.seconds-b.seconds),remain=sudoku.values.filter(v=>!v).length;$('sudokuStats').innerHTML=`<span class="sdk-stat"><span>${escape(sudokuName(sudoku.difficulty))}</span></span><span class="sdk-stat"><span>${tr('计时','Time')}</span> <strong>${sudokuFmt(sudokuElapsed())}</strong></span><span class="sdk-stat"><span>${tr('剩余','Empty')}</span> <strong>${remain}</strong></span><span class="sdk-stat"><span>${tr('最快','Best')}</span> <strong>${rows[0]?sudokuFmt(rows[0].seconds):'--:--'}</strong></span>${sudoku.assistanceUsed?`<span class="sdk-unranked">${tr('辅助模式 · 不计排名','Assisted · Not ranked')}</span>`:''}`}
function sudokuCountFilled(n){return sudoku?sudoku.values.filter(v=>v===n).length:0}
function sudokuKey(n,side){const complete=sudokuCountFilled(n)>=9;return `<button type="button" class="sdk-digit-key ${complete?'sdk-complete':''}" ${complete?'disabled aria-disabled="true"':''} data-${side==='fixed'?'sudoku-input':'sudoku-note'}="${n}" aria-label="${side==='fixed'?tr('确定','Confirm'):tr('候选','Note')} ${n}"><span>${n}</span>${side==='note'?`<sup>${sudokuCountFilled(n)}</sup>`:''}</button>`}
function renderSudokuKeys(){if(!sudoku)return;$('sudokuFixedKeys').innerHTML=[1,2,3,4,5,6,7,8,9].map(n=>sudokuKey(n,'fixed')).join('');$('sudokuNoteKeys').innerHTML=[1,2,3,4,5,6,7,8,9].map(n=>sudokuKey(n,'note')).join('')+`<button type="button" class="sdk-digit-key sdk-key-erase" data-sudoku-erase="1" title="${tr('擦除','Erase')}" aria-label="${tr('擦除','Erase')}">⌫</button>`}
function sudokuPeerSet(ix){const r=Math.floor(ix/9),c=ix%9,out=new Set();for(let i=0;i<9;i++){out.add(r*9+i);out.add(i*9+c);}const br=Math.floor(r/3)*3,bc=Math.floor(c/3)*3;for(let rr=br;rr<br+3;rr++)for(let cc=bc;cc<bc+3;cc++)out.add(rr*9+cc);return out}
function renderSudokuBoard(){if(!sudoku)return;const sel=sudoku.selected,number=sel>=0?sudoku.values[sel]:0,peers=sel>=0?sudokuPeerSet(sel):new Set(),invalid=new Set(sudoku.invalidCells||[]),hint=new Set(sudoku.hintCells||[]);$('sudokuBoard').innerHTML=sudoku.values.map((n,ix)=>{const given=sudoku.puzzle[ix]>0,selected=ix===sel,peer=peers.has(ix)&&!selected,same=number>0&&n===number&&!selected,notes=!n?sudoku.notes[ix]||[]:[];const noteHtml=n?'':`<div class="notes">${[1,2,3,4,5,6,7,8,9].map(d=>`<span>${notes.includes(d)?d:''}</span>`).join('')}</div>`;const cls=['sudoku-cell',given?'given':'user',peer&&number?'sdk-excluded':peer?'sdk-peer':'',same?'sdk-same':'',selected?'selected':'',hint.has(ix)?'sdk-target':'',invalid.has(ix)?'sdk-invalid':'',(ix+1)%3===0&&ix%9!==8?'border-r':'',Math.floor(ix/9)%3===2&&ix<72?'border-b':''].filter(Boolean).join(' ');return `<button type="button" class="${cls}" data-sudoku-cell="${ix}" aria-label="R${Math.floor(ix/9)+1}C${ix%9+1}${n?` ${n}`:''}">${n?`<span class="main-digit">${n}</span>`:noteHtml}</button>`;}).join('')}
function renderSudoku(){adjustButtons();$('sudokuTitle').innerHTML=tr('Sudoku <small>（单机）</small>','Sudoku <small>(Offline)</small>');$('sudokuIntro').textContent=tr('左右数字键快速输入','Fast two-sided input');$('sudokuFixedLabel').textContent=tr('确定','Fixed');$('sudokuNoteLabel').textContent=tr('待定 · 数字角标=已确认个数','Notes · Count fixed');$('sudokuRecordsBtn').textContent=tr('历史','History');$('sudokuBackBtn').textContent=tr('← 难度','← Levels');$('sudokuEraseBtn').textContent=tr('擦除','Erase');$('sudokuUndoBtn').textContent=tr('撤销','Undo');$('sudokuRestartBtn').textContent=tr('重开','Restart');$('sudokuFreshBtn').textContent=tr('新题','New');$('sudokuValidateBtn').textContent=tr('验证','Validate');$('sudokuHintBtn').textContent=tr('提示','Hint');$('sudokuAnalyzeBtn').textContent=tr('分析','Analyze');$('sudokuBackBtn').classList.toggle('hidden',!sudoku);$('sudokuLobby').classList.toggle('hidden',!!sudoku);$('sudokuGame').classList.toggle('hidden',!sudoku);renderSudokuLobby();if(!sudoku){stopSudokuTicker();return}renderSudokuStatsOnly();renderSudokuKeys();renderSudokuBoard();$('sudokuHintText').textContent=sudoku.hintMessage||tr('选择棋盘上的数字：蓝色 = 同数字，黄色 = 其所在行、列和九宫格。','Select a filled cell: blue = same number, yellow = its row, column and 3×3 box.');stopSudokuTicker();if(!sudoku.completed)sudokuTimer=setInterval(()=>{if(view!=='sudoku'||!sudoku||sudoku.completed){stopSudokuTicker();return;}renderSudokuStatsOnly()},1000)}
function sudokuSelect(ix){if(!sudoku)return;sudoku.selected=ix;sudoku.invalidCells=[];sudoku.hintCells=[];sudoku.hintMessage='';saveSudoku();renderSudoku()}
function sudokuPushHistory(){if(!sudoku)return;sudoku.history.push({values:sudoku.values.slice(),notes:sudoku.notes.map(x=>x.slice()),selected:sudoku.selected});if(sudoku.history.length>120)sudoku.history.shift()}
function sudokuInput(n,asNote=false){if(!sudoku||sudoku.completed||sudokuCountFilled(n)>=9)return;const ix=sudoku.selected;if(ix==null||ix<0||sudoku.puzzle[ix])return;sudokuPushHistory();if(asNote){if(sudoku.values[ix])sudoku.values[ix]=0;const set=new Set(sudoku.notes[ix]||[]);set.has(n)?set.delete(n):set.add(n);sudoku.notes[ix]=[...set].sort((a,b)=>a-b)}else{sudoku.values[ix]=n;sudoku.notes[ix]=[];for(const j of sudokuPeerSet(ix))if(j!==ix)sudoku.notes[j]=(sudoku.notes[j]||[]).filter(x=>x!==n)}sudoku.invalidCells=[];sudoku.hintCells=[];sudoku.hintMessage='';saveSudoku();sudokuCheckDone();renderSudoku()}
function sudokuErase(){if(!sudoku||sudoku.completed)return;const ix=sudoku.selected;if(ix==null||ix<0||sudoku.puzzle[ix])return;sudokuPushHistory();sudoku.values[ix]=0;sudoku.notes[ix]=[];sudoku.invalidCells=[];sudoku.hintMessage='';sudoku.hintCells=[];saveSudoku();renderSudoku()}
function sudokuUndo(){if(!sudoku||sudoku.completed||!sudoku.history?.length)return;const prev=sudoku.history.pop();sudoku.values=prev.values;sudoku.notes=prev.notes;sudoku.selected=prev.selected;sudoku.invalidCells=[];sudoku.hintCells=[];sudoku.hintMessage='';saveSudoku();renderSudoku()}
function sudokuRestart(){if(!sudoku)return;const used=!!sudoku.assistanceUsed;sudoku.values=sudoku.puzzle.slice();sudoku.notes=Array.from({length:81},()=>[]);sudoku.selected=sudokuFirstBlank(sudoku.puzzle);sudoku.elapsed=0;sudoku.startedAt=Date.now();sudoku.completed=false;sudoku.history=[];sudoku.hintCells=[];sudoku.invalidCells=[];sudoku.hintMessage='';sudoku.assistanceUsed=used;saveSudoku();renderSudoku()}
function sudokuCheckDone(){if(!sudoku)return;const done=sudoku.values.every((v,i)=>v&&v===sudoku.solution[i])&&sudokuConflictSet(sudoku.values).size===0;if(!done)return;const seconds=sudokuElapsed();sudoku.completed=true;sudoku.elapsed=seconds;sudoku.startedAt=null;if(!sudoku.assistanceUsed){const other=sudokuRecords.filter(r=>r.difficulty!==sudoku.difficulty),same=sudokuRecords.filter(r=>r.difficulty===sudoku.difficulty);same.push({difficulty:sudoku.difficulty,seconds,date:new Date().toISOString()});same.sort((a,b)=>a.seconds-b.seconds);sudokuRecords=other.concat(same.slice(0,20));toast(tr('完成！成绩已进入排行榜。','Solved! Time added to leaderboard.'))}else toast(tr('已完成！使用过提示或分析，本次不计入排行榜。','Solved! Hints were used; this time is unranked.'));saveSudoku()}
function sudokuValidate(){if(!sudoku)return;const bad=[];for(let ix=0;ix<81;ix++)if(sudoku.values[ix]&&sudoku.values[ix]!==sudoku.solution[ix])bad.push(ix);sudoku.invalidCells=bad;sudoku.hintCells=[];sudoku.hintMessage=bad.length?tr(`找到 ${bad.length} 处确定数字错误（红色）；待定笔记未检查。`,`Found ${bad.length} incorrect fixed entries (red); notes were not checked.`):tr('当前所有确定数字正确；空格与待定笔记未检查。','All currently fixed values are correct; blank cells and notes were not checked.');saveSudoku();renderSudoku()}
function sudokuUnits(){const groups=[];for(let r=0;r<9;r++)groups.push({name:tr(`第${r+1}行`,`row ${r+1}`),ids:[...Array(9)].map((_,c)=>r*9+c)});for(let c=0;c<9;c++)groups.push({name:tr(`第${c+1}列`,`column ${c+1}`),ids:[...Array(9)].map((_,r)=>r*9+c)});for(let br=0;br<3;br++)for(let bc=0;bc<3;bc++)groups.push({name:tr(`第${br*3+bc+1}宫`,`box ${br*3+bc+1}`),ids:[...Array(9)].map((_,i)=>(br*3+Math.floor(i/3))*9+bc*3+i%3)});return groups}
function sudokuNextHint(){if(!sudoku)return null;const values=sudoku.values;if(values.every(Boolean))return null;const blanks=[...Array(81).keys()].filter(i=>!values[i]);const options=blanks.map(ix=>({ix,cands:sudokuCandidates(values,ix)}));const label=ix=>`R${Math.floor(ix/9)+1}C${ix%9+1}`;
 const singles=options.filter(x=>x.cands.length===1);if(singles.length){const x=singles[0];return{focus:x.ix,cells:singles.slice(0,3).map(z=>z.ix),kind:'single',n:x.cands[0],text:tr(`${label(x.ix)} 只剩一个合法数字，可优先解决这里。`,`${label(x.ix)} has only one possible digit. Start there.`)}}
 for(const group of sudokuUnits())for(let n=1;n<=9;n++){if(group.ids.some(ix=>values[ix]===n))continue;const fits=group.ids.filter(ix=>!values[ix]&&sudokuCandidates(values,ix).includes(n));if(fits.length===1){const ix=fits[0];return{focus:ix,cells:[ix],kind:'hidden',n,group:group.name,text:tr(`${group.name} 的 ${n} 只能放在 ${label(ix)}。`,`In ${group.name}, ${n} can only go in ${label(ix)}.`)}}}
 options.sort((a,b)=>a.cands.length-b.cands.length);const x=options.find(o=>o.cands.length>0);if(!x)return{focus:blanks[0],cells:[blanks[0]],kind:'conflict',text:tr('当前出现无合法候选的空格，建议先点“验证”。','At least one empty cell has no candidates. Try Validate first.')};const br=Math.floor(Math.floor(x.ix/9)/3)*3,bc=Math.floor((x.ix%9)/3)*3;const cells=options.filter(o=>Math.floor(Math.floor(o.ix/9)/3)*3===br&&Math.floor((o.ix%9)/3)*3===bc).slice(0,3).map(o=>o.ix);return{focus:x.ix,cells,kind:'candidates',cands:x.cands,text:tr(`建议先研究 ${label(x.ix)} 所在的 3×3 宫，重点检查 ${x.cands.join('、')} 的可能性。`,`Inspect the 3×3 box containing ${label(x.ix)}, focusing on candidates ${x.cands.join(', ')}.`)}}
function sudokuHelp(deeper){if(!sudoku||sudoku.completed)return;sudoku.assistanceUsed=true;const h=sudokuNextHint();if(!h)return;const ix=h.focus,r=Math.floor(ix/9),c=ix%9,peer=sudokuPeerSet(ix),values=sudoku.values;const row=[...Array(9)].map((_,j)=>values[r*9+j]).filter(Boolean),col=[...Array(9)].map((_,j)=>values[j*9+c]).filter(Boolean),box=[...peer].filter(j=>Math.floor(j/9)!==r&&j%9!==c).map(j=>values[j]).filter(Boolean);sudoku.hintCells=h.cells;sudoku.selected=ix;sudoku.invalidCells=[];sudoku.hintMessage=h.text;if(deeper){const cands=sudokuCandidates(values,ix);sudoku.hintMessage+=' '+(tr(`分析：本行已有 ${[...new Set(row)].sort().join(',')||'—'}；本列已有 ${[...new Set(col)].sort().join(',')||'—'}；同宫格已用 ${[...new Set(box)].sort().join(',')||'—'}。因此该格的候选为 ${cands.join(',')||'无'}。`,`Analysis: row contains ${[...new Set(row)].sort().join(',')||'none'}; column has ${[...new Set(col)].sort().join(',')||'none'}; 3×3 box has ${[...new Set(box)].sort().join(',')||'none'}. Remaining candidates: ${cands.join(',')||'none'}.`))}saveSudoku();renderSudoku()}
function showSudokuLeaderboard(){const tabs=Object.keys(SUDOKU_LEVELS).map(level=>`<button class="ui-btn small ghost" data-sudoku-rank="${level}">${escape(sudokuName(level))}</button>`).join('');modal(tr('Sudoku 最快记录','Sudoku Best Times'),`<div class="setting-seg">${tabs}</div><div id="sudokuModalRows"></div>`);const update=level=>{const rows=sudokuRecords.filter(r=>r.difficulty===level).sort((a,b)=>a.seconds-b.seconds).slice(0,20);$('sudokuModalRows').innerHTML=`<h3>${escape(sudokuName(level))} · Top 20</h3>`+(rows.length?rows.map((r,i)=>`<div class="sudoku-record-row"><b>#${i+1}</b><span>${escape(sudokuName(r.difficulty))}</span><strong>${sudokuFmt(r.seconds)}</strong><span>${sudokuDate(r.date)}</span></div>`).join(''):`<p>${tr('暂无成绩','No recorded times yet')}</p>`);document.querySelectorAll('[data-sudoku-rank]').forEach(x=>x.classList.toggle('primary',x.dataset.sudokuRank===level))};document.querySelectorAll('[data-sudoku-rank]').forEach(x=>x.onclick=()=>update(x.dataset.sudokuRank));update(sudoku?.difficulty||'easy')}
function openSudokuSettings(){modal(tr('Sudoku 设置','Sudoku Settings'),`${segment(tr('语言','Language'),'language',[['zh','中文'],['en','English']],settings.language)}<p>${tr('左侧输入确定数字；右侧是待定笔记键盘。右侧数字角标表示该数字在棋盘上已被确认的格子数。','Left keypad places fixed digits; right keypad toggles notes. The corner count on the right is the number of confirmed instances of that digit.')}</p><div class="form-actions"><button class="ui-btn primary" id="sdSettingsSave">${tr('保存','Save')}</button></div>`);document.querySelectorAll('[data-setting] .set-choice').forEach(el=>el.onclick=()=>{el.parentElement.querySelectorAll('.set-choice').forEach(x=>x.classList.remove('active'));el.classList.add('active')});$('sdSettingsSave').onclick=()=>{settings.language=chosen('language');persistSettings();closeModal();renderSudoku()}}
function openSudokuFeedback(){if(!sudoku){toast(tr('请选择难度后再报告','Select a difficulty first'));return}pauseSudoku();const snap=()=>JSON.stringify({schema:'HHgames-sudoku-feedback-v2',version:E.VERSION,at:new Date().toISOString(),comment:$('sdFeedbackComment')?.value||'',puzzle:sudoku.puzzle,values:sudoku.values,notes:sudoku.notes,difficulty:sudoku.difficulty,elapsed:sudokuElapsed(),assistanceUsed:sudoku.assistanceUsed,hintCells:sudoku.hintCells,invalidCells:sudoku.invalidCells},null,2);modal(tr('Sudoku 反馈','Sudoku Feedback'),`<p>${tr('下载或复制当前完整棋盘。不会自动上传。','Export the current board; nothing is uploaded automatically.')}</p><textarea id="sdFeedbackComment" rows="3" placeholder="${tr('问题描述（可选）','Optional comment')}"></textarea><div class="form-actions"><button class="ui-btn primary" id="sdFeedbackDownload">${tr('下载 JSON','Download JSON')}</button><button class="ui-btn ghost" id="sdFeedbackCopy">${tr('复制','Copy')}</button></div>`);$('sdFeedbackDownload').onclick=()=>{const blob=new Blob([snap()],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='HHgames-sudoku-feedback.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)};$('sdFeedbackCopy').onclick=async()=>{const ok=await copyText(snap());toast(ok?tr('已复制','Copied'):tr('复制失败','Copy failed'))}}
function sudokuHandleKey(e){if(view!=='sudoku'||!$('dialogBackdrop').classList.contains('hidden'))return false;if(/^[1-9]$/.test(e.key)){sudokuInput(+e.key,e.shiftKey);return true}if(e.key==='Backspace'||e.key==='Delete'){sudokuErase();return true}if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)&&sudoku){let ix=sudoku.selected>=0?sudoku.selected:0,r=Math.floor(ix/9),c=ix%9;if(e.key==='ArrowUp')r=(r+8)%9;if(e.key==='ArrowDown')r=(r+1)%9;if(e.key==='ArrowLeft')c=(c+8)%9;if(e.key==='ArrowRight')c=(c+1)%9;sudoku.selected=r*9+c;saveSudoku();renderSudoku();return true}return false}
function handleTopNew(){if(view==='game'&&G?.handResults?.champion!==null&&G?.handResults?.champion!==undefined){if(confirm(tr('比赛已经结束。重新开始比赛并重置级数？','Match over. Start a new match and reset both team levels?'))){createHand(true);showGame();}return;}if(view==='sudoku'){if(sudoku){if(confirm(tr('放弃当前数独，生成新题目？','Discard current Sudoku and start a new puzzle?')))beginSudoku(sudoku.difficulty)}else showSudoku();return}nextHand()}

function render(){document.body.dataset.cardSize=settings.cardSize||'large';adjustButtons();if(view==='sudoku'){document.title='HHgames · Sudoku';renderSudoku();return;}if(view!=='game'||!G)return;document.title='HHgames · '+(friendsOn()?tr('找朋友','Find Friends'):tr('拖拉机（单机）','Tractor (Offline)'));$('gameEyebrow').textContent=tr('OFFLINE / SOLO · 无需网络','OFFLINE / SOLO · NO INTERNET');$('gameTitle').innerHTML=friendsOn()?tr(`找朋友 <small>（${G.players}人单机）</small>`,`Find Friends <small>(${G.players}-player Offline)</small>`):tr('拖拉机 <small>（单机）</small>','Tractor <small>(Offline)</small>');renderStats();renderPhase();renderSeats();renderTrick();renderHand();renderActions();renderHistory();if(friendsOn())fitFriendsStatus();}
function modal(title,body){clearTimeout(timer);timer=null;$('dialogTitle').textContent=title;$('dialogBody').innerHTML=body;$('dialogBackdrop').classList.remove('hidden');}
function closeModal(){$('dialogBackdrop').classList.add('hidden');feedbackCaptured=null;if(view==='game')schedule();else if(view==='sudoku'&&sudoku&&!sudoku.completed&&!sudoku.startedAt){sudoku.startedAt=Date.now();saveSudoku();renderSudoku();}}
function segment(label,name,values,current){return `<div class="setting-block"><div class="setting-label">${label}</div><div class="setting-seg" data-setting="${name}">${values.map(([value,text])=>`<button type="button" class="set-choice ${current===value?'active':''}" data-choice="${value}">${text}</button>`).join('')}</div></div>`;}
function chosen(name){return document.querySelector(`[data-setting="${name}"] .set-choice.active`)?.dataset.choice;}
function renamePlayer(i){
 const name=playerTitle(i);
 modal(tr('修改玩家名字','Rename Player'),`<p class="rename-target">${friendsOn()?tr('独立级数','Independent Level'):(i%2?tr('金队','Gold Team'):tr('蓝队','Blue Team'))} · ${tr('玩家','Player')} ${i+1}</p><input class="rename-input" id="renameInput" maxlength="30" value="${escape(name)}" aria-label="Player name"><div class="form-actions"><button id="renameCancel" class="ui-btn ghost">${tr('取消','Cancel')}</button><button id="renameSave" class="ui-btn primary">${tr('保存','Save')}</button></div>`);
 const confirmRename=()=>{settings.names[i]=$('renameInput').value.trim()||('Player '+(i+1));persistSettings();if(G){G.settings=friendsOn()?{...G.settings,...E.clone(settings)}:E.clone(settings);saveGame();}closeModal();if(view==='game')render();else renderHub();};
 $('renameSave').onclick=confirmRename;$('renameCancel').onclick=closeModal;
 $('renameInput').onkeydown=e=>{if(e.key==='Enter')confirmRename()};$('renameInput').focus();$('renameInput').select();
}
function openSettings(){const s=settings;
 const secs=[
 ...(fivePlayerMode()?[
 segment(tr('玩家人数','Players'),'players',[4,5,6,7,8,9].map(x=>[String(x),`${x} ${tr('人','players')}`]),String(s.players||5)),
 segment(tr('牌副数','Decks'),'decks',[2,3,4].map(x=>[String(x),`${x} ${tr('副','decks')}`]),String(s.decks||3)),
 segment(tr('叫朋友人数','Friends to call'),'friendCount',[1,2,3,4].map(x=>[String(x),`${x} ${tr('位','friends')}`]),String(s.friendCount||1)),
 `<div class="setting-block"><label class="setting-label" for="sKitty">${tr('底牌张数（1–12，必须平分所有手牌）','Kitty cards (1–12, even hands required)')}</label><input class="kitty-number-input" id="sKitty" type="number" min="1" max="12" step="1" value="${s.kitty||7}"><div id="kittyValidation" class="kitty-validation" role="status"></div></div>`
 ]:[]),
 segment(tr('语言','Language'),'language',[['zh','中文'],['en','English']],s.language),
 ...(!fivePlayerMode()?[segment(tr('牌副数','Decks'),'decks',[1,2,3,4].map(x=>[String(x),`${x} ${tr('副','decks')}`]),String(s.decks))]:[]),
 segment(tr('牌面数字大小','Card Number Size'),'cardSize',[['normal',tr('标准','Normal')],['large',tr('大','Large')],['xlarge',tr('特大','Extra Large')]],s.cardSize||'large'),
 segment(tr('电脑水平','AI Difficulty'),'difficulty',[['basic',tr('基础','Basic')],['strong',tr('策略','Strategic')],['expert',tr('大师','Master')]],s.difficulty),
 segment(tr('出牌速度','Playing Speed'),'speed',[['fast',tr('快','Fast')],['normal',tr('正常','Normal')],['slow',tr('慢','Slow')]],s.speed),
 segment(tr('发牌速度','Dealing Speed'),'dealSpeed',[['verySlow',tr('很慢','Very Slow')],['slow',tr('慢','Slow')],['normal',tr('正常','Normal')],['fast',tr('快','Fast')],['instant',tr('极快','Very Fast')]],s.dealSpeed||'normal'),
 ...(!fivePlayerMode()?[segment(tr('庄家归属','Dealer Rule'),'dealerMode',[['teamRotation',tr('首局亮主者；以后胜方轮庄','First bidder, then winning team rotates')],['bidder',tr('每局亮主者做庄','Bidder is dealer each hand')]],s.dealerMode||'teamRotation')]:[]),
 segment(tr('扣底计分','Kitty Scoring'),'kittyMultiplier',[['classic',tr('标准','Classic')],['exponential',tr('指数','Exponential')]],s.kittyMultiplier)
 ];
 modal((fivePlayerMode()?tr('找朋友','Find Friends'):tr('拖拉机','Tractor'))+' · '+tr('设置','Settings'),`${secs.join('')}<p class="setting-team-note">${fivePlayerMode()?tr('4–9人、2–4副牌、1–4位朋友；人数切换时自动带入对应默认值，之后仍可手工调整；底牌1–12张且必须使每人手牌一样多。最后有效叫主者坐庄。共用拖拉机牌桌，设置及存档独立。','4–9 players, 2–4 decks, 1–4 friend calls. Player count applies its default preset; afterward settings remain editable. Kitty 1–12 must allow equal hands. Last bidder is dealer; shared Tractor table, separate saves.'):tr('四人固定搭档；该玩法有独立设置与存档。','Four-player fixed teams; separate settings and save.')}</p><div class="setting-checks"><label><input id="sJMustDefend" type="checkbox" ${s.jMustDefend!==false?'checked':''}> ${tr('J/A 必打（A 始终要求坐庄守住；此选项控制 J 必打）；主J/副J抠底特殊降级','J/A mandatory (A is always required; this toggle controls J); special J kitty demotions')}</label><label><input id="sBonus" type="checkbox" ${s.bonusOnTakeover?'checked':''}> ${tr('上台就升级（闲家上台立即升一级）','Upgrade on takeover (+1 level)')}</label><label><input id="sThrow" type="checkbox" ${s.allowThrows?'checked':''}> ${tr('可以甩牌','Allow throws')}</label>${!fivePlayerMode()?`<label><input id="sCounterDealer" type="checkbox" ${s.counterbidTakesDealer?'checked':''}> ${tr('反主同时抢庄家权','Counterbid can take dealer seat')}</label>`:''}<label><input id="sAuto" type="checkbox" ${s.autoMrQ?'checked':''}> ${tr('Mr. Q 交给电脑托管','AI plays Mr. Q')}</label></div>

 <div class="form-actions"><button id="saveSettingsBtn" class="ui-btn primary">${tr('保存并返回','Save & Close')}</button><button id="resetMatchBtn" class="ui-btn ghost">${tr('重新开始比赛 · 重置所有级数','New Match · Reset All Levels')}</button></div>`);
 document.querySelectorAll('[data-setting] .set-choice').forEach(el=>el.onclick=()=>{el.parentElement.querySelectorAll('.set-choice').forEach(a=>a.classList.remove('active'));el.classList.add('active')});
 $('saveSettingsBtn').onclick=saveSettings;
 if(fivePlayerMode()){const check=()=>{const players=Number(chosen('players')),decks=Number(chosen('decks')),n=Number($('sKitty').value),valid=F.kittyOptions(players,decks);let msg=F.validateConfig({players,decks,kitty:n,friendCount:Number(chosen('friendCount'))});$('kittyValidation').textContent=msg||`${tr('合法','Valid')} · ${tr('每人','Each player')} ${(54*decks-n)/players} ${tr('张牌','cards')} · ${tr('其他可选底牌数','Valid kitty sizes')}: ${valid.join('、')}`;$('kittyValidation').classList.toggle('invalid',!!msg);$('saveSettingsBtn').disabled=!!msg;};const pick=(field,value)=>{const group=document.querySelector(`[data-setting="${field}"]`);group?.querySelectorAll('.set-choice').forEach(el=>el.classList.toggle('active',String(el.dataset.choice)===String(value)));};document.querySelectorAll('[data-setting="players"] .set-choice').forEach(b=>b.addEventListener('click',()=>{const preset=FRIEND_PRESETS[Number(chosen('players'))];if(!preset)return;pick('decks',preset.decks);pick('friendCount',preset.friendCount);$('sKitty').value=String(preset.kitty);check();}));document.querySelectorAll('[data-setting="decks"] .set-choice,[data-setting="friendCount"] .set-choice').forEach(b=>b.addEventListener('click',()=>{const players=Number(chosen('players')),decks=Number(chosen('decks')),valid=F.kittyOptions(players,decks);if(!valid.includes(Number($('sKitty').value))){$('sKitty').value=String(valid.reduce((best,x)=>Math.abs(x-7)<Math.abs(best-7)?x:best,valid[0]));}check();}));$('sKitty').addEventListener('input',check);check();}
 $('resetMatchBtn').onclick=()=>{if(confirm(tr('重置所有级数并开始新比赛？','Reset all levels and start over?'))){createHand(true);closeModal();showGame()}};
}
function saveSettings(){
 const priorDecks=G?.decks??settings.decks;
 const previousFriends=G?.settings?.friendCount,priorPlayers=G?.players,priorKitty=G?.settings?.kitty;
 settings.gameMode=activeMode;
 if(fivePlayerMode()){const request={players:Number(chosen('players')),decks:Number(chosen('decks')),kitty:Number($('sKitty').value),friendCount:Number(chosen('friendCount'))};const error=F.validateConfig(request);if(error){toast(error);return;}Object.assign(settings,request);}else settings.decks=Number(chosen('decks'));
 settings.cardSize=chosen('cardSize');settings.difficulty=chosen('difficulty');settings.speed=chosen('speed');settings.dealSpeed=chosen('dealSpeed');settings.kittyMultiplier=chosen('kittyMultiplier');
 settings.dealerMode=fivePlayerMode()?'bidder':chosen('dealerMode');settings.counterbidTakesDealer=fivePlayerMode()?true:$('sCounterDealer').checked;
 settings.jMustDefend=$('sJMustDefend').checked;settings.bonusOnTakeover=$('sBonus').checked;settings.allowThrows=$('sThrow').checked;settings.autoMrQ=$('sAuto').checked;settings.language=chosen('language');
 persistSettings();closeModal();
 if(G&&(priorDecks!==settings.decks||(friendsOn()&&(previousFriends!==settings.friendCount||priorPlayers!==settings.players||priorKitty!==settings.kitty)))){createHand(true);showGame();}
 else{if(G){G.settings=friendsOn()?{...G.settings,...E.clone(settings)}:E.clone(settings);saveGame();}adjustButtons();renderHub();if(view==='game'){render();schedule();}}
}

function openRules(){if(view==='sudoku'){modal(tr('Sudoku 规则','Sudoku Rules'),`<p>${tr('标准 9×9 数独，每行、每列及每个 3×3 宫格都包含 1–9。','Standard 9×9 Sudoku: each row, column and 3×3 box contains 1–9.')}</p><ol class="rule-list"><li>${tr('左侧数字输入确定值；右侧两列数字输入待定候选。右侧数字角标是棋盘已确定的同数字数量。','Left keypad enters confirmed digits; two columns on the right toggle tentative notes, with corner counts of placed digits.')}</li><li>${tr('选择数字后，相同的已确定数字显示为蓝色，同行、同列、同宫变黄色。','Select a filled cell: identical placed digits highlight blue; its row, column and box turn yellow.')}</li><li>${tr('验证只检查填入的确定数字，不检查待定笔记。提示与分析会使本题退出最快记录排名。','Validate checks confirmed entries only, not pencil notes. Hint or Analyze makes the current puzzle ineligible for ranked records.')}</li><li>${tr('可以返回难度页保留未完成题目；同难度再进入时可选择继续或开始新题。','Return to the difficulty selection page without losing progress. Entering a level again offers resume or start new.')}</li></ol>`);return;}if(friendsOn()||fivePlayerMode()){modal(tr('找朋友规则（4–9人）','Find Friends Rules (4–9 Players)'),`<p>${tr('共用拖拉机的主牌、跟牌、牌型、扣底和历史回放规则。','Uses the shared Tractor rules for trump, follows, combinations, kitty and replay.')}</p><ol class="rule-list"><li>${tr('可选4–9人、2–4副牌、1–4位朋友；底牌数为1–12且必须能平分剩余牌，默认5人、3副、7张。','Choose 4–9 players, 2–4 decks, and 1–4 friends. Use 1–12 kitty cards so remaining cards divide equally; default 5 players, 3 decks, 7 kitty.')}</li><li>${tr('每人独立记录2到A的级数。每次亮主使用自己的级牌；最后有效亮主者坐庄。','Each player has an independent 2–A level. Bids use the bidder’s own level; the last valid bidder is dealer.')}</li><li>${tr('庄家逐条指定叫朋友条件，只能叫副花色非分牌（不能叫主牌、级牌、5、10、K），次数不超过牌副数。','Dealer calls a side-suit non-point card per friend, excluding trump, level, 5, 10 and K; appearance number cannot exceed deck count.')}</li><li>${tr('身份仅在被叫的牌打出时公开；叫到庄家自己则可能单独对抗其他玩家。','Allies reveal when called cards appear. Self-calls can leave the dealer playing alone.')}</li><li>${tr('本局获胜者各自按升级规则升级，下一局重新叫主、重新找朋友。','Winning players advance individually; the next hand has new bidding and new friend calls.')}</li></ol>`);return;}modal(tr('拖拉机规则 · 已实现范围','Tractor Rules · Implemented Scope'),`<p>${tr('拖拉机属于升级（Sheng Ji）系列，四人两队，对家为队友。以下为当前 HHgames 的确切玩法。不同地区存在规则差异，可在设置中调整部分条款。','Tractor is a Sheng Ji game for two opposite-seat partnerships. These are the exact rules of the current HHgames build. Regional variations exist.')}</p>
 <ol class="rule-list"><li><strong>${tr('牌副数与底牌：','Decks and kitty:')}</strong> 1/2/3/4 ${tr('副牌对应','decks use')} 4/8/10/12 ${tr('张底牌','kitty cards')}. ${tr('一副牌另外移出2张非分牌。','One deck sets aside two zero-point cards.')}</li>
 <li><strong>${tr('主牌：','Trumps:')}</strong>${tr('四张花色中的一种（或无主），所有级牌及大小王均为主牌。大王＞小王＞主花色级牌＞其他级牌＞其余主花色牌。','A suit (or no-trump), all level cards and jokers. Red joker > black joker > same-suit level > other level > ordinary trump-suit cards.')}</li>
 <li><strong>${tr('亮主：','Declaration:')}</strong>${tr('支持单张级牌、同花色级牌对子及大小王对子反主；首局亮主者坐庄；无人亮主时会自动选择合法亮主。发牌过程中可以实时亮主或反主；发完牌后保留最终反主确认阶段。','Supports level singles, duplicate level pairs and joker-pair overrides. The first bidder becomes dealer. If none bids, a valid declaration is selected automatically; bidding and counterbidding take place during the animated deal, followed by a confirmation stage.')}</li>
 <li><strong>${tr('出牌与跟牌：','Lead and follow:')}</strong>${tr('支持单张、对子、刻子、四张、连对、连刻及连续四张。必须尽量跟花色和结构。若绝门，纯主牌且牌型一致可毙牌。','Supports singles, pairs, triples, quads and same-width consecutive runs. Follow led suit and structure as far as possible; a complete matching trump combination can ruff if void.')}</li>
 <li><strong>${tr('抓分：','Point cards:')}</strong>${tr('5算5分，10和K各10分。闲家目标为 40×牌副数（默认两副=80分），再每多20×副数升一级。上台直接升一级可以单独开关。','5 = 5 points; 10 and K = 10 each. Attackers take over at 40×decks (80 for two decks), and gain a level per extra 20×decks. Immediate +1 takeover is optional.')}</li>
 <li><strong>${tr('抠底：','Kitty:')}</strong>${tr('闲家最后一墩获胜，得底牌分并按牌型翻倍。默认：单张×2、对子×4、两连对×8；另外可选择指数玩法。','Attackers winning the final trick capture multiplied kitty points. Default: single ×2, pair ×4, two-pair run ×8. An exponential variation is also available.')}</li>
 <li><strong>${tr('轮庄升级：','Progression:')}</strong>${tr('庄家守住则同队对家下一局坐庄；闲家上台则换到另一队，由下一位置玩家坐庄。打 A 必须本方坐庄并守住才能赢得整场比赛；任何队都不能直接跳过 A 获胜。','If defenders hold, the partner deals next. If attackers succeed, the next seat takes over as dealer. To win the match a team must defend its A deal as banker; reaching or taking over at A is not sufficient.')}</li><li><strong>${tr('J 必打与钩J：','Mandatory J and J-hook:')}</strong>${tr('默认开启：不允许跳过J；必须在J级坐庄守住才可升到Q及更高。庄家打J时，闲家达到上台分数并抠底，若最后一墩决定性获胜牌是主J则庄家退到2，若是副J则退到7。设置可关闭整组J特殊规则。','On by default: J may not be skipped; a partnership must defend a J deal as banker to advance to Q or above. If attackers reach the target and win the final trick with a decisive main-suit J, the banker resets to 2; with a decisive off-suit J, to 7. Disable the setting to turn off these special J rules.')}</li></ol>
 <div class="notice"><strong>${tr('当前仍有限制：','Known limitations:')}</strong> ${tr('复杂混合甩牌只提供实验选项，复杂组合的完全规范跟牌和判胜尚未实现；部分地区的抢底/反底与钩级规则尚未实现。AI 具有战术和抽样，但尚非经过对战验证的专家水平。','Mixed throws are experimental and not fully adjudicated; re-burying after a kitty counterbid and regional hook rules are not supported. AI uses tactics and sampling but has not been benchmarked as expert-level.')}</div>
 <h3>${tr('参考资料','Rules reference')}</h3><div class="sources"><p><a href="https://www.pagat.com/kt5/tractor.html" target="_blank" rel="noopener">Pagat — Tractor / Sheng Ji</a></p><p><a href="https://robertying.com/shengji/rules.html" target="_blank" rel="noopener">Sheng Ji: Rules and example tricks</a></p><p><a href="https://tractorcardgame.com/2022/03/4-player-shengji/" target="_blank" rel="noopener">四人升级竞赛规则 / regional variations</a></p></div>`);}
function openHistory(){if(!G){toast(tr('尚无游戏记录','No game history'));return}
 const rows=G.history.map((x,i)=>{if(x.kind==='play')return `${String(i+1).padStart(3,'0')} · ${tr('第','Trick ')}${x.trick}${tr('墩','')} · ${settings.names[x.seat]}: ${x.cards.map(id=>E.label(E.cardFromId(G,id))).join(' ')}${x.bot?' [AI]':''}`;
 if(x.kind==='trick-end')return `— ${tr('第','Trick ')}${x.trick}${tr('墩结束',' ended')}: ${settings.names[x.winner]} +${x.points}`;
 if(x.kind==='bid')return `${settings.names[x.seat]} ${tr('亮主','declared')} ${bidDescription({...x,kind:x.kindDetail})}`;
 if(x.kind==='hand-end')return `${tr('本局结算','Deal result')}：${JSON.stringify(x.results)}`;
 return x.kind});
 modal(tr('完整出牌记录','Full Move History'),`<div class="feedback-summary" style="max-height:55vh;white-space:pre-wrap">${escape(rows.join('\n'))}</div><div class="form-actions"><button id="historyFeedbackBtn" class="ui-btn primary">${tr('发现问题？导出反馈','Found an issue? Export feedback')}</button></div>`);
 $('historyFeedbackBtn').onclick=()=>openFeedback();}
function friendFeedbackSnapshot(g){return{...F.snapshot(g),schema:'HHgames-feedback-v1',appVersion:E.VERSION,exportedAt:new Date().toISOString(),botDecisions:g.decisions||[]};}
function feedbackJSON(){const result=feedbackCaptured?E.clone(feedbackCaptured):G?(friendsOn()?friendFeedbackSnapshot(G):E.fullSnapshot(G,'')):{schema:'HHgames-feedback-v1',appVersion:E.VERSION,exportedAt:new Date().toISOString(),settings:E.clone(settings),currentScreen:'hub'};result.comment=$('feedbackComment')?.value||'';result.visualSort=handSort;result.cardSize=settings.cardSize||'large';result.viewport={width:innerWidth,height:innerHeight};const idx=$('feedbackTarget')?.value;if(idx!==undefined&&idx!==''){result.focusDecisionIndex=Number(idx);result.focusDecision=result.botDecisions?.[Number(idx)]||null;}return result;}
function feedbackText(){return JSON.stringify(feedbackJSON(),null,2)}
const BUG_STORAGE='HHgames.tractor.savedBugs.v1';
let savedBugs=load(BUG_STORAGE,[]);if(!Array.isArray(savedBugs))savedBugs=[];
function bugsBundle(){return{schema:'HHgames-feedback-batch-v1',appVersion:E.VERSION,exportedAt:new Date().toISOString(),count:savedBugs.length,bugs:savedBugs}}
function savedBugSummary(){return `${tr('已保存','Saved')} ${savedBugs.length} ${tr('条反馈','reports')}`}
function updateSavedBugSummary(){const el=$('savedBugCount');if(el)el.textContent=savedBugSummary();for(const id of ['copyAllBugsBtn','downloadAllBugsBtn','clearBugsBtn']){const btn=$(id);if(btn)btn.disabled=savedBugs.length===0;}}
function saveCurrentBug(){const report=feedbackJSON();const entry={savedAt:new Date().toISOString(),report};const next=[...savedBugs,entry];try{localStorage.setItem(BUG_STORAGE,JSON.stringify(next))}catch(e){toast(tr('本地保存失败：可能是存储空间不足。请下载已存反馈后清理。','Local storage full or unavailable. Download your reports first.'));return false;}savedBugs=next;updateSavedBugSummary();toast(tr('已保存完整错误现场。','Complete bug snapshot saved.'));return true}
async function copyAllBugs(){if(!savedBugs.length)return;const ok=await copyText(JSON.stringify(bugsBundle(),null,2));toast(ok?tr(`已复制 ${savedBugs.length} 条反馈`,`Copied ${savedBugs.length} reports`):tr('无法复制，请改用下载全部。','Copy failed; use Download All.'))}
function downloadAllBugs(){if(!savedBugs.length)return;const text=JSON.stringify(bugsBundle(),null,2);downloadJSON(text,`HHgames-all-bugs-${new Date().toISOString().slice(0,10)}.json`);toast(tr('全部反馈已下载','All bug reports downloaded'))}
function clearAllBugs(){if(!savedBugs.length)return;if(!confirm(tr(`确定清除全部 ${savedBugs.length} 条本地反馈？此操作不可恢复。建议先下载备份。`,`Permanently clear all ${savedBugs.length} locally saved reports? Download a backup first.`)))return;try{localStorage.removeItem(BUG_STORAGE)}catch(e){toast(tr('清除失败','Clear failed'));return;}savedBugs=[];updateSavedBugSummary();toast(tr('已清除所有已保存反馈','Saved reports cleared'))}
function downloadJSON(value,filename){const blob=new Blob([value],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function openFeedback(){feedbackCaptured=G?(friendsOn()?friendFeedbackSnapshot(G):E.fullSnapshot(G,'')):null;const last=G?.decisions?.at(-1);const preview=last?`${tr('最近机器人动作','Last bot move')}：${escape(settings.names[last.before.seat])}, ${tr('第','trick ')} ${last.before.trickNo} ${tr('墩','')}, ${escape(last.move.map(id=>E.label(E.cardFromId(G,id))).join(' '))}. ${escape(last.strategy.reason||'')}`:tr('尚未有机器人出牌记录，也可以报告界面或规则问题。','No bot decisions yet. You can still report a UI or rule issue.');
 modal(tr('反馈与错误现场','Feedback & Diagnostic Snapshot'),`<p>${tr('发现错误时可先点「保存」，继续游戏再收集其他错误。稍后一次性复制或下载全部错误现场。','Press Save whenever you find a problem. Continue playing and collect more issues; then Copy All or Download All together.')}</p>
 <div class="feedback-summary">${preview}</div>${G?.decisions?.length?`<label class="field" style="margin-top:13px">${tr('选择哪一次机器人出牌','Which bot move was wrong?')}<select id="feedbackTarget">${G.decisions.map((d,i)=>({d,i})).slice(-25).reverse().map(({d,i})=>`<option value="${i}">${tr('第','Trick ')} ${d.before.trickNo} ${tr('墩','')} · ${escape(settings.names[d.before.seat])} · ${escape(d.move.map(id=>E.label(E.cardFromId(G,id))).join(' '))}</option>`).join('')}</select></label>`:''}<label class="field" style="margin-top:15px">${tr('你的评论（可不填）','Your comment (optional)')}<textarea id="feedbackComment" rows="3" placeholder="${tr('说明哪里不合理，保存后可以继续收集其他问题','Describe the problem, then save and keep playing')}"></textarea></label>
 <div class="notice">${tr('隐私：完整快照含各家隐藏手牌、底牌和玩家名字。保存仅存在本设备；不会自动上传。','Privacy: snapshots contain all hidden hands, the kitty and player names. Save stores them locally only; nothing is uploaded.')}</div>
 <div class="form-actions"><button id="saveBugBtn" class="ui-btn primary">${tr('保存这一条','Save this bug')}</button><button id="downloadFeedbackBtn" class="ui-btn ghost">${tr('下载当前 JSON','Download current')}</button><button id="copyFeedbackBtn" class="ui-btn ghost">${tr('复制当前','Copy current')}</button></div>
 <div class="feedback-collection"><strong id="savedBugCount">${savedBugSummary()}</strong><div class="form-actions"><button id="copyAllBugsBtn" class="ui-btn primary">${tr('复制全部','Copy All')}</button><button id="downloadAllBugsBtn" class="ui-btn ghost">${tr('下载全部','Download All')}</button><button id="clearBugsBtn" class="ui-btn ghost">${tr('清除全部','Clear')}</button></div></div>`);
 $('saveBugBtn').onclick=saveCurrentBug;$('downloadFeedbackBtn').onclick=downloadFeedback;$('copyFeedbackBtn').onclick=async()=>{const ok=await copyText(feedbackText());toast(ok?tr('当前反馈已复制','Current report copied'):tr('复制失败，请下载 JSON','Copy failed; download JSON'))};
 $('copyAllBugsBtn').onclick=copyAllBugs;$('downloadAllBugsBtn').onclick=downloadAllBugs;$('clearBugsBtn').onclick=clearAllBugs;updateSavedBugSummary();}
function downloadFeedback(){let json=feedbackText(),blob=new Blob([json],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`HHgames-feedback-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast(tr('现场快照已下载','Snapshot downloaded'))}
async function copyText(s){try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(s);return true}}catch(e){}
 try{const el=document.createElement('textarea');el.value=s;el.style.position='fixed';el.style.opacity='0';document.body.append(el);el.select();const ok=document.execCommand('copy');el.remove();return !!ok}catch(e){return false}}
function handleAction(action){switch(action){case'guandanOffline':location.href='guandan/index.html?mode=offline';break;case'guandanOnline':location.href='guandan/index.html?mode=online';break;case'tractor':case'tractorOffline':enterOffline('classic');break;case'friendsOffline':enterOffline('friends');break;case'tractorOnline':onlineInfo('classic');break;case'friendsOnline':onlineInfo('friends');break;case'sudoku':showSudoku();break;case'callFriends':callFriends();break;case'dealFaster':adjustDealing(1);break;case'dealSlower':adjustDealing(-1);break;case'finishBid':finalizeBid();break;case'autoBury':buryAuto();break;case'bury':burySelected();break;case'play':userPlay();break;case'hint':hint();break;case'showKitty':showKitty();break;case'clear':dismissHint();selected.clear();render();break;case'closeHint':dismissHint();break;case'feedback':openFeedback();break;case'nextHand':nextHand();break;case'restartMatch':if(confirm(friendsOn()?tr('重新开始并重置所有玩家的级数？','Start over and reset every player level?'):tr('开始新比赛并将两队等级归零？','Start new match and reset both teams?'))){createHand(true);showGame()}break;}}
function setup(){ bootstrapSudoku();$('felt').appendChild($('phasePanel')); $('felt').appendChild($('bidDock')); $('felt').appendChild(document.querySelector('.action-panel')); if(!['zh','en'].includes(settings.language))settings.language='zh';if(!G||!G.phase||!G.hands){G=null}else{if(!friendsOn()&&G.match)match=G.match;}
 const bidDock=$('bidDock');let lastPointerBid=0;
 if(bidDock){
  // Process finger/mouse input before the animated deal can replace the target.
  bidDock.addEventListener('pointerdown',e=>{if(e.button!==0||e.isPrimary===false)return;const button=e.target.closest('button[data-bid]');if(!button)return;const choice=window.__hhBids?.[Number(button.dataset.bid)];if(!choice)return;lastPointerBid=Date.now();e.preventDefault();e.stopPropagation();doBid(choice.ids);},{passive:false});
  bidDock.addEventListener('click',e=>{if(e.target.closest('button[data-bid]')&&Date.now()-lastPointerBid<650){e.preventDefault();e.stopPropagation();}});
 }
 $('brand').onclick=showHub;$('homeBtn').onclick=showHub;$('languageBtn').onclick=()=>{settings.language=settings.language==='zh'?'en':'zh';persistSettings();adjustButtons();renderHub();if(view==='game')render();if(view==='sudoku')renderSudoku();if(!$('dialogBackdrop').classList.contains('hidden'))closeModal()};
 $('settingsBtn').onclick=()=>view==='sudoku'?openSudokuSettings():openSettings();$('rulesBtn').onclick=openRules;$('feedbackBtn').onclick=()=>view==='sudoku'?openSudokuFeedback():openFeedback();$('closeDialogBtn').onclick=closeModal;
 $('newHandBtn').onclick=handleTopNew;$('lastTrickBtn').onclick=toggleLastTrick;$('reviewNextBtn').onclick=reviewNextTrick;$('reviewCurrentBtn').onclick=returnToCurrentTrick;$('autoBtn').onclick=toggleAuto;$('replayBtn').onclick=openHistory;$('replayTopBtn').onclick=openHistory;
 if($('sudokuBackBtn'))$('sudokuBackBtn').onclick=sudokuReturnSelection;
 if($('sudokuRecordsBtn'))$('sudokuRecordsBtn').onclick=showSudokuLeaderboard;
 if($('sudokuEraseBtn'))$('sudokuEraseBtn').onclick=sudokuErase;
 $('sudokuValidateBtn').onclick=sudokuValidate;$('sudokuHintBtn').onclick=()=>sudokuHelp(false);$('sudokuAnalyzeBtn').onclick=()=>sudokuHelp(true);
 if($('sudokuUndoBtn'))$('sudokuUndoBtn').onclick=sudokuUndo;
 if($('sudokuRestartBtn'))$('sudokuRestartBtn').onclick=sudokuRestart;
 if($('sudokuFreshBtn'))$('sudokuFreshBtn').onclick=()=>{if(sudoku&&confirm(tr('放弃此题，开始新题？','Start a new puzzle and discard this one?')))beginSudoku(sudoku.difficulty)};
 $('dialogBackdrop').onclick=e=>{if(e.target===$('dialogBackdrop'))closeModal()};document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();if(sudokuHandleKey(e)){e.preventDefault();return;}if(e.key==='Enter'&&view==='game'&&G?.phase==='play'&&$('dialogBackdrop').classList.contains('hidden'))userPlay()});
 document.addEventListener('click',e=>{const rename=e.target.closest('[data-rename]');if(rename){renamePlayer(+rename.dataset.rename);return;}const pack=e.target.closest('[data-pack]');if(pack){handlePackClick(pack.dataset.pack);return;}const card=e.target.closest('[data-card]');if(card){pickCard(card.dataset.card);return}const bid=e.target.closest('[data-bid]');if(bid){const v=window.__hhBids?.[Number(bid.dataset.bid)];if(v)doBid(v.ids);return}const sort=e.target.closest('[data-sort]');if(sort){handSort=sort.dataset.sort;try{localStorage.setItem('HHgames.handSort.v3',handSort)}catch(err){}renderHand();return}const sdStart=e.target.closest('[data-sudoku-start]');if(sdStart){sudokuChooseLevel(sdStart.dataset.sudokuStart);return}const sdHistory=e.target.closest('[data-sudoku-history]');if(sdHistory){showSudokuLeaderboard();return}const sdErase=e.target.closest('[data-sudoku-erase]');if(sdErase){sudokuErase();return}const sdCell=e.target.closest('[data-sudoku-cell]');if(sdCell){sudokuSelect(+sdCell.dataset.sudokuCell);return}const sdIn=e.target.closest('[data-sudoku-input]');if(sdIn){sudokuInput(+sdIn.dataset.sudokuInput,false);return}const sdNote=e.target.closest('[data-sudoku-note]');if(sdNote){sudokuInput(+sdNote.dataset.sudokuNote,true);return}const action=e.target.closest('[data-action]');if(action)handleAction(action.dataset.action)});
 window.addEventListener('resize',()=>{adjustButtons();if(view==='game'){renderHand();if(friendsOn()){positionFriendSeats();fitMultiPlayedCards();fitFriendsStatus();}}if(view==='sudoku')renderSudoku()});bindPackGestures();adjustButtons();renderHub();showHub();}
window.addEventListener('error',e=>{console.error('HHgames error',e.error||e.message);if($('actionMessage'))say(tr('运行出错：','Runtime error: ')+(e.message||''),'error')});
window.HHAppDebug={enterOffline,persistSettings,openSettings,handleAction,showKitty,kittyViewMarkup,getSavedBugs:()=>savedBugs,saveCurrentBug,bugsBundle,openFeedback,completedTrickArchive,reviewPreviousTrick,reviewNextTrick,returnToCurrentTrick,getReviewTrickNo:()=>reviewTrickNo,finishDeal(){if(!G||G.phase!=='dealing')return;clearTimeout(timer);while(G.phase==='dealing'){const next=G.dealPile.shift();if(next){G.hands[next.seat].push(next.card);E.sort(G.hands[next.seat],G);G.dealCursor++;if(next.seat!==0)maybeBotBid(next.seat);}else{G.phase='bid';break;}if(!G.dealPile.length){G.phase='bid';for(let seat of Array.from({length:totalSeats()-1},(_,i)=>i+1))maybeBotBid(seat);}}saveGame();render();},toggleLastTrick,getGame:()=>G,getSettings:()=>settings,createHand,showGame,finalizeBid,autoBury(){if(G?.phase==='bury'&&G.dealerSeat===0){const cards=friendsOn()?F.chooseBury(G):E.chooseKitty(G,0);selected=new Set(cards.map(c=>c.id));burySelected();}},botMove(){if(!G||G.phase!=='play'||G.plays.length===totalSeats())return;const p=G.turn,v=friendsOn()?F.botMove(G,p):B.choose(G,p);playMove(p,v.cards,v)},export:()=>G&&(friendsOn()?F.snapshot(G):E.fullSnapshot(G,'')),getSudoku:()=>sudoku,getSudokuSaves:()=>sudokuSaves,beginSudoku,sudokuChooseLevel,sudokuValidate,sudokuHelp,sudokuCheckDone,sudokuReturnSelection,generateSudoku,sudokuCountSolutions};
setup();
// Installed/hosted versions may cache assets. The standalone HTML is fully offline.
if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost'))navigator.serviceWorker.register('./sw.js?v=1.22.0').catch(()=>{});
})();
