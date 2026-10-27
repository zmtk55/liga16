// Bajas de parejas. Una baja NO borra nada: la pareja y sus resultados se
// conservan (las demás parejas siguen contando esos partidos). Solo cambia quién
// clasifica y, si la llave ya empezó, quién avanza.
import type { Match, Pair } from "@/types";
import { isKnockoutRound } from "./groups";

export const WITHDRAWN = "withdrawn";

export const isWithdrawn = (p: Pick<Pair, "status"> | undefined | null): boolean => p?.status === WITHDRAWN;

/** Antes de eliminatorias: salta a las parejas de baja; entra la siguiente de la tabla. */
export function skipWithdrawn<T extends { pairId: string }>(rows: T[], pairs: Pair[]): T[] {
  const out = new Set(pairs.filter(isWithdrawn).map((p) => p.id));
  return rows.filter((r) => !out.has(r.pairId));
}

export interface WalkoverUpdate {
  matchId: string;
  status: "walkover";
  winner: "a" | "b";
  winnerPairId: string;
}

/**
 * Con la llave empezada: cada cruce eliminatorio PENDIENTE de la pareja que se
 * da de baja lo gana su rival por walkover. No se rehace la llave ni se tocan
 * cruces ya jugados o ya resueltos. Sin rival definido no se inventa uno.
 */
export function withdrawalWalkovers(pairId: string, matches: Match[]): WalkoverUpdate[] {
  const out: WalkoverUpdate[] = [];
  for (const m of matches) {
    if (!isKnockoutRound(m.round)) continue;
    if (m.winner || m.status === "finished" || m.status === "walkover" || m.status === "cancelled") continue;
    const a = m.side_a?.pair_id;
    const b = m.side_b?.pair_id;
    if (!a || !b) continue;
    if (a === pairId) out.push({ matchId: m.id, status: "walkover", winner: "b", winnerPairId: b });
    else if (b === pairId) out.push({ matchId: m.id, status: "walkover", winner: "a", winnerPairId: a });
  }
  return out;
}

/** Walkovers pendientes para todas las parejas de baja (cruces que ya existen). */
export function allWithdrawalWalkovers(withdrawnIds: string[], matches: Match[]): WalkoverUpdate[] {
  const seen = new Set<string>();
  const out: WalkoverUpdate[] = [];
  for (const id of withdrawnIds) {
    for (const w of withdrawalWalkovers(id, matches)) {
      if (seen.has(w.matchId)) continue;
      seen.add(w.matchId);
      out.push(w);
    }
  }
  return out;
}

