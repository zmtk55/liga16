/**
 * Ranking INDIVIDUAL del circuito y palmarés por jugador.
 *
 * Todo se deriva de los partidos capturados, igual que el ranking de parejas:
 * nada se escribe a mano y nada vive en una tabla que pueda desactualizarse
 * (ranking_events existe en el schema pero está huérfana; se ignora a propósito).
 *
 * Modelo de puntos por torneo (configurable, ver `individualPointsFor`):
 *   - Fase de grupos: puntos por victoria y por derrota (jugar suma).
 *   - Eliminatorias: bono por la ronda máxima alcanzada (no acumulativo),
 *     otorgado cuando la final tiene ganador capturado — el torneo "cierra"
 *     por dato, no por rótulo de estado.
 *
 * La unidad es el JUGADOR: lo que gana con una pareja queda en su historial
 * aunque mañana entre con otra (mismo criterio que `records.ts`).
 */

import type { Match, PlayerProfile, Tournament, TournamentScoring } from "@/types";
import { isKnockoutRound } from "@/lib/groups";
import { recordWinRate, type PlayerRecord } from "@/lib/records";

/* ---------------------------------- Config --------------------------------- */

export interface IndividualPointsConfig {
  /** Victoria en fase de grupos. */
  groupWin: number;
  /** Derrota en fase de grupos (jugar suma). */
  groupLoss: number;
  /** Bono por ronda máxima alcanzada en eliminatorias (no acumulativo). */
  champion: number;
  finalist: number;
  semifinalist: number;
  quarterfinalist: number;
  roundOf16: number;
}

export const DEFAULT_INDIVIDUAL_POINTS: IndividualPointsConfig = {
  groupWin: 10,
  groupLoss: 3,
  // Aprobado por Julian (31-oct-2026): el campeonato pesa más que la constancia.
  champion: 100,
  finalist: 40,
  semifinalist: 25,
  quarterfinalist: 15,
  roundOf16: 8,
};

/**
 * Puntos que aplica un torneo: el estándar de la liga con el ajuste opcional
 * del torneo (`scoring.individual_points`). Cualquier valor ausente o inválido
 * cae al estándar: un torneo no puede dejar el ranking sin reglas.
 */
