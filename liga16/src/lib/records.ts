import type { Match, Pair, PlayerProfile } from "@/types";

/**
 * Récord personal de un jugador, derivado de los partidos que jugó.
 *
 * La unidad del récord es el JUGADOR, no la pareja: si mañana entra con otra
 * pareja, todo lo que ganó antes sigue aquí. Las parejas son tramos de la
 * historia, no la historia misma.
 */

export interface PartnerSpell {
  pairId: string;
  pairName: string;
  /** Nombre del compañero de esa etapa (o null si el pair no lo tiene). */
  partnerId: string | null;
  partnerName: string;
  played: number;
  won: number;
  /** Último partido de esa etapa, para ordenar el historial de más reciente a más antigua. */
  lastPlayedAt: string | null;
}

export interface PlayerRecord {
  playerId: string;
  played: number;
  won: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  /** Últimos resultados, 'G'/'P', del más antiguo al más reciente. */
  form: Array<"G" | "P">;
  /** Puntos ganados por partido (últimos 10), para la tendencia. */
  trend: number[];
  /** Historial de parejas, de la etapa más reciente a la más antigua. */
  partners: PartnerSpell[];
}

const TREND_WINDOW = 10;

function makeRecord(playerId: string): PlayerRecord {
  return {
    playerId,
    played: 0,
    won: 0,
    lost: 0,
    setsFor: 0,
    setsAgainst: 0,
    form: [],
    trend: [],
    partners: [],
  };
}

/**
 * Construye el récord de cada jugador a partir de todos sus partidos,
 * sin importar con qué pareja los jugó.
 *
 * `pairs` son las parejas de todos los torneos; los partidos se resuelven por
 * `pair_id` y, si no lo traen, por nombre normalizado (los partidos antiguos
 * guardan solo el texto del lado).
 */
export function buildPlayerRecords(
  matches: Match[],
  pairs: Pair[],
  players: Pick<PlayerProfile, "id" | "display_name">[] = [],
): Map<string, PlayerRecord> {
  const pairById = new Map(pairs.map((p) => [p.id, p]));
  const nameById = new Map(players.map((p) => [p.id, p.display_name]));
  const pairByName = new Map(
    pairs.map((p) => [p.name.trim().toLowerCase(), p] as const),
  );

  const resolve = (side: Match["side_a"]): Pair | null => {
    if (!side) return null;
    if (side.pair_id) {
      const byId = pairById.get(side.pair_id);
      if (byId) return byId;
    }
    return pairByName.get((side.pair_name ?? "").trim().toLowerCase()) ?? null;
  };

  const records = new Map<string, PlayerRecord>();
  const recordFor = (playerId: string) => {
    let r = records.get(playerId);
    if (!r) {
      r = makeRecord(playerId);
      records.set(playerId, r);
    }
    return r;
  };

  const finished = matches
    .filter((m) => m.status === "finished" && m.winner)
    .sort((x, y) => String(x.scheduled_at ?? "").localeCompare(String(y.scheduled_at ?? "")));

  for (const match of finished) {
    const pairA = resolve(match.side_a);
    const pairB = resolve(match.side_b);
    // Cada lado se cuenta por separado: si el rival no está registrado, el
    // jugador conocido sigue teniendo derecho a su partido. El récord personal
    // no puede depender de que el otro lado esté en la base.
    if (!pairA && !pairB) continue;
    // Un partido consigo mismo no aporta nada y rompería el conteo.
    if (pairA && pairB && pairA.id === pairB.id) continue;
    // Dato corrupto: el mismo jugador en los dos lados contaría su partido dos
    // veces. Descartamos el partido entero en vez de inventarnos un récord.
    if (pairA && pairB) {
      const playersA = [pairA.player1_id, pairA.player2_id].filter(Boolean);
      const playersB = [pairB.player1_id, pairB.player2_id].filter(Boolean);
      if (playersA.some((id) => playersB.includes(id))) continue;
    }

    const sides: Array<{ pair: Pair | null; isA: boolean }> = [
      { pair: pairA, isA: true },
      { pair: pairB, isA: false },
    ];
    for (const side of sides) {
      const pair = side.pair;
      if (!pair) continue;
      const isA = side.isA;
      const playerIds = [pair.player1_id, pair.player2_id].filter(
        (id): id is string => Boolean(id),
      );
      if (playerIds.length === 0) continue;

      const won = isA ? match.winner === "a" : match.winner === "b";
      let pointsFor = 0;
      let pointsAgainst = 0;
      for (const s of match.sets) {
        const mine = isA ? s.a : s.b;
        const theirs = isA ? s.b : s.a;
        pointsFor += mine;
        pointsAgainst += theirs;
      }

      for (const playerId of playerIds) {
        const record = recordFor(playerId);
        record.played++;
        if (won) record.won++;
        else record.lost++;
        record.setsFor += pointsFor;
        record.setsAgainst += pointsAgainst;
        record.form.push(won ? "G" : "P");
        record.trend.push(pointsFor);

        const partnerId = playerIds.find((id) => id !== playerId) ?? null;
        const spell = record.partners.find((p) => p.pairId === pair.id);
        if (spell) {
          spell.played++;
          if (won) spell.won++;
          spell.lastPlayedAt = match.scheduled_at ?? spell.lastPlayedAt;
        } else {
          record.partners.push({
            pairId: pair.id,
            pairName: pair.name,
            partnerId,
            partnerName: partnerId ? nameById.get(partnerId) ?? "—" : "—",
            played: 1,
            won: won ? 1 : 0,
            lastPlayedAt: match.scheduled_at ?? null,
          });
        }
      }
    }
  }

  for (const record of records.values()) {
    record.form = record.form.slice(-TREND_WINDOW);
    record.trend = record.trend.slice(-TREND_WINDOW);
    record.partners.sort((x, y) =>
      String(y.lastPlayedAt ?? "").localeCompare(String(x.lastPlayedAt ?? "")),
    );
  }

  return records;
}

/** Porcentaje de victorias; 0 si nunca ha jugado. */
export function recordWinRate(record: Pick<PlayerRecord, "won" | "played">): number {
  return record.played ? Math.round((record.won / record.played) * 100) : 0;
}
