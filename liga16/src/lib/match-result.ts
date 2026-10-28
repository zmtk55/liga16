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

/** Máximo de sets que tiene sentido capturar: 3 en un "2 de 3", 5 en un "3 de 5". */
export function maxSetsForMatch(scoring?: TournamentScoring | null): number {
  return normalizeScoring(scoring).sets_to_win * 2 - 1;
}

/**
 * El marcador capturado ya define al ganador. Cuando es true, el formulario
 * no debe ofrecer "Añadir set": cualquier set extra solo provoca el error
 * "Hay sets de más después de que el partido ya terminó" al guardar.
 */
export function isMatchDecided(sets: SetScore[], scoring?: TournamentScoring | null): boolean {
  const cfg = normalizeScoring(scoring);
  const played = sets.filter(isPlayedSet);
  return determineMatchWinner(played, cfg) != null;
}

/**
 * Captura estilo Excel: cada fila es un par de números. Los sets se anotan en
 * juegos (un 7-6 directo, sin casilla de tie-break aparte) y el set de
 * desempate se anota en puntos de super tie-break (10-8, 14-12…), igual que la
 * hoja "RESULTADOS" de la liga.
 */

/** La fila de desempate es la última posible del formato (3ª en un 2 de 3). */
export function isSuperTieBreakRow(index: number, scoring?: TournamentScoring | null): boolean {
  const maxSets = maxSetsForMatch(scoring);
  return maxSets > 1 && index === maxSets - 1;
}

/**
 * Cómo se muestra un set guardado en la captura Excel-style:
 * - Set empatado con puntos de TB (6-6 + 7-5) → se muestra como 7-6 directo:
 *   es el mismo resultado y así se anota en la hoja. Al guardar queda 7-6.
 * - Super tie-break guardado en formato viejo (puntos en tiebreak_a/b con
 *   juegos 0-0) → se muestran los puntos. Al guardar queda como juegos.
 */
/** Marcador directo de un set cerrado en tie-break ("7-6" con 6 juegos,
 * "5-4" con 4). Null si el formato no tiene tie-break de set (no_tie_break,
 * o un tie_break_at mayor que games_per_set, que no tiene notación directa). */
export function tieBreakDirectNotation(scoring?: TournamentScoring | null): string | null {
  const cfg = normalizeScoring(scoring);
  if (cfg.no_tie_break || cfg.tie_break_at > cfg.games_per_set) return null;
  return `${cfg.games_per_set + 1}-${cfg.tie_break_at}`;
}

export function setToCaptureRow(
  s: SetScore,
  superTB: boolean,
): { a: string; b: string } {
  const a = s.a ?? 0;
  const b = s.b ?? 0;
  if (superTB) {
    if (a + b > 0) return { a: String(a), b: String(b) };
    if (s.tiebreak_a != null || s.tiebreak_b != null) {
      return { a: String(s.tiebreak_a ?? 0), b: String(s.tiebreak_b ?? 0) };
    }
    return { a: "", b: "" };
  }
  if (a === b && s.tiebreak_a != null && s.tiebreak_b != null && s.tiebreak_a !== s.tiebreak_b) {
    return s.tiebreak_a > s.tiebreak_b ? { a: String(a + 1), b: String(b) } : { a: String(a), b: String(b + 1) };
  }
  return { a: String(a), b: String(b) };
}

/**
 * Convierte la fila capturada de vuelta a SetScore. Los puntos de tie-break ya
 * no se capturan por separado, pero si la fila quedó IGUAL a lo guardado se
 * conservan los tiebreak_a/b originales: un tie-break parcial (ej. 6-6 con TB
 * 7 y sin segundo punto) o un marcador histórico incompleto no se borra en
 * silencio por solo abrir el diálogo y dar Guardar. Si la fila cambió (incl.
 * la normalización 6-6+TB(7-5) → 7-6 o súper TB viejo → puntos), los puntos
 * de TB quedan null porque el nuevo formato ya no los usa.
 */
export function captureRowToSet(
  input: { a: string; b: string },
  original?: SetScore,
): SetScore {
  const a = Number(input.a) || 0;
  const b = Number(input.b) || 0;
  if (original && (original.a ?? 0) === a && (original.b ?? 0) === b) {
    return { a, b, tiebreak_a: original.tiebreak_a ?? null, tiebreak_b: original.tiebreak_b ?? null };
  }
  return { a, b, tiebreak_a: null, tiebreak_b: null };
}
