/* HHgames bot: partnership-aware heuristics, observed-card tracking and small imperfect-information rollouts. */
(function(root){'use strict';const E=root.HHEngine,B={};
const unique=a=>[...new Map(a.map(x=>[E.key(x),x])).values()];
const points=a=>a.reduce((v,c)=>v+E.points(c),0);
const hash=a=>a.map(c=>c.id).sort().join('|');
const take=(a,n)=>a.slice(0,n);
const sortBy=(arr,g,asc=true)=>[...arr].sort((a,b)=>(asc?1:-1)*(E.power(a,g)-E.power(b,g))||a.id.localeCompare(b.id));
function pickExtras(pool,need,g,mode='cheap',used=[]){const exclude=new Set(used.map(c=>c.id));let arr=pool.filter(c=>!exclude.has(c.id));let t=arr.map(c=>({c,v:(E.group(c,g)==='T'?25:0)+E.points(c)*1.8+E.power(c,g)*.18}));if(mode==='points')t.sort((a,b)=>E.points(b.c)-E.points(a.c)||a.v-b.v);else if(mode==='high')t.sort((a,b)=>b.v-a.v);else t.sort((a,b)=>a.v-b.v);return t.slice(0,need).map(z=>z.c)}
function patternMoves(hand,g){const moves=[],grouped=new Map();for(let c of hand){const group=E.group(c,g);if(!grouped.has(group))grouped.set(group,[]);grouped.get(group).push(c)}
 for(let arr of grouped.values()){
  for(let c of unique(arr))moves.push([c]);
  const keys=[...E.counts(arr).values()];
  for(let v of keys)for(let width=2;width<=Math.min(4,v.length);width++)moves.push(v.slice(0,width));
  for(let width=2;width<=Math.min(g.decks,4);width++){
   const units=keys.filter(a=>a.length>=width).sort((a,b)=>E.ordinal(a[0],g)-E.ordinal(b[0],g));
   for(let i=0;i<units.length;i++){
    const chunk=[units[i]];for(let j=i+1;j<units.length&&chunk.length<7;j++){
      if(E.ordinal(units[j][0],g)!==E.ordinal(chunk.at(-1)[0],g)+1)break;
      chunk.push(units[j]);if(chunk.length>=2)moves.push(chunk.flatMap(a=>a.slice(0,width)));
    }
   }
  }
 }
 return [...new Map(moves.map(a=>[hash(a),a])).values()];
}
B.leadMoves=patternMoves;
function followerLegal(hand,cards,lead,g){if(cards.length!==lead.n)return false;const has=new Set(hand.map(c=>c.id));if(cards.some(c=>!has.has(c.id)))return false;
 const a=hand.filter(c=>E.group(c,g)===lead.suit),u=cards.filter(c=>E.group(c,g)===lead.suit);
 if(u.length!==Math.min(a.length,lead.n))return false;
 if(a.length>=lead.n&&lead.kind!=='single'){
  let actual=E.structureSignature(u,g,lead),ideal=E.idealSignature(a,g,lead,lead.n);
  if(actual[0]<ideal[0]||(actual[0]===ideal[0]&&actual[1]<ideal[1]))return false;
 }
 return true;
}
B.followerLegal=followerLegal;
function buildGreedy(avail,n,lead,g,mode='cheap'){
 const hand=[...avail],cnt=[...E.counts(hand).values()],picked=[];
 if(lead.kind==='group'){
  const w=lead.width;cnt.sort((a,b)=>Math.min(w,b.length)-Math.min(w,a.length)||((mode==='high'?-1:1)*(E.power(a[0],g)-E.power(b[0],g))));
  if(cnt.length)picked.push(...cnt[0].slice(0,Math.min(w,cnt[0].length)));
 }else if(lead.kind==='run'||lead.kind==='throw'){
  const width=lead.kind==='throw'?2:lead.width;
  const eligible=cnt.filter(a=>a.length>=width).sort((a,b)=>E.ordinal(a[0],g)-E.ordinal(b[0],g));
  const max=Math.min(lead.kind==='throw'?Math.floor(n/2):lead.length,Math.floor(n/width));
  let longest=[],cur=[];
  for(const a of eligible){cur=cur.length&&E.ordinal(a[0],g)===E.ordinal(cur.at(-1)[0],g)+1?[...cur,a]:[a];if(cur.length>longest.length)longest=cur}
  const selected=longest.slice(0,max);for(const a of selected)picked.push(...a.slice(0,width));
  const already=new Set(selected.map(a=>E.key(a[0])));for(const a of eligible){if(picked.length+width>n)break;if(!already.has(E.key(a[0]))){picked.push(...a.slice(0,width));already.add(E.key(a[0]));}}
  if(width>2&&!eligible.length){const second=cnt.filter(a=>a.length>=2).sort((a,b)=>E.power(a[0],g)-E.power(b[0],g));for(const a of second){if(picked.length+2>n)break;picked.push(...a.slice(0,2));}}
 }
 return [...picked,...pickExtras(hand,n-picked.length,g,mode,picked)];
}
function candidateFollow(hand,g,lead){const n=lead.n,arr=hand.filter(c=>E.group(c,g)===lead.suit),other=hand.filter(c=>E.group(c,g)!==lead.suit),out=[];
 const add=x=>{if(x.length===n&&followerLegal(hand,x,lead,g))out.push(x)};
 if(n===1){for(let c of unique(arr.length?arr:hand))add([c]);return out}
 if(arr.length>=n){
  if(lead.kind==='group'){
   const by=[...E.counts(arr).values()];for(const cards of by){const picked=cards.slice(0,Math.min(n,cards.length));for(let mode of ['cheap','high','points'])add([...picked,...pickExtras(arr,n-picked.length,g,mode,picked)]);}
  }
  if(lead.kind==='run'){
   const width=lead.width,by=[...E.counts(arr).values()].filter(a=>a.length>=width).sort((a,b)=>E.ordinal(a[0],g)-E.ordinal(b[0],g));
   for(let i=0;i<by.length;i++){
    let run=[by[i]];for(let j=i+1;j<by.length&&run.length<lead.length;j++){
     if(E.ordinal(by[j][0],g)!==E.ordinal(run.at(-1)[0],g)+1)break;run.push(by[j]);
    }
    const picked=run.slice(0,lead.length).flatMap(a=>a.slice(0,width));for(let mode of ['cheap','high','points'])add([...picked,...pickExtras(arr,n-picked.length,g,mode,picked)]);
   }
  }
  for(let mode of ['cheap','high','points'])add(buildGreedy(arr,n,lead,g,mode));
  const sortable=sortBy(arr,g,true);add(sortable.slice(0,n));add(sortable.slice(-n));
  for(let j=0;j<Math.min(7,arr.length);j++){
   const picked=[arr[j]];add([...picked,...pickExtras(arr,n-1,g,'cheap',picked)]);
  }
 }else{
  // Every card of the led suit must be played; optimize the unavoidable slough or ruff.
  const left=n-arr.length;if(!arr.length){
    for(let group of ['T',...E.SUITS]){
      const suit=other.filter(c=>E.group(c,g)===group);if(suit.length>=n){
       for(let v of patternMoves(suit,g))if(v.length===n)add(v);
      }
    }
  }
  for(let mode of ['cheap','high','points'])add([...arr,...pickExtras(other,left,g,mode)]);
  for(let c of unique(other).slice(0,12)){let start=[...arr,c];add([...start,...pickExtras(other,n-start.length,g,'cheap',start)])}
 }
 return [...new Map(out.map(a=>[hash(a),a])).values()].slice(0,135);
}
// Full, rank-distinct enumeration for one- and two-card follows. The old
// greedy sampler missed cheap sloughs like C2+C3 when void in the led suit.
// All selections still pass the shared structure/follow legality check.
const followLegacy=candidateFollow;
candidateFollow=function(hand,g,lead){
 const older=followLegacy(hand,g,lead);if(lead.n!==2)return older;
 const led=hand.filter(c=>E.group(c,g)===lead.suit),need=Math.min(2,led.length);
 const others=hand.filter(c=>E.group(c,g)!==lead.suit);
 const uniqueRank=list=>[...new Map(list.map(c=>[E.key(c),c])).values()];
 const uniq=uniqueRank(need===2?led:need===0?others:others);
 const added=new Map(older.map(x=>[hash(x),x]));
 const add=x=>{if(x.length!==2||!followerLegal(hand,x,lead,g))return;added.set(hash(x),x)};
 if(need===2){const u=uniqueRank(led);for(let i=0;i<u.length;i++)for(let j=i+1;j<u.length;j++)add([u[i],u[j]]);}
 else if(need===1){for(const c of uniqueRank(others))add([led[0],c]);}
 else{for(let i=0;i<uniq.length;i++)for(let j=i+1;j<uniq.length;j++)add([uniq[i],uniq[j]]);
   for(const cards of E.counts(others).values())if(cards.length>=2)add(cards.slice(0,2));}
 // Do not silently lose cheap candidates due to arbitrary output ordering.
 return [...added.values()];
};
B.followMoves=candidateFollow;
function playedVisibleIds(g){const set=new Set();for(let x of g.history){if(x.kind==='play')for(let id of x.cards)set.add(id);}return set}
function remainingHigher(g,seat,c,onlyEnemy=false){const visible=playedVisibleIds(g);for(let a of g.hands[seat])visible.add(a.id);const universe=E.makeDeck(g.decks||g.settings.decks||2);let greater=0;for(let card of universe){if(visible.has(card.id))continue;if(E.group(card,g)!==E.group(c,g))continue;if(E.ordinal(card,g)>E.ordinal(c,g))greater++}return greater;}
// Cost measures lost future options, not just the physical rank of discarded cards.
// In particular, losing an entire high pair (S A-A) is much more expensive than
// losing two cheap singletons, even when neither move wins the present trick.
function strengthCost(g,seat,move){
 const hand=g.hands[seat],left=new Set(move.map(c=>c.id));
 const remain=hand.filter(c=>!left.has(c.id));
 const before=E.counts(hand),after=E.counts(remain);let cost=0;
 for(const c of move){const trump=E.group(c,g)==='T';const rank=E.ordinal(c,g);
  cost+=(trump?12:0)+(trump?rank*.95:rank*.38)+E.points(c)*.7;
  if(c.s==='J')cost+=(c.r===17?53:40);
  else if(trump&&c.r===g.level)cost+=14;
 }
 for(const [key,arr] of before){const old=arr.length,n=after.get(key)?.length||0;if(old===n)continue;
  const c=arr[0],ord=E.ordinal(c,g),trump=E.group(c,g)==='T';
  if(old>=2&&old<=4){
    const pairValue=trump?21+Math.max(0,ord-8)*1.8:14+Math.max(0,ord-7)*4.0;
    if(n<2)cost+=pairValue*(old===2?1:old===3?.8:1.1);
    if(old===3&&n<3)cost+=18; // preserve triples even if a pair can be spared
    if(old>=4&&n<4)cost+=14;
  }
 }
 const runLoss=Math.max(0,E.maxRun(hand,g,2)-E.maxRun(remain,g,2));
 cost+=runLoss*16;
 return cost;
}
function futureStrength(g,seat,move){
 const ids=new Set(move.map(x=>x.id)),remaining=g.hands[seat].filter(x=>!ids.has(x.id));
 const grouped=new Map();for(const c of remaining){const suit=E.group(c,g);if(!grouped.has(suit))grouped.set(suit,[]);grouped.get(suit).push(c)}
 let value=0;for(const [s,cs] of grouped){const counts=[...E.counts(cs).values()];const ordered=counts.sort((a,b)=>E.ordinal(b[0],g)-E.ordinal(a[0],g));
   for(const a of ordered){const r=E.ordinal(a[0],g),w=a.length;
    if(w>=2)value+= (s==='T'?12:9)+ Math.max(0,r-7)*(s==='T'?1.3:3.3);
    if(w>=3)value+=18;if(w>=4)value+=25;
   }
   value+=Math.max(0,E.maxRun(cs,g,2)-1)*12;
   if(s==='T')value+=cs.length*.6;
 }
 return value;
}
function scoreUrgency(g,seat){
 const attackers=1-E.team(g.dealerSeat),target=40*(g.decks||g.settings.decks||2),score=g.scores[attackers];
 if(E.team(seat)===attackers)return Math.max(-.25,Math.min(.75,(target-score)/target));
 return Math.max(-.25,Math.min(.65,(score-target*.65)/target));
}
// Lead-control advice is based on public cards, our own hand and observed voids.
// A low TRIPLE in a three-deck game is often a better tempo play than a high
// singleton: only an opponent holding the matching higher triple can overtake.
function confirmedPartner(g,seat,other){
 if(other===seat)return false;
 if(g.mode==='friends'){
  const known=new Set(g.allies||[]);
  if(known.has(seat)&&known.has(other))return true;
  // After ALL friend identities are revealed, the remaining seats know
  // they belong to the same defender/opponent side and may cooperate too.
  return !known.has(seat)&&!known.has(other)&&
    (g.friendCalls||[]).length>0&&g.friendCalls.every(c=>c.revealed);
 }
 return E.team(seat)===E.team(other);
}
function leadControlBonus(g,seat,move,p){
 const group=p.suit,other=remainingHigher(g,seat,move[0]);
 const allies=Array.from({length:g.players||4},(_,i)=>i).filter(i=>confirmedPartner(g,seat,i));
 const voidAllies=allies.filter(i=>(g.voids?.[i]||[]).includes(group)).length;
 const voidEnemies=Array.from({length:g.players||4},(_,i)=>i).filter(i=>i!==seat&&!confirmedPartner(g,seat,i)&&(g.voids?.[i]||[]).includes(group)).length;
 const rank=Math.max(...move.map(c=>E.ordinal(c,g)));
 let bonus=0;
 if(p.kind==='group'&&p.width>=3){
  // Three-of-a-kind is inherently a strong structural lead, even if rank=4.
  bonus+=34+9*(p.width-3)+(g.decks===3?13:0);
  // Do not spend the top trump trip on an empty trick without reason.
  if(group==='T'&&move.some(c=>c.s==='J'||c.r===g.level))bonus-=15;
 }
 if(p.kind==='run'){
  bonus+=19+9*(p.length-2)+7*(p.width-2);
  if(group==='T'&&move.some(c=>c.s==='J'))bonus-=13;
 }
 if(p.kind==='single'){
  const c=move[0],unseen=remainingHigher(g,seat,c);
  // K/10 are scoring cards, not harmless signals. Leading them before enemy
  // replies with a viable higher card is usually a needless 10-point gift.
  if(E.points(c)&&unseen>0){
   bonus-=c.r===10?53:c.r===13?44:32;
   if(voidAllies)bonus+=12; // partner may ruff, but is never guaranteed to.
  }
  if(group!=='T'&&rank<9&&unseen>0){
   bonus-=20;
   if(!voidAllies)bonus-=13; // no confirmed teammate known able to ruff
  }
  // A small trump can be a controlled hand-off if the other side suits are
  // unreliable and a confirmed partner is still active. Never assume they
  // have a particular hidden big trump.
  if(group==='T'&&rank<=7&&allies.length&&!move.some(c=>E.points(c))){
    const ownReliableSide=g.hands[seat].some(c=>E.group(c,g)!=='T'&&c.r===14);
    if(!ownReliableSide)bonus+=11;
  }
 }
 if(group!=='T'&&voidAllies){
  bonus+=12+8*voidAllies;
  if(p.kind==='single'&&E.points(move[0]))bonus-=9; // ruff is an opportunity, not certainty
 }
 if(group!=='T'&&voidEnemies)bonus-=24*voidEnemies;
 return bonus;
}
B.controlBonus=leadControlBonus;
function leadScore(g,seat,move){const p=E.pattern(move,g,g.settings.allowThrows),other=remainingHigher(g,seat,move[0]);const group=p.suit;
 let score=22 + (p.kind==='run'?14+6*p.length:p.kind==='group'?7*p.width:0) + (E.ordinal(move[0],g)*.6) -other*(p.kind==='single'?2.7:1.2);
 score-=strengthCost(g,seat,move)*(p.kind==='single'?.48:p.kind==='group'?.12:.22);score-=points(move)*1.65;
 if(group==='T')score-=9;
 const groupCount=g.hands[seat].filter(c=>E.group(c,g)===group).length;
 if(groupCount===move.length&&group!=='T')score+=7;
 if(p.kind==='run'&&move.length>4)score-=5*(move.length-4);
 const handLeft=g.hands[seat].length-move.length;
 const jokerCount=move.filter(c=>c.s==='J').length;
 if(jokerCount&&handLeft>3){
   const jokerPair=move.length>=2&&move.every(c=>c.s==='J'&&c.r===move[0].r);
   score-=(jokerPair?19:49)*jokerCount;
   if(move.some(c=>c.r===17))score-=10;
 }
 if(g.hands[seat].length<=6&&group==='T')score+=10;
 score+=futureStrength(g,seat,move)*.05;
 const remaining=g.hands[seat].filter(c=>!move.some(x=>x.id===c.id));
 if(group!=='T'&&groupCount>=5&&p.kind!=='single')score+=8;
 if(!remaining.some(c=>E.group(c,g)==='T')&&group==='T'&&g.hands[seat].length>5)score-=12;
 return score+leadControlBonus(g,seat,move,p);
}

function knownLateOverruff(g,seat,move){
 if(!g.plays.length)return 0;
 const lead=g.plays[0].pattern;
 if(lead.suit==='T'||!move.every(c=>E.group(c,g)==='T')||!points(move))return 0;
 if(g.hands[seat].some(c=>E.group(c,g)===lead.suit))return 0;
 // Check opponents not yet to play, using void information only (never hidden hands).
 let danger=0;for(let i=g.plays.length+1;i<4;i++){
  const next=(g.plays[0].seat+i)%4;
  if(E.team(next)!==E.team(seat)&&g.voids[next]?.includes(lead.suit))danger++;
 }
 // A known void means the opponent *can* ruff, not that they necessarily
 // have a HIGHER matching trump pair. The previous 21x multiplier made
 // an otherwise winning D5-D5 pair virtually unplayable (user trick 9).
 return danger?points(move)*(1.1+danger*.45):0;
}
// Forecast the FINAL opponent's reply when we are the third player.
// Only cards publicly played and our own hand are excluded: never look at the
// real hidden cards of the last player. A known void is a possibility of a
// ruff, not proof of a stronger trump.
function lastSeatThreat(g,seat,winningCards,lead){
 if(g.plays.length!==2)return 0;
 const last=(seat+1)%4;
 if(E.team(last)===E.team(seat))return 0;
 const bestPattern=E.pattern(winningCards,g,true);if(!bestPattern)return .65;
 const seen=playedVisibleIds(g);
 for(const c of g.hands[seat])seen.add(c.id);
 for(const p of g.plays)for(const c of p.cards)seen.add(c.id);
 const pool=E.makeDeck(g.decks||g.settings.decks||2).filter(c=>!seen.has(c.id));
 if(!pool.length)return 0;
 const held=(g.hands[last]||[]).length;
 // Probability that an opponent with this many unknown cards holds a
 // single higher card (or a higher complete group when following a pair).
 if(lead.n===1){
   const higher=pool.filter(c=>E.canBeat([c],winningCards,lead,g)&&
       (E.group(c,g)===lead.suit || (g.voids[last]||[]).includes(lead.suit)));
   const p=Math.min(.99,1-Math.pow(1-higher.length/pool.length,Math.max(0,held)));
   // A lower-bound threat for a very weak lead, to avoid trusting an
   // opponent who has not yet acted even when few cards remain unplayed.
   return p;
 }
 if(bestPattern.kind==='group'){
   const w=bestPattern.width,groups=[...E.counts(pool).values()];let chanceNone=1;
   for(const group of groups){if(group.length<w)continue;
     const challenger=group.slice(0,w);
     if(!E.canBeat(challenger,winningCards,lead,g))continue;
     // Probability the same opponent holds all w copies, approximated with
     // the exact hypergeometric draw for each group, combined conservatively.
     let p=1;for(let k=0;k<w;k++)p*=Math.max(0,held-k)/Math.max(1,pool.length-k);
     const subsets=w===2?group.length*(group.length-1)/2:1;
     chanceNone*=Math.max(.01,1-Math.min(.92,p*subsets));
   }
   return Math.min(.94,1-chanceNone);
 }
 return .45; // less common mixed structures: do not assume perfect safety
}
function followScore(g,seat,move){const lead=g.plays[0].pattern,best=E.winningPlay(g),partnerWinning=E.team(best.seat)===E.team(seat),canWin=E.canBeat(move,best.cards,lead,g);
 const trickPoints=g.plays.reduce((s,p)=>s+points(p.cards),0)+points(move);
 const isLast=(g.plays.length===3),isFinalHand=g.hands[seat].length===lead.n;
 const cost=strengthCost(g,seat,move);
 const future=futureStrength(g,seat,move);
 let score=0;
 if(partnerWinning){
  score+=points(move)*4.5-cost*.6;
  if(canWin){
   // A teammate *currently* leading is not always safe. If a weak card is
   // exposed to an opponent who has yet to follow, taking control with a
   // proportionate card is better than reflexively ducking and losing 10/K.
   const later=Array.from({length:3-g.plays.length},(_,j)=>(seat+j+1)%4);
   const enemyLater=later.some(i=>E.team(i)!==E.team(seat));
   const old=E.pattern(best.cards,g,true);
   const vulnerable=enemyLater&&old?.kind==='single'&&old.high<9;
   const threat=g.plays.length===2?lastSeatThreat(g,seat,best.cards,lead):.55;
   score+=vulnerable&&threat>.35?(12+trickPoints*1.2):-35;
  }
  // The third player must not feed points merely because the partner is
  // CURRENTLY winning. A fourth-seat enemy can easily beat a weak lead.
  // Reward point-feeding only if the estimate says the partner survives.
  if(g.plays.length===2&&E.team((seat+1)%4)!==E.team(seat)){
    const danger=lastSeatThreat(g,seat,best.cards,lead);
    // A low, unprotected side-suit lead is not a secure point-collection
    // opportunity. Even with limited public information, err on the side of
    // not gifting 5/10/K points to the unseen fourth-seat opponent.
    const bp=E.pattern(best.cards,g,true);
    const weakSideLead=bp?.kind==='single'&&bp.suit!=='T'&&bp.high<=7;
    const exposed=Math.max(danger,weakSideLead?.72:0);
    if(exposed>0)score-=points(move)*exposed*17;
  }
  // Teammate leading is not the same as teammate safely winning: if an enemy
  // behind us is known void in the led suit, they may overruff. Avoid feeding
  // that player 5/10/K points. Only public void observations are considered.
  const unsafeLateEnemy=g.plays.length<3 && lead.suit!=='T' &&
    [...Array(3-g.plays.length)].some((_,j)=>{
      const following=(seat+j+1)%4;
      return E.team(following)!==E.team(seat)&&g.voids[following]?.includes(lead.suit);
    });
  if(unsafeLateEnemy&&points(move)){
    // Recorded voids are public information. If an opponent behind us can
    // ruff, feeding them point cards is usually worse than using a small trump.
    // Particularly important when the current winner is our partner.
    score-=points(move)*24;
  }
 }
 else if(canWin){const scoreWeight=(g.scores[1-E.team(g.dealerSeat)]>=40*g.decks-10)?1.5:1;
  score+=24+trickPoints*2.4*scoreWeight-cost*.75 + 11*scoreUrgency(g,seat);
  if(!isLast)score-=10;
  if(isFinalHand&&E.team(seat)!==E.team(g.dealerSeat))score+=35;
 }else {score+=-points(move)*2.7-cost*.68;if(!isLast)score+=3;}
 // Critical partnership and endgame trump preservation. If we are last to
 // act and the trick has no points, don't burn a top joker just for a tempo
 // win. Exception: our hand is almost empty, where kitty control matters.
 const joker=move.some(c=>c.s==='J');
 // A joker sloughed as filler into an off-trump lead cannot win the trick.
 // Never prefer that over an ordinary disposable card when we are short
 // of the led suit. This also covers the reported Prof. Wang follow-pair
 // position (H10 + black Joker vs H K-K) without peeking at hidden hands.
 if(joker&&lead.suit!=='T'){
   const ledHeld=g.hands[seat].filter(c=>E.group(c,g)===lead.suit);
   if(ledHeld.length<lead.n){
     const needed=lead.n-ledHeld.length;
     const disposable=g.hands[seat].filter(c=>E.group(c,g)!==lead.suit&&c.s!=='J');
     const selectedJokers=move.filter(c=>c.s==='J').length;
     if(disposable.length>=needed&&selectedJokers)score-=220*selectedJokers;
   }
 }
 const bigJoker=move.some(c=>c.s==='J'&&c.r===17);
 const futureCards=g.hands[seat].length-move.length;
 if(joker&&futureCards>2){
   // Stronger penalty for burning the big joker and for taking an empty trick.
   if(canWin&&trickPoints===0)score-=bigJoker?100:77;
   else if(canWin&&trickPoints<=10)score-=bigJoker?47:34;
   if(partnerWinning&&canWin)score-=85;
   if(isLast&&trickPoints===0&&canWin)score-=25;
 }
 if(isLast&&partnerWinning)score+=points(move)*1.5;
 if(lead.suit!=='T'&&move.every(c=>E.group(c,g)==='T')&&canWin)score-=7;
 // Evaluate what we retain: future high pairs and tractors have strategic value.
 score+=future*.32;
 // Especially costly: spending an entire high off-suit pair to discard without
 // even taking the trick (the reported Prof. Wang S A-A error).
 if(!canWin&&move.length===2&&E.key(move[0])===E.key(move[1])&&E.group(move[0],g)!=='T'&&E.ordinal(move[0],g)>=9)score-=32;
 // A capable trump pair can wrest the lead back; avoid being permanently passive
 // when the attacker's score still needs to reach its target.
 if(canWin&&lead.suit!=='T'&&move.every(c=>E.group(c,g)==='T')&&g.plays.length<3){
   score+=Math.max(0,scoreUrgency(g,seat))*50;
   // There are still players behind us, who may add valuable points.
   // Winning control before their cards arrive has real expected value.
   score+=(3-g.plays.length)*7;
   const ruffPattern=E.pattern(move,g,true);
   if(ruffPattern?.kind==='group'&&ruffPattern.width===lead.width&&ruffPattern.high>=12)score+=13;
   if(trickPoints===0&&g.hands[seat].length>9)score-=14;
 }
 // Third seat: if the enemy is currently winning, don't merely beat them
 // by the smallest increment and let the fourth enemy take the trick back.
 // Value the chance our new winning card survives until the trick is scored.
 if(g.plays.length===2&&E.team((seat+1)%4)!==E.team(seat)&&
     !partnerWinning&&canWin){
   const danger=lastSeatThreat(g,seat,move,lead);
   score+=(1-danger)*(54+trickPoints*2.4 + 12*Math.max(0,scoreUrgency(g,seat)));
   // Prefer a sufficient ordinary trump over spending a level trump or Joker
   // merely to guard against an uncertain final-seat overtake.
   if(lead.n===1&&move.some(c=>c.r===g.level||c.s==='J')){
     const sufficient=g.hands[seat].some(c=>c.s!=='J'&&c.r!==g.level&&
       E.canBeat([c],best.cards,lead,g)&&lastSeatThreat(g,seat,[c],lead)<.72);
     if(sufficient)score-=17;
   }
 }
 score-=knownLateOverruff(g,seat,move);
 return score;
}
function sampleUnknownWorld(g,seat,seed){const rootHands=[null,null,null,null];rootHands[seat]=g.hands[seat].slice();let seen=playedVisibleIds(g);for(let c of g.hands[seat])seen.add(c.id);
 const unseen=E.makeDeck(g.decks||g.settings.decks||2).filter(c=>!seen.has(c.id));let x=seed>>>0;const next=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296};for(let i=unseen.length-1;i>0;i--){const j=Math.floor(next()*(i+1));[unseen[i],unseen[j]]=[unseen[j],unseen[i]]}
 let pool=unseen,quotas=g.hands.map((h,i)=>i===seat?0:h.length);for(let i=0;i<4;i++)if(i!==seat)rootHands[i]=[];
 // Assign plausible unknown cards respecting inferred void suits where feasible.
 for(let card of pool){const candidates=[0,1,2,3].filter(i=>i!==seat&&quotas[i]>0&&!g.voids[i].includes(E.group(card,g)));
 const fallback=[0,1,2,3].filter(i=>i!==seat&&quotas[i]>0);
 const choices=candidates.length?candidates:fallback;if(!choices.length)break;
 const i=choices[Math.floor(next()*choices.length)];rootHands[i].push(card);quotas[i]--;
 }
 return rootHands;
}
function immediateOutcome(g,seat,move,world){const lead=g.plays.length?g.plays[0].pattern:E.pattern(move,g,g.settings.allowThrows),simPlays=g.plays.map(x=>({...x,cards:x.cards.slice()}));
 simPlays.push({seat,cards:move,pattern:E.pattern(move,g,true)});
 world[seat]=world[seat].filter(c=>!move.some(x=>x.id===c.id));
 let turn=(seat+1)%4;
 while(simPlays.length<4){const hand=world[turn]||[];const simG={...g,hands:world,plays:simPlays,turn};let opts=candidateFollow(hand,g,lead);if(!opts.length){ // Fallback: greedily fit every led-suit card then add filler.
   const a=hand.filter(c=>E.group(c,g)===lead.suit).slice(0,lead.n);opts=[[...a,...pickExtras(hand,lead.n-a.length,g,'cheap',a)]];
 }
 let best=E.winningPlay(simG);const tw=E.team(best.seat)===E.team(turn);
 const scored=opts.map(c=>({c,v:tw?points(c)*2-strengthCost(simG,turn,c)*.35: E.canBeat(c,best.cards,lead,g)?30+points(simPlays.flatMap(p=>p.cards))*1.4-strengthCost(simG,turn,c)*.6:-points(c)*2-strengthCost(simG,turn,c)*.4}));
 scored.sort((a,b)=>b.v-a.v);let reply=scored[0].c;
 simPlays.push({seat:turn,cards:reply,pattern:E.pattern(reply,g,true)});
 world[turn]=hand.filter(c=>!reply.some(r=>r.id===c.id));turn=(turn+1)%4;
 }
 let best=simPlays[0];for(let x of simPlays.slice(1))if(E.canBeat(x.cards,best.cards,lead,g))best=x;
 const tally=simPlays.reduce((s,a)=>s+points(a.cards),0);return{winTeam:E.team(best.seat),winner:best.seat,points:tally,world};
}
// A cheap second-trick forecast is deliberately limited: a sampled world is
// one possible arrangement, never a claim that the bot can see hidden cards.
function nextTrickForecast(g,seat,outcome){
 const hands=outcome.world,winner=outcome.winner,remaining=hands[winner]||[];
 if(!remaining.length)return 0;
 const leaders=patternMoves(remaining,g).filter(a=>a.length<=3);
 if(!leaders.length)return 0;
 // Prefer promising leads after winning; preserve costly pairs / trump assets.
 const leadChoices=leaders.map(c=>({c,v:leadScore({...g,hands},winner,c)})).sort((a,b)=>b.v-a.v);
 const lead=leadChoices[0].c,pat=E.pattern(lead,g,true);if(!pat)return 0;
 const plays=[{seat:winner,cards:lead,pattern:pat}];hands[winner]=remaining.filter(c=>!lead.some(x=>x.id===c.id));
 for(let j=1;j<4;j++){
  const next=(winner+j)%4,hand=hands[next]||[];if(hand.length<lead.length)return 0;
  const sg={...g,hands,plays};const opts=candidateFollow(hand,sg,pat);
  if(!opts.length)return 0;
  const best=E.winningPlay(sg),friendly=E.team(best.seat)===E.team(next);
  const ranked=opts.map(c=>({c,s:friendly?points(c)*1.5-strengthCost(sg,next,c)*.4:E.canBeat(c,best.cards,pat,sg)?22+points(plays.flatMap(p=>p.cards))*2-strengthCost(sg,next,c)*.5:-points(c)*2-strengthCost(sg,next,c)*.35})).sort((a,b)=>b.s-a.s);
  const move=ranked[0].c;plays.push({seat:next,cards:move,pattern:E.pattern(move,g,true)});hands[next]=hand.filter(c=>!move.some(x=>x.id===c.id));
 }
 let best=plays[0];for(const p of plays.slice(1))if(E.canBeat(p.cards,best.cards,pat,g))best=p;
 const scored=points(plays.flatMap(p=>p.cards)),team=E.team(seat);
 return (E.team(best.seat)===team?1:-1)*(scored*.95+7);
}
// Shared imperfect-information lookahead for *both* four-player Tractor and
// four-to-nine-player Find Friends. Do not read other seats' actual card IDs:
// only their hand sizes, our cards, public played cards and observed voids.
function samplePublicWorld(g,seat,seed){
 const n=g.players||g.hands.length,world=Array.from({length:n},()=>[]);
 world[seat]=g.hands[seat].slice();const visible=playedVisibleIds(g);
 for(const play of (g.plays||[]))for(const c of play.cards)visible.add(c.id);
 for(const c of g.hands[seat])visible.add(c.id);
 // A dealer knows the buried cards; others MUST NOT have that information.
 if(g.dealerSeat===seat)for(const c of (g.kitty||[]))visible.add(c.id);
 const pool=E.makeDeck(g.decks||g.settings.decks||2).filter(c=>!visible.has(c.id));
 let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 const quota=Array.from({length:n},(_,i)=>i===seat?0:g.hands[i].length);
 for(const card of pool){
  const candidates=quota.map((q,i)=>({q,i})).filter(x=>x.q>0);
  if(!candidates.length)break;const valid=candidates.filter(x=>!(g.voids?.[x.i]||[]).includes(E.group(card,g)));
  const choices=valid.length?valid:candidates;
  const sum=choices.reduce((v,x)=>v+x.q,0);let pick=random()*sum,index=choices.at(-1).i;
  for(const x of choices){pick-=x.q;if(pick<0){index=x.i;break;}}
  world[index].push(card);quota[index]--;
 }
 return world;
}
function knownSameSide(g,a,b,allies){
 if(a===b)return true;
 if(g.mode!=='friends')return E.team(a)===E.team(b);
 const known=new Set(allies||g.allies||[]);
 if(known.has(a)&&known.has(b))return true;
 // Non-dealer strangers are NOT known teammates until all calls resolved.
 if((g.friendCalls||[]).length>0&&g.friendCalls.every(c=>c.revealed)&&!known.has(a)&&!known.has(b))return true;
 return false;
}
function hypotheticOutcome(g,seat,move,world,allies){
 const n=g.players||g.hands.length,lead=g.plays.length?g.plays[0].pattern:E.pattern(move,g,g.settings.allowThrows);
 if(!lead)return null;
 const plays=g.plays.map(p=>({seat:p.seat,cards:p.cards}));plays.push({seat,cards:move});
 // A called-A appearance changes the actual team DURING the hypothetical
 // trick. Treating the unknown A holder forever as an enemy incorrectly
 // rejects perfectly sensible K -> called-A hand-offs.
 const simulatedAllies=new Set(allies||g.allies||[]),seen={...(g.seenCalls||{})};
 const simulationCall=(player,cards,commit)=>{
  const counts={...seen};let newly=false;
  for(const card of cards){const key=E.key(card);counts[key]=(counts[key]||0)+1;
   for(const call of g.friendCalls||[]){
    if(!call.revealed&&call.s===card.s&&call.r===card.r&&call.n===counts[key]){
     if(!simulatedAllies.has(player))newly=true;
     if(commit)simulatedAllies.add(player);
    }
   }
  }
  if(commit)Object.assign(seen,counts);
  return newly;
 };
 simulationCall(seat,move,true);
 let best=plays[0];for(const p of plays.slice(1))if(E.canBeat(p.cards,best.cards,lead,g))best=p;
 let total=points(plays.flatMap(p=>p.cards));
 for(let turn=(seat+1)%n;plays.length<n;turn=(turn+1)%n){
  const hand=world[turn],options=candidateFollow(hand,g,lead);
  if(!options.length)return null; // no hallucinated illegal action
  const remaining=n-plays.length-1,currentlyFriendly=knownSameSide(g,best.seat,turn,[...simulatedAllies]);
  let bestReply=null,bestScore=-Infinity;
  // Replies use ONLY the synthetic sampled hand and visible current trick.
  for(const candidate of options.slice(0,95)){
   const win=E.canBeat(candidate,best.cards,lead,g);
   const pts=points(candidate),pot=total+pts;
   const strength=candidate.reduce((s,c)=>s+(c.s==='J'?43:0)+(E.group(c,g)==='T'?10:0)+E.ordinal(c,g)*.55,0);
   let value=-strength*.20;
   if(currentlyFriendly){
    value+=pts*(remaining===0?3:remaining===1?0.3:-.7);
    if(win)value-=18;
   }else{
    value+=win?(13+pot*(remaining===0?2.0:1.05)-strength*.28):(-pts*2.5);
    if(win&&pot===0&&candidate.some(c=>c.s==='J'))value-=34;
   }
   // If this play publicly discovers the dealer's friend, it may be worth
   // taking the lead now even before points have appeared in the trick.
   if(g.mode==='friends'&&win&&simulationCall(turn,candidate,false))value+=37;
   if(value>bestScore){bestScore=value;bestReply=candidate;}
  }
  const played=bestReply;plays.push({seat:turn,cards:played});total+=points(played);
  simulationCall(turn,played,true);
  if(E.canBeat(played,best.cards,lead,g))best=plays.at(-1);
  world[turn]=hand.filter(c=>!played.some(x=>x.id===c.id));
 }
 return{winner:best.seat,points:total,ownWin:knownSameSide(g,seat,best.seat,[...simulatedAllies]),seatWin:best.seat===seat};
}
B.evaluateTrickRisk=function(g,seat,moves,{samples=4,allies=null}={}){
 if(!moves.length)return [];
 const n=g.players||g.hands.length,remaining=n-1-g.plays.length;
 if(remaining<=0){
  return moves.map(move=>{const lead=g.plays[0]?.pattern||E.pattern(move,g,true);
   let best=g.plays.length?E.winningPlay(g):{seat,cards:move};
   if(g.plays.length&&E.canBeat(move,best.cards,lead,g))best={seat,cards:move};
   return{control:knownSameSide(g,seat,best.seat,allies)?1:0,ownControl:best.seat===seat?1:0,enemyPoints:knownSameSide(g,seat,best.seat,allies)?0:points(g.plays.flatMap(p=>p.cards))+points(move),samples:1};});
 }
 const results=moves.map(()=>({control:0,ownControl:0,enemyPoints:0,samples:0}));
 const base=(g.seed^(Math.imul(g.trickNo||1,2654435761))^(Math.imul(seat+1,2246822519))^(Math.imul(g.plays.length+1,3266489917)))>>>0;
 for(let i=0;i<samples;i++){
  const world=samplePublicWorld(g,seat,(base+Math.imul(i+1,747796405))>>>0);
  for(let m=0;m<moves.length;m++){
   const copy=world.map(hand=>hand.slice());
   const result=hypotheticOutcome(g,seat,moves[m],copy,allies);
   if(!result)continue;
   results[m].control+=+result.ownWin;
   results[m].ownControl+=+result.seatWin;
   results[m].enemyPoints+=result.ownWin?0:result.points;
   results[m].samples++;
  }
 }
 return results.map(r=>r.samples?{control:r.control/r.samples,ownControl:r.ownControl/r.samples,enemyPoints:r.enemyPoints/r.samples,samples:r.samples}:r);
};
B.estimateLastSeatThreat=lastSeatThreat;
B.scoreMove=function(g,seat,move){return g.plays.length?followScore(g,seat,move):leadScore(g,seat,move)};
B.choose=function(g,seat,{quick=false}={}){const hand=g.hands[seat],lead=g.plays.length?g.plays[0].pattern:null;
 let moves=lead?candidateFollow(hand,g,lead):patternMoves(hand,g);if(!moves.length){throw new Error('Bot unable to find a legal move for player '+seat+'; led='+JSON.stringify(lead));}
 // A joker used as a filler in a non-trump follow has no chance to win.
 // When at least one legal non-joker reply exists, prune such dominated plays
 // before shallow simulations can inflate their value. Keep genuine trump
 // combinations that can win, and never override mandatory-follow rules.
 if(lead&&lead.suit!=='T'){
  const withoutJoker=moves.filter(m=>m.every(c=>c.s!=='J'));
  if(withoutJoker.length){const best=E.winningPlay(g);
   moves=moves.filter(m=>m.every(c=>c.s!=='J')||E.canBeat(m,best.cards,lead,g));
  }
 }

 if(g.settings.difficulty==='basic'){const opts=moves.map(a=>({move:a,score:lead?followScore(g,seat,a):leadScore(g,seat,a)})).sort((a,b)=>b.score-a.score);return{cards:opts[Math.min(3,opts.length-1)].move,reason:'基础策略：尽量合法跟牌并节省大牌',evaluated:opts.length,samples:0}}
 let scores=moves.map(move=>({move,score:lead?followScore(g,seat,move):leadScore(g,seat,move),samples:0}));scores.sort((a,b)=>b.score-a.score);
 const top=scores.slice(0,quick?4:g.settings.difficulty==='strong'?7:10);const samples=quick?0:g.settings.difficulty==='strong'?8:18;
 if(samples&&g.plays.length<4){let seed=(g.seed^(g.trickNo*1664525)^(seat*636413622)^(g.plays.length*2654435761))>>>0;
  for(let j=0;j<samples;j++){const world=sampleUnknownWorld(g,seat,seed+j*314159);for(let entry of top){const w=world.map(h=>h&&[...h]);let outcome=immediateOutcome(g,seat,entry.move,w);
    const team=E.team(seat),win=outcome.winTeam===team;
    const delta=(win?1:-1)*(12+outcome.points*1.6);
    const scarceJoker=entry.move.some(c=>c.s==='J')&&g.hands[seat].length>entry.move.length+2;
    // The rollout samples only one trick; such horizons undervalue keeping
    // a kingmaker joker for the final kitty. Discount its shallow reward.
    // In a sampled world, value handover and likely follow-up as well as
    // immediate points. Opponents' unknown hands are never read directly.
    const followUp= (!quick && g.settings.difficulty==='expert'&&j%3===0&&g.plays.length<=1 && outcome.winner===seat)?nextTrickForecast(g,seat,{...outcome,world:w}):0;
    entry.score+=(delta*(scarceJoker?.22:.52)+followUp*.10)/samples;entry.samples++;
  }}
 }
 // Even with more opponents yet to play, rate a lead by how often it keeps
 // team control and how many points it exposes in sampled public-information
 // worlds. A sampled hand is a hypothesis, never the real hidden hand.
 if(g.settings.difficulty!=='basic'&&g.plays.length<3){
  const estimates=B.evaluateTrickRisk(g,seat,top.map(t=>t.move),{samples:quick?2:5});
  for(let i=0;i<top.length;i++){
   const r=estimates[i];if(!r.samples)continue;
   const inControl=r.control;
   top[i].score+= (inControl-.5)*(g.plays.length?32:56) -r.enemyPoints*(g.plays.length?.42:.85);
   if(!g.plays.length){
    const pat=E.pattern(top[i].move,g,true);
    if(pat?.kind==='group'&&pat.width>=3)top[i].score+=inControl*22;
    if(pat?.kind==='run')top[i].score+=inControl*23;
   }
  }
 }
 top.sort((a,b)=>b.score-a.score);
 const best=top[0],p=E.pattern(best.move,g,true),partner=g.plays.length&&E.team(E.winningPlay(g).seat)===E.team(seat);
 let reason=lead?(partner?'队友当前领先：优先送分并保护主牌；同时评估是否需要接手。':'对手当前领先：比较获胜机会、抓分收益及耗牌成本。'):'主动出牌：考虑控牌、牌型优势、拆对成本、已知绝门及潜在丢分。';
 if(lead&&g.plays.length===2&&E.team((seat+1)%4)!==E.team(seat)){
   const curr=E.winningPlay(g);
   if(E.team(curr.seat)===E.team(seat)&&points(best.move)===0)
      reason='第三家：队友虽然暂时领先，但末家仍可反超；保留分牌，选择无分牌跟出。';
   else if(E.team(curr.seat)!==E.team(seat)&&E.canBeat(best.move,curr.cards,lead,g))
      reason='第三家：不能只用最低的牌超过对手；考虑末家是否会反超并夺分，选择更稳的牌争夺牌权。';
 }
 if(p&&p.kind==='run')reason+=' 出连续组合以争夺牌权。';
 if(samples)reason+=` 结合 ${samples} 次未知牌采样、下一墩预测及剩余手牌价值进行评估（只使用公开牌和不确定推断）。`; 
 return{cards:best.move,reason,score:+best.score.toFixed(2),evaluated:moves.length,samples};
};
root.HHBot=B;if(typeof module!=='undefined'&&module.exports)module.exports=B;
})(typeof window!=='undefined'?window:globalThis);
