/**
 * Generador de rondas para ROUND ROBIN INDIVIDUAL con dobles de compañero
 * rotativo (formato "americano") — rama investigacion/round-robin, solo demo.
 *
 * Modelo: N jugadores se inscriben por nombre. Cada ronda forma partidos de
 * 4 jugadores (2 vs 2) por cancha; con jugadores de sobra, los descansos se
 * reparten de forma estrictamente pareja. Cada jugador suma a su tabla
 * individual los puntos que anotó su equipo.
 *
 * Dos motores:
 *  - exacto (1 cancha, rotación completa): búsqueda con retroceso que cubre
 *    TODAS las parejas posibles con el mínimo de repeticiones (para 7
 *    jugadores: 11 rondas, 1 repetición — el óptimo matemático, porque
 *    C(7,2)=21 es impar y cada partido cubre 2 parejas).
 *  - voraz con reintentos (caso general): por ronda elige descansos justos
 *    (quien menos ha descansado, y entre ellos quien descansó hace más) y
 *    prueba cientos de emparejamientos quedándose con el que menos repite
 *    compañeros (peso 10x) y rivales. Con 4, 5, 8 y 9 jugadores logra
 *    "todos con todos exactamente una vez".
 *
 * Implementación propia escrita para esta investigación. La heurística voraz
 * sigue la descripción pública del generador de CalcPark
 * (https://calcpark.com/padel-americano-generator) y la rotación completa de
 * 11 rondas coincide con lo que publica Rallyano para 7 jugadores
 * (https://www.rallyano.com/padel-americano/7-players); ninguna de las dos
 * apps publica su código bajo licencia reutilizable, así que aquí no hay
 * código copiado.
 */

export interface AmericanoMatch {
  court: number;
  teamA: [number, number];
  teamB: [number, number];
}

export interface AmericanoRound {
  matches: AmericanoMatch[];
  resting: number[];
}

/** Rondas necesarias para que cada jugador pueda ser compañero de todos. */
export function fullRotationRounds(playerCount: number, courts: number): number {
  const partnerships = (playerCount * (playerCount - 1)) / 2;
  return Math.ceil(partnerships / (2 * courts));
}

/** Máximo de canchas útiles: cada partido necesita 4 jugadores. */
export function maxCourts(playerCount: number): number {
  return Math.max(1, Math.floor(playerCount / 4));
}

/* ------------------------------ RNG sembrado ------------------------------ */

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* --------------------------- búsqueda exacta (1c) -------------------------- */

const EDGE = 64; // jugadores por rama < 64 para empaquetar aristas en un int
const edgeKey = (a: number, b: number) => (a < b ? a * EDGE + b : b * EDGE + a);

/**
 * Rotación completa exacta con 1 cancha: cubre cada pareja posible al menos
 * una vez con el mínimo de repeticiones y diferencia de partidos jugados ≤ 1.
 * Devuelve null si agota el presupuesto de búsqueda (el llamador cae al
 * voraz). Pensado para n ≤ 12; en la práctica resuelve n=5,7,9 en ~1 ms.
 */
function exactFullRotation(playerCount: number): AmericanoRound[] | null {
  const n = playerCount;
  const total = (n * (n - 1)) / 2;
  const rounds = Math.ceil(total / 2);
  const repsAllowed = 2 * rounds - total;
  if (n < 4 || n >= EDGE) return null;

  const byEdge = new Map<number, [number, number][][]>();
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      const others: number[] = [];
      for (let p = 0; p < n; p++) if (p !== a && p !== b) others.push(p);
      const cands: [number, number][][] = [];
      for (let i = 0; i < others.length; i++)
        for (let j = i + 1; j < others.length; j++)
          cands.push([
            [a, b],
            [others[i], others[j]],
          ]);
      byEdge.set(edgeKey(a, b), cands);
    }
  }

  const uncovered = new Set<number>();
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) uncovered.add(edgeKey(a, b));

  const chosen: [number, number][][] = [];
  let repsUsed = 0;
  let nodes = 0;
  const NODE_BUDGET = 400_000;

  function dfs(): boolean {
    if (++nodes > NODE_BUDGET) return false;
    if (chosen.length === rounds) {
      if (uncovered.size !== 0) return false;
      // Reparto justo de participaciones: nadie juega 2 partidos más que otro.
      const played = new Array<number>(n).fill(0);
      for (const [[a, b], [c, d]] of chosen) {
        played[a]++;
        played[b]++;
        played[c]++;
        played[d]++;
      }
      return Math.max(...played) - Math.min(...played) <= 1;
    }
    if (uncovered.size > 2 * (rounds - chosen.length)) return false;
    const first = uncovered.values().next().value as number;
    for (const match of byEdge.get(first) ?? []) {
      const k2 = edgeKey(match[1][0], match[1][1]);
      const fresh = [first, k2].filter((k) => uncovered.has(k));
      const reps = 2 - fresh.length;
      if (repsUsed + reps > repsAllowed) continue;
      fresh.forEach((k) => uncovered.delete(k));
      repsUsed += reps;
      chosen.push(match);
      if (dfs()) return true;
      chosen.pop();
      repsUsed -= reps;
      fresh.forEach((k) => uncovered.add(k));
    }
    return false;
  }

  if (!dfs()) return null;
  return chosen.map(([[a, b], [c, d]]) => {
    const onCourt = new Set([a, b, c, d]);
    return {
      matches: [{ court: 1, teamA: [a, b] as [number, number], teamB: [c, d] as [number, number] }],
      resting: Array.from({ length: n }, (_, p) => p).filter((p) => !onCourt.has(p)),
    };
  });
}

/* ------------------------------ voraz general ----------------------------- */

