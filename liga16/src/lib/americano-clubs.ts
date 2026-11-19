import { americanoStandings, maxCourts, type AmericanoRound } from "./americano";

export type Club = "A" | "B";
export type ClubMode = "club-americano" | "club-mexicano" | "club-team-americano" | "club-team-mexicano";
type Pair = [number, number];

export function validClubs(clubs: Club[], fixed: boolean): boolean {
  const a = clubs.filter((c) => c === "A").length;
  const b = clubs.filter((c) => c === "B").length;
  if (a !== b || a < 4) return false;
  return !fixed || (a % 2 === 0 && clubs.every((c, i) => c === clubs[i - i % 2]));
}

function clubPlayers(clubs: Club[], club: Club): number[] {
  return clubs.flatMap((c, p) => c === club ? [p] : []);
}
function fixedPairs(players: number[]): Pair[] {
  const out: Pair[] = [];
  for (let i = 0; i + 1 < players.length; i += 2) out.push([players[i], players[i + 1]]);
  return out;
}
function partners(players: number[]): Pair[][] {
  // Round-robin circle: each within-club partnership occurs exactly once.
  const slots: Array<number | null> = [...players];
  if (slots.length % 2) slots.push(null);
  const out: Pair[][] = [];
  for (let r = 0; r < slots.length - 1; r++) {
    const pairs: Pair[] = [];
    for (let i = 0; i < slots.length / 2; i++) {
      const a = slots[i], b = slots[slots.length - 1 - i];
      if (a !== null && b !== null) pairs.push([a, b]);
    }
    out.push(pairs);
    slots.splice(1, 0, slots.pop()!);
  }
  return out;
}
function pack(clubs: Club[], matches: Array<[Pair, Pair]>, courts: number): AmericanoRound[] {
  const out: AmericanoRound[] = [];
  const c = Math.max(1, Math.min(courts, maxCourts(clubs.length)));
  for (let i = 0; i < matches.length; i += c) {
    const batch = matches.slice(i, i + c);
    const used = new Set(batch.flat(2));
    out.push({
      matches: batch.map(([teamA, teamB], j) => ({ court: j + 1, teamA, teamB })),
      resting: clubs.flatMap((_, p) => used.has(p) ? [] : [p]),
    });
  }
  return out;
}

export function generateClubAmericano(clubs: Club[], courts: number, fixed: boolean): AmericanoRound[] {
  if (!validClubs(clubs, fixed)) return [];
  const a = clubPlayers(clubs, "A"), b = clubPlayers(clubs, "B");
  const out: AmericanoRound[] = [];
  if (fixed) {
    const pa = fixedPairs(a), pb = fixedPairs(b);
    for (let r = 0; r < pb.length; r++) {
      const matches: Array<[Pair, Pair]> = pa.map((p, i) => [p, pb[(i + r) % pb.length]]);
      out.push(...pack(clubs, matches, courts));
    }
  } else {
    const pa = partners(a), pb = partners(b);
    for (let r = 0; r < pa.length; r++) {
      const matches: Array<[Pair, Pair]> = pa[r].map((p, i) => [p, pb[r][(i + r) % pb[r].length]]);
      out.push(...pack(clubs, matches, courts));
    }
  }
  return out;
}

function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let x = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    const j = x % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Append-only dynamic round: source rule, rank inside each club. */
export function nextClubMexicanoRound(
  clubs: Club[], courts: number, fixed: boolean,
  rounds: AmericanoRound[], scores: Record<string, { a: number; b: number }>, seed: number,
): AmericanoRound {
  if (!validClubs(clubs, fixed)) return { matches: [], resting: clubs.map((_, p) => p) };
  const rank = americanoStandings(clubs.length, rounds, scores, "total");
  const byPlayer = new Map(rank.map((r, i) => [r.player, i]));
  const played = new Map(rank.map((r) => [r.player, r.played]));
  const c = Math.min(courts, maxCourts(clubs.length));
  const makePairs = (club: Club): Pair[] => {
    const players = clubPlayers(clubs, club);
    if (fixed) {
      let pairs = fixedPairs(players);
      if (!rounds.length) return shuffled(pairs, seed + (club === "A" ? 0 : 19)).slice(0, c);
      pairs = pairs.sort((x,y) => (played.get(x[0])! - played.get(y[0])!) || byPlayer.get(x[0])! - byPlayer.get(y[0])!).slice(0, c);
      return pairs.sort((x,y) => byPlayer.get(x[0])! - byPlayer.get(y[0])!);
    }
    if (!rounds.length) return fixedPairs(shuffled(players, seed + (club === "A" ? 0 : 19)).slice(0, c*2));
    const chosen = [...players].sort((x,y) => played.get(x)! - played.get(y)! || byPlayer.get(x)! - byPlayer.get(y)!).slice(0, c*2);
    chosen.sort((x,y) => byPlayer.get(x)! - byPlayer.get(y)!);
    // Source allows avoiding the previous partner when rankings permit.
    // Here strict within-club ranking takes priority. Repeats are disclosed.
    return fixedPairs(chosen);
  };
  const a = makePairs("A"), b = makePairs("B");
  return pack(clubs, a.map((p,i) => [p,b[i]]), c)[0];
}

/** Each club's rallies counted once, not twice for the two partners. */
export function clubTotals(clubs: Club[], rounds: AmericanoRound[], scores: Record<string,{a:number;b:number}>): Record<Club,number> {
  const totals = { A: 0, B: 0 };
  rounds.forEach((r,ri) => r.matches.forEach((m,mi) => {
    const score = scores[`${ri}-${mi}`];
    if (!score) return;
    totals[clubs[m.teamA[0]]] += score.a;
    totals[clubs[m.teamB[0]]] += score.b;
  }));
  return totals;
      }
