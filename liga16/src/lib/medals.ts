/**
 * Repisa de medallas del jugador.
 *
 * Igual que el ranking y el palmarés: TODO se deriva de los partidos
 * capturados; nada se escribe a mano ni vive en una tabla aparte. Si el admin
 * corrige un resultado, las medallas se recalculan solas.
 *
 * Cada medalla tiene niveles bronce → plata → oro sobre la misma métrica; la
 * repisa muestra el nivel alcanzado y el progreso hacia el siguiente. Las
 * métricas acumulativas (títulos, puntos, torneos, racha) son históricas;
 * posición y efectividad reflejan el momento actual, como el propio ranking.
 *
 * El ARTE de cada badge es intercambiable: la vista resuelve un asset por
 * medalla/nivel y cae al icono de componente si no existe.
 */

import type { Match, PlayerProfile, Tournament } from "@/types";
import type { PlayerRecord } from "@/lib/records";
import { recordWinRate } from "@/lib/records";
import {
  buildIndividualStandings,
  computeIndividualSeason,
  type PairRef,
} from "@/lib/individual-ranking";

/* ---------------------------------- Tipos ---------------------------------- */

export type MedalTier = "bronce" | "plata" | "oro";

export type MedalId =
  | "campeon"
  | "finalista"
  | "de-llave"
  | "lider"
  | "puntos"
  | "de-gira"
  | "racha"
  | "efectividad"
  | "invicto";

export interface MedalDef {
  id: MedalId;
  name: string;
  /** Regla exacta en una línea, para el detalle de la medalla. */
  rule: string;
  /** Umbrales [bronce, plata, oro]; null = nivel único (oro). */
  thresholds: [number, number, number] | null;
  /** La métrica baja es mejor (posición en el ranking). */
  descending?: boolean;
  /** Nombre del icono de respaldo (la vista lo mapea a su componente). */
  icon: string;
}

export interface MedalState {
  def: MedalDef;
  /** Valor actual del jugador en la métrica. */
  current: number;
  /** Nivel alcanzado; null = bloqueada. */
  tier: MedalTier | null;
  /** Meta del siguiente nivel; null cuando ya está en oro. */
  nextTarget: number | null;
  /** 0..1 hacia el siguiente nivel (1 cuando está en oro). */
  progress: number;
  /** Dato derivado para el detalle: "2 títulos", "mejor racha: 6", … */
  detail: string;
  /** Nota corta cuando está bloqueada por un requisito distinto de la métrica (p. ej. mínimo de partidos). */
  lockedNote?: string;
}

/* --------------------------------- Catálogo -------------------------------- */

/** Mínimo de partidos para que la efectividad cuente (una buena semana no basta). */
export const EFFECTIVENESS_MIN_MATCHES = 10;

export const MEDAL_CATALOG: MedalDef[] = [
  {
    id: "campeon",
    name: "Campeón",
    rule: "Gana torneos: 1 bronce · 3 plata · 5 oro.",
    thresholds: [1, 3, 5],
    icon: "trophy",
  },
  {
    id: "finalista",
    name: "Finalista",
    rule: "Juega finales: 1 bronce · 3 plata · 5 oro.",
    thresholds: [1, 3, 5],
    icon: "medal",
  },
  {
    id: "de-llave",
    name: "De llave",
    rule: "Llega a semifinales: 1 bronce · 3 plata · 5 oro.",
    thresholds: [1, 3, 5],
    icon: "award",
  },
  {
    id: "lider",
    name: "Líder del circuito",
    rule: "Posición en el ranking individual: top 10 bronce · top 3 plata · #1 oro.",
    thresholds: [10, 3, 1],
    descending: true,
    icon: "crown",
  },
  {
    id: "puntos",
    name: "Puntos del circuito",
    rule: "Acumula puntos entre torneos: 100 bronce · 250 plata · 500 oro.",
    thresholds: [100, 250, 500],
    icon: "star",
  },
  {
    id: "de-gira",
    name: "De gira",
    rule: "Juega torneos: 3 bronce · 5 plata · 10 oro.",
    thresholds: [3, 5, 10],
    icon: "calendar",
  },
  {
    id: "racha",
    name: "En racha",
    rule: "Mejor racha de victorias seguidas: 3 bronce · 5 plata · 8 oro.",
    thresholds: [3, 5, 8],
    icon: "flame",
  },
  {
    id: "efectividad",
    name: "Efectividad",
    rule: `Porcentaje de victorias con al menos ${EFFECTIVENESS_MIN_MATCHES} partidos: 60% bronce · 70% plata · 80% oro.`,
    thresholds: [60, 70, 80],
    icon: "target",
  },
  {
    id: "invicto",
    name: "Invicto",
    rule: "Gana un torneo sin perder ni un partido.",
    thresholds: null,
    icon: "shield",
  },
];

