import type { Match, Tournament } from "@/types";

const isDecided = (m: Match) => !!m.winner && (m.status === "finished" || m.status === "walkover");

export interface FinishInfo {
  /** Mostrar la acción "Finalizar" para este torneo. */
  canFinish: boolean;
  /** Partidos que siguen sin resultado (no cuentan los cancelados). */
  pending: number;
  /** Partidos con resultado o walkover. */
  decided: number;
}

/**
 * "Finalizar" no depende solo del estado guardado: un torneo que se jugó entero
 * puede haberse quedado en "publicado" o "inscripciones" y entonces no había
 * forma de cerrarlo. Se permite desde esos estados únicamente cuando ya hay
 * partidos y TODOS están resueltos; así no se puede cerrar por error un torneo
 * que aún no empieza. Desde "en juego" siempre se permite (con aviso si falta
 * algún partido). Borrador y cancelado nunca.
 */
export function finishInfo(status: Tournament["status"], matches: Match[]): FinishInfo {
  const live = matches.filter((m) => m.status !== "cancelled");
  const decided = live.filter(isDecided).length;
  const pending = live.length - decided;
  if (status === "in_progress") return { canFinish: true, pending, decided };
  if (status === "published" || status === "registration_open" || status === "registration_closed") {
    return { canFinish: live.length > 0 && pending === 0, pending, decided };
  }
  return { canFinish: false, pending, decided };
}

export function finishWarning(info: FinishInfo): string | null {
  if (info.pending === 0) return null;
  return `Faltan ${info.pending} ${info.pending === 1 ? "partido" : "partidos"} sin resultado. Se conservan tal cual; el torneo se marca como finalizado.`;
}
