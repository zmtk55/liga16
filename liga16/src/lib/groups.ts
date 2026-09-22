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

const LETTERS = "ABCDEFGHIJ";
