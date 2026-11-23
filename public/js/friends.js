/* Find Friends: five-player hidden partnership rules. Shares Tractor rank and follow rules. */
(function(root){'use strict';
const E=root.HHEngine,B=root.HHBot,F={};
const copy=x=>JSON.parse(JSON.stringify(x));
const choose=x=>x[Math.floor(Math.random()*x.length)];
F.VERSION='v1.21.0';
F.kittyOptions=(players=5,decks=3)=>{
 if(!Number.isInteger(players)||players<4||players>9||!Number.isInteger(decks)||decks<2||decks>4)return [];
 return Array.from({length:12},(_,i)=>i+1).filter(n=>(54*decks-n)>0&&(54*decks-n)%players===0);
};
F.config={players:5,decks:3,kitty:7,friendCount:1,level:2,speed:'normal'};
F.validateConfig=function(s){
 if(!Number.isInteger(s.players)||s.players<4||s.players>9)return '玩家人数必须在4至9人之间';
 if(!Number.isInteger(s.decks)||s.decks<2||s.decks>4)return '牌副数必须为2、3或4';
 if(!Number.isInteger(s.friendCount)||s.friendCount<1||s.friendCount>4||s.friendCount>=s.players)return '叫朋友人数不合法：最多4位，且不得超过其他玩家人数';
 if(!Number.isInteger(s.kitty)||s.kitty<1||s.kitty>12)return '底牌必须为1至12张';
 if((54*s.decks-s.kitty)%s.players!==0)return `底牌不合法：${s.decks}副×54=${54*s.decks}张，扣除${s.kitty}张后不能平均分给${s.players}人。可用底牌张数：${F.kittyOptions(s.players,s.decks).join('、')||'无'}`;
 return null;
};
F.make=function(config={},seed=null){
 const s={...F.config,...config},error=F.validateConfig(s);if(error)throw Error(error);
 const playerLevels=Array.isArray(s.playerLevels)?[...s.playerLevels]:Array(s.players).fill(s.level);
 if(playerLevels.length!==s.players||playerLevels.some(v=>!Number.isInteger(v)||v<2||v>14))throw Error('个人级数必须在2至A之间');
 const g={mode:'friends',handNo:(s.handNo||0)+1,decisions:[],voids:Array.from({length:s.players},()=>[]),seed:seed===null?Math.floor(Math.random()*4294967296):seed>>>0,rng:0,settings:{...s,allowThrows:!!s.allowThrows,kittyMultiplier:s.kittyMultiplier||'classic'},playerLevels,decks:s.decks,level:s.level,trump:null,declared:null,bids:[],phase:'bid',dealerSeat:null,firstDeclarer:null,kitty:[],hands:Array.from({length:s.players},()=>[]),players:s.players,turn:null,leader:null,plays:[],lastTrick:null,tricks:[],trickNo:1,scoresSeat:Array(s.players).fill(0),capturedSeat:Array.from({length:s.players},()=>[]),history:[],friendCalls:[],allies:[],seenCalls:{},lastWinner:null,handResults:null,finished:false};
 g.rng=g.seed;const deck=E.shuffle(g,E.makeDeck(s.decks));g.kitty=deck.splice(0,s.kitty);deck.forEach((c,i)=>g.hands[i%s.players].push(c));g.hands.forEach(h=>E.sort(h,g));g.history.push({kind:'deal',kitty:s.kitty,hands:g.hands.map(h=>h.length)});return g;
};
F.legalBids=(g,seat)=>E.availableBids({...g,level:g.playerLevels[seat]},seat).map(b=>({...b,level:g.playerLevels[seat]}));
F.bidValue=(g,seat,b)=>E.bidValue({...g,level:g.playerLevels[seat]},seat,b);
F.bid=function(g,seat,ids){if(!['bid','dealing'].includes(g.phase))return{ok:false,error:'不在叫主阶段'};
 const b=F.legalBids(g,seat).find(x=>x.ids.length===ids.length&&ids.every(id=>x.ids.includes(id)));
 if(!b)return{ok:false,error:'不符合抢主规则：新叫牌必须高于当前叫牌'};
 g.declared=copy(b);g.dealerSeat=seat;g.firstDeclarer??=seat;g.trump=b.suit;g.level=g.playerLevels[seat];
 g.bids.push({...copy(b),sequence:g.bids.length+1});g.history.push({kind:'bid',seat,bid:copy(b)});
 return{ok:true,bid:b};
};
F.botBids=function(g,{mustBid=false}={}){
 // Bot voluntary bidding and no-bid fallback are different decisions.
 // A pair only raises confidence; it does not force a weak hand to declare.
 const candidates=[];
 for(let seat=1;seat<g.players;seat++)for(const b of F.legalBids(g,seat)){
  const q=E.botBidAssessment({...g,level:g.playerLevels[seat]},seat,b);
  if(q.qualified)candidates.push({seat,b,q});
 }
 candidates.sort((a,b)=>b.q.score-a.q.score||b.b.strength-a.b.strength||a.seat-b.seat);
 if(!candidates.length)return{ok:true,bid:null};
 for(const a of candidates){
  if(g.declared&&a.b.strength<=g.declared.strength)continue;
  if(F.legalBids(g,a.seat).some(b=>b.ids.length===a.b.ids.length&&a.b.ids.every(id=>b.ids.includes(id)))){
   return F.bid(g,a.seat,a.b.ids);
  }
 }
 return{ok:true,bid:null};
};
F.finishBids=function(g){if(g.phase!=='bid')return{ok:false,error:'不在叫主阶段'};
 if(!g.declared){let all=[];for(let seat=0;seat<g.players;seat++)for(let b of F.legalBids(g,seat))all.push({seat,b,v:F.bidValue(g,seat,b)});
  all.sort((a,b)=>b.v-a.v||b.b.strength-a.b.strength);if(all.length){F.bid(g,all[0].seat,all[0].b.ids);g.autoFallbackBid=true;g.history.push({kind:'automatic-trump',seat:all[0].seat,reason:'no voluntary declaration'});}
 }
 if(!g.declared)return{ok:false,error:'无法形成合法叫主，请重新发牌'};
 g.phase='bury';g.hands[g.dealerSeat].push(...g.kitty);E.sort(g.hands[g.dealerSeat],g);return{ok:true};
};
F.chooseBury=function(g){const tmp={...g,dealerSeat:g.dealerSeat,settings:g.settings};
 const cards=[...g.hands[g.dealerSeat]].sort((a,b)=>{
 const cost=c=>(E.group(c,g)==='T'?120:0)+E.points(c)*9+E.power(c,g)*.25+(E.counts(g.hands[g.dealerSeat]).get(E.key(c))?.length>=2?14:0);
 return cost(a)-cost(b)});return cards.slice(0,g.settings.kitty);
};
F.bury=function(g,seat,ids){if(g.phase!=='bury'||seat!==g.dealerSeat)return{ok:false,error:'只有庄家可扣底'};
 const hand=g.hands[seat],set=new Set(ids);
 if(ids.length!==g.settings.kitty||set.size!==ids.length||ids.some(id=>!hand.some(c=>c.id===id)))return{ok:false,error:`请选择 ${g.settings.kitty} 张底牌`};
 g.kitty=hand.filter(c=>set.has(c.id));g.hands[seat]=hand.filter(c=>!set.has(c.id));g.phase='call';g.history.push({kind:'bury',seat,count:ids.length});return{ok:true};
};
F.call=function(g,seat,calls){if(g.phase!=='call'||seat!==g.dealerSeat)return{ok:false,error:'只有庄家可以叫朋友'};
 if(!Array.isArray(calls)||calls.length!==g.settings.friendCount)return{ok:false,error:`必须叫 ${g.settings.friendCount} 张牌`};
 const keys=new Set();for(let c of calls){if(!['S','H','C','D'].includes(c.s)||!Number.isInteger(c.r)||c.r<2||c.r>14||!Number.isInteger(c.n)||c.n<1||c.n>g.decks)return{ok:false,error:'叫牌的花色、点数或第几张无效'};
  if(c.s===g.trump||c.r===g.level||[5,10,13].includes(c.r))return{ok:false,error:'只能叫副牌的非分牌；不能叫主牌、级牌、5、10、K'};
  const k=c.s+':'+c.r+':'+c.n;if(keys.has(k))return{ok:false,error:'不能重复叫同一张次序的牌'};keys.add(k);
 }
 g.friendCalls=calls.map((c,i)=>({...c,callIndex:i,revealed:false,seat:null}));g.allies=[g.dealerSeat];g.phase='play';g.turn=g.dealerSeat;g.leader=g.dealerSeat;g.history.push({kind:'call',calls:copy(calls),seat});return{ok:true};
};
F.observeCall=function(g,seat,card){const key=E.key(card);g.seenCalls[key]=(g.seenCalls[key]||0)+1;
 for(const c of g.friendCalls){if(c.s===card.s&&c.r===card.r&&c.n===g.seenCalls[key]&&!c.revealed){
  c.revealed=true;c.seat=seat;if(seat!==g.dealerSeat&&!g.allies.includes(seat))g.allies.push(seat);
  g.history.push({kind:'friend',seat,callIndex:c.callIndex,self:seat===g.dealerSeat});
 }}
};
// Rebuild point-card provenance for games saved by older versions.
F.ensureCaptured=function(g){
 if(Array.isArray(g.capturedSeat)&&g.capturedSeat.length===g.players)return g.capturedSeat;
 const cards=Array.from({length:g.players},()=>[]);
 for(const trick of g.tricks||[]){if(trick.winner==null)continue;
  cards[trick.winner].push(...(trick.plays||[]).flatMap(p=>p.cards||[]).filter(c=>E.points(c)>0));
 }
 g.capturedSeat=cards;return cards;
};
F.capturedBySeat=g=>F.ensureCaptured(g);
F.play=function(g,seat,ids){if(g.phase!=='play')return{ok:false,error:'不在出牌阶段'};
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||!g.hands?.[seat]||ids.some(id=>!g.hands[seat].some(c=>c.id===id)))return{ok:false,error:'牌不存在或重复 / Invalid or duplicate cards'};
 const cards=g.hands[seat].filter(c=>ids.includes(c.id));const chk=E.validatePlay(g,seat,cards);
 if(!chk.ok)return chk;
 const lead=g.plays[0]?.pattern;const holdingLead=lead?g.hands[seat].filter(c=>E.group(c,g)===lead.suit).length:null;const selected=new Set(ids);g.hands[seat]=g.hands[seat].filter(c=>!selected.has(c.id));
 if(lead&&holdingLead<lead.n&&!g.voids[seat].includes(lead.suit))g.voids[seat].push(lead.suit);g.plays.push({seat,cards:copy(cards),pattern:chk.pattern});g.history.push({kind:'play',trick:g.trickNo,seat,cards:[...ids],team:g.allies.includes(seat)?'dealer':'unknown',bot:seat!==0,time:new Date().toISOString()});
 for(const card of cards)F.observeCall(g,seat,card);
 if(g.plays.length===g.players){
  const w=E.winningPlay(g),points=g.plays.flatMap(p=>p.cards).reduce((a,c)=>a+E.points(c),0);
  g.scoresSeat[w.seat]+=points;g.lastWinner=w.seat;F.ensureCaptured(g)[w.seat].push(...g.plays.flatMap(p=>p.cards).filter(c=>E.points(c)>0));
  g.lastTrick={trick:g.trickNo,winner:w.seat,points,lead:copy(g.plays[0].pattern),plays:copy(g.plays)};
  g.tricks.push(copy(g.lastTrick));g.history.push({kind:'trick-end',trick:g.trickNo,winner:w.seat,points});g.leader=w.seat;g.turn=w.seat;
  return{ok:true,trickComplete:true,winner:w.seat,points};
 }
 g.turn=(seat+1)%g.players;return{ok:true,trickComplete:false};
};
F.clearTrick=function(g){if(g.plays.length!==g.players)return{ok:false,error:'本墩尚未出完'};
 const lastLead=g.plays[0].pattern;g.plays=[];
 if(g.hands.every(h=>h.length===0)){F.endHand(g,lastLead);return{ok:true,handComplete:true};}
 g.trickNo++;return{ok:true,handComplete:false};
};
F.teamSeat=(g,seat)=>g.allies.includes(seat)?'dealer':'opponents';
F.endHand=function(g,lastLead){
 const allySet=new Set(g.allies),attackers=Array.from({length:g.players},(_,i)=>i).filter(i=>!allySet.has(i));
 const kittyValue=g.kitty.reduce((s,c)=>s+E.points(c),0),factor=E.kittyFactor(g,lastLead);
 const attackLast=!allySet.has(g.lastWinner),kittyBonus=attackLast?kittyValue*factor:0;
 const seatScores=[...g.scoresSeat];if(attackLast)seatScores[g.lastWinner]+=kittyBonus;
 const attackingScore=attackers.reduce((s,i)=>s+seatScores[i],0),threshold=40*g.decks,step=20*g.decks;
 const takeover=attackingScore>=threshold,winningSeats=takeover?attackers:[...g.allies];
 const gain=takeover?(g.settings.bonusOnTakeover?1:0)+Math.floor((attackingScore-threshold)/step):(attackingScore===0?3:attackingScore<threshold/2?2:1);
 const oldLevels=[...g.playerLevels];
 for(const seat of winningSeats){const old=g.playerLevels[seat],defended=winningSeats.includes(g.dealerSeat)&&!takeover;
  g.playerLevels[seat]=E.advanceLevel(old,gain,g.level,defended,g.settings.jMustDefend);
 }
 // Tractor's optional J penalty: only the banker playing J is demoted if a
 // decisive jack wins the captured kitty and the opponents meet the cutoff.
 let jackPenalty=null;
 if(g.settings.jMustDefend!==false&&g.level===11&&takeover&&attackLast){const hook=E.kittyWinningJack({...g,lastTrick:g.lastTrick},g.lastWinner);
  if(hook){g.playerLevels[g.dealerSeat]=hook.toLevel;jackPenalty=hook;}}
 const champion=!takeover&&g.level===14?g.dealerSeat:null;
 g.scoresSeat=seatScores;g.handResults={champion,attackers,allies:[...g.allies],attackingScore,threshold,takeover,kittyValue,factor,kittyBonus,attackLast,seatScores,calls:copy(g.friendCalls),winningSeats,gain,oldLevels,newLevels:[...g.playerLevels],jackPenalty};
 g.phase='finished';g.history.push({kind:'hand-end',results:copy(g.handResults)});return g.handResults;
};
F.nextHand=function(g,seed=null){if(g.handResults?.champion!==null&&g.handResults?.champion!==undefined)throw Error('比赛已结束，请重新开始比赛');if(g.phase!=='finished')throw Error('当前牌局还未结束');
 return F.make({...g.settings,playerLevels:[...g.playerLevels],level:g.playerLevels[0],handNo:g.handNo},seed);
};
// Calling friends is a plan for exchanging the lead, not just a rank guess.
// Use ONLY the banker's own hand/kitty.  Three reasonable ways to call an Ace:
//   0 own -> first Ace, optionally open with K to invite the future friend;
//   1 own -> second Ace, play own A promptly to invite partner A;
//   2 own -> third Ace, lead the A pair before the outsider's final Ace.
// The last is particularly reliable *after* both dealer A's have appeared;
// it never guarantees that an unknown opponent holds/plays the last card.
F.chooseCalls=function(g){
 const own=g.hands[g.dealerSeat],buried=g.kitty||[],candidates=[];
 const num=(list,s,r)=>list.filter(c=>c.s===s&&c.r===r).length;
 for(const suit of E.SUITS){
  if(suit===g.trump)continue;
  for(const rank of [14,12,11,9,8,7,6,4,3,2]){
   if(rank===g.level)continue;
   const owned=num(own,suit,rank),buriedCount=num(buried,suit,rank),others=g.decks-owned-buriedCount;
   if(others<=0)continue; // no stranger can become this partner
   for(let n=1;n<=g.decks-buriedCount;n++){
    // Prefer the occurrence immediately AFTER the dealer's own copies when
    // those copies can actually be led. Never manufacture a self-friend.
    const selfRisk=n<=owned?90:0;
    const beforeOwn=n>owned+1?(n-owned-1)*16:0;
    const wait=(n-1)*5.5;
    const rankCost=(14-rank)*3.3;
    let plan=0;
    if(rank===14){
     if(owned===0&&n===1){plan=-12;
      if(num(own,suit,13)===1)plan-=10; // lead singleton K to solicit the A
      if(num(own,suit,10)>0)plan-=3;}
     if(owned===1&&n===2){plan=-14;
      if(num(own,suit,13)||num(own,suit,10))plan-=3;}
     if(owned===2&&n===3){plan=-36;}
    }
    const playableBuried=buriedCount*16;
    const remainingFoe=others===1?3:0;
    candidates.push({s:suit,r:rank,n,cost:selfRisk+beforeOwn+wait+rankCost+playableBuried+remainingFoe+plan});
   }
  }
 }
 candidates.sort((a,b)=>a.cost-b.cost||b.r-a.r||a.n-b.n||a.s.localeCompare(b.s));
 const calls=[],selected=new Set();
 for(const c of candidates){const key=c.s+':'+c.r;if(selected.has(key))continue;
  calls.push({s:c.s,r:c.r,n:c.n});selected.add(key);
  if(calls.length===g.settings.friendCount)break;
 }
 return calls;
};
// Public, observable history only; use past K leads as a second-stage signal.
F.dealerLedK=function(g,suit){return (g.history||[]).some(h=>h.kind==='play'&&h.seat===g.dealerSeat&&h.cards?.length===1&&h.cards[0].split('-')[1]===suit&&h.cards[0].split('-')[2]==='13');};
// Does this exact play complete a public call? Account for several copies of
// the same card played together, without inspecting anybody else's hand.
F.callsRevealedByPlay=function(g,seat,cards){
 const counts={...g.seenCalls},revealed=[];
 for(const card of cards){const key=E.key(card);counts[key]=(counts[key]||0)+1;
  for(const call of g.friendCalls||[]){if(!call.revealed&&call.s===card.s&&call.r===card.r&&call.n===counts[key])revealed.push(call);}
 }
 return [...new Set(revealed)];
};
F.botMove=function(g,seat){
 const hand=g.hands[seat],lead=g.plays[0]?.pattern;
 const possible=lead?B.followMoves(hand,g,lead):B.leadMoves(hand,g).filter(a=>a.length<=Math.min(12,hand.length));
 const moves=possible.filter(cards=>E.validatePlay(g,seat,cards).ok);
 if(!moves.length)throw Error('BOT 找不到合法出牌，座位 '+seat);
 const best=g.plays.length?E.winningPlay(g):null,old=E.counts(hand);
  const isPartner=i=>g.allies.includes(i);
 const callsA=(g.friendCalls||[]).filter(c=>!c.revealed&&c.r===14);
 const isDealer=seat===g.dealerSeat;
 const hasCalledAce=callsA.filter(c=>hand.some(x=>x.s===c.s&&x.r===14));
 // A partner holding a called Ace can infer the possible signal, but cannot
 // know who else holds a hidden copy or that they will be the first to play it.
 const callKSignal=(cards)=>{
  if(isDealer||!lead||lead.n!==1||cards.length!==1||cards[0].r!==10)return 0;
  if(!best||best.seat!==g.dealerSeat||best.cards.length!==1||best.cards[0].r!==13)return 0;
  const match=hasCalledAce.some(c=>c.s===cards[0].s&&c.n>(g.seenCalls[E.key(cards[0])]||0));
  if(!match)return 0;
  const nextSeats=g.players-g.plays.length-1;
  return nextSeats===0?67:nextSeats===1?20:0;
 };
 const canBecomeAlly=cards=>!isPartner(seat)&&seat!==g.dealerSeat&&F.callsRevealedByPlay(g,seat,cards).length>0;
 const currentFriendly=best&&isPartner(best.seat)===isPartner(seat);
 const scoreCards=cards=>{
  const ids=new Set(cards.map(c=>c.id)),after=E.counts(hand.filter(c=>!ids.has(c.id)));
  let loss=0;
  for(const c of cards){const trump=E.group(c,g)==='T',o=E.ordinal(c,g);
   loss+=(trump?15+o*.80:o*.32)+E.points(c)*.8;
   if(c.s==='J')loss+=(c.r===17?70:53);
   else if(trump&&c.r===g.level)loss+=18;
  }
  for(const [key,oldCards] of old){const remain=after.get(key)?.length||0;
   if(remain===oldCards.length)continue;
   const card=oldCards[0],w=oldCards.length,high=E.ordinal(card,g),trump=E.group(card,g)==='T';
   if(w>=2&&remain<2)loss+=(trump?24:15)+Math.max(0,high-7)*(trump?1.7:4.1);
   if(w>=3&&remain<3)loss+=21;if(w>=4&&remain<4)loss+=19;
  }
  loss+=Math.max(0,E.maxRun(hand,g,2)-E.maxRun(hand.filter(c=>!ids.has(c.id)),g,2))*17;
  return loss;
 };
 const scored=moves.map(cards=>{
  const p=E.pattern(cards,g,true),pts=cards.reduce((a,c)=>a+E.points(c),0),cost=scoreCards(cards);
  const win=best?E.canBeat(cards,best.cards,lead,g):false;
  const revealingAlly=canBecomeAlly(cards);
  const ownAlly=isPartner(seat)||revealingAlly;
  // Two unrevealed non-dealer players are NOT known teammates.  The old
  // equality check incorrectly treated every stranger as a single allied team.
  // Cooperate with other non-dealers only after every called friend is found.
  const friendsSettled=g.friendCalls.length>0&&g.friendCalls.every(c=>c.revealed);
  const sameTeam=!!best&&((ownAlly&&isPartner(best.seat))||(!ownAlly&&friendsSettled&&!isPartner(best.seat)));
  const nextSeats=g.plays.length?g.players-g.plays.length-1:g.players-1;
  const trickPts=g.plays.flatMap(p=>p.cards).reduce((a,c)=>a+E.points(c),0);
  let score= -cost*(g.settings.difficulty==='basic'?.30:.52) + (lead?-1:0);
  if(lead){
   if(sameTeam){score+=pts*(nextSeats===0?3.1:nextSeats===1?1.05:.25);
    if(win){
     // Usually do not overtake a partner. If their current winning play is weak
     // and opponents still follow, taking control can protect the points and
     // keep the initiative with a known friend.
     const bestStrength=Math.max(...best.cards.map(c=>E.ordinal(c,g)));
     const underThreat=ownAlly&&isPartner(best.seat)&&nextSeats>0&&bestStrength<9;
     score-=underThreat?4:22;
     if(underThreat)score+=Math.min(24,8+trickPts*.7)+(nextSeats>=2?7:0);
    }
   }
   else{
    score-=pts*(nextSeats===0?2:nextSeats===1?1.9:1.7);
    if(win)score+=22+trickPts*1.6+(nextSeats===0?18:4);
    if(win&&nextSeats===1)score+=10;
   }
   if(!win&&cards.some(c=>c.s==='J'))score-=65;
   if(!win&&p?.kind==='group'&&p.width===2&&p.high>=9)score-=16;
   if(win&&lead.suit!=='T'&&cards.every(c=>E.group(c,g)==='T')&&nextSeats===0)score+=9;
   // Dealer's singleton K in the called Ace suit can invite a possible ally
   // to contribute a 10 rather than spend their A over an already winning K.
   // With many strangers still to act, do not assume that K is safe.
   score+=callKSignal(cards);
  }else{
    // Same control assessment as four-player Tractor: low three-of-a-kind
    // and tractors can be dominant formations, not just low-ranked cards.
    score+=B.controlBonus(g,seat,cards,p);
    if(p.kind==='group'&&p.width>=3)score+=28; // prefer decisive trips before exposing lone high cards
    if(p.kind==='run')score+=16; // consecutive pairs take and retain tempo
    score+=Math.min(7,hand.length/5)*(p?.kind==='group'?3:p?.kind==='run'?8:0);
    if(cards.length===1&&E.group(cards[0],g)==='T')score-=12;
    score-=pts*.25;
    if(ownAlly){
      // A known friend with control cards can lead a high side card / strong
      // structure to obtain the next lead and protect the banker, rather than
      // mindlessly leading the cheapest singleton.
      const strongest=Math.max(...cards.map(c=>E.ordinal(c,g)));
      const side=E.group(cards[0],g)!=='T';
      const strength=Math.max(0,strongest-8);
      if(side)score+=strength*(p?.kind==='single'?2.7:3.1);
      if(side&&p?.kind==='group'&&p.width>=2&&strongest>=9)score+=12;
      if(revealingAlly)score+=14;
      if(isDealer && cards.length===1 && callsA.length){
       const card=cards[0],called=callsA.find(c=>c.s===card.s);
       if(called){
        const seen=g.seenCalls[E.key({s:card.s,r:14})]||0;
        const ownedA=hand.filter(c=>c.s===card.s&&c.r===14).length;
        if(card.r===14&&called.n===2&&ownedA===1&&seen===0)score+=110;
        // Called outside-A: invite a hand-off with K, then optionally 10.
        if(card.r===13&&called.n===1&&ownedA===0&&seen===0){
         // First cash safe control cards before signaling with K.  A naked
         // K+10 lead is too costly when we could first win an outside Ace.
         const otherControl=hand.some(c=>c.s!=='J'&&c.r===14&&c.s!==card.s&&E.group(c,g)!=='T');
         const controlled=g.tricks?.some(t=>t.winner===g.dealerSeat);
         // Preserve the K as a natural option, rather than FORCING it
         // ahead of stronger winners. A tiny nudge after prior control only.
         if(controlled&&!otherControl)score+=3;
        }
        if(card.r===10&&called.n===1&&ownedA===0&&F.dealerLedK(g,card.s)&&seen===0)score+=56;
       }
      }
      if(isDealer&&cards.length===2&&cards.every(c=>c.r===14)&&callsA.some(c=>c.s===cards[0].s&&c.n===3)&&(g.seenCalls[E.key(cards[0])]||0)===0)score+=120;
    }
  }
  if(revealingAlly){
   // Completing the called occurrence makes the player's team public. Reward
   // signaling early, especially when the card wins the trick and gives the
   // friend an opportunity to lead next. Keep valuable groups in consideration.
   score+=14+(win?11:0)+(g.trickNo<=5?8:3);
  }
  return{cards,score};
 });
 // Sample plausible FOLLOWING opponents, rather than assuming that a
 // currently winning low card stays ahead through every remaining seat.
 // Use public cards, own cards, void observations, and opponent hand sizes.
 // The actual other hands are never read; unconfirmed strangers are never
 // silently treated as partners. This is deliberately a shallow, bounded
 // rollout to stay responsive for 7-9 players.
 if(g.settings.difficulty!=='basic'&&g.plays.length<g.players-1){
  scored.sort((a,b)=>b.score-a.score);
  const count=g.players>=8?5:g.players>=6?6:8;
  const top=scored.slice(0,count);
  const revealing=top.map(entry=>F.callsRevealedByPlay(g,seat,entry.cards).length>0);
  // Any action revealing the player as a known dealer ally must be evaluated
  // with that new public status. The sampled physical cards do not change.
  const ordinary=B.evaluateTrickRisk(g,seat,top.map(x=>x.cards),{samples:g.players>=8?3:5});
  const newlyFriendly=revealing.some(Boolean)?B.evaluateTrickRisk(g,seat,top.map(x=>x.cards),
   {samples:g.players>=8?3:5,allies:[...new Set([...(g.allies||[]),seat])]}):ordinary;
  for(let j=0;j<top.length;j++){
   const estimate=revealing[j]?newlyFriendly[j]:ordinary[j];
   if(!estimate.samples)continue;
   const remaining=g.players-1-g.plays.length;
   const riskFactor=!lead?1.25:remaining>=2?1.05:.65;
   top[j].score+=(estimate.control-.5)*(lead?45:76)
      -estimate.enemyPoints*riskFactor;
   const shape=E.pattern(top[j].cards,g,true);
   if(!lead&&shape?.kind==='group'&&shape.width>=3)top[j].score+=estimate.control*19;
   if(!lead&&shape?.kind==='run')top[j].score+=estimate.control*24;
  }
 }
 scored.sort((a,b)=>b.score-a.score||a.cards.map(c=>c.id).join().localeCompare(b.cards.map(c=>c.id).join()));
 const idx=g.settings.difficulty==='basic'?Math.min(2,scored.length-1):0;
 return{cards:scored[idx].cards,score:scored[idx].score,reason:'评估三张/连对控牌、10与K首出风险、已知队友缺门接牌及后手未知牌模拟；同时顾及A叫友和跟牌合法性',evaluated:moves.length,samples:0};
};

F.snapshot=g=>copy(g);
root.HHFriends=F;if(typeof module!=='undefined'&&module.exports)module.exports=F;
})(typeof window!=='undefined'?window:globalThis);
