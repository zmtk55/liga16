// Estado de un partido según su marcador.
//
// La app guardaba el estado a mano (`status`) y el marcador por separado
// (`sets`), y los dos se separaban: hay partidos con sets capturados que
// seguían marcados "scheduled". Cada pantalla los leía por su cuenta y la
// card se contradecía a sí misma ("Por jugar" con un trofeo al lado).
//
// Aquí vive la única regla: el estado sale del marcador, y todas las
// pantallas (card pública, pie del admin) leen de aquí.
import type { Match } from "@/types";
import { DEFAULT_SCORING } from "@/lib/scoring";

export type MatchState = "live" | "finished" | "playing" | "pending";

/**
 * Sets ganados por cada lado leyendo el marcador como lo lee una persona:
 * el lado con más juegos ganó el set (el super tie-break a 10 también sale
 * así). La regla oficial (`determineMatchWinner`) necesita los puntos del
 * tie-break para resolver un 6-7, y ese dato casi nunca se captura: con esa
 * regla un partido claramente ganado se quedaba sin ganador.
 */
export function setsWon(sets: Match["sets"]): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const s of sets) {
    const av = s.a ?? 0;
    const bv = s.b ?? 0;
    if (av > bv) a++;
    else if (bv > av) b++;
  }
  return { a, b };
}

/** Quién ganó el partido: el `winner` guardado manda; si falta, el marcador. */
export function matchWinner(match: Match): "a" | "b" | null {
  if (match.winner) return match.winner;
  const won = setsWon(match.sets);
  if (won.a > won.b) return "a";
  if (won.b > won.a) return "b";
  return null;
}

/**
 * - `live`     · se está jugando ahora mismo.
 * - `finished` · hay ganador: no queda nada por capturar.
 * - `playing`  · hay marcador pero el partido no está decided.
 * - `pending`  · no hay marcador: nadie lo ha jugado.
 */
export function matchState(match: Match): MatchState {
  if (match.status === "live") return "live";
  if (match.status === "finished") return "finished";
  const won = setsWon(match.sets);
  if (
    match.winner ||
    won.a >= DEFAULT_SCORING.sets_to_win ||
    won.b >= DEFAULT_SCORING.sets_to_win
  ) {
    return "finished";
  }
  return match.sets.length > 0 ? "playing" : "pending";
}
