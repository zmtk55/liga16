// Interfaz única de acceso a datos de Liga16.
// Las páginas consumen `db`, sin saber si detrás hay datos demo o Supabase.
import type { PlayerRecord } from '@/lib/records';
import type { MyProfileInput, PlayerStatus } from '@/types';
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
  RegistrationStatus,
  Sponsor,
  Team,
  Tournament,
  TournamentCategory,
  TournamentFilters,
  UUID,
  Court,
  PaymentMethod,
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

/**
 * Fila de la vista global de participantes. Los ids de jugador están
 * presentes para conectar la pareja con el directorio (nivel, ciudad, foto),
 * y los campos `registration_*` traen su inscripción del flujo público, si la
 * tiene. Una pareja creada desde el admin no tiene inscripción: todo es null.
 */
export interface AllPair {
  id: UUID;
  name: string;
  category_id: UUID | null;
  category_name: string | null;
  tournament_id: UUID | null;
  tournament_name: string | null;
  created_at: string | null;
  player1_id: UUID | null;
  player2_id: UUID | null;
  registration_id: UUID | null;
  /** El estado de pago vive aquí: payment_pending → payment_review → paid. */
  registration_status: RegistrationStatus | null;
  payment_method: PaymentMethod | null;
  amount_cents: number | null;
}

export interface DataProvider {
  // Torneos
  listTournaments(filters?: Omit<TournamentFilters, 'city'>): Promise<Tournament[]>;
  getTournament(slug: string): Promise<Tournament | null>;
  createTournament(data: Omit<Tournament, 'id' | 'slug'>): Promise<Tournament>;
  updateTournament(slug: string, data: Partial<Tournament>): Promise<Tournament | null>;
  deleteTournament(slug: string): Promise<boolean>;
  getTournamentCategories(tournamentId: string): Promise<TournamentCategory[]>;
  createTournamentCategory(data: Omit<TournamentCategory, 'id'>): Promise<TournamentCategory>;
  deleteTournamentCategory(id: string): Promise<void>;
  getTournamentPairs(tournamentId: string): Promise<Pair[]>;
  /**
   * Todas las parejas del circuito, con el nombre de categoría y torneo ya
   * resueltos, más los ids de jugador para conectar con el directorio.
   */
  listAllPairs(): Promise<AllPair[]>;
  createPair(data: { tournament_id: UUID; category_id?: UUID | null; name: string; seed?: number | null; player1_id?: UUID | null; player2_id?: UUID | null; crest_url?: string | null }): Promise<Pair>;
  updatePair(id: UUID, data: { name?: string; category_id?: UUID | null; seed?: number | null; tournament_id?: UUID; crest_url?: string | null }): Promise<Pair>;
  deletePair(id: UUID): Promise<boolean>;
  /**
   * Cambia el estado de una inscripción (p. ej. confirmar el pago). Pasar a
   * `paid` sella `paid_at` con la hora actual; cualquier otro estado lo limpia.
   */
  setRegistrationStatus(registrationId: UUID, status: RegistrationStatus): Promise<void>;
  listMatchesByTournament(tournamentId: string): Promise<Match[]>;
  createMatches(matches: Array<Omit<Match, 'id'>>): Promise<Match[]>;
  updateMatch(id: string, updates: Partial<Match>): Promise<Match | null>;
  deleteMatchesByTournament(tournamentId: string): Promise<boolean>;
  // Canchas
  listCourts(): Promise<Court[]>;
  createCourt(data: Omit<Court, 'id'>): Promise<Court>;
  deleteCourt(id: string): Promise<boolean>;
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
  /** Categoría REAL por jugador: división de la pareja con la que compite. */
  listPlayerDivisions(): Promise<Record<string, string>>;
  /** Perfil ligado a la cuenta con sesión (autoregistro, opción A). */
  getMyProfile(): Promise<PlayerProfile | null>;
  /** Crea el perfil del jugador con su cuenta ya iniciada. */
  createMyProfile(data: MyProfileInput): Promise<PlayerProfile>;
  /** El jugador edita SU perfil; status/official_level/role los decide el admin. */
  updateMyProfile(id: string, data: MyProfileInput): Promise<PlayerProfile>;
  /** Verificación administrativa: approve = 'verificado', reject = 'rechazado'. */
  setPlayerStatus(id: string, status: PlayerStatus): Promise<PlayerProfile>;
  /**
   * Récord personal derivado de TODOS los partidos del jugador, aunque haya
   * cambiado de pareja. Es la unidad estable del desempeño.
   */
  getPlayerRecord(playerId: string): Promise<PlayerRecord | null>;
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
  createSponsor(data: Omit<Sponsor, 'id'>): Promise<Sponsor>;
  updateSponsor(id: string, data: Partial<Sponsor>): Promise<Sponsor | null>;
  deleteSponsor(id: string): Promise<boolean>;
  // Registro
  registerPair(input: RegisterPairInput): Promise<{ registration: Registration }>;
}

export const DATA_MODE: 'demo' | 'supabase' =
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
    ? 'supabase'
    : 'demo';
