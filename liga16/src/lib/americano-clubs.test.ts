import { describe, it, expect } from "vitest";
import { validClubs, generateClubAmericano, nextClubMexicanoRound, clubTotals, type Club } from "./americano-clubs";
import type { AmericanoRound } from "./americano";

function checkRound(clubs: Club[], r: AmericanoRound, courts: number) {
  const used: number[] = [];
  expect(r.matches.length).toBeGreaterThan(0);
  expect(r.matches.length).toBeLessThanOrEqual(courts);
  r.matches.forEach((m) => {
    expect(clubs[m.teamA[0]]).toBe(clubs[m.teamA[1]]);
    expect(clubs[m.teamB[0]]).toBe(clubs[m.teamB[1]]);
    expect(clubs[m.teamA[0]]).not.toBe(clubs[m.teamB[0]]);
    used.push(...m.teamA, ...m.teamB);
  });
  expect(used.length + r.resting.length).toBe(clubs.length);
  expect(new Set([...used, ...r.resting]).size).toBe(clubs.length);
}

describe("Club formats", () => {
  it("validates equal clubs and complete fixed pairs", () => {
    expect(validClubs(["A","A","A","A","B","B","B","B"],true)).toBe(true);
    expect(validClubs(["A","B","A","B","A","B","A","B"],false)).toBe(true);
    expect(validClubs(["A","B","A","B","A","B","A","B"],true)).toBe(false);
    expect(validClubs(["A","A","B","B"],false)).toBe(false);
  });
  for(const n of [4,5,6]) for(const courts of [1,2,3]) {
    it(`Club Americano ${n}+${n}, ${courts} courts covers each within-club partnership once`, () => {
      const clubs: Club[]=[...Array<Club>(n).fill("A"),...Array<Club>(n).fill("B")];
      const rounds=generateClubAmericano(clubs,courts,false);
      const pairs=new Set<string>(); let count=0;
      for(const r of rounds) {
        checkRound(clubs,r,courts);
        for(const m of r.matches) for(const pair of [m.teamA,m.teamB]) {pairs.add([...pair].sort((a,b)=>a-b).join("-")); count++;}
      }
      expect(pairs.size).toBe(n*(n-1));
      expect(count).toBe(pairs.size);
    });
  }
  for(const n of [4,6]) for(const courts of [1,2,3]) {
    it(`Club Team Americano ${n}+${n}, ${courts} courts covers every opposing pair exactly once`, () => {
      const clubs: Club[]=[...Array<Club>(n).fill("A"),...Array<Club>(n).fill("B")];
      const rounds=generateClubAmericano(clubs,courts,true);
      const games=new Set<string>();let count=0;
      for(const r of rounds) {
        checkRound(clubs,r,courts);
        for(const mt of r.matches) {
          expect(Math.abs(mt.teamA[0]-mt.teamA[1])).toBe(1);
          expect(Math.abs(mt.teamB[0]-mt.teamB[1])).toBe(1);
          games.add(`${mt.teamA[0]}-${mt.teamB[0]}`);count++;
        }
      }
      expect(games.size).toBe((n/2)**2);expect(count).toBe(games.size);
    });
  }
  for(const fixed of [false,true]) {
    it(`Club Mexicano fixed=${fixed}: deterministic, fair play counts and no mutation`, () => {
      const clubs: Club[]=["A","A","A","A","A","A","B","B","B","B","B","B"];
      const rounds: AmericanoRound[]=[];
      const scores: Record<string,{a:number;b:number}>={};
      for(let i=0;i<6;i++) {
        const before=JSON.stringify(rounds);
        const next=nextClubMexicanoRound(clubs,1,fixed,rounds,scores,7);
        expect(next).toEqual(nextClubMexicanoRound(clubs,1,fixed,rounds,scores,7));
        expect(JSON.stringify(rounds)).toBe(before);
        checkRound(clubs,next,1);
        rounds.push(next);scores[`${i}-0`]={a:3,b:2};
      }
      const played=Array<number>(12).fill(0);
      for(const r of rounds)for(const mt of r.matches)for(const p of [...mt.teamA,...mt.teamB])played[p]++;
      expect(Math.max(...played)-Math.min(...played)).toBeLessThanOrEqual(1);
    });
  }
  it("Club Mexicano draws top two in A against top two in B after round one", () => {
    const clubs: Club[]=["A","A","A","A","B","B","B","B"];
    const r1: AmericanoRound={matches:[{court:1,teamA:[0,1],teamB:[4,5]},{court:2,teamA:[2,3],teamB:[6,7]}],resting:[]};
    const scores={"0-0":{a:8,b:2},"0-1":{a:3,b:7}};
    const r2=nextClubMexicanoRound(clubs,2,false,[r1],scores,1);
    expect(r2.matches[0].teamA).toEqual([0,1]);expect(r2.matches[0].teamB).toEqual([6,7]);
  });
  it("club totals count team points once and ignore unclosed scores", () => {
    const clubs: Club[]=["A","A","A","A","B","B","B","B"];
    const rounds=generateClubAmericano(clubs,2,false);
    expect(clubTotals(clubs,rounds,{"0-0":{a:6,b:4}})).toEqual({A:6,B:4});
  });
});
