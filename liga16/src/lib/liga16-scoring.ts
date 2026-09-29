// Liga16 — Algoritmo de puntuación específico para la Liga 16 (4ta edición)
// Basado en la especificación del Excel LIGA16_4TA_EDICION.xlsx

import type { Match, UUID } from "@/types";

export type Liga16Category = "4TA" | "5TA" | "6TA" | "SUMA9";

export interface Liga16CategoryConfig {
  id: Liga16Category;
  name: string;
  maxPairs: number;
  totalMatchesRoundRobin: number; // n*(n-1)/2
  resultsSheet: string;
  teamsTable: string;
  pairRule?: string;
}

export const LIGA16_CATEGORIES: Record<Liga16Category, Liga16CategoryConfig> = {
  "4TA": {
    id: "4TA",
    name: "Cuarta femenil",
    maxPairs: 9,
    totalMatchesRoundRobin: 15, // 6 parejas visibles en Excel -> 6*5/2 = 15
    resultsSheet: "RESULTADOS 4TA F",
    teamsTable: "EQUIPOS4TA",
  },
  "5TA": {
    id: "5TA",
    name: "Quinta femenil",
    maxPairs: 9,
    totalMatchesRoundRobin: 15,
    resultsSheet: "RESULTADOS 5TA F",
    teamsTable: "EQUIPOS5TA",
  },
  "6TA": {
    id: "6TA",
    name: "Sexta femenil",
    maxPairs: 9,
    totalMatchesRoundRobin: 36, // 9 parejas -> 9*8/2 = 36
    resultsSheet: "RESULTADOS 6TA F",
    teamsTable: "EQUIPOS6TAA",
  },
  "SUMA9": {
    id: "SUMA9",
    name: "Varonil Suma 9 (4ta + 5ta)",
    maxPairs: 9,
    totalMatchesRoundRobin: 36,
    resultsSheet: "RESULTADOS +9 V",
    teamsTable: "EQUIPOS6TAA12",
    pairRule: "participante_1 es de CUARTA y participante_2 es de QUINTA (4+5=9)",
  },
};

/** Mapea nombre de categoría del sistema a categoría Liga16 */
export function getLiga16Category(catName: string): Liga16Category | null {
  const name = catName.toLowerCase();
  if (name.includes("4ta") || name.includes("cuarta")) return "4TA";
  if (name.includes("5ta") || name.includes("quinta")) return "5TA";
  if (name.includes("6ta") || name.includes("sexta")) return "6TA";
  if (name.includes("suma 9") || name.includes("+9") || name.includes("suma9")) return "SUMA9";
  return null;
}

/** SetScore específico para Liga16: set1, set2 y tiebreak opcional */
export interface Liga16MatchSets {
  set1: { a: number; b: number };
  set2: { a: number; b: number };
  tiebreak?: { a: number; b: number } | null;
}

/** Resultado de sets ganados por lado */
export interface SetsWon {
  a: number;
  b: number;
}

/** Estadísticas calculadas por pareja (equivalente a columnas G-K del Excel) */
export interface Liga16PairStats {
  pairId: UUID;
  pairNumber: number; // 1..9
  pairName: string;
  PJ: number; // Partidos jugados (col G)
  PG: number; // Partidos ganados (col H)
  RENDIMIENTO_PG: number | null; // PG / PJ (col I)
  PUNTOS_A_FAVOR: number; // Suma de puntos propios en todos los sets
  PUNTOS_TOTALES: number; // Suma de (puntos propios + puntos rival) en todos los sets
  RENDIMIENTO_PTS: number | null; // PUNTOS_A_FAVOR / PUNTOS_TOTALES (col K)
  JERARQUIA: number; // Posición en ranking (col L) - 0 si sin partidos
}

/** Resumen de jornada (celdas G12-G14 del Excel) */
export interface Liga16JornadaSummary {
  JUEGOS_JUGADOS: number; // suma(PJ) / 2
  TOTAL_JUEGOS: number; // 15 (6 parejas) o 36 (9 parejas)
  JUEGOS_FALTANTES: number; // TOTAL - JUGADOS
}

