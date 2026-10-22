// Liga16 — utilidades del sistema de grupos de un torneo
import type { Match, UUID, TournamentScoring } from "@/types";
import { computePairStatsLiga16, computeJerarquiaLiga16 } from "@/lib/liga16-scoring";

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
  /** Nombre del grupo ya asignado (para preservar sorteos previos). */
  groupName?: string;
}

/**
 * Sorteo por categoría — la regla del sistema: una categoría es una competencia
 * aparte, así que un grupo NUNCA mezcla 4tas con 5tas. Cada grupo se arma solo
 * con parejas de su categoría, con el mismo reparto parejo.
 *
 * `groupCount` es opcional: si el admin quiere un número de grupos distinto al
 * sugerido (1 por cada 4 parejas) lo pasa por aquí. Si no, se usa
 * `suggestGroupCount`.
 */
export function drawGroupsByCategory(
  pairs: DrawablePair[],
  groupCount?: (catPairs: DrawablePair[]) => number,
  preserveAssignments?: boolean,
): Group[] {
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
    const nGroups = groupCount ? groupCount(catPairs) : suggestGroupCount(catPairs.length);
    for (let i = 0; names.length < nGroups && i < LETTERS.length; i++) {
      const name = base(LETTERS[i]);
      if (taken.has(name)) continue;
      names.push(name);
    }
    if (names.length === 0) continue;
    names.forEach((n) => taken.add(n));

    const catGroups: Group[] = names.map((name) => ({ name, pairIds: [] }));

    if (preserveAssignments) {
      // Las parejas ya asignadas conservan su grupo; sólo se reparten las
      // parejas libres entre los grupos que aún tienen cupo.
      const assigned = catPairs.filter((p) => p.groupName);
      const free = catPairs.filter((p) => !p.groupName);
      for (const p of assigned) {
        const g = catGroups.find((x) => x.name === p.groupName);
        if (g) g.pairIds.push(p.id);
      }
      shuffle(free).forEach((p, i) => {
        catGroups[i % catGroups.length].pairIds.push(p.id);
      });
    } else {
      shuffle(catPairs).forEach((p, i) => {
        catGroups[i % catGroups.length].pairIds.push(p.id);
      });
    }
    out.push(...catGroups);
  }
  return out;
}

/**
 * "4ta Varonil · Grupo A · J2" -> { group: "4ta Varonil · Grupo A", jornada: 2 }.
 *
 * El nombre del grupo puede llevar la categoría delante, así que se parte por la
 * ETIQUETA de jornada al final, no por el primer separador.
 */
export function parseRound(round: string): { group: string; jornada: number | null } {
  const match = /^(.*?)(?:\s*·\s*J(\d+))?$/.exec(round.trim());
  const group = (match?.[1] ?? round).trim();
  return { group, jornada: match?.[2] ? Number(match[2]) : null };
}

/**
 * La jornada de un partido como clave de filtro: "J1", "J2"… o "all" si el
 * round no trae número de jornada.
 *
 * El round completo lleva la categoría y el grupo ("Sexta femenina · Grupo A ·
 * J1") porque es lo que distingue un grupo de otro dentro de la categoría. Para
 * filtrar, la jornada es el número de ronda dentro del grupo: ofrecer el round
 * entero como opción daba 20 opciones redundantes con el filtro de categoría.
 */
export function jornadaKey(round: string | null | undefined): string {
  const j = parseRound(round ?? "").jornada;
  return j ? `J${j}` : "all";
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
 * Tabla de posiciones de la Liga16.
 *
 * Sólo hay un criterio: el % de puntos (pts_favor / pts_total) con RANK
 *1, 1, 3) estilo Excel, el de la 4ta edición. Antes esta función aceptaba
 * `ranking_method: 'match_points'` (3 puntos por victoria) y venía siendo el
 * default, de modo que el detalle de torneo ordenaba por victorias mientras el
 * ranking global ordenaba por porcentaje: dos reglas para lo mismo.
 * `ranking_method` sigue en el tipo porque es una columna de la BD, pero ya no
 * cambia el cálculo.
 */
export function computeStandings(
  pairIds: UUID[],
  matches: Match[],
  pairNameById: Record<string, string>,
  _scoring?: TournamentScoring,
): StandingRow[] {
  // Reglas únicas Liga16: derivar de partidos con ganador + puntos (no status crudo)
  const stats = pairIds.map((id, i) =>
    computePairStatsLiga16(id, i + 1, pairNameById[id] ?? "", matches),
  );
  const ranked = computeJerarquiaLiga16(stats);
  return ranked.map((s) => ({
    pairId: s.pairId,
    played: s.PJ,
    won: s.PG,
    lost: s.PJ - s.PG,
    setsFor: s.SETS_FAVOR,
    setsAgainst: s.SETS_CONTRA,
    // Juegos ganados y perdidos: los del Excel (PUNTOS_A_FAVOR y lo que
    // sobró del total). Antes venían en 0, así que en la tabla del admin la
    // columna "%PTS" salía siempre "—" (dividía 0/0) y "Juegos G/P" siempre 0,
    // y el orden del bracket se resolvía por nombre de pareja.
    gamesFor: s.PUNTOS_A_FAVOR,
    gamesAgainst: Math.max(s.PUNTOS_TOTALES - s.PUNTOS_A_FAVOR, 0),
    points: s.RENDIMIENTO_PTS ? Math.round(s.RENDIMIENTO_PTS * 1000) / 10 : 0,
    form: [], // El form requiere historial por partido; se conserva vacío si no se usa directamente
    pointsFor: s.PUNTOS_A_FAVOR,
    pointsTotal: s.PUNTOS_TOTALES,
    pointsPercentage: s.RENDIMIENTO_PTS,
    jerarquia: s.JERARQUIA ?? 0,
  }));
}

const LETTERS = "ABCDEFGHIJ";
