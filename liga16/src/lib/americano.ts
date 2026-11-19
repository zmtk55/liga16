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

/**
 * Cobertura real de compañeros de una rotación: cuántas parejas distintas
 * llegaron a formarse de las posibles. La UI la usa para no prometer "todos
 * con todos" cuando una ruta de respaldo no lo logró.
 */
export function partnershipCoverage(
  rounds: AmericanoRound[],
  playerCount: number,
): { covered: number; total: number } {
  const seen = new Set<number>();
  for (const round of rounds)
    for (const match of round.matches)
      for (const team of [match.teamA, match.teamB])
        seen.add(team[0] < team[1] ? team[0] * EDGE + team[1] : team[1] * EDGE + team[0]);
  return { covered: seen.size, total: (playerCount * (playerCount - 1)) / 2 };
}

function popcount(x: number): number {
  let c = 0;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
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


/* ------------- rotación completa exacta por construcción / DFS ------------- */

/**
 * Factorización circular para n divisible por 4 con canchas = n/4 (todos
 * juegan todas las rondas): construcción clásica del círculo — n-1 rondas,
 * cada pareja exactamente una vez. Determinista.
 */
function circleRotation(playerCount: number): AmericanoRound[] {
  const n = playerCount;
  const rounds: AmericanoRound[] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [number, number][] = [[n - 1, r]];
    for (let i = 1; i <= (n - 2) / 2; i++) {
      pairs.push([(((r + i) % (n - 1)) + (n - 1)) % (n - 1), (((r - i) % (n - 1)) + (n - 1)) % (n - 1)]);
    }
    const matches: AmericanoMatch[] = [];
    for (let m = 0; m < pairs.length; m += 2) {
      matches.push({ court: m / 2 + 1, teamA: pairs[m], teamB: pairs[m + 1] });
    }
    rounds.push({ matches, resting: [] });
  }
  return rounds;
}