/**
 * PASO 1: Cuenta sets ganados por cada lado en un partido
 * Un partido tiene hasta 3 'sets': set1, set2 y tiebreak.
 * Para cada uno gana el lado con más puntos; empate o vacío no suma.
 */
export function countSetsWonLiga16(sets: Liga16MatchSets): SetsWon {
  let a = 0;
  let b = 0;

  // set1
  if (sets.set1.a > sets.set1.b) a++;
  else if (sets.set1.b > sets.set1.a) b++;

  // set2
  if (sets.set2.a > sets.set2.b) a++;
  else if (sets.set2.b > sets.set2.a) b++;

  // tiebreak (opcional)
  if (sets.tiebreak) {
    if (sets.tiebreak.a > sets.tiebreak.b) a++;
    else if (sets.tiebreak.b > sets.tiebreak.a) b++;
  }

  return { a, b };
}

/**
 * PASO 2: Determina ganador del partido
 * Gana la pareja con más sets ganados.
 */
export function determineMatchWinnerLiga16(sets: Liga16MatchSets): "a" | "b" | null {
  const { a, b } = countSetsWonLiga16(sets);
  if (a > b) return "a";
  if (b > a) return "b";
  return null; // empate (no debería pasar en pádel)
}

/**
 * Convierte Match del sistema actual a Liga16MatchSets
 * El sistema actual usa SetScore[] con tiebreak_a/tiebreak_b opcionales
 */
export function matchToLiga16Sets(match: Match): Liga16MatchSets {
  const sets = match.sets ?? [];
  const set1 = sets[0] ?? { a: 0, b: 0 };
  const set2 = sets[1] ?? { a: 0, b: 0 };
  const set3 = sets[2]; // super tie-break si existe

  let tiebreak: { a: number; b: number } | null = null;
  if (set3) {
    // Formato real en BD: el super tie-break se guarda como tercer set con
    // juegos (ej. {a:10,b:8}). Variante legacy: juegos en 0 y puntos en
    // tiebreak_a/b. Un tercer set vacío no cuenta.
    if ((set3.a ?? 0) > 0 || (set3.b ?? 0) > 0) {
      tiebreak = { a: set3.a ?? 0, b: set3.b ?? 0 };
    } else if (set3.tiebreak_a != null || set3.tiebreak_b != null) {
      tiebreak = { a: set3.tiebreak_a ?? 0, b: set3.tiebreak_b ?? 0 };
    }
  }

  return {
    set1: { a: set1.a ?? 0, b: set1.b ?? 0 },
    set2: { a: set2.a ?? 0, b: set2.b ?? 0 },
    tiebreak,
  };
}

/**
 * PASO 3: Calcula estadísticas de una pareja a partir de sus partidos
 * Pseudocódigo del Excel:
 *   PJ = 0; PG = 0; pts_favor = 0; pts_total = 0
 *   para cada partido donde la pareja participó:
 *       PJ += 1
 *       si sets_propios > sets_rival: PG += 1
 *       para cada s en [set1, set2, tiebreak]:
 *           pts_favor += s.propios
 *           pts_total += s.propios + s.rival
 *   RENDIMIENTO_PG  = PJ > 0 ? PG / PJ : null
 *   RENDIMIENTO_PTS = pts_total > 0 ? pts_favor / pts_total : null
 */
