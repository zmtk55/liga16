import { describe,it,expect } from "vitest";
import { firstBoxStage,secondBoxStage,boxStageReady,boxGroupPlayers,boxStageScores } from "./americano-box";
import { americanoStandings,parseAmericanoDemo,serializeAmericanoDemo } from "./americano";
import { PUBLISHED_DEMO_SNAPSHOT_TEXT } from "./americano-demo-published.fixture";

describe("Beat the Box",()=>{
 for(const n of [8,12,16]) {
  it(`${n} players: three complete rounds per stage, local partner coverage, source regrouping`,()=>{
   const stage1=firstBoxStage(n,7);expect(stage1).toEqual(firstBoxStage(n,7));expect(stage1.length).toBe(3);
   for(const round of stage1){expect(round.matches.length).toBe(n/4);expect(new Set(round.matches.flatMap(m=>[...m.teamA,...m.teamB])).size).toBe(n);expect(round.resting).toEqual([]);}
   for(let g=0;g<n/4;g++) {
    const pairs=new Set<string>();for(const r of stage1)for(const t of [r.matches[g].teamA,r.matches[g].teamB])pairs.add([...t].sort((a,b)=>a-b).join("-"));
    expect(pairs.size).toBe(6);
   }
   const scores:Record<string,{a:number;b:number}>={};
   expect(boxStageReady(stage1,scores)).toBe(false);expect(secondBoxStage(n,stage1,scores)).toEqual([]);
   stage1.forEach((r,ri)=>r.matches.forEach((_,mi)=>{scores[`${ri}-${mi}`]={a:8+ri+mi,b:2+mi};}));
   expect(boxStageReady(stage1,scores)).toBe(true);
   const saved=JSON.stringify(stage1);
   const stage2=secondBoxStage(n,stage1,scores);expect(stage2.length).toBe(3);expect(JSON.stringify(stage1)).toBe(saved);
   expect(new Set(stage2[0].matches.flatMap(m=>[...m.teamA,...m.teamB])).size).toBe(n);
   const rank=americanoStandings(n,stage1,scores,"total");
   const groups=stage1[0].matches.map(m=>rank.filter(p=>[...m.teamA,...m.teamB].includes(p.player)));
   const topGroup=new Set([...stage2[0].matches[0].teamA,...stage2[0].matches[0].teamB]);
   for(const group of groups)expect(topGroup.has(group[0].player)).toBe(true);
   if(n===8)for(const group of groups)expect(topGroup.has(group[1].player)).toBe(true);
   if(n===12){const bestSecond=groups.map(g=>g[1]).sort((a,b)=>b.points-a.points||b.diff-a.diff||b.wins-a.wins||a.player-b.player)[0];expect(topGroup.has(bestSecond.player)).toBe(true);}
   if(n===16)expect(topGroup.size).toBe(4);
   const combined=[...stage1,...stage2];expect(boxGroupPlayers(combined,2,0).length).toBe(4);
   const frozen=JSON.stringify(combined);
   secondBoxStage(n,stage1,{...scores,"0-0":{a:1,b:20}});
   expect(JSON.stringify(combined)).toBe(frozen);
  });
 }
 it("stage 2 points restart at zero, not cumulative stage 1",()=>{
   expect(boxStageScores({"0-0":{a:9,b:1},"3-0":{a:4,b:4}},2)).toEqual({"0-0":{a:4,b:4}});
 });
 it("16-player, 4-court snapshot roundtrips while old published snapshot is unchanged",()=>{
   const old=parseAmericanoDemo(PUBLISHED_DEMO_SNAPSHOT_TEXT)!;
   expect(parseAmericanoDemo(serializeAmericanoDemo(old))).toEqual(old);
   const names=Array.from({length:16},(_,i)=>`Player ${i+1}`);
   const snap={...old,modalidad:"beat-box" as const,names,inscritos:names,courts:4,rounds:firstBoxStage(16,1),drafts:{}};
   expect(parseAmericanoDemo(serializeAmericanoDemo(snap))).toEqual(snap);
   expect(parseAmericanoDemo(serializeAmericanoDemo({...snap,modalidad:"americano"}))).toBeNull();
 });
});
