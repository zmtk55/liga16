/**
 * Generador de rondas para ROUND ROBIN INDIVIDUAL con dobles de compañero
 * rotativo (formato "americano") — rama investigacion/round-robin, solo demo.
 *
 * Modelo: N jugadores se inscriben por nombre. Cada ronda forma partidos de
 * 4 jugadores (2 vs 2) por cancha; con jugadores de sobra, los descansos se
 * reparten parejo Y se ordenan para que nadie descanse dos rondas seguidas
 * cuando existe un orden que lo logra (ver `optimizeSequencing`).
 *
 * Dos motores:
 *  - exacto (1 cancha, rotación completa): búsqueda con retroceso que cubre
 *    TODAS las parejas posibles con el mínimo de repeticiones (para 7
 *    jugadores: 11 rondas, 1 repetición — el óptimo matemático, porque
 *    C(7,2)=21 es impar y cada partido cubre 2 parejas). Enumera soluciones
 *    hasta hallar una cuyas rondas se puedan ordenar sin descansos seguidos.
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

/* --------------------- orden de rondas (descansos sanos) ------------------- */

/** Máximo de descansos consecutivos de cualquier jugador en esta secuencia. */
export function maxConsecutiveRests(rounds: AmericanoRound[], playerCount: number): number {
  let worst = 0;
  for (let p = 0; p < playerCount; p++) {
    let streak = 0;
    let best = 0;
    for (const round of rounds) {
      if (round.resting.includes(p)) {
        streak++;
        best = Math.max(best, streak);
      } else {
        streak = 0;
      }
    }
    worst = Math.max(worst, best);
  }
  return worst;
}

/**
 * Orden exacto por programación dinámica: existe una permutación de las
 * rondas donde NADIE descansa dos rondas seguidas (los descansos de rondas
 * adyacentes son ajenos)? Factible para ~14 rondas o menos (2^R estados).
 */
function perfectRestOrder(rounds: AmericanoRound[]): number[] | null {
  const R = rounds.length;
  if (R > 14) return null;
  const restMask = rounds.map((r) => r.resting.reduce((m, p) => m | (1 << p), 0));
  const adjacentOk = (i: number, j: number) => (restMask[i] & restMask[j]) === 0;
  const seen = new Map<number, number>();
  const frontier = rounds.map((_, i) => ({ mask: 1 << i, last: i }));
  for (const s of frontier) seen.set((s.mask << 5) | s.last, -1);
  const layers = [frontier];
  for (let lvl = 1; lvl < R; lvl++) {
    const next: { mask: number; last: number }[] = [];
    const nextSeen = new Map<number, number>();
    for (const s of layers[lvl - 1]) {
      for (let j = 0; j < R; j++) {
        if (s.mask & (1 << j) || !adjacentOk(s.last, j)) continue;
        const mask = s.mask | (1 << j);
        const key = (mask << 5) | j;
        if (nextSeen.has(key)) continue;
        nextSeen.set(key, (s.mask << 5) | s.last);
        next.push({ mask, last: j });
      }
    }
    layers.push(next);
    for (const [k, v] of nextSeen) seen.set(k, v);
    if (next.length === 0) break;
  }
  const lastLayer = layers[R - 1];
  if (!lastLayer || lastLayer.length === 0) return null;
  const order: number[] = [];
  let key: number | undefined = (((1 << R) - 1) << 5) | lastLayer[0].last;
  while (key !== undefined && key !== -1) {
    order.unshift(key & 31);
    key = seen.get(key);
  }
  return order;
}

/** Descansos consecutivos (peso fuerte) + solape de jugadores entre rondas. */
function sequenceCost(ordered: AmericanoRound[], playerCount: number): number {
  let cost = maxConsecutiveRests(ordered, playerCount) * 10_000;
  for (let i = 0; i + 1 < ordered.length; i++) {
    const onCourt = new Set<number>();
    for (const m of ordered[i].matches) for (const p of [...m.teamA, ...m.teamB]) onCourt.add(p);
    let overlap = 0;
    for (const m of ordered[i + 1].matches)
      for (const p of [...m.teamA, ...m.teamB]) if (onCourt.has(p)) overlap++;
    cost += overlap * overlap;
  }
  return cost;
}

