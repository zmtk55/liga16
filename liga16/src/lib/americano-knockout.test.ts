import {describe,it,expect} from "vitest";
import {knockoutBracket,seedPositions,pruneKnockoutDrafts,type KnockoutScore} from "./americano-knockout";

describe("Playoffs fixed-pair bracket",()=>{
 it("standard seed positions",()=>{expect(seedPositions(8)).toEqual([1,8,4,5,2,7,3,6]);expect(seedPositions(3)).toEqual([]);});
 for(let teams=3;teams<=8;teams++) {
  it(`${teams} pairs: every seed once, correct byes and exactly teams-1 real matches`,()=>{
   const drafts:Record<string,KnockoutScore>={},keys:Record<string,string>={};
   let bracket=knockoutBracket(teams*2,drafts,keys);
   const seeds=bracket.rounds[0].flatMap(n=>[n.teamA,n.teamB]).filter(Boolean);
   expect(seeds.length).toBe(teams);expect(new Set(seeds.map(t=>t![0])).size).toBe(teams);
   expect(bracket.rounds[0].filter(n=>n.bye).length).toBe(2**Math.ceil(Math.log2(teams))-teams);
   for(let stage=0;stage<bracket.rounds.length;stage++){
    bracket=knockoutBracket(teams*2,drafts,keys);
    for(const n of bracket.rounds[stage])if(n.signature){keys[n.key]=n.signature;drafts[n.key]={a:"6",b:"4",done:true};}
   }
   bracket=knockoutBracket(teams*2,drafts,keys);
   expect(bracket.finished).toBe(teams-1);expect(bracket.champion).not.toBeNull();
  });
 }
 it("tie never advances; unclosed/invalid score never advances",()=>{
  const first=knockoutBracket(8,{},{}).rounds[0][0];
  for(const score of [{a:"4",b:"4",done:true},{a:"6",b:"4",done:false},{a:"bad",b:"4",done:true}]){
   const bracket=knockoutBracket(8,{[first.key]:score},{[first.key]:first.signature!});
   expect(bracket.rounds[0][0].winner).toBeNull();expect(bracket.rounds[1][0].ready).toBe(false);
  }
 });
 it("correcting semifinal invalidates only dependent final, never resurrects deleted results",()=>{
  const drafts:Record<string,KnockoutScore>={},keys:Record<string,string>={};
  let b=knockoutBracket(8,drafts,keys);
  for(const n of b.rounds[0]){keys[n.key]=n.signature!;drafts[n.key]={a:"6",b:"4",done:true};}
  b=knockoutBracket(8,drafts,keys);const final=b.rounds[1][0];keys[final.key]=final.signature!;drafts[final.key]={a:"6",b:"2",done:true};
  expect(knockoutBracket(8,drafts,keys).champion).not.toBeNull();
  drafts["ko-0-0"]={a:"6",b:"4",done:false};
  const pruned=pruneKnockoutDrafts(8,drafts,keys);
  expect(pruned[final.key]).toBeUndefined();expect(pruned["ko-0-1"]).toEqual(drafts["ko-0-1"]);
  pruned["ko-0-0"]={a:"6",b:"4",done:true};
  expect(knockoutBracket(8,pruned,keys).champion).toBeNull();
 });
 it("rejects unsupported ranges and odd player counts",()=>{for(const n of [4,7,18,64])expect(knockoutBracket(n,{},{}).rounds).toEqual([]);});
});