/** Emparejamientos de `play` en `courts` partidos (2 parejas c/u), sin duplicados. */
function matchPairings(play: number[], courts: number): [number, number][][][] {
  const out: [number, number][][][] = [];
  function pairingsOf4(w: number, x: number, y: number, z: number): [number, number][][] {
    return [
      [[w, x], [y, z]],
      [[w, y], [x, z]],
      [[w, z], [x, y]],
    ];
  }
  function choose(players: number[], acc: [number, number][][]) {
    if (acc.length === courts) {
      out.push(acc.map((m) => m.map((t) => [...t]) as [number, number][]));
      return;
    }
    const p0 = players[0];
    for (let i = 1; i < players.length; i++)
      for (let j = i + 1; j < players.length; j++)
        for (let k = j + 1; k < players.length; k++) {
          const four = [p0, players[i], players[j], players[k]];
          const rest = players.filter((p) => !four.includes(p));
          for (const m of pairingsOf4(four[0], four[1], four[2], four[3])) choose(rest, [...acc, m]);
        }
  }
  choose(play, []);
  const seen = new Set<string>();
  return out.filter((o) => {
    const key = o
      .map((m) => m.map((t) => [...t].sort((a, b) => a - b).join(',')).sort().join('|'))
      .join(';');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Rotación completa exacta por DFS con restricciones: por ronda elige el
 * grupo que descansa (cuotas parejas, racha de descansos <= targetMaxRest) y
 * el emparejamiento (urgencia: parejas aún no cubiertas), con retroceso.
 * Determinista (sin azar). Devuelve null si agota el presupuesto de nodos.
 */
export function constrainedFullRotation(
  playerCount: number,
  courts: number,
  targetMaxRest: number,
  nodeCap: number,
): AmericanoRound[] | null {
  const n = playerCount;
  const R = fullRotationRounds(n, courts);
  const b = n - 4 * courts;
  const repsAllowed = 2 * courts * R - (n * (n - 1)) / 2;
  const quota = (R * b) / n;
  const qLo = Math.floor(quota);
  const qHi = Math.ceil(quota);
  const pairTotal = (n * (n - 1)) / 2;
  const uncovered = new Set<number>();
  for (let a = 0; a < n; a++) for (let c = a + 1; c < n; c++) uncovered.add(edgeKey(a, c));
  const restCounts = new Array<number>(n).fill(0);
  const streak = new Array<number>(n).fill(0);
  const savedStreak: number[][] = new Array(R);
  let nodes = 0;
  let repsUsed = 0;

  const allCombos: number[][] = [];
  (function gen(start: number, acc: number[]) {
    if (acc.length === b) {
      allCombos.push([...acc]);
      return;
    }
    for (let i = start; i < n; i++) {
      acc.push(i);
      gen(i + 1, acc);
      acc.pop();
    }
  })(0, []);

  const comboMasks = allCombos.map((c) => c.reduce((m, p) => m | (1 << p), 0));
  const fullMask = (1 << n) - 1;
  const answer: { matches: [number, number][][]; resting: number[] }[] = new Array(R);

  function dfs(r: number): boolean {
    if (++nodes > nodeCap) return false;
    if (r === R) return uncovered.size === 0;
    const roundsLeft = R - r - 1;
    savedStreak[r] = [...streak];
    // Parejas sin cubrir como máscaras por jugador: la urgencia de cada grupo
    // se cuenta con operaciones de bits (antes recorría todas las parejas).
    const unc = new Array<number>(n).fill(0);
    for (const k of uncovered) {
      const a = Math.floor(k / EDGE);
      const c = k % EDGE;
      unc[a] |= 1 << c;
      unc[c] |= 1 << a;
    }
    const cands: { rest: number[]; play: number[]; urgent: number }[] = [];
    for (let ci = 0; ci < allCombos.length; ci++) {
      const rest = allCombos[ci];
      let ok = true;
      for (const p of rest)
        if (streak[p] + 1 > targetMaxRest || restCounts[p] + 1 > qHi) {
          ok = false;
          break;
        }
      if (!ok) continue;
      const restMask = comboMasks[ci];
      for (let p = 0; p < n && ok; p++)
        if (!(restMask & (1 << p)) && restCounts[p] + roundsLeft < qLo) ok = false;
      if (!ok) continue;
      const playMask = fullMask ^ restMask;
      let twice = 0;
      for (let p = 0; p < n; p++) if (playMask & (1 << p)) twice += popcount(unc[p] & playMask);
      cands.push({ rest, play: [], urgent: twice >> 1 });
    }
    cands.sort((x, y) => y.urgent - x.urgent);
    for (const cand of cands.slice(0, 12)) {
      const rest = cand.rest;
      const restSetTop = new Set(rest);
      const play: number[] = [];
      for (let p = 0; p < n; p++) if (!restSetTop.has(p)) play.push(p);
      for (const o of matchPairings(play, courts)) {
        const keys = o.flatMap((m) => [edgeKey(m[0][0], m[0][1]), edgeKey(m[1][0], m[1][1])]);
        const fresh = keys.filter((k) => uncovered.has(k));
        const reps = keys.length - fresh.length;
        if (repsUsed + reps > repsAllowed) continue;
        fresh.forEach((k) => uncovered.delete(k));
        repsUsed += reps;
        for (const p of rest) {
          restCounts[p]++;
          streak[p]++;
        }
        for (const p of play) streak[p] = 0;
        answer[r] = { matches: o, resting: rest };
        if (dfs(r + 1)) return true;
        for (const p of rest) restCounts[p]--;
        for (let p = 0; p < n; p++) streak[p] = savedStreak[r][p];
        fresh.forEach((k) => uncovered.add(k));
        repsUsed -= reps;
        if (nodes > nodeCap) return false;
      }
    }
    return false;
  }
  if (pairTotal === 0) return null;
  if (!dfs(0)) return null;
  return answer.map((a) => ({
    matches: a.matches.map((m, i) => ({
      court: i + 1,
      teamA: [m[0][0], m[0][1]] as [number, number],
      teamB: [m[1][0], m[1][1]] as [number, number],
    })),
    resting: a.resting,
  }));
}

/**
 * Piso de descansos seguidos por conteo: con r descansos por jugador en R
 * rondas, la racha mínima posible es k = ceil(r/(R-r)). Si la densidad es
 * exacta (r = R·k/(k+1)), cumplir k obligaría a grupos fijos de descanso que
 * harían imposible la cobertura completa de parejas (demostrado: con racha
 * ≤k y densidad exacta, cada jugador sigue un patrón periódico fijo y solo se
 * empareja dentro de su bloque), así que el piso real con cobertura es k+1.
 */
function restFloor(n: number, courts: number, rounds: number): number {
  const b = n - 4 * courts;
  if (b <= 0) return 0;
  const r = (rounds * b) / n;
  const k = Math.ceil(r / (rounds - r));
  const tight = Math.abs((rounds * k) / (k + 1) - r) < 1e-9;
  return tight ? k + 1 : k;
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
/** La rotación completa por DFS es determinista: se calcula una vez por (jugadores, canchas). */
const KNOWN_UNREACHED_FLOOR = new Set(['11-1']);
const fullRotationMemo = new Map<string, AmericanoRound[]>();

export function generateAmericano(
  playerCount: number,
  courts: number,
  rounds: number,
  seed = 1,
): AmericanoRound[] {
  if (playerCount < 4) return [];
  const usableCourts = Math.min(Math.max(1, courts), maxCourts(playerCount));
  if (rounds < 1) return [];
  if (rounds === fullRotationRounds(playerCount, usableCourts)) {
    // Sin descansos (n divisible por 4, canchas = n/4): círculo exacto.
    if (playerCount % 4 === 0 && usableCourts === playerCount / 4) {
      return circleRotation(playerCount);
    }
    // Con descansos: DFS con restricciones; intenta el piso teórico de
    // descansos seguidos y, si no aparece solución pronto, el siguiente nivel.
    const memoKey = `${playerCount}-${usableCourts}`;
    const memo = fullRotationMemo.get(memoKey);
    if (memo) return memo;
    const floor = restFloor(playerCount, usableCourts, rounds);
    // 11 jugadores / 1 cancha: el piso (racha 2) no apareció con tres métodos
    // distintos (NO demostrado imposible); se salta ese intento para no gastar
    // tiempo en el teléfono y se entrega la racha 3 que sí se construye.
    const targets = KNOWN_UNREACHED_FLOOR.has(memoKey) ? [floor + 1] : [floor, floor + 1];
    for (const target of targets) {
      const cap = target === floor ? 1_500 : 600_000;
      const solved = constrainedFullRotation(playerCount, usableCourts, target, cap);
      if (solved) {
        fullRotationMemo.set(memoKey, solved);
        return solved;
      }
    }
    if (usableCourts === 1 && playerCount <= 12) {
      const exact = exactFullRotation(playerCount); // ya viene con orden sano
      if (exact) return exact;
    }
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

/* ----- Mexicano: cada ronda se arma con la tabla de las anteriores ----- */

export type AmericanoModalidad =
  | "americano"
  | "mexicano"
  | "team-americano"
  | "team-mexicano"
  | "mix-americano"
  | "mixicano"
  | "club-americano"
  | "club-mexicano"
  | "club-team-americano"
  | "club-team-mexicano"
  | "beat-box"
  | "playoffs";

/** Modalidades con pareja de una mujer y un hombre: piden el género por jugador. */
export function esClub(m: AmericanoModalidad): boolean { return m.startsWith("club-"); }
export function esParejasFijas(m: AmericanoModalidad): boolean { return m.startsWith("team-") || m.startsWith("club-team-") || m === "playoffs"; }
export function esMix(m: AmericanoModalidad): boolean {
  return m === "mix-americano" || m === "mixicano";
}

/** Modalidades que arman cada ronda con la tabla de las anteriores. */
export function esDinamica(m: AmericanoModalidad): boolean {
  return m === "mexicano" || m === "team-mexicano" || m === "mixicano" || m === "club-mexicano" || m === "club-team-mexicano";
}

/** Rondas por defecto del Mexicano: una menos que jugadores (convención de Rueda Padel). */
export function mexicanoTotalRounds(playerCount: number): number {
  return Math.max(1, playerCount - 1);
}

function seededOrder(n: number, seed: number): number[] {
  let t = seed >>> 0;
  const rnd = () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** La ronda siguiente solo se arma cuando todos los partidos de la última ya están cerrados. */
export function mexicanoRoundReady(
  rounds: AmericanoRound[],
  scores: Record<string, { a: number; b: number }>,
): boolean {
  if (rounds.length === 0) return false;
  const ri = rounds.length - 1;
  return rounds[ri].matches.every((_, mi) => scores[`${ri}-${mi}`] !== undefined);
}

/**
 * Arma UNA ronda de Mexicano. Pura: no modifica `rounds` y nunca toca rondas
 * ya armadas (corregir un marcador viejo cambia la tabla, no los partidos ya
 * jugados). Ronda 1: sorteo con semilla. Después: tabla individual por puntos
 * (desempate diferencia, victorias, número de jugador), cortada en cuartetos;
 * en cada uno 1º+4º contra 2º+3º, el cuarteto de arriba en la cancha 1.
 * Descansos: quien menos ha descansado, luego quien descansó hace más;
 * el empate final se rota por número de jugador (no depende del resultado).
 */
export function nextMexicanoRound(
  playerCount: number,
  courts: number,
  rounds: AmericanoRound[],
  scores: Record<string, { a: number; b: number }>,
  seed: number,
): AmericanoRound {
  const useCourts = Math.min(courts, maxCourts(playerCount));
  const playing = useCourts * 4;
  const restCount = new Array<number>(playerCount).fill(0);
  const lastRest = new Array<number>(playerCount).fill(-1);
  rounds.forEach((r, ri) =>
    r.resting.forEach((p) => {
      restCount[p]++;
      lastRest[p] = ri;
    }),
  );
  const ri = rounds.length;
  let active: number[];
  let resting: number[];
  if (ri === 0) {
    const order = seededOrder(playerCount, seed);
    active = order.slice(0, playing);
    resting = order.slice(playing);
  } else {
    const rank = americanoStandings(playerCount, rounds, scores, "total").map((r) => r.player);
    const byRest = Array.from({ length: playerCount }, (_, p) => p).sort(
      (x, y) =>
        restCount[x] - restCount[y] ||
        lastRest[x] - lastRest[y] ||
        ((x + ri) % playerCount) - ((y + ri) % playerCount),
    );
    resting = byRest.slice(0, playerCount - playing);
    const restSet = new Set(resting);
    active = rank.filter((p) => !restSet.has(p));
  }
  const matches: AmericanoMatch[] = [];
  for (let c = 0; c < useCourts; c++) {
    const g = active.slice(c * 4, c * 4 + 4);
    matches.push(
      ri === 0
        ? { court: c + 1, teamA: [g[0], g[1]], teamB: [g[2], g[3]] }
        : { court: c + 1, teamA: [g[0], g[3]], teamB: [g[1], g[2]] },
    );
  }
  return { matches, resting: [...resting].sort((a, b) => a - b) };
}

/* ----- Mix: pareja de una mujer y un hombre ----- */

export type Genero = "m" | "f";

function splitGeneros(generos: Genero[]): { women: number[]; men: number[] } {
  const women: number[] = [];
  const men: number[] = [];
  generos.forEach((g, p) => (g === "f" ? women : men).push(p));
  return { women, men };
}

/**
 * Parejas mixtas de UNA vuelta: la lista corta empareja en orden y la larga
 * rota `shift` posiciones; así, en max(mujeres, hombres) vueltas, cada mujer
 * es pareja de cada hombre exactamente una vez. Pura.
 */
function mixPairsRound(women: number[], men: number[], shift: number): Array<[number, number]> {
  const small = women.length <= men.length ? women : men;
  const big = women.length <= men.length ? men : women;
  const pairs: Array<[number, number]> = [];
  for (let j = 0; j < small.length; j++) {
    const a = small[j];
    const b = big[(j + shift) % big.length];
    pairs.push(women.length <= men.length ? [a, b] : [b, a]);
  }
  return pairs;
}

function roundsFromPairLists(
  playerCount: number,
  pairLists: Array<Array<[number, number]>>,
  courts: number,
): AmericanoRound[] {
  const useCourts = Math.max(1, Math.min(courts, maxCourts(playerCount)));
  return pairLists.map((pairs, r) => {
    const rot = pairs.map((_, i) => pairs[(i + r) % pairs.length]);
    const matches: Array<[[number, number], [number, number]]> = [];
    for (let k = 0; k + 1 < rot.length && matches.length < useCourts; k += 2)
      matches.push([rot[k], rot[k + 1]]);
    return roundFromPairMatches(playerCount, matches);
  });
}

/**
 * Mix Americano: cobertura completa de parejas mujer/hombre con grupos iguales.
 * Se agrupan las n² parejas posibles en partidos sin compartir jugador.
 * Si n es impar hay n² impar: se repite una pareja para completar el último
 * partido. Nunca se omite una pareja. Se agrupan partidos simultáneos solo
 * cuando no comparten jugadores y caben en las canchas.
 */
export function generateMixAmericano(generos: Genero[], courts: number, seed: number): AmericanoRound[] {
  const { women, men } = splitGeneros(generos);
  if (women.length < 2 || women.length !== men.length) return [];
  const w = seededOrder(women.length, seed).map((i) => women[i]);
  const m = seededOrder(men.length, seed + 7919).map((i) => men[i]);
  const pairs: Array<[number, number]> = [];
  for (let r = 0; r < m.length; r++) pairs.push(...mixPairsRound(w, m, r));
  if (pairs.length % 2 !== 0) pairs.push([...pairs[0]]);
  const disjoint = (a: [number, number], b: [number, number]) => a[0] !== b[0] && a[1] !== b[1];
  function solve(remaining: number[]): Array<[number, number]> | null {
    if (remaining.length === 0) return [];
    // Menor número de rivales elegibles primero reduce la búsqueda.
    let first = remaining[0];
    let min = Infinity;
    for (const i of remaining) {
      const n = remaining.filter((j) => i !== j && disjoint(pairs[i], pairs[j])).length;
      if (n < min) { min = n; first = i; }
    }
    if (min === 0) return null;
    for (const second of remaining) {
      if (first === second || !disjoint(pairs[first], pairs[second])) continue;
      const tail = solve(remaining.filter((i) => i !== first && i !== second));
      if (tail) return [[first, second], ...tail];
    }
    return null;
  }
  const solution = solve(pairs.map((_, i) => i));
  if (!solution) return [];
  const pending = solution.map(([a, b]) => [pairs[a], pairs[b]] as [[number, number], [number, number]]);
  const out: AmericanoRound[] = [];
  const useCourts = Math.max(1, Math.min(courts, maxCourts(generos.length)));
  while (pending.length) {
    const batch: Array<[[number, number], [number, number]]> = [];
    const used = new Set<number>();
    for (let i = 0; i < pending.length && batch.length < useCourts;) {
      const mt = pending[i];
      if (mt.flat().some((p) => used.has(p))) { i++; continue; }
      for (const p of mt.flat()) used.add(p);
      batch.push(mt);
      pending.splice(i, 1);
    }
    out.push(roundFromPairMatches(generos.length, batch));
  }
  return out;
}

/**
 * Mixicano: como Mexicano pero cada pareja es una mujer y un hombre.
 * Ronda 1 sorteada; después se ordenan mujeres entre mujeres y hombres entre
 * hombres por la tabla; en cada grupo de dos por género, 1ª con 2º y 2ª con 1º;
 * los partidos enfrentan parejas vecinas en la tabla combinada. Descansos
 * repartidos por género (quien menos ha descansado). Convención nuestra: la
 * app de referencia no publica el emparejamiento. Pura.
 */
export function nextMixicanoRound(
  generos: Genero[],
  courts: number,
  rounds: AmericanoRound[],
  scores: Record<string, { a: number; b: number }>,
  seed: number,
): AmericanoRound {
  const playerCount = generos.length;
  const { women, men } = splitGeneros(generos);
  const useCourts = Math.max(1, Math.min(courts, maxCourts(playerCount)));
  const ri = rounds.length;
  if (ri === 0) {
    const w = seededOrder(women.length, seed).map((i) => women[i]);
    const m = seededOrder(men.length, seed + 7919).map((i) => men[i]);
    return roundsFromPairLists(playerCount, [mixPairsRound(w, m, 0)], useCourts)[0];
  }
  const restCount = new Array<number>(playerCount).fill(0);
  const lastRest = new Array<number>(playerCount).fill(-1);
  rounds.forEach((r, idx) =>
    r.resting.forEach((p) => {
      restCount[p]++;
      lastRest[p] = idx;
    }),
  );
  const rank = americanoStandings(playerCount, rounds, scores, "total").map((r) => r.player);
  const pick = (pool: number[], n: number) => {
    const rest = [...pool].sort(
      (x, y) => restCount[x] - restCount[y] || lastRest[x] - lastRest[y] || x - y,
    );
    const out = new Set(rest.slice(0, Math.max(0, pool.length - n)));
    return rank.filter((p) => pool.includes(p) && !out.has(p));
  };
  const available = Math.min(useCourts * 2, women.length, men.length);
  const n = available - (available % 2);
  const wSel = pick(women, n);
  const mSel = pick(men, n);
  const pairs: Array<[number, number]> = wSel.map((wp, i) => [wp, mSel[i % 2 === 0 ? i + 1 : i - 1]]);
  return roundsFromPairLists(playerCount, [pairs], useCourts)[0];
}

/* ----- Team: parejas fijas ----- */

/** Parejas fijas por el orden de la lista: (1º,2º), (3º,4º)... Requiere cantidad par. */
export function pairsFromRoster(playerCount: number): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i + 1 < playerCount; i += 2) pairs.push([i, i + 1]);
  return pairs;
}

/** Rondas del Team Mexicano: una menos que parejas. */
export function teamMexicanoTotalRounds(playerCount: number): number {
  return Math.max(1, Math.floor(playerCount / 2) - 1);
}

function roundFromPairMatches(
  playerCount: number,
  matches: Array<[[number, number], [number, number]]>,
): AmericanoRound {
  const used = new Set<number>();
  const out: AmericanoMatch[] = matches.map(([teamA, teamB], i) => {
    for (const p of [...teamA, ...teamB]) used.add(p);
    return { court: i + 1, teamA, teamB };
  });
  const resting = Array.from({ length: playerCount }, (_, p) => p).filter((p) => !used.has(p));
  return { matches: out, resting };
}

/**
 * Team Americano: cada pareja juega contra todas las demás una vez (método del
 * círculo). Si hay más partidos por vuelta que canchas, la vuelta se reparte en
 * varias rondas; quien no juega en una ronda descansa.
 */
export function generateTeamAmericano(playerCount: number, courts: number): AmericanoRound[] {
  const pairs = pairsFromRoster(playerCount);
  const useCourts = Math.max(1, Math.min(courts, maxCourts(playerCount)));
  const slots: Array<number | null> = pairs.map((_, i) => i);
  if (slots.length % 2 === 1) slots.push(null);
  const m = slots.length;
  const rounds: AmericanoRound[] = [];
  for (let r = 0; r < m - 1; r++) {
    const vuelta: Array<[[number, number], [number, number]]> = [];
    for (let i = 0; i < m / 2; i++) {
      const a = slots[i];
      const b = slots[m - 1 - i];
      if (a !== null && b !== null) vuelta.push([pairs[a], pairs[b]]);
    }
    for (let k = 0; k < vuelta.length; k += useCourts)
      rounds.push(roundFromPairMatches(playerCount, vuelta.slice(k, k + useCourts)));
    slots.splice(1, 0, slots.pop() as number | null);
  }
  return rounds;
}

/**
 * Team Mexicano: ronda 1 sorteada entre parejas; después se ordenan las parejas
 * por puntos (desempate: diferencia, victorias, número) y la 1ª juega contra la
 * 2ª, la 3ª contra la 4ª... Si hay más parejas que lugares juegan las que
 * menos han jugado. Pura: no toca rondas ya armadas.
 */
export function nextTeamMexicanoRound(
  playerCount: number,
  courts: number,
  rounds: AmericanoRound[],
  scores: Record<string, { a: number; b: number }>,
  seed: number,
): AmericanoRound {
  const pairs = pairsFromRoster(playerCount);
  const useCourts = Math.max(1, Math.min(courts, maxCourts(playerCount)));
  const slots = Math.min(useCourts * 2, pairs.length - (pairs.length % 2));
  const ri = rounds.length;
  const played = new Array<number>(pairs.length).fill(0);
  const pairOf = (p: number) => Math.floor(p / 2);
  for (const r of rounds)
    for (const mt of r.matches) {
      played[pairOf(mt.teamA[0])]++;
      played[pairOf(mt.teamB[0])]++;
    }
  let order: number[];
  if (ri === 0) {
    order = seededOrder(pairs.length, seed).slice(0, slots);
  } else {
    const st = americanoStandings(playerCount, rounds, scores, "total");
    const rankOfPair = st
      .map((row) => pairOf(row.player))
      .filter((pi, i, arr) => arr.indexOf(pi) === i);
    const chosen = Array.from({ length: pairs.length }, (_, i) => i)
      .sort((x, y) => played[x] - played[y] || rankOfPair.indexOf(x) - rankOfPair.indexOf(y))
      .slice(0, slots);
    order = rankOfPair.filter((pi) => chosen.includes(pi));
  }
  const matches: Array<[[number, number], [number, number]]> = [];
  for (let i = 0; i + 1 < order.length; i += 2) matches.push([pairs[order[i]], pairs[order[i + 1]]]);
  return roundFromPairMatches(playerCount, matches);
}

/* ----- eliminatoria: PROPUESTA reversible de la demo (no regla confirmada) ----- */

export interface PlayoffMatch {
  label: string;
  teamA: [number, number];
  teamB: [number, number];
}

export interface PlayoffPlan {
  mode: "final" | "semifinals";
  /** Clasificados, en orden de tabla (mejor primero). */
  qualifiers: number[];
  semifinals: PlayoffMatch[];
  /** En final directa, las dos parejas de la final; en semis, null hasta tener ganadores. */
  finalPairs: [number, number][] | null;
}

/**
 * PROPUESTA A PRUEBA (reversible, no confirmada por Julian): parejas
 * balanceadas desde la tabla individual, mejor clasificado con peor
 * clasificado. Convenciones documentadas: 1º+4º vs 2º+3º por bloque de 4
 * (https://padelturn.com/en/padel/americano) y 1º+3º vs 2º+4º estilo mexicano
 * (https://www.padelisa.com/mexicano). Julian pidió poder ESCOGER entre ambas
 * (19-nov-2026: "deberias escoger 1 y 3 2 y 4 impares o pares aveces la
 * Gente utiliza diferente"). Con 4-7, final directa con la convención elegida
 * (por defecto la balanceada 1º+4º vs 2º+3º); con 8+, semifinales cruzadas
 * (1º+8º vs 4º+5º y 2º+7º vs 3º+6º) para que los dos primeros de la tabla no
 * puedan coincidir hasta la final — para 8+ no hay convención impares/pares
 * documentada y la elección todavía no aplica ahí (pendiente con Julian).
 * Los empates se rompen con el orden que ya trae la tabla (puntos,
 * diferencia, victorias).
 */
export type PlayoffPairing = "balanced" | "odds-evens";
export function proposePlayoffPairs(ranking: number[], pairing: PlayoffPairing = "balanced"): PlayoffPlan | null {
  if (ranking.length < 4) return null;
  if (ranking.length >= 8) {
    const q = ranking.slice(0, 8);
    return {
      mode: "semifinals",
      qualifiers: q,
      semifinals: [
        { label: "Semifinal 1", teamA: [q[0], q[7]], teamB: [q[3], q[4]] },
        { label: "Semifinal 2", teamA: [q[1], q[6]], teamB: [q[2], q[5]] },
      ],
      finalPairs: null,
    };
  }
  const q = ranking.slice(0, 4);
  return {
    mode: "final",
    qualifiers: q,
    semifinals: [],
    finalPairs:
      pairing === "odds-evens"
        ? [
            [q[0], q[2]],
            [q[1], q[3]],
          ]
        : [
            [q[0], q[3]],
            [q[1], q[2]],
          ],
  };
}

/**
 * Parejas de la final. En semis, cada pareja ganadora avanza JUNTA (propuesta
 * de la demo); null hasta que ambas semis tengan marcador.
 */
export function playoffFinalPairs(
  plan: PlayoffPlan,
  semifinalScores: ({ a: number; b: number } | null)[],
): [number, number][] | null {
  if (plan.mode === "final") return plan.finalPairs;
  const winners: [number, number][] = [];
  for (let i = 0; i < plan.semifinals.length; i++) {
    const s = semifinalScores[i];
    if (!s || s.a === s.b) return null;
    winners.push(s.a > s.b ? plan.semifinals[i].teamA : plan.semifinals[i].teamB);
  }
  return winners;
}

/* --------------------------- regla de puntuación --------------------------- */

/**
 * Regla de captura AJUSTADA por Julian el 18-nov-2026 ("No me pongas limite
 * asi. Aveces quedan 2 a 2 suman 4"): captura libre de enteros no negativos,
 * SIN obligar a llegar a N ni a una suma fija, y el empate es un resultado
 * final válido. Los puntos configurados quedan como referencia, no como
 * bloqueo. Un marcador cerrado es válido si ambos lados son enteros 0-99.
 */
export function validateAmericanoScore(
  a: number,
  b: number,
): { ok: true; score: { a: number; b: number } } | { ok: false; error: string } {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > 99 || b > 99) {
    return { ok: false, error: "Los puntos deben ser números enteros entre 0 y 99." };
  }
  return { ok: true, score: { a, b } };
}


/* -------------------- persistencia local de la demo -------------------- */

/**
 * Respaldo del avance de la demo en localStorage del MISMO navegador, para
 * que un refresco accidental no borre jugadores, rondas ni marcadores
 * (reportado por Julian el 18-nov-2026). Sigue siendo una prueba aislada:
 * nada sale del navegador ni toca Supabase.
 *
 * El formato lleva version: si cambia la estructura, un respaldo viejo se
 * descarta en vez de restaurarse a medias. Datos corruptos o incompletos
 * tambien se descartan (parse devuelve null) y la demo arranca de cero.
 */

export const AMERICANO_DEMO_STORAGE_KEY = "liga16-demo-round-robin-v1";

export interface AmericanoDemoSnapshot {
  version: 1;
  savedAt: string;
  inscritos: string[];
  courts: number;
  pointsPerMatch: number;
  roundMode: "full" | "short";
  seed: number;
  names: string[];
  rounds: AmericanoRound[];
  drafts: Record<string, { a: string; b: string; done?: boolean }>;
  sortMode: AmericanoSortMode;
  currentRound: number;
  configOpen: boolean;
  view: "rounds" | "standings" | "playoff";
  playoffDrafts: Record<string, { a: string; b: string; done?: boolean }>;
  playoffKeys: Record<string, string>;
  /** Convención de parejas de la final directa; ausente en guardados anteriores = "balanced". */
  poPairing?: PlayoffPairing;
  /** Ausente en guardados anteriores = "americano" (Normal Americano). */
  modalidad?: AmericanoModalidad;
  /** Géneros de la partida aplicada; solo existe en modalidades mixtas. */
  generos?: Genero[];
  clubs?: Array<"A" | "B">;
}

function isNameList(value: unknown, max: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= max &&
    value.every((n) => typeof n === "string" && n.trim().length > 0 && n.length <= 30)
  );
}

function isIntIn(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function isTeam(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) && value.length === 2 && value.every((n) => isIntIn(n, 0, 15))
  );
}

function isRoundList(value: unknown): value is AmericanoRound[] {
  return (
    Array.isArray(value) &&
    value.every(
      (r) =>
        r !== null &&
        typeof r === "object" &&
        Array.isArray((r as AmericanoRound).matches) &&
        (r as AmericanoRound).matches.every(
          (m) =>
            m !== null &&
            typeof m === "object" &&
            isIntIn((m as { court?: unknown }).court, 1, 4) &&
            isTeam((m as { teamA?: unknown }).teamA) &&
            isTeam((m as { teamB?: unknown }).teamB),
        ) &&
        Array.isArray((r as AmericanoRound).resting) &&
        (r as AmericanoRound).resting.every((n) => isIntIn(n, 0, 15)),
    )
  );
}

function isDraftMap(
  value: unknown,
): value is Record<string, { a: string; b: string; done?: boolean }> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (d) =>
        d !== null &&
        typeof d === "object" &&
        typeof (d as { a?: unknown }).a === "string" &&
        typeof (d as { b?: unknown }).b === "string" &&
        ((d as { done?: unknown }).done === undefined ||
          typeof (d as { done?: unknown }).done === "boolean"),
    )
  );
}

