// Agenda del torneo: días, horas y conflictos.
//
// El motivo de que esto viva aquí y no dentro del componente es la zona horaria.
// `scheduled_at` se guarda como instante UTC ("2026-09-26T18:00:00Z") pero una
// persona piensa en hora local: un partido de las 22:00 en CDMX se guarda a las
// 05:00Z del día SIGUIENTE. Comparar el prefijo del string UTC contra el día local
// (lo que hacía `scheduled_at.startsWith(dia)`) esconde ese partido del día que
// de verdad es. Toda comparación de día pasa por `localDayKey`.

export interface AvailabilityConfig {
  /** Días con juego, "YYYY-MM-DD". */
  days: string[];
  /** Horas del día en punto, 0-23. */
  hours: number[];
  /** Canchas a usar; vacío = todas. */
  courtNames: string[];
  minutesPerMatch: number;
}

export interface ScheduleMatch {
  id: string;
  scheduled_at?: string | null;
  court_name?: string | null;
  status?: string | null;
  side_a?: { pair_name?: string | null };
  side_b?: { pair_name?: string | null };
}

/**
 * La rejilla de huecos de un torneo: día → hora → cancha.
 *
 * El orden es el que se ve en pantalla: primero el día, luego la hora, y
 * dentro de la hora las canchas. Cada hueco es único, así que dos partidos
 * nunca caen en el mismo sitio — que es justo lo que pasaba antes.
 */
export function buildSlotGrid(cfg: {
  days: string[];
  hours: number[];
  courtNames: string[];
}): Array<{ court: string; at: string }> {
  const courts = cfg.courtNames.length > 0 ? cfg.courtNames : ["Cancha 1"];
  const hours = [...cfg.hours].sort((a, b) => a - b);
  const days = [...cfg.days].sort();
  const out: Array<{ court: string; at: string }> = [];
  for (const day of days) {
    for (const hour of hours) {
      for (const court of courts) {
        out.push({
          court,
          at: new Date(`${day}T${String(hour).padStart(2, "0")}:00:00`).toISOString(),
        });
      }
    }
  }
  return out;
}

/**
 * Reparte los partidos ya existentes en los huecos de la rejilla.
 *
 * POR JORNADA: la jornada 1 de todas las categorías ocupa los primeros huecos
 * del primer día, la jornada 2 los siguientes, y así. Dentro de una jornada
 * las categorías se alternan, para que un mismo grupo de parejas no juegue
 * seguido.
 *
 * El emparejamiento NO se recalcula: cada partido conserva contra quién
 * juega y, con él, su resultado. Recalcular el round-robin cambiaría las
 * parejas de cada partido y dejarían de valer los resultados ya capturados.
 *
 * Devuelve también cuántos partidos se quedaron sin hueco: si hay más
 * partidos que huecos, mejor decirlo que amontonarlos.
 */
export function assignSlotsToMatches(
  matches: Array<{ id: string; jornada: number; category?: string }>,
  cfg: { days: string[]; hours: number[]; courtNames: string[] },
  reserved: Array<{ scheduled_at: string | null; court_name: string | null }> = [],
): {
  assignments: Array<{ id: string; court: string; at: string }>;
  missing: number;
  slots: number;
} {
  const grid = buildSlotGrid(cfg).filter((slot) => !reserved.some((m) => m.scheduled_at && new Date(m.scheduled_at).getTime() === new Date(slot.at).getTime() && m.court_name === slot.court));

  // Por jornada, y dentro de la jornada las categorías alternadas.
  const byJornada = new Map<number, Map<string, string[]>>();
  for (const m of matches) {
    const cat = m.category ?? "";
    if (!byJornada.has(m.jornada)) byJornada.set(m.jornada, new Map());
    const cats = byJornada.get(m.jornada)!;
    if (!cats.has(cat)) cats.set(cat, []);
    cats.get(cat)!.push(m.id);
  }

  const ordered: string[] = [];
  for (const jornada of [...byJornada.keys()].sort((a, b) => a - b)) {
    const cats = byJornada.get(jornada)!;
    const catNames = [...cats.keys()].sort();
    const depth = Math.max(0, ...catNames.map((c) => cats.get(c)!.length));
    for (let i = 0; i < depth; i++) {
      for (const c of catNames) {
        const id = cats.get(c)![i];
        if (id) ordered.push(id);
      }
    }
  }

  const assignments: Array<{ id: string; court: string; at: string }> = [];
  let s = 0;
  for (const id of ordered) {
    const slot = grid[s++];
    if (!slot) break;
    assignments.push({ id, court: slot.court, at: slot.at });
  }
  return { assignments, missing: Math.max(0, ordered.length - assignments.length), slots: grid.length };
}