function greedyAmericano(
  playerCount: number,
  courts: number,
  rounds: number,
  seed: number,
  restarts: number,
  triesPerRound: number,
): AmericanoRound[] {
  const n = playerCount;
  const restPerRound = n - courts * 4;
  let bestSchedule: AmericanoRound[] | null = null;
  let bestRepeats = Number.POSITIVE_INFINITY;

  for (let restart = 0; restart < restarts; restart++) {
    const rng = mulberry32(seed * 7919 + restart * 104729 + 1);
    const rests = new Array<number>(n).fill(0);
    const lastRest = new Array<number>(n).fill(-1);
    const partnered = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const opposed = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const schedule: AmericanoRound[] = [];
    let repeats = 0;

    for (let r = 0; r < rounds; r++) {
      const order = Array.from({ length: n }, (_, p) => p).sort(
        (a, b) => rests[a] - rests[b] || lastRest[a] - lastRest[b] || a - b,
      );
      const resting = order.slice(0, restPerRound);
      const playing = order.slice(restPerRound);
      for (const p of resting) {
        rests[p]++;
        lastRest[p] = r;
      }

      let bestCost = Number.POSITIVE_INFINITY;
      let bestSplit: [number, number][][] | null = null;
      for (let t = 0; t < triesPerRound; t++) {
        const shuffled = [...playing];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        let cost = 0;
        const split: [number, number][][] = [];
        for (let m = 0; m < courts; m++) {
          const [a, b, c, d] = shuffled.slice(m * 4, m * 4 + 4);
          split.push([
            [a, b],
            [c, d],
          ]);
          cost += 10 * (partnered[a][b] ** 2 + partnered[c][d] ** 2);
          cost +=
            opposed[a][c] ** 2 + opposed[a][d] ** 2 + opposed[b][c] ** 2 + opposed[b][d] ** 2;
        }
        if (cost < bestCost) {
          bestCost = cost;
          bestSplit = split;
        }
      }

      const roundMatches: AmericanoMatch[] = (bestSplit ?? []).map(([[a, b], [c, d]], m) => {
        if (partnered[a][b] > 0) repeats++;
        if (partnered[c][d] > 0) repeats++;
        partnered[a][b]++;
        partnered[b][a]++;
        partnered[c][d]++;
        partnered[d][c]++;
        for (const x of [a, b]) for (const y of [c, d]) {
          opposed[x][y]++;
          opposed[y][x]++;
        }
        return { court: m + 1, teamA: [a, b], teamB: [c, d] };
      });
      schedule.push({ matches: roundMatches, resting: [...resting].sort((a, b) => a - b) });
    }

    if (repeats < bestRepeats) {
      bestRepeats = repeats;
      bestSchedule = schedule;
      if (repeats === 0) break;
    }
  }
  return bestSchedule ?? [];
}

/**
 * Genera las rondas del americano. Determinista: mismos argumentos, mismas
 * rondas. Con 1 cancha y `rounds` = rotación completa usa la búsqueda exacta;
 * en cualquier otro caso, el voraz con reintentos.
 */
export function generateAmericano(
  playerCount: number,
  courts: number,
  rounds: number,
  seed = 1,
): AmericanoRound[] {
  if (playerCount < 4) return [];
  const usableCourts = Math.min(Math.max(1, courts), maxCourts(playerCount));
  if (rounds < 1) return [];
  if (usableCourts === 1 && playerCount <= 12 && rounds === fullRotationRounds(playerCount, 1)) {
    const exact = exactFullRotation(playerCount);
    if (exact) return exact;
  }
  return greedyAmericano(playerCount, usableCourts, rounds, seed, 20, 300);
}

/* ------------------------------ tabla individual --------------------------- */

export interface AmericanoPlayerRow {
  player: number;
  points: number;
  diff: number;
  wins: number;
  played: number;
  /** Puntos por partido jugado; null si aún no juega. */
  average: number | null;
}

export type AmericanoSortMode = "total" | "average";

/**
 * Tabla individual: cada jugador acumula los puntos que anotó su equipo.
 * Regla elegida para la demo (así lo hacen las apps de referencia); con
 * descansos, `total` favorece a quien jugó más partidos y `average` nivela.
 */
export function americanoStandings(
  playerCount: number,
  rounds: AmericanoRound[],
  scores: Record<string, { a: number; b: number }>,
  sort: AmericanoSortMode,
): AmericanoPlayerRow[] {
  const rows: AmericanoPlayerRow[] = Array.from({ length: playerCount }, (_, p) => ({
    player: p,
    points: 0,
    diff: 0,
    wins: 0,
    played: 0,
    average: null,
  }));
  rounds.forEach((round, ri) => {
    round.matches.forEach((match, mi) => {
      const score = scores[`${ri}-${mi}`];
      if (!score) return;
      const [a1, a2] = match.teamA;
      const [b1, b2] = match.teamB;
      for (const p of [a1, a2]) {
        rows[p].points += score.a;
        rows[p].diff += score.a - score.b;
        rows[p].played++;
        if (score.a > score.b) rows[p].wins++;
      }
      for (const p of [b1, b2]) {
        rows[p].points += score.b;
        rows[p].diff += score.b - score.a;
        rows[p].played++;
        if (score.b > score.a) rows[p].wins++;
      }
    });
  });
  for (const row of rows) {
    row.average = row.played > 0 ? row.points / row.played : null;
  }
  const byTotal = (x: AmericanoPlayerRow, y: AmericanoPlayerRow) =>
    y.points - x.points || y.diff - x.diff || y.wins - x.wins || x.player - y.player;
  const byAverage = (x: AmericanoPlayerRow, y: AmericanoPlayerRow) =>
    (y.average ?? -1) - (x.average ?? -1) || byTotal(x, y);
  return rows.sort(sort === "average" ? byAverage : byTotal);
}
