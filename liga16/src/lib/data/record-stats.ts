// Récord derivado (jugado/ganado) de todo el directorio en unas pocas consultas.
// player_cards solo tiene trigger de creación (schema.sql) y nunca se actualiza
// con los partidos: el récord sale de buildPlayerRecords, igual que en el detalle.
import { db } from "./index";
import { buildPlayerRecords } from "@/lib/records";
import type { Pair, PlayerProfile } from "@/types";

export interface DirStats {
  played: number;
  won: number;
}

export async function buildDirectoryStats(
  players: PlayerProfile[],
): Promise<Record<string, DirStats>> {
  const [matches, tournaments] = await Promise.all([
    db.listRecentMatches(),
    db.listTournaments(),
  ]);
  const pairLists = await Promise.all(
    tournaments.map((t) =>
      db.getTournamentPairs(t.id).catch((): Pair[] => []),
    ),
  );
  const records = buildPlayerRecords(matches, pairLists.flat(), players);
  const stats: Record<string, DirStats> = {};
  records.forEach((r, id) => {
    stats[id] = { played: r.played, won: r.won };
  });
  return stats;
}
