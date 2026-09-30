// Liga16 — utilidades del sistema de grupos de un torneo
import type { Match, UUID, TournamentScoring } from "@/types";

export interface Group {
  name: string; // "Grupo A", "Grupo B"…
  pairIds: UUID[];
}

/** Fisher-Yates: baraja aleatoria. */
export function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Una pareja con la categoría que compite, suficiente para sortear. */
export interface DrawablePair {
  id: UUID;
  category_id: UUID | null;
  /** Nombre de la categoría; vacío si la pareja no tiene ninguna asignada. */
  categoryName: string;
}

/**
 * Sorteo por categoría — la regla del sistema: una categoría es una competencia
 * aparte, así que un grupo NUNCA mezcla 4tas con 5tas. Cada grupo se arma solo
 * con parejas de su categoría, con el mismo reparto parejo.
 *
 * Con más de una categoría en juego el nombre lleva la delante ("4ta Masculino ·
 * Grupo A"): dos "Grupo A" de categorías distintas tienen que poder convivir sin
 * que el admin los confunda al leerlos.
 */
export function drawGroupsByCategory(pairs: DrawablePair[]): Group[] {
  const byCategory = new Map<string, DrawablePair[]>();
  for (const p of pairs) {
    const key = p.categoryName;
    byCategory.set(key, [...(byCategory.get(key) ?? []), p]);
  }
  const multiCategory = byCategory.size > 1;
  const taken = new Set<string>();
  const out: Group[] = [];

  for (const [categoryName, catPairs] of byCategory) {
    const base = (letter: string) =>
      multiCategory && categoryName ? `${categoryName} · Grupo ${letter}` : `Grupo ${letter}`;
    // Un nombre de grupo no puede repetirse dentro del torneo.
    const names: string[] = [];
    for (let i = 0; names.length < suggestGroupCount(catPairs.length) && i < LETTERS.length; i++) {
      const name = base(LETTERS[i]);
      if (taken.has(name)) continue;
      names.push(name);
    }
    if (names.length === 0) continue;
    names.forEach((n) => taken.add(n));

    const catGroups: Group[] = names.map((name) => ({ name, pairIds: [] }));
    shuffle(catPairs).forEach((p, i) => {
      catGroups[i % catGroups.length].pairIds.push(p.id);
    });
    out.push(...catGroups);
  }
  return out;
}

/**
 * "4ta Masculino · Grupo A · J2" -> { group: "4ta Masculino · Grupo A", jornada: 2 }.
 *
 * El nombre del grupo puede llevar la categoría delante, así que se parte por la
 * ETIQUETA de jornada al final, no por el primer separador.
 */
export function parseRound(round: string): { group: string; jornada: number | null } {
  const match = /^(.*?)(?:\s*·\s*J(\d+))?$/.exec(round.trim());
  const group = (match?.[1] ?? round).trim();
  return { group, jornada: match?.[2] ? Number(match[2]) : null };
}

/** Sugerencia de número de grupos: 1 grupo por cada 4 parejas, mínimo 1. */
export function suggestGroupCount(pairCount: number): number {
  if (pairCount <= 4) return 1;
  return Math.max(2, Math.round(pairCount / 4));
}

/**
 * Genera el round-robin de un grupo (todos contra todos).
 * Usa el método del círculo para el orden de jornadas.
 */
export function roundRobinRounds(pairIds: UUID[]): Array<Array<[UUID, UUID]>> {
  const ids = [...pairIds];
  if (ids.length < 2) return [];
  if (ids.length % 2 !== 0) ids.push("__BYE__");
  const rounds: Array<Array<[UUID, UUID]>> = [];
  const n = ids.length;
  for (let r = 0; r < n - 1; r++) {
    const round: Array<[UUID, UUID]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i];
      const b = ids[n - 1 - i];
      if (a !== "__BYE__" && b !== "__BYE__") round.push([a, b]);
    }
    rounds.push(round);
    // rotar (método del círculo)
    const fixed = ids[0];
    const rest = ids.slice(1);
    rest.unshift(rest.pop()!);
    ids.splice(0, ids.length, fixed, ...rest);
  }
  return rounds;
}

