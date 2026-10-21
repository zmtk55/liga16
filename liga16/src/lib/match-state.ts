// Estado de un partido según su marcador.
//
// La app guardaba el estado a mano (`status`) y el marcador por separado
// (`sets`), y los dos se separaban: hay partidos con sets capturados que
// seguían marcados "scheduled". Cada pantalla los leía por su cuenta y la
// card se contradecía a sí misma ("Por jugar" con un trofeo al lado).
//
// Aquí vive la única regla: el estado sale del marcador, y todas las
// pantallas (card pública, pie del admin) leen de aquí.
import type { Match, MatchStatus } from "@/types";
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

/**
 * Quién ganó el partido: el `winner` guardado manda; si falta, el marcador.
 *
 * Solo cuenta como ganador el que alcanzó los sets para ganar: en un partido
 * a medias (1 set) el trofeo de la card sería mentira. Los chips en verde
 * ya enseñan quién va ganando cada set.
 */
export function matchWinner(match: Match): "a" | "b" | null {
  if (match.winner) return match.winner;
  const won = setsWon(match.sets);
  const need = DEFAULT_SCORING.sets_to_win;
  if (won.a >= need) return "a";
  if (won.b >= need) return "b";
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

/**
 * El estado con el que trabaja el admin, en las etiquetas del organizador.
 *
 * Es el mismo estado que ve la card, no el campo crudo: un partido con
 * marcador completo ya no está "por capturar" aunque su `status` siga
 * diciendo "scheduled". Sin esto, el stat decía "54 por capturar" en la
 * misma pantalla donde 27 cards decían "Finalizado".
 *
 * Los estados que no tienen marcador (disputado, walkover, cancelado) se
 * quedan como están: el campo crudo es lo único que los describe.
 */
export function matchStatusKey(match: Match): MatchStatus {
  if (
    match.status === "disputed" ||
    match.status === "walkover" ||
    match.status === "cancelled"
  ) {
    return match.status;
  }
  const state = matchState(match);
  if (state === "live") return "live";
  if (state === "finished") return "finished";
  return "scheduled";
}

/**
 * El bucket fino: separa "nunca se capturó" de "se capturó a medias".
 *
 * `matchStatusKey` aplana las dos cosas en "scheduled" porque para saber si
 * un partido está terminado basta. Para el listado del admin no: un partido
 * con un set capturado y sin ganador es trabajo a medias, no un partido sin
 * tocar, y el organizador los cuenta distinto.
 *
 * - `pending`  · sin marcador: nadie lo ha capturado.
 * - `playing`  · hay marcador pero no hay ganador: quedó a medias.
 * - `live`     · se está jugando ahora.
 * - `finished` · hay ganador.
 * - `disputed` · `walkover` · `cancelled` · estados sin marcador, tal cual.
 */
export type MatchBucket = "pending" | "playing" | "live" | "finished" | "disputed" | "walkover" | "cancelled";

export function matchBucket(match: Match): MatchBucket {
  if (
    match.status === "disputed" ||
    match.status === "walkover" ||
    match.status === "cancelled"
  ) {
    return match.status;
  }
  const state = matchState(match);
  if (state === "live") return "live";
  if (state === "finished") return "finished";
  if (state === "playing") return "playing";
  return "pending";
}
