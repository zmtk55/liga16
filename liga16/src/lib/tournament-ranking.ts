import type { Match, Team } from "@/types";
import { computePairStatsLiga16, computeJerarquiaLiga16 } from "@/lib/liga16-scoring";
import { withoutWithdrawn } from "@/lib/rank-simulator";
import { isKnockoutRound } from "@/lib/groups";
import { teamCategoryKey } from "@/lib/categories";

export interface TournamentOption {
  id: string;
  name: string;
  /** Parejas inscritas (sin bajas). */
  n: number;
}

/** Torneos en los que hay parejas inscritas, para el selector. */
export function tournamentOptions(teams: Team[]): TournamentOption[] {
  const m = new Map<string, TournamentOption>();
  for (const t of teams) {
    for (const e of t.entries ?? []) {
      const cur = m.get(e.tournament_id) ?? { id: e.tournament_id, name: e.tournament_name, n: 0 };
      if (!e.withdrawn) cur.n += 1;
      m.set(e.tournament_id, cur);
    }
  }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/**
 * Tabla de UN torneo con SUS reglas (scoring.rank_order). Solo fase de grupos,
 * igual que Equipos. Se calcula por categoría. Las bajas cuentan en las estadísticas
 * de los demás pero no aparecen ni ocupan posición. No hay respaldo silencioso:
 * si el torneo no define orden, se usa el orden estándar y así se rotula en la UI.
 */
export function tournamentTeams(teams: Team[], matches: Match[], tournamentId: string): Team[] {
  const members = teams
    .map((t) => ({ t, e: (t.entries ?? []).find((x) => x.tournament_id === tournamentId) }))
    .filter((x): x is { t: Team; e: NonNullable<typeof x.e> } => !!x.e);
  if (!members.length) return [];
  const scoring = members[0].e.scoring;
  const order = scoring?.rank_order?.length ? scoring.rank_order : undefined;
  const tMatches = matches.filter((m) => m.tournament_id === tournamentId && !isKnockoutRound(m.round));
  const withdrawn = new Set(members.filter((x) => x.e.withdrawn).map((x) => x.e.pair_id));
  const byCat = new Map<string, typeof members>();
  for (const x of members) {
    const k = teamCategoryKey(x.t);
    byCat.set(k, [...(byCat.get(k) ?? []), x]);
  }
  const out: Team[] = [];
  for (const group of byCat.values()) {
    const stats = group.map((x, i) => computePairStatsLiga16(x.e.pair_id, i + 1, x.t.name, tMatches));
    const ranked = computeJerarquiaLiga16(stats, order, tMatches);
    const pos = withoutWithdrawn(new Map(ranked.map((s) => [s.pairId, s.JERARQUIA])), withdrawn);
    for (const s of ranked) {
      const x = group.find((g) => g.e.pair_id === s.pairId);
      if (!x || withdrawn.has(s.pairId)) continue;
      out.push({
        ...x.t,
        position: pos.get(s.pairId) ?? 0,
        points: s.RENDIMIENTO_PTS == null ? 0 : Math.round(s.RENDIMIENTO_PTS * 1000) / 10,
        played: s.PJ,
        won: s.PG,
        lost: Math.max(s.PJ - s.PG, 0),
        tied: false,
      });
    }
  }
  return out;
}

/**
 * Parejas contra las que compite `team` en un torneo: las inscritas en él y de su MISMA
 * categoría (igual que /ranking). Incluye bajas, que cuentan en estadísticas pero no ocupan cupo.
 */
export function categoryRoster(teams: Team[], tournamentId: string, team: Team | null | undefined) {
  const key = team ? teamCategoryKey(team) : null;
  const roster: { id: string; name: string }[] = [];
  const withdrawn = new Set<string>();
  for (const t of teams) {
    const e = (t.entries ?? []).find((x) => x.tournament_id === tournamentId);
    if (!e) continue;
    if (key !== null && teamCategoryKey(t) !== key) continue;
    if (e.withdrawn) withdrawn.add(e.pair_id);
    roster.push({ id: e.pair_id, name: t.name });
  }
  return { roster, withdrawn };
}
