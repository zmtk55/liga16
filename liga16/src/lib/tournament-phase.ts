// Fase real de un torneo para el Panel.
//
// El campo `status` lo cambia un organizador a mano y se queda atrás: un torneo
// puede seguir en "published" semanas después de empezar. El Panel contaba solo
// por `status`, así que con un torneo jugándose decía "Sin torneos en juego".
// Aquí el estado manda cuando es terminal o explícito, y las fechas deciden el
// resto.
import type { Tournament } from "@/types";

type PhaseInput = Pick<Tournament, "status" | "start_date" | "end_date" | "registration_deadline">;

/** AAAA-MM-DD en la zona horaria local (las fechas del torneo no llevan hora). */
export function localYmd(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

const day = (v: string | null | undefined) => (v ?? "").slice(0, 10);

/** "running": se está jugando; "signup": acepta inscripciones; "other": ninguna. */
export function tournamentPhase(t: PhaseInput, now: Date = new Date()): "running" | "signup" | "other" {
  if (t.status === "finished" || t.status === "cancelled" || t.status === "draft") return "other";
  if (t.status === "in_progress") return "running";
  const today = localYmd(now);
  const start = day(t.start_date);
  const end = day(t.end_date);
  if (start && end && start <= today && today <= end) return "running";
  const deadline = day(t.registration_deadline);
  if (t.status === "registration_open") return deadline && deadline < today ? "other" : "signup";
  if (t.status === "published" && deadline && deadline >= today && (!start || today < start)) return "signup";
  return "other";
}
