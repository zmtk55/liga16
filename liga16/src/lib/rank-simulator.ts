/**
 * Simulador de resultados hipotéticos: aplica un partido que aún no se juega a
 * la lista real de partidos y vuelve a correr el ranking con el orden dado. No
 * cambia etiquetas: recalcula posiciones.
 *
 * Marcadores posibles: se enumeran los que acepta `validateLiga16Match` dentro
 * de un tope (sets 0..7, super tie-break hasta TB_CAP). Un super tie-break real
 * puede alargarse más (12-10, 13-11...): por eso `exhaustive` es false y las
 * conclusiones valen para el espacio enumerado, no como garantía matemática.
 */
import {
  computeJerarquiaLiga16,
  computePairStatsLiga16,
  DEFAULT_RANK_ORDER,
  determineMatchWinnerLiga16,
  validateLiga16Match,
  type RankCriterion,
} from "@/lib/liga16-scoring";
import { determineMatchWinner, determineSetWinner, normalizeScoring, validateScoring } from "@/lib/scoring";
import type { Match, SetScore, TournamentScoring } from "@/types";

export const TB_CAP = 15;

export interface Roster {
  id: string;
  name: string;
}

export interface SimulatedPlay {
  sets: SetScore[];
  winner: "a" | "b";
}

/** Todos los marcadores válidos (en el espacio acotado) cuyo ganador es `winner`. */
export function enumerateScores(winner: "a" | "b"): SimulatedPlay[] {
  const out: SimulatedPlay[] = [];
  const games = Array.from({ length: 8 }, (_, i) => i);
  const tbs: Array<number | null> = [null];
  for (let x = 0; x <= TB_CAP; x++) tbs.push(x);
  for (const a1 of games) for (const b1 of games) for (const a2 of games) for (const b2 of games) {
    for (const ta of tbs) {
      for (const tb of ta === null ? [null] : tbs) {
        if ((ta === null) !== (tb === null)) continue;
        const l = {
          set1: { a: a1, b: b1 },
          set2: { a: a2, b: b2 },
          tiebreak: ta === null || tb === null ? null : { a: ta, b: tb },
        };
        if (validateLiga16Match(l) !== null) continue;
        if (determineMatchWinnerLiga16(l) !== winner) continue;
        const sets: SetScore[] = [{ a: a1, b: b1 }, { a: a2, b: b2 }];
        if (l.tiebreak) sets.push({ a: 0, b: 0, tiebreak_a: l.tiebreak.a, tiebreak_b: l.tiebreak.b });
        out.push({ sets, winner });
      }
    }
  }
  return out;
}

/**
 * Marcadores posibles según el FORMATO del torneo (sets_to_win, juegos por set,
 * tie-break), validados con las mismas funciones que la captura de resultados.
 * Se agrupan por lo que mueve el ranking (ganador, sets y juegos de cada lado),
 * así que dos marcadores con las mismas cifras cuentan como uno.
 */
export function enumerateScoresForFormat(winner: "a" | "b", scoring: TournamentScoring): SimulatedPlay[] {
  const cfg = normalizeScoring(scoring);
  const maxSets = cfg.sets_to_win * 2 - 1;
  const pool: SetScore[] = [];
  for (let a = 0; a <= TB_CAP; a++) {
    for (let b = 0; b <= TB_CAP; b++) {
      // 6-6 sin ganador no es un set terminado; un set decidido en tie-break
      // se guarda como 7-6, y los puntos del tie-break no mueven el ranking.
      const set: SetScore = { a, b };
      if (a === cfg.tie_break_at && b === cfg.tie_break_at) continue;
      if (determineSetWinner(set, cfg) && validateScoring([set], cfg) === null) pool.push(set);
    }
  }
  const seen = new Map<string, SimulatedPlay>();
  const walk = (acc: SetScore[]) => {
    const w = determineMatchWinner(acc, cfg);
    if (w) {
      if (w === winner && validateScoring(acc, cfg) === null) {
        const g = acc.reduce((t, x) => ({ a: t.a + x.a, b: t.b + x.b }), { a: 0, b: 0 });
        const key = `${acc.map((x) => (determineSetWinner(x, cfg) === "a" ? "a" : "b")).join("")}|${g.a}-${g.b}`;
        if (!seen.has(key)) seen.set(key, { sets: acc, winner });
      }
      return;
    }
    if (acc.length >= maxSets) return;
    for (const st of pool) walk([...acc, st]);
  };
  walk([]);
  return [...seen.values()];
}

