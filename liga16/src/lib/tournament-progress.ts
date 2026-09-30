import type { BracketEntry, BracketMatch } from "./bracket";

/**
 * Cómo va el torneo, derivado de los resultados ya capturados.
 *
 * No guarda estado: si el admin corrige un partido, esto se recalcula. Responde
 * lo que un organizador mira primero: en qué ronda estamos, cuánto falta y quién
 * sigue vivo.
 */

export interface ProgressInput {
  /** Cruces del bracket ya resueltos (con ganadores propagados). */
  matches: BracketMatch[];
  /** Rondas totales del bracket. */
  rounds: number;
  /** Partidos capturados del torneo, para el global. */
  played: number;
  /** Partidos programados del torneo. */
  total: number;
}

export interface TournamentProgress {
  /** Ronda 1..rounds en la que todavía falta algún resultado. */
  currentRound: number;
  /** Partidos sin resolver en la ronda actual. */
  pendingInRound: number;
  /** Las dos parejas que disputan la última ronda, si ya seurno. */
  finalists: Array<BracketEntry | null>;
  /** La pareja campeona, cuando la última ronda ya tiene ganador. */
  champion: BracketEntry | null;
  /** El torneo ya tiene campeón. */
  finished: boolean;
}

export function tournamentProgress(input: ProgressInput): TournamentProgress | null {
  const { matches, rounds, played, total } = input;
  if (!matches.length || rounds === 0) return null;

  const finalMatch = matches.find((m) => m.round === rounds) ?? null;
  // La última ronda tiene ganador cuando las dos parejas Facing ya son conocidas.
  const championPick = finalMatch && finalMatch.a && finalMatch.b && finalMatch.played ? finalMatch.a : null;
  const champion = championPick && finalMatch?.b?.pairId === championPick.pairId ? finalMatch.b : championPick;

  const pendingByRound = new Map<number, number>();
  for (const m of matches) {
    if (!m.played) pendingByRound.set(m.round, (pendingByRound.get(m.round) ?? 0) + 1);
  }
  const currentRound =
    Math.min(...[...pendingByRound.keys()], rounds + 1) || rounds + 1;

  return {
    currentRound: Math.min(currentRound, rounds),
    pendingInRound: pendingByRound.get(Math.min(currentRound, rounds)) ?? 0,
    finalists: finalMatch ? [finalMatch.a, finalMatch.b] : [],
    champion: champion ?? null,
    finished: Boolean(champion) || (played > 0 && played >= total),
  };
}