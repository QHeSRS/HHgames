/* HHgames rules engine: zero external dependencies. JavaScript usable in browsers and Node. */
(function(root){'use strict';
const E={};
E.VERSION='2026-11-23 · v1.22.1';
E.SUITS=['S','H','D','C']; E.SYMBOL={S:'♠',H:'❤',D:'♦',C:'♣',J:'★',N:'NT'};
E.DEFAULTS={decks:2, bonusOnTakeover:true, names:['Mr. Q','HH Boy','Prof. Wang','HH Girl'], difficulty:'expert', speed:'normal', language:'zh', allowThrows:true, kittyMultiplier:'classic', showHints:true, autoMrQ:false, handSort:'smart',dealSpeed:'normal',cardSize:'large',dealerMode:'teamRotation',counterbidTakesDealer:false,jMustDefend:true};
const clone=x=>JSON.parse(JSON.stringify(x)); E.clone=clone;
E.key=c=>c.s+':'+c.r;
E.label=c=>c.s==='J'?(c.r===17?'RJ':'BJ'):(c.r===14?'A':c.r===13?'K':c.r===12?'Q':c.r===11?'J':c.r)+E.SYMBOL[c.s];
E.points=c=>c.r===5?5:(c.r===10||c.r===13?10:0);
E.team=s=>s%2;
E.kittySizes=[0,4,8,10,12];
E.makeDeck=function(decks){const a=[];for(let d=0;d<decks;d++){for(let s of E.SUITS)for(let r=2;r<=14;r++)a.push({s,r,id:`${d}-${s}-${r}`});for(let r of [16,17])a.push({s:'J',r,id:`${d}-J-${r}`})}return a};
E.random=function(g){g.rng=(Math.imul(g.rng,1664525)+1013904223)>>>0;return g.rng/4294967296};
E.shuffle=function(g,arr){for(let i=arr.length-1;i>0;i--){let j=Math.floor(E.random(g)*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr};
E.group=function(c,g){return c.s==='J'||c.r===g.level||c.s===g.trump?'T':c.s};
E.ordinal=function(c,g){if(E.group(c,g)!=='T')return c.r>g.level?c.r-3:c.r-2;
  if(c.s==='J')return (g.trump==='N'?(c.r===17?2:1):(c.r===17?15:14));
  if(c.r===g.level){if(g.trump==='N')return 0;return c.s===g.trump?13:12}
  return c.r>g.level?c.r-3:c.r-2;
};
E.power=function(c,g){return E.group(c,g)==='T'?100+E.ordinal(c,g):E.ordinal(c,g)};
E.sort=function(arr,g){const order={T:0,S:1,H:2,C:3,D:4};return arr.sort((a,b)=>(order[E.group(a,g)]-order[E.group(b,g)])||E.power(b,g)-E.power(a,g)||a.s.localeCompare(b.s)||a.id.localeCompare(b.id))};
E.counts=function(cards){const m=new Map();for(const c of cards){const k=E.key(c);if(!m.has(k))m.set(k,[]);m.get(k).push(c)}return m};
E.maxRun=function(cards,g,width){const vals=new Set();for(let a of E.counts(cards).values())if(a.length>=width)vals.add(E.ordinal(a[0],g));const sorted=[...vals].sort((a,b)=>a-b);let best=0,cur=0,previous=null;for(const v of sorted){cur=previous!==null&&v===previous+1?cur+1:1;best=Math.max(best,cur);previous=v}return best};
E.pattern=function(cards,g,allowThrow=false){if(!cards.length)return null;const suit=E.group(cards[0],g);if(cards.some(c=>E.group(c,g)!==suit))return null;if(cards.length===1)return {kind:'single',n:1,width:1,length:1,suit,high:E.ordinal(cards[0],g)};
 const m=E.counts(cards),arr=[...m.values()],values=arr.map(a=>a.length);
 if(arr.length===1)return {kind:'group',n:cards.length,width:cards.length,length:1,suit,high:E.ordinal(cards[0],g)};
 const w=values[0],ords=arr.map(a=>E.ordinal(a[0],g)).sort((a,b)=>a-b);
 if(w>=2&&arr.length>=2&&values.every(v=>v===w)&&ords.every((v,i)=>!i||v===ords[i-1]+1))return{kind:'run',n:cards.length,width:w,length:arr.length,suit,high:ords.at(-1)};
 if(!allowThrow)return null;
 // Mixed same-suit high-card throw: validated independently by checkThrowSafe.
 const component=E.throwComponents(cards,g);
 return{kind:'throw',n:cards.length,width:Math.max(...component.map(a=>a.length)),length:1,suit,high:Math.max(...cards.map(c=>E.ordinal(c,g))),component:component.map(a=>({kind:a.length===1?'single':'group',width:a.length,high:E.ordinal(a[0],g)}))};
};
E.throwComponents=function(cards,g){const arr=[...E.counts(cards).values()].sort((a,b)=>E.ordinal(b[0],g)-E.ordinal(a[0],g));return arr};
// A throw can only be defeated by an OTHER player on an opposing side.
// In Find Friends, unrevealed seats must still be treated as potential opponents.
E.throwOpponent=function(g,seat,other){
 if(other===seat)return false; // Never test our own still-held cards against a proposed throw.
 if(g.mode==='friends'){
  const known=new Set(g.allies||[]);
  return !(known.has(seat)&&known.has(other));
 }
 return E.team(other)!==E.team(seat);
};
E.checkThrowSafe=function(cards,g,seat){
 if(!Array.isArray(cards)||!cards.length||!g.hands?.[seat])return false;
 const units=E.throwComponents(cards,g),suit=E.group(cards[0],g);
 for(let p=0;p<g.hands.length;p++){
  if(!E.throwOpponent(g,seat,p))continue;
  const enemy=E.counts(g.hands[p].filter(c=>E.group(c,g)===suit));
  for(const unit of units){const high=E.ordinal(unit[0],g),n=unit.length;
   for(const v of enemy.values())if(v.length>=n&&E.ordinal(v[0],g)>high)return false;
  }
 }
 return true;
};
E.make=function(settings={},match=null,seed=null){const options={...clone(E.DEFAULTS),...clone(settings)};
 const m=match?clone(match):{levels:[2,2],dealerSeat:0,handNo:0};
 if(m.champion!==undefined&&m.champion!==null)throw new Error('Match finished; create a new match to play again');
 const g={seed:seed===null?((Date.now()^((Math.random()*0xffffffff)>>>0))>>>0):seed>>>0,rng:0,settings:options,match:m, handNo:m.handNo+1,decks:options.decks,level:m.levels[E.team(m.dealerSeat)],dealerSeat:m.dealerSeat, phase:'bid', trump:null, declared:null,hands:[[],[],[],[]],kitty:[],removed:[], plays:[],leader:m.dealerSeat,turn:m.dealerSeat,scores:[0,0],captured:[[],[]],trickNo:1,history:[], decisions:[],voids:Array.from({length:4},()=>[]), lastTrick:null, handResults:null,firstDeclarer:null, startedAt:new Date().toISOString(), initialHands:null, bids:[]};
 g.rng=g.seed;let deck=E.shuffle(g,E.makeDeck(g.decks));if(options.decks===1){for(let i=deck.length-1;i>=0&&g.removed.length<2;i--){const c=deck[i];if(E.points(c)===0&&c.s!=='J'&&c.r!==g.level){g.removed.push(...deck.splice(i,1));}}}
 const n=E.kittySizes[g.decks];g.kitty=deck.splice(0,n);deck.forEach((c,i)=>g.hands[i%4].push(c));g.initialHands=clone(g.hands);
 g.hands.forEach(h=>E.sort(h,g));g.history.push({kind:'deal',seed:g.seed,decks:g.decks,level:g.level,dealerSeat:g.dealerSeat,handNo:g.handNo,kittySize:n,time:g.startedAt});return g;
};
// Any no-trump bid requires at least TWO IDENTICAL jokers: two red or two black.
// Multi-deck bids support 1..N identical level cards and 2..N identical jokers.
// Strength sorts by number of physically identical cards, then red > black > level.
E.availableBids=function(g,seat){const counts=E.counts(g.hands[seat]),bids=[];
 for(const cards of counts.values()){
   const c=cards[0];
   if(c.r===g.level&&c.s!=='J')for(let n=1;n<=cards.length;n++)
     bids.push({suit:c.s,strength:n*10+1,ids:cards.slice(0,n).map(x=>x.id),seat,kind:'level',count:n});
   if(c.s==='J')for(let n=2;n<=cards.length;n++)
     bids.push({suit:'N',strength:n*10+(c.r===17?3:2),ids:cards.slice(0,n).map(x=>x.id),seat,kind:c.r===17?'red-joker':'black-joker',count:n});
 }
 return bids.filter(b=>!g.declared||(b.strength>g.declared.strength&&g.declared.seat!==seat));
};
E.bidValue=function(g,seat,b){const hand=g.hands[seat],s=b.suit;const trumps=hand.filter(c=>c.s==='J'||c.r===g.level||c.s===s).length;
 const control=hand.filter(c=>c.s==='J'||c.r===g.level).length;
 return trumps*1.5+control*2+hand.filter(c=>c.s===s&&c.r>=11).length*2 +(b.strength>=2?2:0);
};
// A legal declaration is NOT necessarily a good declaration.  Judge the
// holder's real suit structure before bidding; never use rival hidden hands.
// Evaluate partially dealt hands by fractions so the same test works late in
// dealing and at the end.  A pair changes bid priority, but never auto-bids.
E.botBidAssessment=function(g,seat,b){
 const hand=g.hands[seat]||[],n=hand.length,level=b.level||g.level;
 if(!n)return{score:-Infinity,qualified:false};
 const isNoTrump=b.suit==='N';
 const isTrump=c=>c.s==='J'||c.r===level||(!isNoTrump&&c.s===b.suit);
 const trumps=hand.filter(isTrump),jokers=hand.filter(c=>c.s==='J'),levels=hand.filter(c=>c.s!=='J'&&c.r===level);
 const highTrump=trumps.filter(c=>c.s==='J'||c.r===level||c.r===14).length;
 const by=E.counts(trumps),pairs=[...by.values()].reduce((v,c)=>v+Math.floor(c.length/2),0);
 const allPairs=[...E.counts(hand).values()].reduce((v,c)=>v+Math.floor(c.length/2),0);
 const sideA=hand.filter(c=>c.s!=='J'&&c.r===14&&!isTrump(c)).length;
 const baseline=isNoTrump?6/54:18/54;
 // Difference from an average hand is more meaningful than sheer bid count.
 let score=100*(trumps.length/n-baseline)
          +45*(jokers.length/n-2/54)
          +45*(levels.length/n-4/54)
          +Math.min(13,pairs*3.1)+Math.min(5,allPairs*.65)
          +Math.min(5,sideA*1.4)+Math.min(5,highTrump*.8)
          +(Math.min(4,b.count)-1)*4.2;
 // A no-trump joker pair needs meaningful other controls, not just its legality.
 if(isNoTrump){score-=7;if(jokers.length<3)score-=4;}
 const expected=(54*(g.decks||g.settings?.decks||2)-(g.mode==='friends'?g.settings?.kitty||7:E.kittySizes[g.decks]||8))/(g.players||4);
 // Evaluate a near-complete hand. During early dealing the guess is unstable.
 const maturity=Math.min(1,n/expected);
 const partnerBid=g.mode!=='friends'&&g.declared&&g.declared.seat%2===seat%2;
 const threshold=(g.declared?22:15)+(g.mode==='friends'?7:2)+(partnerBid?10:0)+(maturity<.95?12:0);
 return{score,threshold,qualified:maturity>=.75&&score>=threshold,
  trumps:trumps.length,jokers:jokers.length,pairs,maturity};
};
E.submitBid=function(g,seat,ids){if(!['bid','dealing'].includes(g.phase))return{ok:false,error:'Not bidding phase'};
 const found=E.availableBids(g,seat).find(b=>b.ids.length===ids.length&&ids.every(id=>b.ids.includes(id)));
 if(!found)return{ok:false,error:'无效亮主：无主必须至少两张相同大小的王 / Invalid trump declaration'};
 const first=!g.bids.length;
 if(first)g.firstDeclarer=seat;
 // First deal: first bidder becomes dealer. Subsequent deals: winner-team rotation,
 // unless the setting says the bidder takes the bank each deal.
 if((first&&(g.handNo===1||g.settings.dealerMode==='bidder'))||(!first&&g.settings.counterbidTakesDealer)){
   g.dealerSeat=seat;g.leader=seat;
 }
 g.declared=found;g.bids.push({...found,time:new Date().toISOString()});
 g.history.push({kind:'bid',seat,suit:found.suit,strength:found.strength,kindDetail:found.kind,count:found.count,ids:[...found.ids],dealerAfter:g.dealerSeat});
 return{ok:true,bid:found};
};
E.finishBidding=function(g){if(g.phase!=='bid')return{ok:false,error:'Not in bidding phase'};
 // No one bid: a valid single-level-card call is made automatically so the first
 // dealer is never silently preassigned to Mr. Q. The caller owns the bank.
 if(!g.declared){let opts=[];for(let seat=0;seat<4;seat++)for(const b of E.availableBids(g,seat))opts.push({...b,value:E.bidValue(g,seat,b)});
   opts.sort((a,b)=>b.value-a.value||b.strength-a.strength||a.seat-b.seat);
   if(opts.length){E.submitBid(g,opts[0].seat,opts[0].ids);g.autoFallbackBid=true;g.history.push({kind:'automatic-trump',seat:opts[0].seat,reason:'no voluntary declaration'});}
 }
 if(!g.declared){let best={suit:'S',val:-Infinity};for(let s of E.SUITS){const h=g.hands[g.dealerSeat];const value=h.filter(c=>c.s===s).length+2*h.filter(c=>c.s===s&&c.r>=12).length; if(value>best.val)best={suit:s,val:value}}
 g.trump=best.suit;g.history.push({kind:'fallback-trump',suit:g.trump,reason:'No level cards available for a declaration'});
 }else g.trump=g.declared.suit;
 g.phase='bury';g.hands[g.dealerSeat].push(...g.kitty);E.sort(g.hands[g.dealerSeat],g);
 g.history.push({kind:'trump-final',suit:g.trump,level:g.level,declared:g.declared});return{ok:true,trump:g.trump};
};
E.chooseKitty=function(g,seat){const hand=g.hands[seat],n=E.kittySizes[g.decks];const groups={};for(let c of hand){const suit=E.group(c,g);groups[suit]=(groups[suit]||0)+1;}
 // Favor voiding a short side suit; avoid burying trumps, kings, tens and fives.
 const sorted=[...hand].sort((a,b)=>{const v=c=>{let gr=E.group(c,g),m=E.counts(hand).get(E.key(c)).length;
 let p=E.points(c);return (gr==='T'?120:0) + (p===10?46:p===5?25:0)+(E.ordinal(c,g)*.48)+(m>=2?15:0)+(groups[gr]||0)*1.8+(gr==='T'&&c.r===g.level?40:0)};
 return v(a)-v(b)});
 return sorted.slice(0,n);
};
E.bury=function(g,seat,ids){if(g.phase!=='bury'||seat!==g.dealerSeat)return{ok:false,error:'Only dealer can bury cards'};
 const n=E.kittySizes[g.decks],hand=g.hands[seat],set=new Set(ids);if(ids.length!==n||set.size!==n||ids.some(id=>!hand.find(c=>c.id===id)))return{ok:false,error:`请选择 ${n} 张牌扣底 / Choose ${n} cards`};
 g.kitty=hand.filter(c=>set.has(c.id));g.hands[seat]=hand.filter(c=>!set.has(c.id));E.sort(g.hands[seat],g);g.phase='play';g.turn=g.dealerSeat;g.leader=g.dealerSeat;g.history.push({kind:'bury',seat,cards:g.kitty.map(c=>c.id),pointValue:g.kitty.reduce((a,c)=>a+E.points(c),0)});return{ok:true};
};
E.autoBury=function(g){const cards=E.chooseKitty(g,g.dealerSeat);return E.bury(g,g.dealerSeat,cards.map(c=>c.id))};
function longestRun(values){const s=[...new Set(values)].sort((a,b)=>a-b);let best=0,cur=0,prev=null;for(let v of s){cur=v===prev+1?cur+1:1;best=Math.max(best,cur);prev=v}return best}
/* HHgames Tractor follow conventions (Chinese partnership/80 points variant).
 * In a pair lead, a three-of-a-kind is NOT a compulsory pair: a player may
 * retain their triple and play two other cards of the led suit. A genuine
 * two-card pair (including a pair in a tractor) remains compulsory.
 * The distinction only affects the FOLLOW obligation, not the validity
 * of voluntarily playing two cards from a triple.
 */
E.followGroupSignature=function(cards,g,lead){
 const units=[...E.counts(cards).values()],freq=units.map(u=>u.length);
 if(lead.width===2)return [freq.some(n=>n>=2)?1:0,0];
 if(lead.width===3)return [freq.some(n=>n>=3)?2:freq.some(n=>n>=2)?1:0,0];
 if(lead.width===4){
  if(freq.some(n=>n>=4))return[4,0];
  if(freq.some(n=>n>=3))return[3,0];
  const pairs=units.filter(u=>u.length>=2);
  if(pairs.length>=2){const ranks=pairs.map(u=>E.ordinal(u[0],g)).sort((a,b)=>a-b);const adjacent=ranks.some((n,i)=>i>0&&n===ranks[i-1]+1);return[2,adjacent?2:1]}
  return[pairs.length?1:0,0];
 }
 return[0,0];
};
E.structureSignature=function(cards,g,lead){const cnt=[...E.counts(cards).values()];
 if(lead.kind==='single')return[0,0,0];
 if(lead.kind==='group')return [...E.followGroupSignature(cards,g,lead),0];
 const width=lead.width;const eligible=cnt.filter(a=>a.length>=width);const order=eligible.map(a=>E.ordinal(a[0],g));const run=Math.min(lead.length,longestRun(order));const groups=Math.min(lead.length,eligible.length);
 const lower=cnt.reduce((s,a)=>s+Math.min(a.length,width-1),0);return[run,groups,lower];
};
E.idealSignature=function(available,g,lead,n){
 const cnt=[...E.counts(available).values()];
 if(lead.kind==='group'){
  if(lead.width===2){return [cnt.some(a=>a.length===2)?1:0,0,0]}
  if(lead.width===3){return [cnt.some(a=>a.length>=3)?2:cnt.some(a=>a.length===2)?1:0,0,0]}
  if(lead.width===4){
   if(cnt.some(a=>a.length>=4))return[4,0,0];
   if(cnt.some(a=>a.length>=3))return[3,0,0];
   const pairs=cnt.filter(a=>a.length===2);
   if(pairs.length>=2){const ranks=pairs.map(a=>E.ordinal(a[0],g)).sort((a,b)=>a-b);return[2,ranks.some((r,i)=>i>0&&r===ranks[i-1]+1)?2:1,0]}
   return[pairs.length?1:0,0,0];
  }
  return[0,0,0];
 }
 if(lead.kind==='single')return[0,0,0];
 // Exact-width groups determine compulsory tractors; three matching cards
 // are not treated as a compulsory pair when following an ordinary tractor.
 const width=lead.width;
 const eligible=cnt.filter(a=>a.length===width);
 const values=eligible.map(a=>E.ordinal(a[0],g));
 const run=Math.min(lead.length,Math.floor(n/width),longestRun(values));
 const groups=Math.min(lead.length,Math.floor(n/width),eligible.length);
 return[run,groups,0];
};
E.validatePlay=function(g,seat,cards){if(g.phase!=='play'||g.plays.length===g.hands.length||g.turn!==seat)return{ok:false,error:'现在不是该玩家的回合 / Not this player’s turn'};
 const hand=g.hands[seat],set=new Set(cards.map(c=>c.id));if(set.size!==cards.length||cards.some(c=>!hand.find(v=>v.id===c.id)))return{ok:false,error:'牌不存在 / Cards not held'};
 if(!g.plays.length){const p=E.pattern(cards,g,g.settings.allowThrows);if(!p)return{ok:false,error:'只能出单张、相同牌组合或连续对子/刻子。 / Invalid lead combination'};
 if(p.kind==='throw'&&!E.checkThrowSafe(cards,g,seat))return{ok:false,error:'甩牌失败：对手拥有可压制的同花色牌。请改出安全的组合。 / Unsafe throw'};
 return{ok:true,pattern:p};}
 const lead=g.plays[0].pattern;if(cards.length!==lead.n)return{ok:false,error:`必须跟 ${lead.n} 张牌 / Must play ${lead.n} cards`};
 const available=hand.filter(c=>E.group(c,g)===lead.suit),used=cards.filter(c=>E.group(c,g)===lead.suit);
 if(used.length!==Math.min(available.length,lead.n))return{ok:false,error:'必须先跟首家花色（主牌也是同一门）。 / Must follow the led suit'};
 if(available.length>=lead.n&&lead.kind!=='single'){
   const actual=E.structureSignature(used,g,lead),ideal=E.idealSignature(available,g,lead,lead.n);
   if(actual[0]<ideal[0]||(actual[0]===ideal[0]&&actual[1]<ideal[1]))return{ok:false,error:'必须尽量跟对子、刻子及连续组合。 / Must follow matching structure where possible'};
 }
 return{ok:true,pattern:E.pattern(cards,g,true)};
};
E.canBeat=function(challenger,best,lead,g){const a=E.pattern(challenger,g,true),b=E.pattern(best,g,true);if(!a||!b||a.kind!==lead.kind||a.n!==lead.n||a.width!==lead.width||a.length!==lead.length)return false;
 if(a.suit!==lead.suit&&a.suit!=='T')return false;
 if(b.suit==='T'&&a.suit!=='T')return false;
 if(a.suit==='T'&&b.suit!=='T')return true;
 if(a.kind==='throw'){if(!a.component||!b.component||a.component.length!==b.component.length)return false;return a.component.every((v,i)=>v.width===b.component[i].width&&v.high>=b.component[i].high)&&a.component.some((v,i)=>v.high>b.component[i].high)}
 return a.high>b.high;
};
E.winningPlay=function(g){if(!g.plays.length)return null;let best=g.plays[0],lead=best.pattern;for(let x of g.plays.slice(1))if(E.canBeat(x.cards,best.cards,lead,g))best=x;return best};
E.kittyFactor=function(g,lead){if(!lead)return 2;const classic=g.settings.kittyMultiplier==='classic';
 if(lead.kind==='single')return 2;
 if(lead.kind==='group')return classic?Math.min(32,2**lead.width):Math.min(64,2**lead.n);
 if(lead.kind==='run')return classic?Math.min(64,2**(lead.length+1)):Math.min(64,2**lead.n);
 return 2**Math.min(5,lead.width);
};
E.play=function(g,seat,ids,decisionMeta=null){if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||!g.hands?.[seat]||ids.some(id=>!g.hands[seat].some(c=>c.id===id)))return{ok:false,error:'牌不存在或重复 / Invalid or duplicate card IDs'};const cards=g.hands[seat].filter(c=>ids.includes(c.id));const check=E.validatePlay(g,seat,cards);if(!check.ok)return check;
 const before={phase:g.phase,trickNo:g.trickNo,seat,turn:g.turn,plays:clone(g.plays.map(x=>({seat:x.seat,ids:x.cards.map(c=>c.id)}))),hands:clone(g.hands.map(h=>h.map(c=>c.id))),kitty:g.kitty.map(c=>c.id),scores:[...g.scores],level:g.level,trump:g.trump,voids:clone(g.voids)};
 const lead=g.plays[0]?.pattern;if(lead&&g.hands[seat].filter(c=>E.group(c,g)===lead.suit).length<lead.n&&!g.voids[seat].includes(lead.suit))g.voids[seat].push(lead.suit);
 const set=new Set(ids);g.hands[seat]=g.hands[seat].filter(c=>!set.has(c.id));const rec={seat,cards,pattern:check.pattern};g.plays.push(rec);g.history.push({kind:'play',trick:g.trickNo,seat,cards:[...ids],team:E.team(seat),bot:!!decisionMeta,reason:decisionMeta?.reason||'',time:new Date().toISOString()});
 if(decisionMeta){g.decisions.push({before,move:[...ids],strategy:decisionMeta,handNo:g.handNo});if(g.decisions.length>140)g.decisions.shift()}
 if(g.plays.length===4){const winner=E.winningPlay(g),points=g.plays.flatMap(x=>x.cards).reduce((n,c)=>n+E.points(c),0);g.scores[E.team(winner.seat)]+=points;
 (g.captured||(g.captured=[[],[]]))[E.team(winner.seat)].push(...g.plays.flatMap(x=>x.cards).filter(c=>E.points(c)>0));
 g.lastTrick={trick:g.trickNo,winner:winner.seat,points,plays:clone(g.plays),lead:clone(g.plays[0].pattern)};
 g.history.push({kind:'trick-end',trick:g.trickNo,winner:winner.seat,points,scores:[...g.scores]});
 g.turn=winner.seat;g.leader=winner.seat;
 return{ok:true,trickComplete:true,winner:winner.seat,points};}
 g.turn=(seat+1)%4;return{ok:true,trickComplete:false};
};
E.clearTrick=function(g){if(g.plays.length!==4)return{ok:false};const lead=g.plays[0].pattern,lastWinner=g.lastTrick.winner;
 g.plays=[];if(g.hands.every(h=>h.length===0)){E.endHand(g,lastWinner,lead);return{ok:true,handComplete:true}}g.trickNo++;return{ok:true,handComplete:false};
};
// The finishing play, not a random J in the trick, decides a J-hook penalty.
// Only a highest-ranking card within the winning final-play combination can qualify.
E.kittyWinningJack=function(g,winner){
 const last=g.lastTrick;
 if(!last||last.winner!==winner||!Array.isArray(last.plays))return null;
 const play=last.plays.find(p=>p.seat===winner);
 if(!play||!play.cards?.length)return null;
 const high=Math.max(...play.cards.map(c=>E.power(c,g)));
 const determining=play.cards.filter(c=>E.power(c,g)===high);
 const main=determining.some(c=>c.s===g.trump&&c.r===11&&c.s!=='J');
 const side=determining.some(c=>c.s!=='J'&&c.s!==g.trump&&c.r===11);
 if(main)return{kind:'main',toLevel:2,winningCards:determining.filter(c=>c.r===11).map(c=>c.id)};
 if(side)return{kind:'side',toLevel:7,winningCards:determining.filter(c=>c.r===11).map(c=>c.id)};
 return null;
};
// An upgrade may reach J, but may never bypass it. Only *defending J*
// (actually playing at J with the dealer team) unlocks the levels above J.
E.advanceLevel=function(old,gain,playedLevel,defended,Jrequired){
 let next=Math.min(14,old+Math.max(0,gain));
 if(Jrequired!==false&&old<=11&&next>11&&!(defended&&playedLevel===11&&old===11))next=11;
 return next;
};
E.endHand=function(g,winner,lastLead){
 const dealerTeam=E.team(g.dealerSeat),attacking=1-dealerTeam;
 const kittyValue=g.kitty.reduce((a,c)=>a+E.points(c),0),factor=E.kittyFactor(g,lastLead);
 const kittyCaptured=E.team(winner)===attacking;
 const kittyBonus=kittyCaptured?kittyValue*factor:0;
 if(kittyCaptured)g.scores[attacking]+=kittyBonus;
 const score=g.scores[attacking],threshold=40*g.decks,step=20*g.decks,takeover=score>=threshold;
 let gain,winTeam;
 if(takeover){winTeam=attacking;gain=Math.floor((score-threshold)/step)+(g.settings.bonusOnTakeover?1:0)}
 else{winTeam=dealerTeam;gain=score===0?3:score<threshold/2?2:1;}
 const old=[...g.match.levels];
 g.match.levels[winTeam]=E.advanceLevel(old[winTeam],gain,g.level,winTeam===dealerTeam,g.settings.jMustDefend);
 // The penalty requires all three conditions: playing J as banker, the
 // challengers reach the takeover threshold *including the kitty*, and the
 // challengers win the last trick specifically with a decisive J.
 let jackPenalty=null;
 if(g.settings.jMustDefend!==false&&g.level===11&&takeover&&kittyCaptured){
  const hook=E.kittyWinningJack(g,winner);
  if(hook){g.match.levels[dealerTeam]=hook.toLevel;
   jackPenalty={...hook,fromLevel:old[dealerTeam],dealerTeam};}
 }
 // A is the last playable rank. Match victory is possible ONLY when the
 // defending partnership actually played A as banker and held the bank.
 const champion=(g.level===14&&!takeover)?dealerTeam:null;
 // Winning A ends the match; do not advance/deal a phantom level 15.
 if(champion!==null)g.match.champion=champion;
 else delete g.match.champion;
 g.match.dealerSeat=takeover?(g.dealerSeat+1)%4:(g.dealerSeat+2)%4;
 g.match.handNo=g.handNo;
 g.handResults={attacking,score,threshold,step,takeover,winnerTeam:winTeam,gain,kittyValue,kittyBonus,factor,kittyCaptured,oldLevels:old,newLevels:[...g.match.levels],nextDealer:g.match.dealerSeat,champion,jackPenalty};
 g.phase='finished';g.history.push({kind:'hand-end',results:clone(g.handResults)});return g.handResults;
};
E.describe=function(p){if(!p)return'';if(p.kind==='single')return'单张';if(p.kind==='group')return p.width===2?'对子':p.width===3?'刻子':p.width===4?'四张':'同牌';if(p.kind==='run')return p.width===2?`拖拉机 ${p.length} 对`:p.width===3?`连刻 ${p.length} 组`:`连续 ${p.length} 组`;return'甩牌'};
E.fullSnapshot=function(g,comment=''){return {schema:'HHgames-feedback-v1',appVersion:E.VERSION,exportedAt:new Date().toISOString(),comment,disclosure:'This feedback contains all four players hidden hands, the kitty, bot decisions and editable player names. Only share it if comfortable.',settings:clone(g.settings),seed:g.seed,rng:g.rng,handNo:g.handNo,match:clone(g.match),phase:g.phase,dealerSeat:g.dealerSeat,level:g.level,trump:g.trump,declared:clone(g.declared),firstDeclarer:g.firstDeclarer,bids:clone(g.bids),dealCursor:g.dealCursor,totalToDeal:g.totalToDeal,dealPile:clone(g.dealPile||[]),turn:g.turn,leader:g.leader,trickNo:g.trickNo,plays:clone(g.plays),hands:clone(g.hands),kitty:clone(g.kitty),removed:clone(g.removed),initialHands:clone(g.initialHands),scores:clone(g.scores),captured:clone(g.captured||[[],[]]),voids:clone(g.voids),lastTrick:clone(g.lastTrick),handResults:clone(g.handResults),history:clone(g.history),botDecisions:clone(g.decisions)};};
E.cardFromId=function(g,id){return E.makeDeck(g.decks).find(c=>c.id===id)};
root.HHEngine=E;if(typeof module!=='undefined'&&module.exports)module.exports=E;
})(typeof window!=='undefined'?window:globalThis);
