// Liga16 — utilidades del sistema de grupos de un torneo
import type { Match, UUID } from "@/types";

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

/**
 * Sorteo aleatorio: reparte parejas en n grupos lo más parejos posible.
 */
export function drawGroups(pairIds: UUID[], groupCount: number): Group[] {
  const n = Math.max(1, Math.min(groupCount, pairIds.length || 1));
  const shuffled = shuffle(pairIds);
  const groups: Group[] = Array.from({ length: n }, (_, i) => ({
    name: `Grupo ${LETTERS[i]}`,
    pairIds: [],
  }));
  shuffled.forEach((id, i) => {
    groups[i % n].pairIds.push(id);
  });
  return groups;
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
}

/**
 * Tabla de posiciones de un grupo calculada desde los partidos terminados.
 * Orden: puntos (3 por victoria de partido), diferencia de sets, sets ganados.
 */
export function computeStandings(
  pairIds: UUID[],
  matches: Match[],
  pairNameById: Record<string, string>,
): StandingRow[] {
  const rows = new Map<UUID, StandingRow>();
  pairIds.forEach((id) =>
    rows.set(id, { pairId: id, played: 0, won: 0, lost: 0, setsFor: 0, setsAgainst: 0, gamesFor: 0, gamesAgainst: 0, points: 0, form: [] }),
  );

  // Los terminados en orden de fecha para armar la forma (últimos 5)
  const finished = matches
    .filter((m) => m.status === "finished" && m.winner)
    .sort((x, y) => String(x.scheduled_at).localeCompare(String(y.scheduled_at)));

  for (const m of finished) {
    const a = m.side_a.pair_id;
    const b = m.side_b.pair_id;
    if (!a || !b || !rows.has(a) || !rows.has(b)) continue;
    const rowA = rows.get(a)!;
    const rowB = rows.get(b)!;
    rowA.played++;
    rowB.played++;
    for (const s of m.sets) {
      rowA.setsFor += s.a;
      rowA.setsAgainst += s.b;
      rowA.gamesFor += s.a;
      rowA.gamesAgainst += s.b;
      rowB.setsFor += s.b;
      rowB.setsAgainst += s.a;
      rowB.gamesFor += s.b;
      rowB.gamesAgainst += s.a;
    }
    if (m.winner === "a") {
      rowA.won++;
      rowA.points += 3;
      rowA.form.push("G");
      rowB.lost++;
      rowB.form.push("P");
    } else {
      rowB.won++;
      rowB.points += 3;
      rowB.form.push("G");
      rowA.lost++;
      rowA.form.push("P");
    }
  }

  rows.forEach((r) => {
    r.form = r.form.slice(-5);
  });

  return [...rows.values()].sort(
    (x, y) =>
      y.points - x.points ||
      y.setsFor - y.setsAgainst - (x.setsFor - x.setsAgainst) ||
      y.setsFor - x.setsFor ||
      (pairNameById[x.pairId] ?? "").localeCompare(pairNameById[y.pairId] ?? ""),
  );
}

const LETTERS = "ABCDEFGHIJ";
