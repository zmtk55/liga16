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
