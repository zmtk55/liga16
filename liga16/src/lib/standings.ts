// Récord y posición de cada pareja, SIEMPRE derivados de los partidos.
//
// Este módulo es el único sitio donde se calcula una tabla de posiciones. Antes
// cada provider lo hacía por su cuenta y se quedaron desincronizados: el de
// Supabase derivaba, el de demo devolvía filas fijas del seed —meter un score no
// movía nada— y los dos ordenaban con reglas distintas. Quien llama pasa el
// roster (ya con división, rama y jugadores resueltos) y la lista de partidos;
// sale el roster con los números ya puestos.
//
// El ORDEN lo decide el % de puntos de la Liga16 (puntos ganados / puntos
// jugados), no el número de victorias: ver liga16-scoring.ts, que replica la
// 4ta edición del Excel. `points` sigue siendo 3 por victoria porque así lo
// muestran las fichas y los comparadores, pero no manda en el orden.
import { computeJerarquiaLiga16, computePairStatsLiga16 } from "./liga16-scoring";
import { DIVISION_ORDER } from "./categories";
import type { Match, Team } from "@/types";

/** Las parejas sin partidos (posición 0) van al final de su grupo. */
const rankOf = (t: Team) => (t.position === 0 ? Number.MAX_SAFE_INTEGER : t.position);

/**
 * Devuelve el mismo roster con `played`, `won`, `lost`, `sets_for`,
 * `sets_against`, `points`, `rendimiento_pct` y `position` recalculados desde
 * `matches`, ordenado por división → rama → posición.
 *
 * Las parejas se reconocen por `id` de lado o, si no hay, por nombre: los
 * partidos guardados a mano no siempre traen `pair_id`.
 */
export function deriveTeamStandings(teams: Team[], matches: Match[]): Team[] {
  // El ranking solo significa algo dentro de una división + rama (ver
  // groupByDivision), así que el cálculo se corre por grupo y no sobre la lista
  // completa mezclada.
  const byId = new Map(teams.map((t) => [t.id, t]));
  const groups = new Map<string, Team[]>();

  for (const t of teams) {
    const key = `${t.division}|${t.sex}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  for (const list of groups.values()) {
    const stats = list.map((t, i) => computePairStatsLiga16(t.id, i + 1, t.name, matches));
    for (const s of computeJerarquiaLiga16(stats)) {
      const t = byId.get(s.pairId);
      if (!t) continue;
      t.played = s.PJ;
      t.won = s.PG;
      t.lost = s.PJ - s.PG;
      t.sets_for = s.SETS_FAVOR;
      t.sets_against = s.SETS_CONTRA;
      t.points = s.PG * 3;
      t.rendimiento_pct = s.RENDIMIENTO_PTS == null ? null : Math.round(s.RENDIMIENTO_PTS * 1000) / 10;
      t.position = s.JERARQUIA;
    }
  }

  return [...teams].sort(
    (a, b) =>
      DIVISION_ORDER.indexOf(a.division) - DIVISION_ORDER.indexOf(b.division) ||
      a.sex.localeCompare(b.sex) ||
      rankOf(a) - rankOf(b),
  );
}