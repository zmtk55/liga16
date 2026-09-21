// Interfaz única de acceso a datos de Liga16.
// Las páginas consumen `db`, sin saber si detrás hay datos demo o Supabase.
import type {
  Club,
  League,
  Match,
  NewsItem,
  Pair,
  PlayerCard,
  PlayerProfile,
  RankingEntry,
  RankingEvent,
  Registration,
  Sponsor,
  Team,
  Tournament,
  TournamentCategory,
  TournamentFilters,
} from '@/types';

export interface RegisterPairInput {
  tournament_id: string;
  category_id: string;
  player1_name: string;
  player2_name: string;
  pair_name: string;
  accepted_rules: boolean;
  payment_method: 'cash' | 'transfer';
}

export interface DataProvider {
  listTournaments(filters?: TournamentFilters): Promise<Tournament[]>;
  getTournament(slug: string): Promise<Tournament | null>;
  getTournamentCategories(tournamentId: string): Promise<TournamentCategory[]>;
  getTournamentPairs(tournamentId: string): Promise<Pair[]>;
  listLeagues(): Promise<League[]>;
  getLeague(slug: string): Promise<League | null>;
  listRankings(scope?: { sex?: string; city?: string }): Promise<RankingEntry[]>;
  getPlayerRankingEvents(playerId: string): Promise<RankingEvent[]>;
  listPlayers(query?: string): Promise<PlayerProfile[]>;
  getPlayer(id: string): Promise<PlayerProfile | null>;
  getPlayerCard(playerId: string): Promise<PlayerCard | null>;
  listTeams(): Promise<Team[]>;
  getTeam(slug: string): Promise<Team | null>;
  listClubs(): Promise<Club[]>;
  getClub(slug: string): Promise<Club | null>;
  listRecentMatches(): Promise<Match[]>;
  listNews(): Promise<NewsItem[]>;
  listSponsors(): Promise<Sponsor[]>;
  registerPair(input: RegisterPairInput): Promise<{ registration: Registration }>;
}

export const DATA_MODE: 'demo' | 'supabase' =
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
    ? 'supabase'
    : 'demo';
