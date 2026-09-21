// Liga16 — modelo de dominio (alineado con supabase/schema.sql)

export type UUID = string;

export type Sex = 'M' | 'F' | 'X';
export type DominantHand = 'right' | 'left' | 'both';
export type CourtPosition = 'drive' | 'reves' | 'both';

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
  created_at: string;
}

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
  organizer_id: UUID;
  price_cents: number;
  currency: string;
  rules_summary: string | null;
  description: string | null;
}

export interface TournamentCategory {
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
}

export interface Registration {
  id: UUID;
  tournament_id: UUID;
  category_id: UUID;
  pair_id: UUID;
  status: RegistrationStatus;
  created_at: string;
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
export type SetScore = { a: number; b: number };

export interface Match {
  id: UUID;
  tournament_id: UUID;
  tournament_name?: string;
  category_name?: string;
  round: string;
  court_name: string | null;
  scheduled_at: string | null;
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

export interface RankingEntry {
  position: number;
  player_id: UUID;
  player_name: string;
  city: string;
  sex?: Sex;
  level: number;
  points: number;
  delta: number;
  played: number;
  won: number;
}

export interface RankingEvent {
  id: UUID;
  player_id: UUID;
  tournament_id: UUID | null;
  points: number;
  reason: string;
  created_at: string;
}

export interface PlayerCard {
  player_id: UUID;
  slug: string;
  titles: number;
  record: { played: number; won: number };
  frequent_partner: string | null;
  recent_results: string[];
  trend: number[];
}

export interface Team {
  id: UUID;
  slug: string;
  name: string;
  crest_url: string | null;
  city: string;
  captain_name: string;
  members: { player_id: UUID; name: string; level: number }[];
  category: string;
  record: { played: number; won: number; lost: number };
  position: number;
  titles: number;
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
  city?: string;
  status?: TournamentStatus | 'all';
  category?: string;
  format?: TournamentFormat | 'all';
}