function isKeyMap(value: unknown): value is Record<string, string> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => typeof v === "string")
  );
}

/** Valida la forma completa del respaldo; cualquier pieza rara lo invalida. */
export function validateAmericanoDemoSnapshot(value: unknown): value is AmericanoDemoSnapshot {
  if (value === null || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    s.version === 1 &&
    typeof s.savedAt === "string" &&
    isNameList(s.inscritos, 16) &&
    isIntIn(s.courts, 1, 4) &&
    isIntIn(s.pointsPerMatch, 1, 99) &&
    (s.roundMode === "full" || s.roundMode === "short") &&
    isIntIn(s.seed, 1, 1_000_000) &&
    isNameList(s.names, (s.modalidad === "beat-box" || s.modalidad === "playoffs") ? 16 : 12) &&
    isRoundList(s.rounds) &&
    isDraftMap(s.drafts) &&
    (s.sortMode === "total" || s.sortMode === "average") &&
    isIntIn(s.currentRound, 0, 500) &&
    typeof s.configOpen === "boolean" &&
    (s.view === "rounds" || s.view === "standings" || s.view === "playoff") &&
    isDraftMap(s.playoffDrafts) &&
    isKeyMap(s.playoffKeys) &&
    (s.poPairing === undefined || s.poPairing === "balanced" || s.poPairing === "odds-evens") &&
    (s.modalidad === undefined ||
      s.modalidad === "americano" ||
      s.modalidad === "mexicano" ||
      s.modalidad === "team-americano" ||
      s.modalidad === "team-mexicano" ||
      s.modalidad === "mix-americano" ||
      s.modalidad === "mixicano" ||
      s.modalidad === "club-americano" || s.modalidad === "club-mexicano" ||
      s.modalidad === "club-team-americano" || s.modalidad === "club-team-mexicano" || s.modalidad === "beat-box" || s.modalidad === "playoffs") &&
    (s.generos === undefined ||
      (Array.isArray(s.generos) && s.generos.length === (s.names as string[]).length &&
        s.generos.every((g) => g === "m" || g === "f"))) &&
    (s.clubs === undefined || (Array.isArray(s.clubs) && s.clubs.length === (s.names as string[]).length && s.clubs.every((c) => c === "A" || c === "B"))) &&
    (!(typeof s.modalidad === "string" && s.modalidad.startsWith("club-")) ||
      (Array.isArray(s.clubs) && s.clubs.filter((c) => c === "A").length >= 4 &&
        s.clubs.filter((c) => c === "A").length === s.clubs.filter((c) => c === "B").length &&
        (!s.modalidad.startsWith("club-team-") ||
          (s.clubs.filter((c) => c === "A").length % 2 === 0 && s.clubs.every((c,i,a) => c === a[i-i%2]))))) &&
    ((s.modalidad !== "mix-americano" && s.modalidad !== "mixicano") ||
      (Array.isArray(s.generos) &&
        s.generos.filter((g) => g === "f").length >= 2 &&
        s.generos.filter((g) => g === "f").length === s.generos.filter((g) => g === "m").length))
  );
}

