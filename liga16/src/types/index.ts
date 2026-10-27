import type { RankCriterion } from "@/lib/liga16-scoring";
// Liga16 — modelo de dominio (alineado con supabase/schema.sql)

export type UUID = string;

export type Sex = 'M' | 'F' | 'X';
export type DominantHand = 'right' | 'left' | 'both';
export type CourtPosition = 'drive' | 'reves' | 'both';

// Categorías de padel por división
export type PadelDivision = '1ra' | '2da' | '3ra' | '4ta' | '5ta' | '6ta' | 'Novatos';

export type UserRole = 'player' | 'captain' | 'organizer' | 'club' | 'admin' | 'sponsor';

export type TournamentStatus =
  | 'draft'
  | 'published'
  | 'registration_open'
  | 'registration_closed'
  | 'in_progress'
  | 'finished'
  | 'cancelled';

export type TournamentFormat =
  | 'single_elimination'
  | 'round_robin'
  | 'groups_knockout'
  | 'americano'
  | 'mexicano'
  | 'ladder'
  | 'custom';

export type TournamentModality = 'pairs' | 'singles' | 'teams' | 'league';

export type RegistrationStatus =
  | 'started'
  | 'payment_pending'
  | 'payment_review'
  | 'paid'
  | 'refunded'
  | 'cancelled'
  | 'no_show';

export type PaymentStatus = 'pending' | 'review' | 'paid' | 'refunded' | 'rejected';
export type PaymentMethod = 'cash' | 'transfer' | 'stripe' | 'mercado_pago';

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'walkover' | 'disputed' | 'cancelled';

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'rejected';

export interface User {
  id: UUID;
  email: string;
  role: UserRole;
  player_id?: UUID | null;
  created_at: string;
}

export type PlayerStatus = 'pendiente' | 'verificado' | 'rechazado';

/** Lo único que edita el jugador de su propio perfil. */
export type MyProfileInput = Pick<
  PlayerProfile,
  'display_name' | 'username' | 'city' | 'state' | 'sex' | 'declared_level' | 'dominant_hand' | 'preferred_position'
> & { bio?: string | null; photo_url?: string | null };

export interface PlayerProfile {
  id: UUID;
  user_id: UUID;
  display_name: string;
  username: string;
  photo_url: string | null;
  city: string;
  state: string;
  country: string;
  birth_date: string | null;
  sex: Sex;
  declared_level: number; // 1.0 - 7.0
  official_level: number | null;
  dominant_hand: DominantHand;
  preferred_position: CourtPosition;
  bio: string | null;
  is_public: boolean;
  role: UserRole;
  /**
   * Autoregistro (opción A): el perfil es del jugador, la elegibilidad para
   * competir la da el admin. Ausente en bases viejas = verificado.
   */
  status?: PlayerStatus;
}

export interface Club {
  id: UUID;
  name: string;
  slug: string;
  city: string;
  state: string;
  address: string | null;
  photo_url: string | null;
  phone: string | null;
  description: string | null;
}

export interface Court {
  id: UUID;
  club_id: UUID;
  name: string;
  surface: string;
  indoor: boolean;
}

export interface Organizer {
  id: UUID;
  user_id: UUID;
  name: string;
  club_id: UUID | null;
}

export interface Tournament {
  id: UUID;
  slug: string;
  name: string;
  cover_url: string | null;
  club_id: UUID;
  club_name?: string;
  city: string;
  state: string;
  start_date: string;
  end_date: string;
  registration_deadline: string;
  status: TournamentStatus;
  modality: TournamentModality;
  format: TournamentFormat;
  organizer_id: UUID | null;
  price_cents: number;
  currency: string;
  /**
   * Cuántas parejas pasan a la ronda de semifinales. Lo define el organizador
   * al crear o editar el torneo; de aquí salen la probabilidad de clasificar y
   * el bracket. Null solo en torneos antiguos sin la migración aplicada.
   */
  semifinal_slots?: number | null;
  rules_summary: string | null;
  description: string | null;
  scoring?: TournamentScoring | null;
  /**
   * La disponibilidad real de este torneo: qué días hay juego, a qué horas y
   * con qué canchas.
   *
   * Es POR TORNEO porque cada torneo juega distinto: un torneo de fin de
   * semana en la mañana y otro de entre semana por la noche no comparten ni un
   * solo día. Antes esto vivía en el estado de la pantalla, así que se perdía
   * al recargar y no había forma de guardar la disponibilidad de un torneo para
   * el siguiente.
   *
   * Null si el torneo nunca se repartió, o si la columna todavía no existe en
   * la base (ver `supabase/tournament-schedule-config.sql`).
   */
  schedule_config?: TournamentScheduleConfig | null;
}