/** Turnos por jornada según número de canchas disponibles. */
export function scheduleRounds(
  pairIds: UUID[],
  courts: number,
  startDate: string,
  minutesPerMatch: number,
  startHour: number,
): Array<Array<{ a: UUID; b: UUID; court: number; scheduled_at: string }>> {
  const rounds = roundRobinRounds(pairIds);
  let slot = 0;
  return rounds.map((round) => {
    const matches = round.map(([a, b], i) => {
      const courtCount = Math.max(1, courts);
      const court = i % courtCount;
      const slotIndex = Math.floor(i / courtCount);
      const at = new Date(`${startDate}T00:00:00`);
      at.setMinutes(at.getMinutes() + slot * minutesPerMatch + slotIndex * minutesPerMatch + startHour * 60);
      return { a, b, court: court + 1, scheduled_at: at.toISOString() };
    });
    const usedTurns = Math.ceil(round.length / Math.max(1, courts));
    slot += Math.max(1, usedTurns);
    return matches;
  });
}

export function matchIsBetween(m: Match, a: UUID, b: UUID) {
  return (
    (m.side_a.pair_id === a && m.side_b.pair_id === b) ||
    (m.side_a.pair_id === b && m.side_b.pair_id === a)
  );
}

export interface AvailabilityConfig {
  /** Fechas YYYY-MM-DD en las que hay juego. */
  days: string[];
  /** Horas de inicio permitidas (0–23). */
  hours: number[];
  /** Nombres de canchas disponibles, en orden. */
  courtNames: string[];
  minutesPerMatch: number;
}

/**
 * Round-robin por grupo respetando disponibilidad real:
 * solo agenda en los días/horas marcados y reparte por cancha.
 * Devuelve partidos planos con cancha y fecha/hora asignadas.
 */
export function scheduleWithAvailability(
  pairIds: UUID[],
  cfg: AvailabilityConfig,
): Array<{ a: UUID; b: UUID; court: string; scheduled_at: string }> {
  const rounds = roundRobinRounds(pairIds);
  const courtNames = cfg.courtNames.length > 0 ? cfg.courtNames : ["Cancha 1"];
  const hours = [...cfg.hours].sort((x, y) => x - y);
  const days = [...cfg.days].sort();
  if (hours.length === 0 || days.length === 0) return rounds.flat().map(([a, b]) => ({ a, b, court: courtNames[0], scheduled_at: new Date().toISOString() }));

  // Slots disponibles en orden: día → hora → cancha
  const slots: Array<{ court: string; at: Date }> = [];
  for (const day of days) {
    for (const hour of hours) {
      for (const court of courtNames) {
        slots.push({ court, at: new Date(`${day}T${String(hour).padStart(2, "0")}:00:00`) });
      }
    }
  }

  const out: Array<{ a: UUID; b: UUID; court: string; scheduled_at: string }> = [];
  let s = 0;
  for (const round of rounds) {
    for (const [a, b] of round) {
      if (s >= slots.length) {
        // Sin disponibilidad suficiente: agenda restante al final del último día
        const last = slots[slots.length - 1];
        const at = new Date(last.at.getTime() + (s - slots.length + 1) * cfg.minutesPerMatch * 60000);
        out.push({ a, b, court: last.court, scheduled_at: at.toISOString() });
        s++;
        continue;
      }
      const slot = slots[s];
      out.push({ a, b, court: slot.court, scheduled_at: slot.at.toISOString() });
      s++;
    }
  }
  return out;
}

export interface StandingRow {
  pairId: UUID;
  played: number;
  won: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  gamesFor: number;
  gamesAgainst: number;
  points: number;
  /** Últimos 5 resultados: 'G' victoria, 'P' derrota (más reciente al final). */
  form: Array<"G" | "P">;
  /** Para ranking_method = 'points_percentage' (Liga16) */
  pointsFor?: number;
  pointsTotal?: number;
  /** `null` cuando el jugador no tiene puntos disputables; el ordenamiento lo trata aparte. */
  pointsPercentage?: number | null;
  /** Posición estilo Excel RANK (1,1,3...) para points_percentage */
  jerarquia?: number;
}

/**
 * Tabla de posiciones unificada configurable por TournamentScoring.
 * - ranking_method = 'match_points' (default): 3 pts/win, desempate por sets/games
 * - ranking_method = 'points_percentage' (Liga16): % puntos (pts_favor/pts_total), RANK estilo Excel
 */
