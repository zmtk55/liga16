import type { Match } from "@/types";

/**
 * Duración efectiva de un partido para calcular cruces de cancha.
 *
 * Los partidos viejos no tienen `duration_minutes` (la columna es nueva y no
 * se rellena a lo histórico: decir que todos duraron 60 sería inventar un
 * dato). Para esos se usa `fallbackMinutes` — normalmente el
 * `minutesPerMatch` configurado en el torneo — y la interfaz lo dice.
 */
export function effectiveDurationMinutes(
  match: Pick<Match, "duration_minutes">,
  fallbackMinutes: number,
): number {
  const d = match.duration_minutes;
  return typeof d === "number" && d > 0 ? d : fallbackMinutes;
}