export interface TournamentCategory {
  category?: PadelDivision;
  id: UUID;
  tournament_id: UUID;
  name: string;
  sex: Sex;
  min_level: number | null;
  max_level: number | null;
  max_pairs: number;
  registered_pairs: number;
  price_cents: number;
}

export interface Pair {
  id: UUID;
  tournament_id: UUID;
  category_id: UUID;
  name: string;
  player1_id: UUID;
  player2_id: UUID;
  seed: number | null;
  group_name: string | null;
  /** 'withdrawn' = baja. Cualquier otro valor (o ausente) = sigue en el torneo. */
  status?: string;
}

export interface Registration {
  id: UUID;
  tournament_id: UUID;
  category_id: UUID;
  pair_id: UUID;
  status: RegistrationStatus;
  created_at: string;
}

/**
 * Registro con sus datos de pago. El esquema de Supabase guarda
 * payment_method, amount_cents y paid_at en la misma tabla `registrations`, y
 * el estado del pago es el propio `status` del registro.
 */
export interface RegistrationWithPayment extends Registration {
  payment_method: PaymentMethod;
  amount_cents: number | null;
  paid_at: string | null;
}

export interface Payment {
  id: UUID;
  registration_id: UUID;
  amount_cents: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  provider_ref: string | null;
  receipt_url: string | null;
}

export type MatchSide = { pair_id: UUID | null; pair_name: string };


export type TieBreakerRule =
  | 'points'
  | 'sets_won'
  | 'sets_diff'
  | 'games_won'
  | 'games_diff'
  | 'head_to_head'
  | 'tiebreak_won';

export type RankingMethod = 'match_points' | 'points_percentage';

export interface SetScore {
  a: number; // juegos del lado A
  b: number; // juegos del lado B
  tiebreak_a?: number | null; // puntos del tie-break (si aplica)
  tiebreak_b?: number | null;
}

export interface TournamentScoring {
  sets_to_win: number;
  games_per_set: number;
  tie_break_at: number;
  tie_break_points: number;
  win_by_two_tiebreak?: boolean;
  tie_breaker_rules?: TieBreakerRule[];
  /** Orden de criterios del ranking (ver liga16-scoring RankCriterion). Ausente = orden estándar. */
  rank_order?: RankCriterion[];
  ranking_method?: RankingMethod; // 'match_points' (3 pts/win) | 'points_percentage' (Liga16: pts_for/pts_total)
}

/**
 * La disponibilidad de un torneo: qué días hay juego, a qué horas y con qué
 * canchas. Vive en el torneo porque cada uno juega distinto.
 */
export interface TournamentScheduleConfig {
  /** Días con juego, "YYYY-MM-DD". */
  days: string[];
  /** Horas de inicio, 0-23. */
  hours: number[];
  /** Nombres de las canchas a usar. */
  courtNames: string[];
  /** Minutos que dura un partido. */
  minutesPerMatch: number;
}


export interface Match {
  id: UUID;
  tournament_id: UUID;
  tournament_name?: string;
  category_name?: string;
  round: string;
  court_name: string | null;
  scheduled_at: string | null;
  /** Duración real en minutos (60 u 90). Null/ausente = sin registrar: no se rellena a lo histórico. */
  duration_minutes?: number | null;
  status: MatchStatus;
  side_a: MatchSide;
  side_b: MatchSide;
  sets: SetScore[];
  winner: 'a' | 'b' | null;
}