export function computePairStatsLiga16(
  pairId: UUID,
  pairNumber: number,
  pairName: string,
  matches: Match[]
): Liga16PairStats {
  let PJ = 0;
  let PG = 0;
  let puntosAFavor = 0;
  let puntosTotales = 0;

  for (const match of matches) {
    // Solo partidos terminados con ganador
    if (match.status !== "finished" || !match.winner) continue;

    // Verificar si esta pareja participó en el partido
    const isSideA = match.side_a.pair_id === pairId;
    const isSideB = match.side_b.pair_id === pairId;

    // Fallback por nombre si no hay pair_id (partidos legacy)
    const sideAName = (match.side_a.pair_name ?? "").trim().toLowerCase();
    const sideBName = (match.side_b.pair_name ?? "").trim().toLowerCase();
    const thisPairName = pairName.trim().toLowerCase();

    const participated =
      isSideA ||
      isSideB ||
      (!match.side_a.pair_id && sideAName === thisPairName) ||
      (!match.side_b.pair_id && sideBName === thisPairName);

    if (!participated) continue;

    PJ++;

    const sets = matchToLiga16Sets(match);
    const setsWon = countSetsWonLiga16(sets);

    // Determinar si esta pareja fue lado A o B en este partido
    const wasSideA = isSideA || (!match.side_a.pair_id && sideAName === thisPairName);
    const setsPropios = wasSideA ? setsWon.a : setsWon.b;
    const setsRival = wasSideA ? setsWon.b : setsWon.a;

    if (setsPropios > setsRival) PG++;

    // Sumar puntos: set1, set2, tiebreak
    // Puntos a favor = juegos propios en cada set
    // Puntos totales = juegos propios + juegos rival en cada set
    const allSets = [
      { a: sets.set1.a, b: sets.set1.b },
      { a: sets.set2.a, b: sets.set2.b },
      ...(sets.tiebreak ? [{ a: sets.tiebreak.a, b: sets.tiebreak.b }] : []),
    ];

    for (const s of allSets) {
      const propios = wasSideA ? s.a : s.b;
      const rival = wasSideA ? s.b : s.a;
      puntosAFavor += propios;
      puntosTotales += propios + rival;
    }
  }

  const RENDIMIENTO_PG = PJ > 0 ? PG / PJ : null;
  const RENDIMIENTO_PTS = puntosTotales > 0 ? puntosAFavor / puntosTotales : null;

  return {
    pairId,
    pairNumber,
    pairName,
    PJ,
    PG,
    RENDIMIENTO_PG,
    PUNTOS_A_FAVOR: puntosAFavor,
    PUNTOS_TOTALES: puntosTotales,
    RENDIMIENTO_PTS,
    JERARQUIA: 0, // Se calcula en el paso 4
  };
}

/**
 * PASO 4: Calcula JERARQUIA (ranking) usando comportamiento RANK de Excel
 * - Ordena DESCENDENTE por RENDIMIENTO_PTS
 * - RANK de Excel: misma posición para valores iguales, salta la siguiente (1, 1, 3...)
 * - Si RENDIMIENTO_PTS es null → JERARQUIA = 0 (como en el Excel con IFERROR)
 */
export function computeJerarquiaLiga16(stats: Liga16PairStats[]): Liga16PairStats[] {
  // Filtrar solo los que tienen RENDIMIENTO_PTS válido para el ranking
  const withRank = stats.filter((s) => s.RENDIMIENTO_PTS !== null);
  const withoutRank = stats.filter((s) => s.RENDIMIENTO_PTS === null);

  // Ordenar descendente por RENDIMIENTO_PTS
  withRank.sort((a, b) => (b.RENDIMIENTO_PTS ?? 0) - (a.RENDIMIENTO_PTS ?? 0));

  // Asignar JERARQUIA estilo Excel RANK
  // Para cada pareja, JERARQUIA = 1 + cantidad de parejas con RENDIMIENTO_PTS mayor
  for (const s of withRank) {
    const higher = withRank.filter(
      (other) => (other.RENDIMIENTO_PTS ?? 0) > (s.RENDIMIENTO_PTS ?? 0)
    ).length;
    s.JERARQUIA = 1 + higher;
  }

  // Los sin partidos: JERARQUIA = 0 (comportamiento Excel con IFERROR)
  for (const s of withoutRank) {
    s.JERARQUIA = 0;
  }

  // Retornar ordenados: primero los con ranking (por JERARQUIA), luego los sin partidos
  return [...withRank.sort((a, b) => a.JERARQUIA - b.JERARQUIA), ...withoutRank];
}

/**
 * PASO 5: Resumen de jornada (equivalente a G12:G14 del Excel)
 */