/**
 * Constructor voraz con reinicios: encadena rondas eligiendo siempre una cuyos
 * descansos sean ajenos a los de la ronda anterior. Ideal cuando hay muchas
 * rondas (el DP exacto crece como 2^R). Determinista con la semilla dada.
 */
function greedyDisjointOrder(rounds: AmericanoRound[], seed: number): number[] | null {
  const R = rounds.length;
  const restMask = rounds.map((r) => r.resting.reduce((m, p) => m | (1 << p), 0));
  const rng = mulberry32(seed);
  for (let attempt = 0; attempt < 500; attempt++) {
    const remaining = rounds.map((_, i) => i);
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    const order: number[] = [];
    let lastMask = 0;
    while (remaining.length > 0) {
      const idx = remaining.findIndex((i) => order.length === 0 || (restMask[i] & lastMask) === 0);
      if (idx === -1) break;
      const [chosen] = remaining.splice(idx, 1);
      order.push(chosen);
      lastMask = restMask[chosen];
    }
    if (order.length === R) return order;
  }
  return null;
}

/** Permutación por ascenso de colina, determinista con la semilla dada. */
function hillClimbOrder(rounds: AmericanoRound[], playerCount: number, seed: number): number[] {
  const rng = mulberry32(seed);
  const order = rounds.map((_, i) => i);
  const apply = (ord: number[]) => sequenceCost(ord.map((i) => rounds[i]), playerCount);
  let best = apply(order);
  for (let it = 0; it < 20_000; it++) {
    const i = Math.floor(rng() * order.length);
    const j = Math.floor(rng() * order.length);
    [order[i], order[j]] = [order[j], order[i]];
    const cost = apply(order);
    if (cost <= best) best = cost;
    else [order[i], order[j]] = [order[j], order[i]];
    if (best < 10_000) break; // ya no hay descansos seguidos
  }
  return order;
}

/**
 * Reordena las rondas (sin tocar parejas ni cobertura) para que los descansos
 * no se encadenen. Con ≤14 rondas intenta el orden perfecto exacto; si no
 * existe, cae al ascenso de colina. Determinista.
 */
export function optimizeSequencing(
  rounds: AmericanoRound[],
  playerCount: number,
  seed = 1,
): AmericanoRound[] {
  if (rounds.length < 2) return rounds;
  const order =
    perfectRestOrder(rounds) ??
    greedyDisjointOrder(rounds, seed) ??
    hillClimbOrder(rounds, playerCount, seed);
  return order.map((i) => rounds[i]);
}

/* --------------------------- búsqueda exacta (1c) -------------------------- */

const EDGE = 64; // jugadores por rama < 64 para empaquetar aristas en un int
const edgeKey = (a: number, b: number) => (a < b ? a * EDGE + b : b * EDGE + a);

interface InternalRound {
  playing: number[];
  resting: number[];
}