export function computeStandings(
  pairIds: UUID[],
  matches: Match[],
  pairNameById: Record<string, string>,
  scoring?: TournamentScoring,
): StandingRow[] {
  const rankingMethod = scoring?.ranking_method ?? 'match_points';

  const rows = new Map<UUID, StandingRow>();
  pairIds.forEach((id) =>
    rows.set(id, { pairId: id, played: 0, won: 0, lost: 0, setsFor: 0, setsAgainst: 0, gamesFor: 0, gamesAgainst: 0, points: 0, form: [], pointsFor: 0, pointsTotal: 0, pointsPercentage: 0, jerarquia: 0 }),
  );

  const finished = matches
    .filter((m) => m.status === "finished" && m.winner)
    .sort((x, y) => String(x.scheduled_at).localeCompare(String(y.scheduled_at)));

  const nameToId = new Map<string, UUID>();
  pairIds.forEach((id) => {
    const n = (pairNameById[id] ?? "").trim().toLowerCase();
    if (n) nameToId.set(n, id);
  });
  const resolve = (side: { pair_id: UUID | null; pair_name: string | null }): UUID | null =>
    side.pair_id && rows.has(side.pair_id)
      ? side.pair_id
      : nameToId.get((side.pair_name ?? "").trim().toLowerCase()) ?? null;

  for (const m of finished) {
    const a = resolve(m.side_a);
    const b = resolve(m.side_b);
    if (!a || !b || a === b) continue;
    const rowA = rows.get(a)!;
    const rowB = rows.get(b)!;
    rowA.played++;
    rowB.played++;

    // sumar juegos/sets de ESTE match
    let matchGamesForA = 0;
    let matchGamesForB = 0;
    for (const s of m.sets) {
      rowA.setsFor += s.a;
      rowA.setsAgainst += s.b;
      rowA.gamesFor += s.a;
      rowA.gamesAgainst += s.b;
      rowB.setsFor += s.b;
      rowB.setsAgainst += s.a;
      rowB.gamesFor += s.b;
      rowB.gamesAgainst += s.a;
      matchGamesForA += s.a;
      matchGamesForB += s.b;
    }

    const aWon = m.winner === "a";
    if (aWon) {
      rowA.won++;
      rowB.lost++;
      rowA.form.push("G");
      rowB.form.push("P");
    } else {
      rowB.won++;
      rowA.lost++;
      rowB.form.push("G");
      rowA.form.push("P");
    }

    if (rankingMethod === 'match_points') {
      rowA.points += aWon ? 3 : 0;
      rowB.points += aWon ? 0 : 3;
    } else {
      // points_percentage (Liga16): sumar solo los juegos DE ESTE match
      rowA.pointsFor = (rowA.pointsFor ?? 0) + matchGamesForA;
      rowA.pointsTotal = (rowA.pointsTotal ?? 0) + matchGamesForA + matchGamesForB;
      rowB.pointsFor = (rowB.pointsFor ?? 0) + matchGamesForB;
      rowB.pointsTotal = (rowB.pointsTotal ?? 0) + matchGamesForA + matchGamesForB;
    }
  }

  rows.forEach((r) => {
    r.form = r.form.slice(-5);
    if (rankingMethod === 'points_percentage') {
      r.pointsPercentage = r.pointsTotal && r.pointsTotal > 0 ? r.pointsFor! / r.pointsTotal! : null;
      // points se usa para sort descendente
      r.points = r.pointsPercentage ? Math.round(r.pointsPercentage * 10000) : 0;
    }
  });

  let result = [...rows.values()];

  if (rankingMethod === 'points_percentage') {
    // Liga16: ordenar por % puntos descendente, RANK estilo Excel (1,1,3...)
    const withPct = result.filter((r) => r.pointsPercentage !== null && r.pointsPercentage !== undefined);
    const withoutPct = result.filter((r) => r.pointsPercentage === null || r.pointsPercentage === undefined);
    withPct.sort((x, y) => (y.pointsPercentage ?? 0) - (x.pointsPercentage ?? 0));
    for (const r of withPct) {
      const higher = withPct.filter((o) => (o.pointsPercentage ?? 0) > (r.pointsPercentage ?? 0)).length;
      r.jerarquia = 1 + higher;
    }
    for (const r of withoutPct) {
      r.jerarquia = 0;
    }
    result = [...withPct.sort((a, b) => a.jerarquia! - b.jerarquia!), ...withoutPct];
  } else {
    // match_points: ordenar por puntos, diff sets, sets ganados
    result.sort(
      (x, y) =>
        y.points - x.points ||
        y.setsFor - y.setsAgainst - (x.setsFor - x.setsAgainst) ||
        y.setsFor - x.setsFor ||
        (pairNameById[x.pairId] ?? "").localeCompare(pairNameById[y.pairId] ?? ""),
    );
  }

  return result;
}

const LETTERS = "ABCDEFGHIJ";