/* ------------------------------ Nivel y progreso ---------------------------- */

function tierFor(def: MedalDef, current: number): MedalTier | null {
  if (!def.thresholds) return current > 0 ? "oro" : null;
  const [b, s, o] = def.thresholds;
  if (def.descending) {
    if (current <= 0) return null;
    if (current <= o) return "oro";
    if (current <= s) return "plata";
    if (current <= b) return "bronce";
    return null;
  }
  if (current >= o) return "oro";
  if (current >= s) return "plata";
  if (current >= b) return "bronce";
  return null;
}

function nextTargetFor(def: MedalDef, tier: MedalTier | null): number | null {
  if (!def.thresholds || tier === "oro") return null;
  const [b, s, o] = def.thresholds;
  if (tier === "plata") return o;
  if (tier === "bronce") return s;
  return b;
}

function progressFor(def: MedalDef, current: number, tier: MedalTier | null): number {
  if (!def.thresholds) return tier === "oro" ? 1 : 0;
  if (tier === "oro") return 1;
  const [b, s, o] = def.thresholds;
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  if (def.descending) {
    if (current <= 0 || current > b) return 0;
    if (tier === "bronce") return clamp((b - current) / (b - s));
    return clamp((s - current) / (s - o));
  }
  if (tier === "plata") return clamp((current - s) / (o - s));
  if (tier === "bronce") return clamp((current - b) / (s - b));
  return clamp(current / b);
}

/* --------------------- Racha y torneos invictos (derivados) ----------------- */

interface PlayerMatchOutcome {
  tournamentId: string;
  won: boolean;
  when: string;
}

/**
 * Partidos del jugador en orden cronológico, resolviendo la pareja DENTRO de
 * su torneo (el mismo nombre de pareja puede existir en dos torneos). Misma
 * regla de participación que `records.ts`: ganador capturado, marcador con
 * puntos y sin cancelado/walkover.
 */
function playerOutcomes(playerId: string, matches: Match[], pairs: PairRef[]): PlayerMatchOutcome[] {
  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
  const mine = pairs.filter((p) => p.player1_id === playerId || p.player2_id === playerId);
  const byId = new Map(mine.map((p) => [p.id, p]));
  const byTournamentAndName = new Map(
    mine.map((p) => [`${p.tournament_id ?? ""}|${norm(p.name)}`, p]),
  );
  const resolve = (m: Match, side: Match["side_a"]) => {
    if (!side) return null;
    if (side.pair_id && byId.has(side.pair_id)) return side.pair_id;
    const p = byTournamentAndName.get(`${m.tournament_id ?? ""}|${norm(side.pair_name)}`);
    return p?.id ?? null;
  };
  const outcomes: PlayerMatchOutcome[] = [];
  for (const m of matches) {
    if (m.winner == null || m.status === "cancelled" || m.status === "walkover") continue;
    if (!(m.sets ?? []).some((s) => (s.a ?? 0) + (s.b ?? 0) > 0)) continue;
    const aId = resolve(m, m.side_a);
    const bId = resolve(m, m.side_b);
    const playedAs = aId ? "a" : bId ? "b" : null;
    if (!playedAs) continue;
    outcomes.push({
      tournamentId: m.tournament_id ?? "",
      won: m.winner === playedAs,
      when: String(m.scheduled_at ?? ""),
    });
  }
  outcomes.sort((x, y) => x.when.localeCompare(y.when));
  return outcomes;
}

