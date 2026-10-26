import type { SetScore, TournamentScoring } from "@/types";
import { determineMatchWinner, normalizeScoring, validateScoring } from "@/lib/scoring";

/** Un set cuenta si tiene algún juego o tie-break capturado (una fila 0-0 es un hueco en blanco). */
export function isPlayedSet(s: SetScore): boolean {
  return (s.a ?? 0) + (s.b ?? 0) > 0 || !!s.tiebreak_a || !!s.tiebreak_b;
}

export type MatchResultCheck =
  | { ok: true; winner: "a" | "b"; sets: SetScore[] }
  | { ok: false; error: string };

/**
 * Regla única para cerrar un partido, la usan Resultados y Jornada: los sets
 * deben ser válidos con el scoring del torneo Y alguna pareja debe haber
 * ganado los sets necesarios. Un solo set 1-0 no cierra un partido a 2 sets.
 */
export function checkFinishedMatch(sets: SetScore[], scoring?: TournamentScoring | null): MatchResultCheck {
  const cfg = normalizeScoring(scoring);
  const played = sets.filter(isPlayedSet);
  if (played.length === 0) return { ok: false, error: "Captura el marcador para cerrar el partido" };
  const invalid = validateScoring(played, cfg);
  if (invalid) return { ok: false, error: invalid };
  const winner = determineMatchWinner(played, cfg);
  if (!winner) {
    return { ok: false, error: `El marcador no cierra el partido: una pareja debe ganar ${cfg.sets_to_win} set(s)` };
  }
  return { ok: true, winner, sets: played };
}