export function individualPointsFor(
  scoring?: TournamentScoring | null,
): IndividualPointsConfig {
  const o = scoring?.individual_points;
  const pick = (v: number | undefined, d: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : d;
  return {
    groupWin: pick(o?.groupWin, DEFAULT_INDIVIDUAL_POINTS.groupWin),
    groupLoss: pick(o?.groupLoss, DEFAULT_INDIVIDUAL_POINTS.groupLoss),
    champion: pick(o?.champion, DEFAULT_INDIVIDUAL_POINTS.champion),
    finalist: pick(o?.finalist, DEFAULT_INDIVIDUAL_POINTS.finalist),
    semifinalist: pick(o?.semifinalist, DEFAULT_INDIVIDUAL_POINTS.semifinalist),
    quarterfinalist: pick(o?.quarterfinalist, DEFAULT_INDIVIDUAL_POINTS.quarterfinalist),
    roundOf16: pick(o?.roundOf16, DEFAULT_INDIVIDUAL_POINTS.roundOf16),
  };
}

/* ---------------------------------- Tipos ---------------------------------- */

/** Lo mínimo que necesita el ranking de una pareja (cubre `Pair` y las filas de `listAllPairs`). */
export interface PairRef {
  id: string;
  name: string;
  tournament_id: string | null;
  category_name?: string | null;
  tournament_name?: string | null;
  player1_id: string | null;
  player2_id: string | null;
  status?: string;
}

export type HonorKind = "title" | "final" | "semi";

/** Un logro derivado de un bracket cerrado: campeonato, final o semifinal. */
export interface TournamentHonor {
  kind: HonorKind;
  tournamentId: string;
  tournamentName: string;
  tournamentSlug: string | null;
  category: string | null;
  pairId: string;
  partnerId: string | null;
  partnerName: string | null;
  /** Fecha del logro: la final capturada (o el cierre del torneo si no hay dato). */
  date: string | null;
}

/** Fila del ranking individual acumulado. */
export interface IndividualStanding {
  playerId: string;
  name: string;
  sex: PlayerProfile["sex"];
  photoUrl: string | null;
  /** Puntos acumulados entre torneos. */
  points: number;
  titles: number;
  finals: number;
  semis: number;
  /** Torneos con al menos un partido contado. */
  tournaments: number;
  played: number;
  won: number;
  lost: number;
  winRate: number;
  /** Posición estilo RANK de Excel: empates comparten número (1, 1, 3…). */
  position: number;
}

/* -------------------------------- Derivación -------------------------------- */

type KnockoutPhase = "roundOf16" | "quarterfinal" | "semifinal" | "final";

const PHASE_RANK: Record<KnockoutPhase, number> = {
  roundOf16: 1,
  quarterfinal: 2,
  semifinal: 3,
  final: 4,
};

/**
 * La fase de un cruce de eliminatorias, desde la ETIQUETA del round
 * ("Final · r2-m1", "Semifinales · r1-m2"…). El nodo ("r2-m1") no importa:
 * solo la primera parte. Null si no es eliminatoria.
 */
export function knockoutPhase(round: string | null | undefined): KnockoutPhase | null {
  if (!isKnockoutRound(round)) return null;
  const head = (round ?? "").split("·")[0].trim().toLowerCase();
  if (/^semifinal/.test(head)) return "semifinal";
  if (/^final/.test(head)) return "final";
  if (/^cuartos/.test(head)) return "quarterfinal";
  if (/^octavos/.test(head)) return "roundOf16";
  // "Eliminatoria ronda N" u otra etiqueta rara: no se puede graduar, no suma bono.
  return null;
}

/** ¿El partido cuenta para puntos/títulos? Misma regla que el bracket: ganador capturado y no cancelado. */
function isDecided(m: Match): boolean {
  return m.winner != null && m.status !== "cancelled" && m.status !== "disputed";
}

interface TournamentBucket {
  tournament: Tournament | null;
  pairs: Map<string, PairRef>;
  pairByName: Map<string, PairRef>;
  groupMatches: Match[];
  /** phase -> cruces decididos */
  knockout: Map<KnockoutPhase, Match[]>;
}

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function bucketFor(
  buckets: Map<string, TournamentBucket>,
  m: Match,
  tournaments: Map<string, Tournament>,
  pairs: PairRef[],
): TournamentBucket {
  const key = m.tournament_id ?? "";
  let b = buckets.get(key);
  if (!b) {
    const mine = pairs.filter((p) => (p.tournament_id ?? "") === key);
    b = {
      tournament: tournaments.get(key) ?? null,
      pairs: new Map(mine.map((p) => [p.id, p])),
      // El nombre se resuelve DENTRO del torneo: "Fuentes / Rojas" puede ser una
      // pareja distinta en cada torneo y un mapa global los cruzaba.
      pairByName: new Map(mine.map((p) => [norm(p.name), p])),
      groupMatches: [],
      knockout: new Map(),
    };
    buckets.set(key, b);
  }
  return b;
}

function resolveSide(
  b: TournamentBucket,
  side: Match["side_a"],
): PairRef | null {
  if (!side) return null;
  if (side.pair_id) {
    const byId = b.pairs.get(side.pair_id);
    if (byId) return byId;
  }
  return b.pairByName.get(norm(side.pair_name)) ?? null;
}

function playersOf(pair: PairRef): string[] {
  return [pair.player1_id, pair.player2_id].filter((x): x is string => Boolean(x));
}

/**
 * Motor único: recorre los partidos UNA vez y devuelve, por jugador, sus puntos
 * y sus logros. Las vistas (ranking y palmarés) son proyecciones de esto, así no
 * pueden divergir.
 */
export function computeIndividualSeason(
  matches: Match[],
  pairs: PairRef[],
  tournaments: Tournament[],
): {
  pointsByPlayer: Map<string, number>;
  honorsByPlayer: Map<string, TournamentHonor[]>;
  tournamentsByPlayer: Map<string, Set<string>>;
} {
  const tournamentsById = new Map(tournaments.map((t) => [t.id, t]));
  const buckets = new Map<string, TournamentBucket>();
  for (const m of matches) {
    if (!isDecided(m)) continue;
    const b = bucketFor(buckets, m, tournamentsById, pairs);
    const phase = knockoutPhase(m.round);
    if (phase) {
      b.knockout.set(phase, [...(b.knockout.get(phase) ?? []), m]);
    } else {
      b.groupMatches.push(m);
    }
  }

  const pointsByPlayer = new Map<string, number>();
  const honorsByPlayer = new Map<string, TournamentHonor[]>();
  const tournamentsByPlayer = new Map<string, Set<string>>();

  const addPoints = (playerId: string, n: number) =>
    pointsByPlayer.set(playerId, (pointsByPlayer.get(playerId) ?? 0) + n);
  const addHonor = (playerId: string, h: TournamentHonor) =>
    honorsByPlayer.set(playerId, [...(honorsByPlayer.get(playerId) ?? []), h]);
  const markTournament = (playerId: string, tournamentId: string) => {
    if (!tournamentId) return;
    const s = tournamentsByPlayer.get(playerId) ?? new Set<string>();
    s.add(tournamentId);
    tournamentsByPlayer.set(playerId, s);
  };

  for (const [tournamentId, b] of buckets) {
    const config = individualPointsFor(b.tournament?.scoring);

    // 1) Fase de grupos: puntos por resultado, por jugador.
    for (const m of b.groupMatches) {
      const pairA = resolveSide(b, m.side_a);
      const pairB = resolveSide(b, m.side_b);
      for (const [pair, isA] of [
        [pairA, true],
        [pairB, false],
      ] as const) {
        if (!pair) continue;
        const won = isA ? m.winner === "a" : m.winner === "b";
        for (const pid of playersOf(pair)) {
          addPoints(pid, won ? config.groupWin : config.groupLoss);
          markTournament(pid, tournamentId);
        }
      }
    }

    // 2) Eliminatorias: bono por ronda máxima cuando la FINAL ya tiene ganador.
    //    Antes de eso el torneo está en curso y los bonos no existen: la tabla
    //    no muestra campeones a medias.
    const finals = b.knockout.get("final") ?? [];
    const finalPlayed = finals.find((m) => m.winner);
    if (!finalPlayed) continue;

    const championPair = resolveSide(
      b,
      finalPlayed.winner === "a" ? finalPlayed.side_a : finalPlayed.side_b,
    );
    const finalistPair = resolveSide(
      b,
      finalPlayed.winner === "a" ? finalPlayed.side_b : finalPlayed.side_a,
    );

    /** pairId -> ronda máxima alcanzada (la final la juegan dos). */
    const reached = new Map<string, KnockoutPhase>();
    const bump = (pair: PairRef | null, phase: KnockoutPhase) => {
      if (!pair) return;
      const cur = reached.get(pair.id);
      if (!cur || PHASE_RANK[phase] > PHASE_RANK[cur]) reached.set(pair.id, phase);
    };
    bump(championPair, "final");
    bump(finalistPair, "final");
    for (const phase of ["semifinal", "quarterfinal", "roundOf16"] as const) {
      for (const m of b.knockout.get(phase) ?? []) {
        bump(resolveSide(b, m.side_a), phase);
        bump(resolveSide(b, m.side_b), phase);
      }
    }

    const bonusFor = (pair: PairRef, phase: KnockoutPhase): number => {
      if (pair.id === championPair?.id) return config.champion;
      if (pair.id === finalistPair?.id) return config.finalist;
      switch (phase) {
        case "semifinal": return config.semifinalist;
        case "quarterfinal": return config.quarterfinalist;
        default: return config.roundOf16;
      }
    };

    const date =
      finalPlayed.scheduled_at ??
      b.tournament?.end_date ??
      b.tournament?.start_date ??
      null;
    const tournamentName = b.tournament?.name ?? "Torneo";
    const tournamentSlug = b.tournament?.slug ?? null;

    for (const [pairId, phase] of reached) {
      const pair = b.pairs.get(pairId);
      if (!pair) continue;
      const bonus = bonusFor(pair, phase);
      const kind: HonorKind =
        pairId === championPair?.id ? "title" : pairId === finalistPair?.id ? "final" : "semi";
      for (const pid of playersOf(pair)) {
        addPoints(pid, bonus);
        markTournament(pid, tournamentId);
        // El palmarés guarda título/final/semifinal; cuartos y octavos solo suman puntos.
        if (kind === "title" || kind === "final" || phase === "semifinal") {
          const partnerId = playersOf(pair).find((x) => x !== pid) ?? null;
          addHonor(pid, {
            kind,
            tournamentId,
            tournamentName,
            tournamentSlug,
            category: pair.category_name ?? null,
            pairId: pair.id,
            partnerId,
            partnerName: null, // se rellena en la vista con el directorio
            date,
          });
        }
      }
    }
  }

  // Más reciente primero.
  for (const list of honorsByPlayer.values()) {
    list.sort((x, y) => String(y.date ?? "").localeCompare(String(x.date ?? "")));
  }

  return { pointsByPlayer, honorsByPlayer, tournamentsByPlayer };
}

/* ------------------------------ Proyecciones ------------------------------- */

/**
 * Tabla individual acumulada. `records` es el récord derivado de siempre
 * (`buildPlayerRecords`): los números de partidos de la tabla son LOS MISMOS
 * que ve el jugador en su perfil.
 *
 * Criterios de desempate, en orden: puntos, títulos, finales, % de victorias,
 * partidos ganados y nombre. Empate total = misma posición (estilo Excel RANK).
 */
export function buildIndividualStandings(
  matches: Match[],
  pairs: PairRef[],
  players: PlayerProfile[],
  tournaments: Tournament[],
  records: Map<string, PlayerRecord>,
): IndividualStanding[] {
  const season = computeIndividualSeason(matches, pairs, tournaments);
  const rows: IndividualStanding[] = [];
  for (const p of players) {
    const record = records.get(p.id);
    const points = season.pointsByPlayer.get(p.id) ?? 0;
    const played = record?.played ?? 0;
    if (points === 0 && played === 0) continue; // sin actividad no rankea
    const honors = season.honorsByPlayer.get(p.id) ?? [];
    rows.push({
      playerId: p.id,
      name: p.display_name,
      sex: p.sex,
      photoUrl: p.photo_url ?? null,
      points,
      titles: honors.filter((h) => h.kind === "title").length,
      finals: honors.filter((h) => h.kind === "final").length,
      semis: honors.filter((h) => h.kind === "semi").length,
      tournaments: season.tournamentsByPlayer.get(p.id)?.size ?? 0,
      played,
      won: record?.won ?? 0,
      lost: record?.lost ?? 0,
      winRate: recordWinRate({ won: record?.won ?? 0, played }),
      position: 0,
    });
  }
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.titles !== a.titles) return b.titles - a.titles;
    if (b.finals !== a.finals) return b.finals - a.finals;
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    if (b.won !== a.won) return b.won - a.won;
    return a.name.localeCompare(b.name, "es");
  });
  // RANK estilo Excel: mismos puntos y criterios = misma posición; salta tras el grupo.
  let pos = 0;
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    const tied =
      prev &&
      prev.points === r.points &&
      prev.titles === r.titles &&
      prev.finals === r.finals &&
      prev.winRate === r.winRate &&
      prev.won === r.won;
    pos = tied ? prev.position : i + 1;
    r.position = pos;
  });
  return rows;
}

/**
 * Palmarés de un jugador (títulos, finales, semifinales), del más reciente al
 * más antiguo, con el nombre del compañero resuelto contra el directorio.
 */
export function buildPlayerHonors(
  playerId: string,
  matches: Match[],
  pairs: PairRef[],
  players: PlayerProfile[],
  tournaments: Tournament[],
): TournamentHonor[] {
  const season = computeIndividualSeason(matches, pairs, tournaments);
  const nameById = new Map(players.map((p) => [p.id, p.display_name]));
  return (season.honorsByPlayer.get(playerId) ?? []).map((h) => ({
    ...h,
    partnerName: h.partnerId ? nameById.get(h.partnerId) ?? null : null,
  }));
  }
