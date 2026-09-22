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
  // Torneos
  listTournaments(filters?: Omit<TournamentFilters, 'city'>): Promise<Tournament[]>;
  getTournament(slug: string): Promise<Tournament | null>;
  createTournament(data: Omit<Tournament, 'id' | 'slug'>): Promise<Tournament>;
  updateTournament(slug: string, data: Partial<Tournament>): Promise<Tournament | null>;
  deleteTournament(slug: string): Promise<boolean>;
  getTournamentCategories(tournamentId: string): Promise<TournamentCategory[]>;
  getTournamentPairs(tournamentId: string): Promise<Pair[]>;
  // Ligas
  listLeagues(): Promise<League[]>;
  getLeague(slug: string): Promise<League | null>;
  // Rankings
  listRankings(scope?: { sex?: string }): Promise<RankingEntry[]>;
  updateRanking(playerId: string, updates: Partial<RankingEntry>): Promise<RankingEntry | null>;
  getPlayerRankingEvents(playerId: string): Promise<RankingEvent[]>;
  // Jugadores
  listPlayers(query?: string): Promise<PlayerProfile[]>;
  getPlayer(id: string): Promise<PlayerProfile | null>;
  createPlayer(data: Omit<PlayerProfile, 'id' | 'user_id'>): Promise<PlayerProfile>;
  updatePlayer(id: string, data: Partial<PlayerProfile>): Promise<PlayerProfile | null>;
  deletePlayer(id: string): Promise<boolean>;
  getPlayerCard(playerId: string): Promise<PlayerCard | null>;
  // Equipos
  listTeams(): Promise<Team[]>;
  getTeam(slug: string): Promise<Team | null>;
  createTeam(data: Omit<Team, 'id' | 'slug'>): Promise<Team>;
  updateTeam(slug: string, data: Partial<Team>): Promise<Team | null>;
  deleteTeam(slug: string): Promise<boolean>;
  // Club
  listClubs(): Promise<Club[]>;
  getClub(slug: string): Promise<Club | null>;
  updateClub(slug: string, data: Partial<Club>): Promise<Club | null>;
  // Resultados
  listRecentMatches(): Promise<Match[]>;
  updateMatch(id: string, updates: Partial<Match>): Promise<Match | null>;
  // Noticias
  listNews(): Promise<NewsItem[]>;
  createNews(data: Omit<NewsItem, 'id'>): Promise<NewsItem>;
  updateNews(id: string, data: Partial<NewsItem>): Promise<NewsItem | null>;
  deleteNews(id: string): Promise<boolean>;
  // Sponsors
  listSponsors(): Promise<Sponsor[]>;
  // Registro
  registerPair(input: RegisterPairInput): Promise<{ registration: Registration }>;
}

export const DATA_MODE: 'demo' | 'supabase' =
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
    ? 'supabase'
    : 'demo';
