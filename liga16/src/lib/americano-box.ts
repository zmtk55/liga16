import { americanoStandings, type AmericanoRound } from "./americano";

/** Three doubles rotations: each member partners each other once. */
function boxRounds(groups: number[][]): AmericanoRound[] {
  return [0,1,2].map((r) => ({
    matches: groups.map((g,i) => {
      const plans = [ [[g[0],g[1]],[g[2],g[3]]], [[g[0],g[2]],[g[1],g[3]]], [[g[0],g[3]],[g[1],g[2]]] ];
      const [a,b]=plans[r];
      return {court:i+1,teamA:a as [number,number],teamB:b as [number,number]};
    }),
    resting:[],
  }));
}
export function validBoxCount(n: number): boolean { return [8,12,16].includes(n); }
export function firstBoxStage(n: number,seed:number): AmericanoRound[] {
  if(!validBoxCount(n))return [];
  const players=Array.from({length:n},(_,p)=>p);
  let x=seed>>>0;
  for(let i=n-1;i>0;i--) {
    x=(Math.imul(x,1664525)+1013904223)>>>0;
    const j=x%(i+1);[players[i],players[j]]=[players[j],players[i]];
  }
  const groups=Array.from({length:n/4},(_,i)=>players.slice(i*4,i*4+4));
  return boxRounds(groups);
}
export function boxStageReady(rounds:AmericanoRound[],scores:Record<string,{a:number;b:number}>):boolean {
  return rounds.length===3 && rounds.every((r,ri)=>r.matches.every((_,mi)=>scores[`${ri}-${mi}`]!==undefined));
}
/** Source: first by position in original box, then compare tied positions by points/diff/wins/index. */
export function secondBoxStage(n:number,rounds:AmericanoRound[],scores:Record<string,{a:number;b:number}>):AmericanoRound[] {
  if(!validBoxCount(n)||!boxStageReady(rounds,scores))return [];
  const rank=americanoStandings(n,rounds,scores,"total");
  const groups=rounds[0].matches.map((m)=>[...m.teamA,...m.teamB]);
  const byBox=groups.map((g)=>rank.filter((row)=>g.includes(row.player)));
  const order:number[]=[];
  for(let place=0;place<4;place++) {
    const atPlace=byBox.map((g)=>g[place]).sort((a,b)=>b.points-a.points || b.diff-a.diff || b.wins-a.wins || a.player-b.player);
    order.push(...atPlace.map((row)=>row.player));
  }
  return boxRounds(Array.from({length:n/4},(_,i)=>order.slice(i*4,i*4+4)));
}
export function boxGroupPlayers(rounds:AmericanoRound[],stage:1|2,group:number):number[] {
  const mt=rounds[stage===1?0:3]?.matches[group];
  return mt?[...mt.teamA,...mt.teamB]:[];
}
export function boxStageScores(scores:Record<string,{a:number;b:number}>,stage:1|2):Record<string,{a:number;b:number}> {
  const out:Record<string,{a:number;b:number}>={};
  for(const [key,value]of Object.entries(scores)) {
    const [ri,mi]=key.split("-").map(Number);
    if(ri >= (stage===1?0:3) && ri<(stage===1?3:6))out[`${ri-(stage===1?0:3)}-${mi}`]=value;
  }
  return out;
}
