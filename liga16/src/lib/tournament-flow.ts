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
  // Un cruce ya guardado conserva las parejas que el admin le puso (reemplazo por lesión).
  const chosen = (node: { id: string; round: number }): [BracketEntry, BracketEntry] | null => {
    const m = matches.find((x) => x.round === knockoutLabel(node, base.rounds));
    if (!m?.side_a.pair_id || !m.side_b.pair_id) return null;
    return [
      { pairId: m.side_a.pair_id, name: m.side_a.pair_name, seed: 0, points: 0 },
      { pairId: m.side_b.pair_id, name: m.side_b.pair_name, seed: 0, points: 0 },
    ];
  };
  const resolved = resolveBracket(base, (a, b, node) => {
    const m = matches.find((m) => m.round === knockoutLabel(node, base.rounds) &&
      ((m.side_a.pair_id === a.pairId && m.side_b.pair_id === b.pairId) || (m.side_b.pair_id === a.pairId && m.side_a.pair_id === b.pairId)));
    if (!m?.winner || !["finished", "walkover"].includes(m.status)) return null;
    return (m.winner === "a" ? m.side_a.pair_id : m.side_b.pair_id) ?? null;
  }, chosen);
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

export interface DependentRounds {
  /** Rondas posteriores con resultado o estado: el cambio se rechaza, no se toca nada. */
  withActivity: Match[];
  /** Rondas posteriores ya creadas sin resultado pero con cancha u hora puestas: se rechaza para no perder esa programación. */
  scheduled: Match[];
  /** Rondas posteriores generadas, vacías (sin sets, ganador, cancha ni hora): se pueden quitar y volver a generar. */
  removable: Match[];
}

/**
 * Cruces de rondas posteriores (misma categoría) que dependen de este cruce eliminatorio.
 * Al cambiar o deshacer su ganador, esos cruces quedan con parejas viejas. Solo cuentan los que
 * ya incluyen a alguna de las dos parejas de este cruce. Puro: no escribe nada.
 */
export function dependentRounds(match: Pick<Match, "round" | "category_name" | "side_a" | "side_b">, all: Match[]): DependentRounds {
  const node = /\br(\d+)-m\d+$/.exec(match.round);
  const out: DependentRounds = { withActivity: [], scheduled: [], removable: [] };
  if (!node) return out;
  const ids = new Set([match.side_a.pair_id, match.side_b.pair_id].filter(Boolean));
  for (const m of all) {
    const n = /\br(\d+)-m\d+$/.exec(m.round);
    if (!n || Number(n[1]) <= Number(node[1]) || m.category_name !== match.category_name) continue;
    if (!ids.has(m.side_a.pair_id) && !ids.has(m.side_b.pair_id)) continue;
    if (hasMatchActivity(m)) out.withActivity.push(m);
    else if (m.court_name || m.scheduled_at) out.scheduled.push(m);
    else out.removable.push(m);
  }
  return out;
}

/** Cambiar o deshacer el ganador de un cruce se bloquea si ya existe cualquier ronda posterior que dependa de él. */
export function winnerChangeBlocked(match: Pick<Match, "round" | "category_name" | "side_a" | "side_b">, all: Match[]): boolean {
  const d = dependentRounds(match, all);
  return d.withActivity.length + d.scheduled.length + d.removable.length > 0;
}

/** Los reemplazos se editan sólo mientras el cruce está intacto y nada posterior depende de él. */
export function canReplacePairs(match: Match, all: Match[]): { ok: true } | { ok: false; reason: string } {
  if (!/ · r\d+-m\d+$/.test(match.round)) return { ok: false, reason: "Sólo los cruces de eliminatoria." };
  if (hasMatchActivity(match)) return { ok: false, reason: "El cruce ya tiene resultado o estado: no se cambian sus parejas." };
  if (winnerChangeBlocked(match, all)) return { ok: false, reason: "La ronda siguiente ya existe con las parejas actuales: no se cambian." };
  return { ok: true };
}

/** Parejas que se pueden poner en un cruce: confirmadas de la categoría, sin repetir en la misma ronda. */
export function replacementCandidates(match: Match, pairs: Pair[], all: Match[]): Pair[] {
  const node = / · r(\d+)-m\d+$/.exec(match.round);
  const busy = new Set<string>();
  for (const m of all) {
    if (m.id === match.id || m.category_name !== match.category_name) continue;
    const n = / · r(\d+)-m\d+$/.exec(m.round);
    if (node && n && n[1] === node[1]) { if (m.side_a.pair_id) busy.add(m.side_a.pair_id); if (m.side_b.pair_id) busy.add(m.side_b.pair_id); }
  }
  return pairs.filter((p) => (p.status ?? "confirmed") === "confirmed" && !busy.has(p.id));
}
