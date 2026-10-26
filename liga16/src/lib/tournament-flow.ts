import type { Match, Pair } from "@/types";
import { buildBracket, resolveBracket, type BracketEntry } from "./bracket";
import { roundRobinRounds, type Group } from "./groups";

/** Anything captured, including partial scores and exceptional statuses, is protected. */
export function hasMatchActivity(m: Match): boolean {
  return m.sets.length > 0 || !!m.winner || m.status !== "scheduled";
}

export function groupsFromPairs(pairs: Pair[]): Group[] {
  const groups = new Map<string, Group>();
  for (const p of pairs) {
    if (!p.group_name) continue;
    const g = groups.get(p.group_name) ?? { name: p.group_name, pairIds: [], categoryId: p.category_id ?? "" };
    g.pairIds.push(p.id);
    groups.set(g.name, g);
  }
  return [...groups.values()];
}

export function groupMatchDrafts(groups: Group[], pairs: Pair[], tournamentId: string, categoryNames: Map<string, string>): Omit<Match, "id">[] {
  const byId = new Map(pairs.map((p) => [p.id, p]));
  return groups.flatMap((g) => roundRobinRounds(g.pairIds).flatMap((round, i) => round.map(([a, b]) => {
    const pa = byId.get(a), pb = byId.get(b);
    if (!pa || !pb || pa.category_id !== pb.category_id) throw new Error("Un grupo no puede mezclar categorías");
    return {
      tournament_id: tournamentId, category_name: categoryNames.get(pa.category_id) ?? "Sin categoría",
      round: `${g.name} · J${i + 1}`, side_a: { pair_id: a, pair_name: pa.name }, side_b: { pair_id: b, pair_name: pb.name },
      court_name: null, scheduled_at: null, status: "scheduled" as const, sets: [], winner: null,
    };
  })));
}

export function sameMatchup(m: Pick<Match, "round" | "side_a" | "side_b">, n: Pick<Match, "round" | "side_a" | "side_b">): boolean {
  return m.round === n.round && ((m.side_a.pair_id === n.side_a.pair_id && m.side_b.pair_id === n.side_b.pair_id) ||
    (m.side_a.pair_id === n.side_b.pair_id && m.side_b.pair_id === n.side_a.pair_id));
}

/** Idempotent insert-first reconciliation. Never removes a match with activity. */
export function reconcileMatches(existing: Match[], desired: Omit<Match, "id">[]) {
  const unused = new Set(existing.map((m) => m.id));
  const create = desired.filter((draft) => {
    const found = existing.find((m) => unused.has(m.id) && sameMatchup(m, draft));
    if (!found) return true;
    unused.delete(found.id);
    return false;
  });
  const obsolete = existing.filter((m) => unused.has(m.id));
  if (obsolete.some(hasMatchActivity)) throw new Error("Hay resultados o partidos iniciados que no coinciden. No se regeneró nada.");
  return { create, remove: obsolete };
}

export function knockoutRoundName(round: number, rounds: number): string {
  const left = rounds - round;
  return left === 0 ? "Final" : left === 1 ? "Semifinales" : left === 2 ? "Cuartos de final" : left === 3 ? "Octavos de final" : `Eliminatoria ronda ${round}`;
}

export function knockoutLabel(node: { id: string; round: number }, rounds: number): string {
  return `${knockoutRoundName(node.round, rounds)} · ${node.id}`;
}

/** Resolve by bracket node AND participants, never by a previous group/round result. */
export function resolvedKnockout(entries: BracketEntry[], matches: Match[]) {
  const base = buildBracket(entries);
  const resolved = resolveBracket(base, (a, b, node) => {
    const m = matches.find((m) => m.round === knockoutLabel(node, base.rounds) &&
      ((m.side_a.pair_id === a.pairId && m.side_b.pair_id === b.pairId) || (m.side_b.pair_id === a.pairId && m.side_a.pair_id === b.pairId)));
    if (!m?.winner || !["finished", "walkover"].includes(m.status)) return null;
    return (m.winner === "a" ? m.side_a.pair_id : m.side_b.pair_id) ?? null;
  });
  return { ...base, matches: resolved };
}

export function knockoutDrafts(entries: BracketEntry[], matches: Match[], tournamentId: string, categoryName: string): Omit<Match, "id">[] {
  const bracket = resolvedKnockout(entries, matches);
  return bracket.matches.filter((m) => m.a && m.b && !m.bye).map((m) => ({
    tournament_id: tournamentId, category_name: categoryName, round: knockoutLabel(m, bracket.rounds),
    side_a: { pair_id: m.a!.pairId, pair_name: m.a!.name }, side_b: { pair_id: m.b!.pairId, pair_name: m.b!.name },
    court_name: null, scheduled_at: null, status: "scheduled", sets: [], winner: null,
  }));
}
