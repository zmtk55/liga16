/**
 * Bracket de eliminación simple, con siembra clásica.
 *
 * "Clásico de los deportes": el primero se planta arriba y el último cae
 * contra él; los dos primeros quedan en mitades opuestas para que no puedan
 * cruzarse hasta la final.
 *
 * Todo puro y sin dependencias: el mismo motor sirve para sortear, para mover
 * una pareja de posición y para volver a generar cuando cambian los puntos.
 */

/** Posición de siembra dentro del bracket de `size` (potencia de 2). */
export type SeedPosition = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Cuántas parejas entran a un bracket con esta semilla. */
export function bracketSizeFor(qualified: number): 2 | 4 | 8 | 16 | 32 | 64 {
  if (qualified <= 2) return 2;
  if (qualified <= 4) return 4;
  if (qualified <= 8) return 8;
  if (qualified <= 16) return 16;
  if (qualified <= 32) return 32;
  return 64;
}

/**
 * Orden clásico de siembra para `size` parejas.
 * size=4 -> [1,4,2,3] · size=8 -> [1,8,4,5,2,7,3,6]
 */
export function seedOrder(size: 2 | 4 | 8 | 16 | 32 | 64): number[] {
  let order = [1, 2];
  for (let round = 1; round < Math.log2(size); round++) {
    const sum = 2 ** (round + 1) + 1;
    const next: number[] = [];
    for (const seed of order) {
      next.push(seed, sum - seed);
    }
    order = next;
  }
  return order;
}

export interface BracketEntry {
  seed: number;
  name: string;
  points: number;
  pairId: string;
}

export interface BracketMatch {
  id: string;
  round: number;
  /** Posiciones 1-based del bracket que se enfrentan en esta ronda. */
  slots: [number, number];
  /** Rondas > 1: partidos de la ronda anterior de los que sale cada lado. */
  sourceIds?: [string, string];
  a: BracketEntry | null;
  b: BracketEntry | null;
  /** Ya hay resultado capturado para este cruce. */
  played?: boolean;
}

export interface Bracket {
  size: 2 | 4 | 8 | 16 | 32 | 64;
  rounds: number;
  matches: BracketMatch[];
  /** Posiciones vacías (bye): no hay pareja con esa semilla. */
  byes: number[];
}

/**
 * Genera el bracket desde las parejas ya clasificadas, en orden de puntos.
 * La lista DEBE venir ordenada: la posición 1 es la que se planta.
 */
export function buildBracket(qualified: BracketEntry[]): Bracket {
  const size: 2 | 4 | 8 | 16 | 32 | 64 = bracketSizeFor(qualified.length);
  const rounds = Math.log2(size);
  const order = seedOrder(size);
  const bySeed = new Map(qualified.map((q, i) => [i + 1, q]));

  // Posición del bracket -> semilla
  const placed = order.map((seed) => bySeed.get(seed) ?? null);
  const byes = order
    .map((seed, pos) => ({ seed, pos: pos + 1 }))
    .filter(({ seed }) => !bySeed.has(seed))
    .map(({ pos }) => pos);

  const matches: BracketMatch[] = [];
  let slotsInRound: number = size;
  let prevIds: string[] = [];
  for (let round = 1; round <= rounds; round++) {
    const count = slotsInRound / 2;
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const id = `r${round}-m${i + 1}`;
      ids.push(id);
      if (round === 1) {
        const slotA = i * 2 + 1;
        const slotB = i * 2 + 2;
        matches.push({
          id,
          round,
          slots: [slotA, slotB],
          a: placed[slotA - 1] ?? null,
          b: placed[slotB - 1] ?? null,
        });
      } else {
        const pos = (i - 1) * 2 + 1;
        const srcA = `r${round - 1}-m${i + 1}`;
        const srcB = `r${round - 1}-m${i + 2}`;
        matches.push({
          id,
          round,
          slots: [pos, pos + 1],
          sourceIds: [srcA, srcB],
          a: null,
          b: null,
        });
      }
    }
    prevIds = ids;
    slotsInRound = count;
  }
  void prevIds;
  return { size, rounds, matches, byes };
}
/**
 * Resuelve el bracket con los resultados reales: el ganador de cada cruce pasa
 * a la ronda siguiente. No guarda nada, solo propaga.
 *
 * `winnerOf` recibe las dos parejas de un cruce y devuelve el id del ganador, o
 * null si ese partido aún no se capturó. Se inyecta para que este módulo no
 * sepa nada de la base de datos.
 */
export function resolveBracket(
  bracket: Bracket,
  winnerOf: (a: BracketEntry, b: BracketEntry) => string | null,
): BracketMatch[] {
  const byPairId = new Map<string, BracketEntry>();
  for (const m of bracket.matches) {
    for (const e of [m.a, m.b]) if (e) byPairId.set(e.pairId, e);
  }
  const winners = new Map<string, string | null>();
  const resolved: BracketMatch[] = [];

  for (const m of bracket.matches) {
    if (m.round === 1) {
      let winner: string | null = null;
      let played = false;
      if (m.a && m.b) {
        winner = winnerOf(m.a, m.b);
        played = winner !== null;
      }
      winners.set(m.id, winner);
      resolved.push({ ...m, played });
      continue;
    }
    const [srcA, srcB] = m.sourceIds ?? ["", ""];
    const idA = winners.get(srcA) ?? null;
    const idB = winners.get(srcB) ?? null;
    winners.set(m.id, null); // el ganador de esta ronda aún no existe
    resolved.push({
      ...m,
      a: idA ? byPairId.get(idA) ?? null : null,
      b: idB ? byPairId.get(idB) ?? null : null,
      played: Boolean(idA && idB),
    });
  }
  return resolved;
}

/**
 * Intercambia dos siembra y recalcula el bracket.
 * El admin puede mover una pareja y el orden clásico se rehace solo.
 */
export function moveSeed(qualified: BracketEntry[], fromSeed: number, toSeed: number): BracketEntry[] {
  const list = [...qualified];
  const a = list.findIndex((q) => q.seed === fromSeed);
  const b = list.findIndex((q) => q.seed === toSeed);
  if (a === -1 || b === -1) return qualified;
  const tmp = list[a];
  list[a] = { ...list[b], seed: fromSeed };
  list[b] = { ...tmp, seed: toSeed };
  return list;
}