/** Mejor racha de victorias seguidas en toda la historia del jugador. */
export function bestWinStreak(outcomes: PlayerMatchOutcome[]): number {
  let best = 0;
  let run = 0;
  for (const o of outcomes) {
    run = o.won ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

/** Torneos ganados sin perder un solo partido (grupos + llave). */
function undefeatedTitles(outcomes: PlayerMatchOutcome[], titleTournamentIds: string[]): number {
  const ids = new Set(titleTournamentIds);
  let count = 0;
  for (const tid of ids) {
    const games = outcomes.filter((o) => o.tournamentId === tid);
    if (games.length > 0 && games.every((o) => o.won)) count++;
  }
  return count;
}

/* --------------------------------- Motor ---------------------------------- */

/**
 * Medallas de un jugador con su nivel y progreso, derivadas de los mismos
 * partidos que alimentan el ranking y el palmarés.
 */
export function buildPlayerMedals(
  playerId: string,
  matches: Match[],
  pairs: PairRef[],
  players: PlayerProfile[],
  tournaments: Tournament[],
  records: Map<string, PlayerRecord>,
): MedalState[] {
  const season = computeIndividualSeason(matches, pairs, tournaments);
  const honors = season.honorsByPlayer.get(playerId) ?? [];
  const titles = honors.filter((h) => h.kind === "title").length;
  const finals = honors.filter((h) => h.kind === "final").length;
  const semis = honors.filter((h) => h.kind === "semi").length;
  const points = season.pointsByPlayer.get(playerId) ?? 0;
  const tournamentsPlayed = season.tournamentsByPlayer.get(playerId)?.size ?? 0;

  const standings = buildIndividualStandings(matches, pairs, players, tournaments, records);
  const position = standings.find((s) => s.playerId === playerId)?.position ?? 0;

  const record = records.get(playerId);
  const played = record?.played ?? 0;
  const winRate = recordWinRate({ won: record?.won ?? 0, played });

  const outcomes = playerOutcomes(playerId, matches, pairs);
  const streak = bestWinStreak(outcomes);
  const undefeated = undefeatedTitles(
    outcomes,
    honors.filter((h) => h.kind === "title").map((h) => h.tournamentId),
  );

  const metrics: Record<MedalId, { current: number; detail: string; eligible?: boolean }> = {
    campeon: {
      current: titles,
      detail: titles === 1 ? "1 título" : `${titles} títulos`,
    },
    finalista: {
      current: finals,
      detail: finals === 1 ? "1 final" : `${finals} finales`,
    },
    "de-llave": {
      current: semis,
      detail: semis === 1 ? "1 semifinal" : `${semis} semifinales`,
    },
    lider: {
      current: position,
      detail: position > 0 ? `Estás #${position} en el ranking individual.` : "Sin posición en el ranking todavía.",
    },
    puntos: {
      current: points,
      detail: `${points.toLocaleString("es-MX")} puntos del circuito`,
    },
    "de-gira": {
      current: tournamentsPlayed,
      detail: tournamentsPlayed === 1 ? "1 torneo jugado" : `${tournamentsPlayed} torneos jugados`,
    },
    racha: {
      current: streak,
      detail: streak === 1 ? "mejor racha: 1 victoria" : `mejor racha: ${streak} victorias`,
    },
    efectividad: {
      current: winRate,
      detail:
        played < EFFECTIVENESS_MIN_MATCHES
          ? `${winRate}% de victorias, pero llevas ${played} de ${EFFECTIVENESS_MIN_MATCHES} partidos mínimos.`
          : `${winRate}% de victorias en ${played} partidos`,
      eligible: played >= EFFECTIVENESS_MIN_MATCHES,
    },
    invicto: {
      current: undefeated,
      detail:
        undefeated > 0
          ? undefeated === 1
            ? "1 torneo ganado sin perder"
            : `${undefeated} torneos ganados sin perder`
          : "Gana un torneo sin perder ni un partido.",
    },
  };

  return MEDAL_CATALOG.map((def) => {
    const m = metrics[def.id];
    const ineligible = m.eligible === false;
    const tier = ineligible ? null : tierFor(def, m.current);
    return {
      def,
      current: m.current,
      tier,
      nextTarget: ineligible ? def.thresholds?.[0] ?? null : nextTargetFor(def, tier),
      progress: ineligible ? 0 : progressFor(def, m.current, tier),
      detail: m.detail,
      lockedNote: ineligible ? `mínimo ${EFFECTIVENESS_MIN_MATCHES} partidos` : undefined,
    };
  });
      }