export interface Standing {
  position: number;
  entity_id: UUID;
  entity_name: string;
  played: number;
  won: number;
  lost: number;
  sets_for: number;
  sets_against: number;
  points: number;
}


export interface PlayerCard {
  player_id: UUID;
  slug: string;
  titles: number;
  played: number;
  won: number;
  partner: string | null;
  recent_results: string[];
  trend: number[];
  division?: string | null;  // Categoría REAL: división de la pareja con la que compite
}

// En padel, un "equipo" es una pareja de 2 jugadores que compite en una división.
/** Una inscripción de la pareja (pairs): un torneo concreto. */
export interface TeamEntry {
  pair_id: UUID;
  tournament_id: UUID;
  tournament_name: string;
  scoring: TournamentScoring | null;
  /** Cupos a semifinales del torneo; null = no definido. */
  semifinal_slots: number | null;
  /** La pareja se dio de baja de este torneo (pairs.status = 'withdrawn'). */
  withdrawn?: boolean;
}

export interface Team {
  id: UUID;
  slug: string;
  name: string;              // Ej: "Fuentes / Rojas"
  crest_url: string | null;
  city: string;
  club_id: UUID | null;      // Club al que pertenece la pareja
  division: PadelDivision;   // 1ra, 2da, 3ra, 4ta, 5ta, 6ta, Novatos
  /** Categoría de inscripción original (ej. "Suma 9", "4ta Femenil"). */
  category_name?: string | null;
  sex: Sex;                  // M, F, X
  player1: { player_id: UUID; name: string; level: number } | null;
  player2: { player_id: UUID; name: string; level: number } | null;
  /** Foto/avatar de cada jugador de la pareja (opcional). */
  photo1_url?: string | null;
  photo2_url?: string | null;
  position: number;          // Posición en la división
  /** PUNTOS_TOTALES del Excel, en % (0-100). Es lo que ordena la posición.
   * Antes valía `ganadas × 3`, un criterio que no está en la especificación y
   * que ya no decidía el orden. */
  points: number;
  /** Alias de `points`, nullable: null = la pareja no ha jugado ningún partido. */
  rendimiento_pct?: number | null;
  played: number;
  won: number;
  lost: number;
  sets_for: number;
  sets_against: number;
  titles: number;
  /** Torneos en los que está inscrita (por nombre de pareja). Vacío/ausente = sin dato. */
  entries?: TeamEntry[];
  tied?: boolean;            // Indica empate en ranking dentro de división/sex
}

export interface League {
  id: UUID;
  slug: string;
  name: string;
  season: string;
  city: string;
  format: TournamentFormat;
  status: 'active' | 'upcoming' | 'finished';
  divisions: { name: string; teams: number }[];
  rules_summary: string | null;
}

export interface Sponsor {
  id: UUID;
  name: string;
  logo_url: string | null;
  website: string | null;
  tier: 'principal' | 'oro' | 'plata' | 'bronce';
}

export interface NewsItem {
  id: UUID;
  title: string;
  excerpt: string;
  image_url: string | null;
  published_at: string;
  tag: string;
}

export interface Dispute {
  id: UUID;
  match_id: UUID;
  reporter_id: UUID;
  reason: string;
  status: DisputeStatus;
  resolution_note: string | null;
}

export interface TournamentFilters {
  status?: TournamentStatus | 'all';
  category?: string;
  format?: TournamentFormat | 'all';
}

// ——— Bandeja de entrada / alertas de admin ————————————————————————

export type AlertType =
  | 'player_pending'
  | 'tournament_starting'
  | 'match_live'
  | 'match_disputed'
  | 'registration_closing_soon';

export type AlertSeverity = 'info' | 'warning' | 'critical';

/** Alerta derivada de datos en vivo (no se persiste en una tabla). */
export interface AdminAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  /** Ruta dentro del admin a la que lleva el ítem. */
  href: string;
  /** ISO 8601 para ordenar. */
  timestamp: string;
  /** Cuando la alerta agrupa varios ítems (p. ej. jugadores pendientes). */
  count?: number;
  }