/**
 * Configuración que realmente produjo las rondas guardadas (canchas y modo).
 * Los campos courts/roundMode del respaldo pueden reflejar una edición sin
 * aplicar; las rondas son la fuente de verdad de la partida en curso.
 */
export function deriveAppliedConfig(
  rounds: AmericanoRound[],
  playerCount: number,
  fallback: { courts: number; mode: "full" | "short" },
  modalidad: AmericanoModalidad = "americano",
): { courts: number; mode: "full" | "short" } {
  if (rounds.length === 0) return fallback;
  const courts = Math.max(1, rounds[0].matches.length);
  // Mexicano crece ronda a ronda: su duración no se deduce del conteo.
  if (modalidad !== "americano") return { courts, mode: "full" };
  return {
    courts,
    mode: rounds.length === fullRotationRounds(playerCount, courts) ? "full" : "short",
  };
}

export function serializeAmericanoDemo(snapshot: AmericanoDemoSnapshot): string {
  return JSON.stringify(snapshot);
}

/** JSON invalido o forma distinta -> null (la demo arranca de cero). */
export function parseAmericanoDemo(text: string): AmericanoDemoSnapshot | null {
  try {
    const value: unknown = JSON.parse(text);
    return validateAmericanoDemoSnapshot(value) ? value : null;
  } catch {
    return null;
  }
}