/** Días del torneo entre `start_date` y `end_date`, en `YYYY-MM-DD`, tope `cap`. */
export function tournamentDays(
  t: { start_date?: string | null; end_date?: string | null },
  cap = 21,
): string[] {
  const start = t?.start_date;
  if (!start) return [];
  const end = t.end_date || start;
  const days: string[] = [];
  const d = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(last.getTime())) return [];
  while (d <= last && days.length < cap) {
    days.push(dayKeyFromLocalDate(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function dayKeyFromLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Hoy en clave de día local. `toISOString()` devolvería el día UTC. */
export function todayKey(now: Date = new Date()): string {
  return dayKeyFromLocalDate(now);
}

/** Día local ("YYYY-MM-DD") del instante ISO. Nunca el día UTC. */
export function localDayKey(iso: string): string {
  if (!iso) return "";
  // Los "YYYY-MM-DD" a secas son calendario, no instante: no se desplazan.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return dayKeyFromLocalDate(d);
}

/** Hora local "HH:MM" del instante ISO. */
export function localTimeHHMM(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Instante de un partido en el día `day` a las `time` (hora local → UTC). */
export function rescheduleTo(day: string, time: string): string {
  const [h, min] = time.split(":").map((n) => Number(n));
  const d = new Date(`${day}T00:00:00`);
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(min) ? min : 0, 0, 0);
  return d.toISOString();
}

/** Hora "HH:MM" → "19:30" en formato de 24h sin depender del locale. */
export function hhmmToMinutes(time: string): number {
  const [h, m] = time.split(":").map((n) => Number(n));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export interface ScheduleIssue {
  kind: "sin_cancha" | "choque";
  /** Texto corto para el badge. */
  label: string;
  /** Con quién choca (otro id de partido), si aplica. */
  with?: string;
}

/**
 * Problemas que el admin tiene que ver ANTES de capturar: dos partidos en la
 * misma cancha y hora, y partidos sin cancha. Se indexan por id de partido para
 * poder pintar el aviso en la fila.
 */
export function findScheduleIssues(matches: ScheduleMatch[]): Map<string, ScheduleIssue[]> {
  const issues = new Map<string, ScheduleIssue[]>();
  const add = (id: string, issue: ScheduleIssue) => {
    const list = issues.get(id) ?? [];
    list.push(issue);
    issues.set(id, list);
  };
  const bySlot = new Map<string, ScheduleMatch[]>();
  for (const m of matches) {
    if (!m.scheduled_at) continue;
    if (!m.court_name) {
      add(m.id, { kind: "sin_cancha", label: "Sin cancha" });
      continue;
    }
    const key = `${localDayKey(m.scheduled_at)}|${localTimeHHMM(m.scheduled_at)}|${m.court_name}`;
    bySlot.set(key, [...(bySlot.get(key) ?? []), m]);
  }
  for (const group of bySlot.values()) {
    if (group.length < 2) continue;
    for (const m of group) {
      const others = group.filter((o) => o.id !== m.id);
      add(m.id, {
        kind: "choque",
        label: `Choca a las ${localTimeHHMM(m.scheduled_at ?? "")}`,
        with: others.map((o) => o.id).join(","),
      });
    }
  }
  return issues;
}

/** ¿Está libre la cancha `court` el día `day` a las `time`? */
export function isSlotFree(
  matches: ScheduleMatch[],
  slot: { day: string; time: string; court: string; ignoreId?: string },
): boolean {
  return !matches.some(
    (m) =>
      m.id !== slot.ignoreId &&
      !!m.scheduled_at &&
      !!m.court_name &&
      m.court_name === slot.court &&
      localDayKey(m.scheduled_at) === slot.day &&
      localTimeHHMM(m.scheduled_at) === slot.time,
  );
}

/** Horarios libres de una cancha para un día (sugiere el siguiente hueco). */
export function nextFreeTimes(
  matches: ScheduleMatch[],
  slot: { day: string; court: string; ignoreId?: string },
  from = 8,
  to = 22,
  step = 30,
): string[] {
  const out: string[] = [];
  for (let m = from * 60; m <= to * 60; m += step) {
    const time = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    if (isSlotFree(matches, { ...slot, time })) out.push(time);
  }
  return out;
}