/**
 * Rotación completa exacta con 1 cancha: cubre cada pareja posible al menos
 * una vez con el mínimo de repeticiones y diferencia de partidos jugados ≤ 1.
 * Enumera soluciones (máx. 40) hasta encontrar una que además se pueda
 * ordenar sin descansos consecutivos; si ninguna lo logra, devuelve la
 * primera con el mejor orden disponible. Devuelve null si agota el presupuesto.
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
  const NODE_BUDGET = 3_000_000;
  const MAX_SOLUTIONS = 40;

  let firstSolution: [number, number][][] | null = null;
  let bestSolution: [number, number][][] | null = null;
  let bestOrder: number[] | null = null;
  let solutions = 0;
  let stop = false;

  function toInternal(sol: [number, number][][]): InternalRound[] {
    return sol.map(([[a, b], [c, d]]) => {
      const onCourt = [a, b, c, d];
      return {
        playing: onCourt,
        resting: Array.from({ length: n }, (_, p) => p).filter((p) => !onCourt.includes(p)),
      };
    });
  }

  function dfs(): void {
    if (stop || ++nodes > NODE_BUDGET) return;
    if (chosen.length === rounds) {
      if (uncovered.size !== 0) return;
      const played = new Array<number>(n).fill(0);
      for (const [[a, b], [c, d]] of chosen) {
        played[a]++;
        played[b]++;
        played[c]++;
        played[d]++;
      }
      if (Math.max(...played) - Math.min(...played) > 1) return;
      solutions++;
      const snapshot = chosen.map((m) => [
        [...m[0]],
        [...m[1]],
      ]) as [number, number][][];
      if (!firstSolution) firstSolution = snapshot;
      const order = perfectRestOrder(
        toInternal(snapshot).map((r) => ({
          matches: [
            {
              court: 1,
              teamA: [r.playing[0], r.playing[1]] as [number, number],
              teamB: [r.playing[2], r.playing[3]] as [number, number],
            },
          ],
          resting: r.resting,
        })),
      );
      if (order) {
        bestSolution = snapshot;
        bestOrder = order;
        stop = true;
      }
      if (solutions >= MAX_SOLUTIONS) stop = true;
      return;
    }
    if (uncovered.size > 2 * (rounds - chosen.length)) return;
    const first = uncovered.values().next().value as number;
    for (const match of byEdge.get(first) ?? []) {
      const k2 = edgeKey(match[1][0], match[1][1]);
      const fresh = [first, k2].filter((k) => uncovered.has(k));
      const reps = 2 - fresh.length;
      if (repsUsed + reps > repsAllowed) continue;
      fresh.forEach((k) => uncovered.delete(k));
      repsUsed += reps;
      chosen.push(match);
      dfs();
      chosen.pop();
      repsUsed -= reps;
      fresh.forEach((k) => uncovered.add(k));
      if (stop) return;
    }
  }

  dfs();
  const solution = bestSolution ?? firstSolution;
  if (!solution) return null;
  const internal = toInternal(solution);
  const asRounds = internal.map((r) => ({
    matches: [
      {
        court: 1,
        teamA: [r.playing[0], r.playing[1]] as [number, number],
        teamB: [r.playing[2], r.playing[3]] as [number, number],
      },
    ],
    resting: r.resting,
  }));
  const finalOrder =
    bestOrder ??
    perfectRestOrder(asRounds) ??
    greedyDisjointOrder(asRounds, 1) ??
    hillClimbOrder(asRounds, n, 1);
  return finalOrder.map((idx) => asRounds[idx]);
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
 * en cualquier otro caso, el voraz con reintentos. Al final, las rondas se
 * reordenan para que nadie descanse dos seguidas cuando existe ese orden.
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
    const exact = exactFullRotation(playerCount); // ya viene con orden sano
    if (exact) return exact;
    return optimizeSequencing(greedyAmericano(playerCount, 1, rounds, seed, 20, 300), playerCount, seed);
  }
  return optimizeSequencing(
    greedyAmericano(playerCount, usableCourts, rounds, seed, 20, 300),
    playerCount,
    seed,
  );
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

/* --------------------------- regla de puntuación --------------------------- */

/**
 * Regla de captura ELEGIDA PARA LA DEMO (la que describió Julian: "el primero
 * que llegue a N"): el partido lo gana el primer equipo en llegar a
 * `pointsPerMatch` puntos, así que un marcador debe ser exactamente N y el
 * otro menor que N. Sin empates.
 */
export function validateAmericanoScore(
  a: number,
  b: number,
  pointsPerMatch: number,
): { ok: true; score: { a: number; b: number } } | { ok: false; error: string } {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > 99 || b > 99) {
    return { ok: false, error: "Los puntos deben ser números enteros entre 0 y 99." };
  }
  if (Math.max(a, b) !== pointsPerMatch || Math.min(a, b) >= pointsPerMatch) {
    return {
      ok: false,
      error: `El partido es al primero que llegue a ${pointsPerMatch}: un marcador debe ser ${pointsPerMatch} y el otro menor.`,
    };
  }
  return { ok: true, score: { a, b } };
}
