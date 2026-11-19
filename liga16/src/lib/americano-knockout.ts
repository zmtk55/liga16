export type FixedPair=[number,number];
export type KnockoutScore={a:string;b:string;done?:boolean};
export interface KnockoutNode {
 key:string;stage:number;index:number;teamA:FixedPair|null;teamB:FixedPair|null;
 signature:string|null;bye:boolean;winner:FixedPair|null;ready:boolean;
}
export interface KnockoutBracket { rounds:KnockoutNode[][];validKeys:Record<string,string>;champion:FixedPair|null;finished:number; }

/** Standard seed positions spread automatic byes to the highest seeds. */
export function seedPositions(size:number):number[] {
 if(size<2 || (size&(size-1))!==0) return [];
 let positions=[1,2];
 while(positions.length<size){const total=positions.length*2+1;positions=positions.flatMap((p)=>[p,total-p]);}
 return positions;
}
export function knockoutBracket(playerCount:number,drafts:Record<string,KnockoutScore>,keys:Record<string,string>):KnockoutBracket {
 const pairs=Array.from({length:Math.floor(playerCount/2)},(_,i)=>[i*2,i*2+1] as FixedPair);
 if(pairs.length<3 || pairs.length>8 || playerCount%2) return {rounds:[],validKeys:{},champion:null,finished:0};
 const size=2**Math.ceil(Math.log2(pairs.length));
 const slots=seedPositions(size).map((seed)=>pairs[seed-1]??null);
 const stages=Math.log2(size);const rounds:KnockoutNode[][]=[];
 const validKeys:Record<string,string>={};let finished=0;
 for(let stage=0;stage<stages;stage++) {
  const nodes:KnockoutNode[]=[];const count=size/2**(stage+1);
  for(let i=0;i<count;i++) {
   const previous=rounds[stage-1];
   const teamA=stage===0?slots[i*2]:previous[i*2].winner;
   const teamB=stage===0?slots[i*2+1]:previous[i*2+1].winner;
   const ready=stage===0 || (previous[i*2].winner!==null && previous[i*2+1].winner!==null);
   const key=`ko-${stage}-${i}`;
   const bye=stage===0 && Boolean(teamA)!==Boolean(teamB);
   const signature=teamA&&teamB?`${teamA.join(",")}|${teamB.join(",")}`:null;
   if(signature)validKeys[key]=signature;
   let winner:FixedPair|null=bye?(teamA??teamB):null;
   const score=drafts[key];
   if(signature && keys[key]===signature && score?.done && /^\d+$/.test(score.a) && /^\d+$/.test(score.b)) {
    const a=Number(score.a),b=Number(score.b);
    if(a!==b){winner=a>b?teamA:teamB;finished++;}
   }
   nodes.push({key,stage,index:i,teamA,teamB,signature,bye,winner,ready});
  }
  rounds.push(nodes);
 }
 return {rounds,validKeys,champion:rounds[rounds.length-1][0].winner,finished};
}

/** Irreversibly discard only results whose participants are no longer valid. */
export function pruneKnockoutDrafts(playerCount:number,drafts:Record<string,KnockoutScore>,keys:Record<string,string>):Record<string,KnockoutScore> {
 const bracket=knockoutBracket(playerCount,drafts,keys);
 return Object.fromEntries(Object.entries(drafts).filter(([k])=>!k.startsWith("ko-")|| (bracket.validKeys[k]!==undefined && keys[k]===bracket.validKeys[k])));
}