export function rankPositions(
  roster: Roster[],
  matches: Match[],
  order: RankCriterion[] = DEFAULT_RANK_ORDER,
  withdrawn?: ReadonlySet<string>,
): Map<string, number> {
  const stats = roster.map((p, i) => computePairStatsLiga16(p.id, i + 1, p.name, matches));
  const ranked = computeJerarquiaLiga16(stats, order, matches);
  const pos = new Map(ranked.map((s) => [s.pairId, s.JERARQUIA]));
  return withdrawn?.size ? withoutWithdrawn(pos, withdrawn) : pos;
}

/**
 * Las bajas no ocupan cupo: sus resultados ya cuentan en las estadísticas de todos,
 * pero la posición se recalcula solo entre las parejas que siguen (1 + cuántas van por delante).
 * Las bajas salen del mapa.
 */
export function withoutWithdrawn(pos: Map<string, number>, withdrawn: ReadonlySet<string>): Map<string, number> {
  const live = [...pos].filter(([id]) => !withdrawn.has(id));
  return new Map(
    live.map(([id, p]) => [id, p > 0 ? 1 + live.filter(([, q]) => q > 0 && q < p).length : 0]),
  );
}

const fake = (a: Roster, b: Roster, play: SimulatedPlay): Match =>
  ({
    id: "sim", tournament_id: "sim", round: "sim", court_name: null, scheduled_at: null,
    status: "finished", side_a: { pair_id: a.id, pair_name: a.name }, side_b: { pair_id: b.id, pair_name: b.name },
    sets: play.sets, winner: play.winner,
  }) as unknown as Match;

const playsCache = new Map<string, SimulatedPlay[]>();
function cachedPlays(winner: "a" | "b", scoring?: TournamentScoring): SimulatedPlay[] {
  const key = `${winner}|${scoring ? JSON.stringify(normalizeScoring(scoring)) : "liga16"}`;
  let v = playsCache.get(key);
  if (!v) {
    v = scoring ? enumerateScoresForFormat(winner, scoring) : enumerateScores(winner);
    playsCache.set(key, v);
  }
  return v;
}

export interface SimulationResult {
  /** Posiciones que cada pareja puede tener según el marcador (0 = sin partidos). */
  positions: Map<string, number[]>;
  /** Marcadores evaluados. */
  scoresChecked: number;
  /** Siempre false: el super tie-break no tiene tope real. */
  exhaustive: false;
}

/** `winnerSide` = lado que gana el partido hipotético entre `a` y `b`. */
export function simulateResult(args: {
  roster: Roster[];
  matches: Match[];
  a: Roster;
  b: Roster;
  winnerSide: "a" | "b";
  order?: RankCriterion[];
  /** Formato del torneo. Sin él se usa el de la Liga16 (2 sets + super tie-break). */
  scoring?: TournamentScoring;
  /** Parejas dadas de baja: cuentan en las estadísticas pero no ocupan cupo. */
  withdrawn?: ReadonlySet<string>;
}): SimulationResult {
  const { roster, matches, a, b, winnerSide, order, scoring, withdrawn } = args;
  const plays = cachedPlays(winnerSide, scoring);
  const positions = new Map<string, Set<number>>(roster.map((r) => [r.id, new Set<number>()]));
  for (const play of plays) {
    const pos = rankPositions(roster, [...matches, fake(a, b, play)], order, withdrawn);
    for (const [id, p] of pos) positions.get(id)?.add(p);
  }
  return {
    positions: new Map([...positions].map(([id, s]) => [id, [...s].sort((x, y) => x - y)])),
    scoresChecked: plays.length,
    exhaustive: false,
  };
}
