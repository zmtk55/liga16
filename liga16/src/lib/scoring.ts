// @ts-nocheck
// Liga16 — utilidades de puntuación para pádel
import type { SetScore, TournamentScoring, Team } from "@/types";

export const DEFAULT_SCORING: TournamentScoring = {
  sets_to_win: 2,
  games_per_set: 6,
  tie_break_at: 6,
  tie_break_points: 7,
  win_by_two_tiebreak: true,
  tie_breaker_rules: ["points", "sets_diff", "games_diff", "head_to_head"],
};

export function normalizeScoring(scoring?: TournamentScoring | null): TournamentScoring {
  return {
    sets_to_win: scoring?.sets_to_win ?? DEFAULT_SCORING.sets_to_win,
    games_per_set: scoring?.games_per_set ?? DEFAULT_SCORING.games_per_set,
    tie_break_at: scoring?.tie_break_at ?? DEFAULT_SCORING.tie_break_at,
    tie_break_points: scoring?.tie_break_points ?? DEFAULT_SCORING.tie_break_points,
    win_by_two_tiebreak: scoring?.win_by_two_tiebreak ?? DEFAULT_SCORING.win_by_two_tiebreak,
    tie_breaker_rules: scoring?.tie_breaker_rules?.length
      ? scoring.tie_breaker_rules
      : DEFAULT_SCORING.tie_breaker_rules!,
  };
}

/** Determina si un set llegó a tie-break. */
export function isTieBreakSet(set: SetScore, config: TournamentScoring): boolean {
  return set.a === config.tie_break_at && set.b === config.tie_break_at;
}

/** Determina el ganador de un set ('a', 'b' o null si no terminó). */
export function determineSetWinner(set: SetScore, config: TournamentScoring): "a" | "b" | null {
  const cfg = normalizeScoring(config);
  const a = set.a;
  const b = set.b;

  // Set normal
  if (!isTieBreakSet(set, cfg)) {
    if (a >= cfg.games_per_set && a >= b + 2) return "a";
    if (b >= cfg.games_per_set && b >= a + 2) return "b";
    // 7-5
    if (a === cfg.games_per_set + 1 && b === cfg.games_per_set - 1) return "a";
    if (b === cfg.games_per_set + 1 && a === cfg.games_per_set - 1) return "b";
    return null;
  }

  // Tie-break
  const ta = set.tiebreak_a ?? 0;
  const tb = set.tiebreak_b ?? 0;
  const target = cfg.tie_break_points;
  if (cfg.win_by_two_tiebreak) {
    if (ta >= target && ta >= tb + 2) return "a";
    if (tb >= target && tb >= ta + 2) return "b";
  } else {
    if (ta >= target) return "a";
    if (tb >= target) return "b";
  }
  return null;
}

/** Cuenta sets ganados por cada lado. */
export function countSetsWon(sets: SetScore[], config: TournamentScoring): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const set of sets) {
    const winner = determineSetWinner(set, config);
    if (winner === "a") a++;
    if (winner === "b") b++;
  }
  return { a, b };
}

/** Determina el ganador del partido. */
export function determineMatchWinner(
  sets: SetScore[],
  config: TournamentScoring
): "a" | "b" | null {
  const cfg = normalizeScoring(config);
  const { a, b } = countSetsWon(sets, cfg);
  if (a >= cfg.sets_to_win) return "a";
  if (b >= cfg.sets_to_win) return "b";
  return null;
}

/** Total de juegos ganados por cada lado (incluye tie-break como 1 juego para el ganador). */
export function countGames(sets: SetScore[]): { a: number; b: number } {
  return sets.reduce(
    (acc, s) => ({ a: acc.a + (s.a ?? 0), b: acc.b + (s.b ?? 0) }),
    { a: 0, b: 0 }
  );
}

/** Formatea un set para mostrar: "6-4", "7-6 (7-5)", etc. */
export function formatSet(set: SetScore, config?: TournamentScoring): string {
  const cfg = normalizeScoring(config);
  const isTb = isTieBreakSet(set, cfg);
  if (isTb && (set.tiebreak_a != null || set.tiebreak_b != null)) {
    return `${set.a}-${set.b} (${set.tiebreak_a ?? 0}-${set.tiebreak_b ?? 0})`;
  }
  return `${set.a}-${set.b}`;
}

/** Formatea todo el marcador del partido. */
export function formatMatchScore(sets: SetScore[], config?: TournamentScoring): string {
  if (sets.length === 0) return "—";
  return sets.map((s) => formatSet(s, config)).join(" · ");
}

/** Valida que los sets sean coherentes (sin sets posteriores si ya hay ganador). */
export function validateScoring(sets: SetScore[], config: TournamentScoring): string | null {
  const cfg = normalizeScoring(config);
  let aWon = 0;
  let bWon = 0;
  for (let i = 0; i < sets.length; i++) {
    const set = sets[i];
    if (set.a < 0 || set.b < 0) return `El set ${i + 1} tiene juegos negativos`;
    if ((set.tiebreak_a ?? 0) < 0 || (set.tiebreak_b ?? 0) < 0) {
      return `El set ${i + 1} tiene puntos de tie-break negativos`;
    }
    if (aWon >= cfg.sets_to_win || bWon >= cfg.sets_to_win) {
      return `Hay sets de más después de que el partido ya terminó`;
    }
    const winner = determineSetWinner(set, cfg);
    if (winner === "a") aWon++;
    if (winner === "b") bWon++;
  }
  return null;
}

/** Ordena equipos según las reglas de desempate configuradas. */
export function sortTeamsByTieBreakers(
  teams: Team[],
  config?: TournamentScoring
): Team[] {
  const cfg = normalizeScoring(config);
  const rules = cfg.tie_breaker_rules ?? DEFAULT_SCORING.tie_breaker_rules!;

  return [...teams].sort((x, y) => {
    for (const rule of rules) {
      const diff = compareTeamsByRule(x, y, rule);
      if (diff !== 0) return -diff; // mayor va primero
    }
    return x.name.localeCompare(y.name);
  });
}

function compareTeamsByRule(a: Team, b: Team, rule: ReturnType<typeof normalizeScoring>["tie_breaker_rules"][number]): number {
  switch (rule) {
    case "points":
      return a.points - b.points;
    case "sets_won":
      return a.sets_for - b.sets_for;
    case "sets_diff":
      return a.sets_for - a.sets_against - (b.sets_for - b.sets_against);
    case "games_won":
      return a.sets_for - b.sets_for; // aproximación, juegos no están en Team
    case "games_diff":
      return a.sets_for - a.sets_against - (b.sets_for - b.sets_against);
    case "tiebreak_won":
    case "head_to_head":
    default:
      return 0;
  }
}

/** Construye un objeto SetScore a partir de juegos y opcional tie-break. */
export function buildSet(
  aGames: number,
  bGames: number,
  aTiebreak?: number | null,
  bTiebreak?: number | null
): SetScore {
  return {
    a: aGames,
    b: bGames,
    tiebreak_a: aTiebreak ?? null,
    tiebreak_b: bTiebreak ?? null,
  };
}