export function computeJornadaSummaryLiga16(
  stats: Liga16PairStats[],
  category: Liga16Category
): Liga16JornadaSummary {
  const totalPJ = stats.reduce((sum, s) => sum + s.PJ, 0);
  const JUEGOS_JUGADOS = Math.floor(totalPJ / 2); // Cada partido cuenta en 2 parejas
  const TOTAL_JUEGOS = LIGA16_CATEGORIES[category].totalMatchesRoundRobin;
  const JUEGOS_FALTANTES = TOTAL_JUEGOS - JUEGOS_JUGADOS;

  return { JUEGOS_JUGADOS, TOTAL_JUEGOS, JUEGOS_FALTANTES };
}

/**
 * Función principal: Calcula tabla de posiciones completa para una categoría/grupo
 * Equivalente a la hoja RESULTADOS X del Excel
 */
export function computeLiga16Standings(
  pairs: Array<{ id: UUID; number: number; name: string }>,
  matches: Match[],
  category: Liga16Category
): {
  standings: Liga16PairStats[];
  jornada: Liga16JornadaSummary;
} {
  // Calcular stats para cada pareja
  const stats = pairs.map((p) =>
    computePairStatsLiga16(p.id, p.number, p.name, matches)
  );

  // Calcular jerarquía (ranking)
  const ranked = computeJerarquiaLiga16(stats);

  // Resumen de jornada
  const jornada = computeJornadaSummaryLiga16(ranked, category);

  return { standings: ranked, jornada };
}

/**
 * Utilidad: Genera todos los partidos de round-robin para n parejas
 * Devuelve array de [parejaA, parejaB] donde cada par juega una vez
 */
export function generateRoundRobinMatches(pairNumbers: number[]): Array<[number, number]> {
  const matches: Array<[number, number]> = [];
  for (let i = 0; i < pairNumbers.length; i++) {
    for (let j = i + 1; j < pairNumbers.length; j++) {
      matches.push([pairNumbers[i], pairNumbers[j]]);
    }
  }
  return matches;
}

/**
 * Valida que un partido tenga scores válidos según reglas de pádel
 * - Set normal: gana quien llega a 6 con diff 2, o 7-5
 * - Tiebreak: a 7 puntos (o 10 en super tiebreak) con diff 2
 */
export function validateLiga16Match(sets: Liga16MatchSets): string | null {
  // Set 1
  const s1 = sets.set1;
  if (!isValidSet(s1.a, s1.b, false)) return "Set 1: marcador inválido";

  // Set 2
  const s2 = sets.set2;
  if (!isValidSet(s2.a, s2.b, false)) return "Set 2: marcador inválido";

  // Tiebreak (super tie-break a 10 en Liga16)
  if (sets.tiebreak) {
    const tb = sets.tiebreak;
    if (!isValidSet(tb.a, tb.b, true)) return "Tiebreak: marcador inválido (super tie-break a 10, diff 2)";
  }

  // Coherencia del desempate: si alguien ya ganó 2 sets, el tercer "set" sólo
  // puede ser super tie-break a 10; un set completo (6-x / 7-5) es inválido.
  const setsWon = countSetsWonLiga16(sets);
  if ((setsWon.a === 2 || setsWon.b === 2) && sets.tiebreak) {
    const w = Math.max(sets.tiebreak.a, sets.tiebreak.b);
    const l = Math.min(sets.tiebreak.a, sets.tiebreak.b);
    const fullSet = (w === 6 && l <= 4) || (w === 7 && l === 5);
    if (fullSet) {
      return "El desempate debe ser super tie-break a 10, no un tercer set completo";
    }
  }

  return null;
}

function isValidSet(a: number, b: number, isTiebreak: boolean): boolean {
  if (a < 0 || b < 0) return false;
  if (a === b) return false; // No empates en pádel

  if (isTiebreak) {
    // Super tie-break a 10, ganar por 2
    const winner = Math.max(a, b);
    const loser = Math.min(a, b);
    return winner >= 10 && winner - loser >= 2;
  }

  // Set normal a 6 juegos, ganar por 2
  const winner = Math.max(a, b);
  const loser = Math.min(a, b);

  if (winner === 6 && loser <= 4) return true; // 6-0 a 6-4
  if (winner === 7 && loser === 5) return true; // 7-5
  if (winner === 7 && loser === 6) return true; // 7-6 (tie-break del set, pero en Liga16 no se usa)

  return false;
}