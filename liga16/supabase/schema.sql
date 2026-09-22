-- Liga16 — Esquema de base de datos para Supabase (PostgreSQL)
-- Aplicar en SQL Editor del proyecto o con `supabase db push`.
-- Este proyecto representa la única sede: Club Pádel Reforma, Ciudad de México.

create extension if not exists "pgcrypto";

-- Tipos enumerados
create type if not exists user_role as enum ('player', 'captain', 'organizer', 'club', 'admin', 'sponsor');
create type if not exists sex_type as enum ('M', 'F', 'X');
create type if not exists dominant_hand as enum ('right', 'left', 'both');
create type if not exists court_position as enum ('drive', 'reves', 'both');
create type if not exists tournament_status as enum ('draft', 'published', 'registration_open', 'registration_closed', 'in_progress', 'finished', 'cancelled');
create type if not exists tournament_format as enum ('single_elimination', 'round_robin', 'groups_knockout', 'americano', 'mexicano', 'ladder', 'custom');
create type if not exists tournament_modality as enum ('pairs', 'singles', 'teams', 'league');
create type if not exists registration_status as enum ('started', 'payment_pending', 'payment_review', 'paid', 'refunded', 'cancelled', 'no_show');
create type if not exists payment_status as enum ('pending', 'review', 'paid', 'refunded', 'rejected');
create type if not exists payment_method as enum ('cash', 'transfer', 'stripe', 'mercado_pago');
create type if not exists match_status as enum ('scheduled', 'live', 'finished', 'walkover', 'disputed', 'cancelled');
create type if not exists dispute_status as enum ('open', 'under_review', 'resolved', 'rejected');
create type if not exists league_status as enum ('upcoming', 'active', 'finished');
create type if not exists invitation_status as enum ('pending', 'accepted', 'declined', 'expired');
create type if not exists sponsor_tier as enum ('principal', 'oro', 'plata', 'bronce');
create type if not exists news_tag as enum ('General', 'Resultados', 'Torneos', 'Ligas', 'Jugadores', 'Clubs');
create type if not exists tournament_category as enum ('18A', '18B', '18C', '16A', '16B', '14A', '14B', '12A', '12B', '10A', '10B');

-- Club / Sede
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  city text not null default 'Ciudad de México',
  state text not null default 'CDMX',
  address text,
  photo_url text,
  phone text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Torneos
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  cover_url text,
  club_id uuid references public.clubs (id) on delete set null,
  city text not null default 'Ciudad de México',
  state text not null default 'CDMX',
  start_date date not null,
  end_date date not null,
  registration_deadline date not null,
  status tournament_status not null default 'draft',
  modality tournament_modality not null default 'pairs',
  format tournament_format not null default 'single_elimination',
  organizer_id uuid references auth.users (id) on delete set null,
  price_cents integer not null default 0,
  currency text not null default 'MXN',
  rules_summary text,
  description text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tournaments_slug on public.tournaments(slug);
create index if not exists idx_tournaments_status on public.tournaments(status);
create index if not exists idx_tournaments_start_date on public.tournaments(start_date);

-- Categorías de torneo
create table if not exists public.tournament_categories (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  name text not null,
  category tournament_category not null,
  sex sex_type not null,
  price_cents integer not null default 0,
  unique (tournament_id, name)
);

-- Pares (inscripciones)
create table if not exists public.pairs (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  category_id uuid references public.tournament_categories (id) on delete set null,
  name text not null,
  player1_id uuid references public.player_profiles (id) on delete set null,
  player2_id uuid references public.player_profiles (id) on delete set null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists idx_pairs_tournament on public.pairs(tournament_id);

-- Registros
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  category_id uuid references public.tournament_categories (id) on delete set null,
  pair_id uuid references public.pairs (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  status registration_status not null default 'started',
  payment_method payment_method not null default 'cash',
  amount_cents integer,
  paid_at timestamptz,
  rules_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tournament_id, category_id, user_id)
);

-- Jugadores (perfiles)
create table if not exists public.player_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete cascade,
  display_name text not null,
  username text not null unique,
  photo_url text,
  city text not null default 'Ciudad de México',
  state text not null default 'CDMX',
  country text not null default 'MX',
  birth_date date,
  sex sex_type not null default 'X',
  declared_level numeric(3,1) not null default 3.0,
  official_level numeric(3,1),
  dominant_hand dominant_hand not null default 'right',
  preferred_position court_position not null default 'both',
  bio text,
  is_public boolean not null default true,
  role user_role not null default 'player',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_player_username on public.player_profiles(username);
create index if not exists idx_player_display_name on public.player_profiles(display_name);
create index if not exists idx_player_sex on public.player_profiles(sex);

-- Tarjetas de jugador (estadísticas)
create table if not exists public.player_cards (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique references public.player_profiles (id) on delete cascade,
  slug text not null unique,
  titles integer not null default 0,
  played integer not null default 0,
  won integer not null default 0,
  partner text,
  recent_results jsonb not null default '[]'::jsonb,
  trend jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Equipos
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  crest_url text,
  city text not null default 'Ciudad de México',
  state text not null default 'CDMX',
  captain_name text,
  captain_id uuid references public.player_profiles (id) on delete set null,
  category text not null default 'Primera División',
  record jsonb not null default '{"played": 0, "won": 0, "lost": 0}'::jsonb,
  position integer not null default 0,
  titles integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_teams_slug on public.teams(slug);
create index if not exists idx_teams_category on public.teams(category);

-- Miembros de equipo
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  player_id uuid not null references public.player_profiles (id) on delete cascade,
  role text not null default 'player',
  unique (team_id, player_id)
);

-- Ligas
create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  season text not null,
  city text not null default 'Ciudad de México',
  state text not null default 'CDMX',
  format tournament_format not null default 'round_robin',
  status league_status not null default 'upcoming',
  rules_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_leagues_slug on public.leagues(slug);

-- Divisiones de liga
create table if not exists public.league_divisions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  name text not null,
  teams integer not null default 0 check (teams >= 0)
);

-- Equipos en liga (posiciones)
create table if not exists public.league_teams (
  league_id uuid not null references public.leagues (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  division text,
  played integer not null default 0 check (played >= 0),
  won integer not null default 0 check (won >= 0),
  lost integer not null default 0 check (lost >= 0),
  position integer,
  primary key (league_id, team_id)
);

-- Partidos / Resultados
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments (id) on delete set null,
  tournament_name text,
  category_name text,
  round text,
  court_name text,
  scheduled_at timestamptz,
  status match_status not null default 'scheduled',
  side_a_pair_id uuid references public.pairs (id) on delete set null,
  side_b_pair_id uuid references public.pairs (id) on delete set null,
  side_a_score integer,
  side_b_score integer,
  winner text,
  sets jsonb,
  disputed_by text,
  dispute_status dispute_status,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_matches_tournament on public.matches(tournament_id);
create index if not exists idx_matches_status on public.matches(status);
create index if not exists idx_matches_scheduled on public.matches(scheduled_at);

-- Eventos de ranking
create table if not exists public.ranking_events (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.player_profiles (id) on delete cascade,
  tournament_id uuid references public.tournaments (id) on delete set null,
  points integer not null default 0,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ranking_events_player on public.ranking_events(player_id);
create index if not exists idx_ranking_events_tournament on public.ranking_events(tournament_id);

-- Vista consolidada de ranking
create or replace view public.ranking_view as
select
  pp.id as player_id,
  pp.display_name as player_name,
  pp.city,
  pp.state,
  pp.sex,
  coalesce(pp.official_level, pp.declared_level) as level,
  coalesce(sum(re.points), 0) as points,
  pc.played,
  pc.won,
  row_number() over (order by coalesce(sum(re.points), 0) desc, pp.display_name) as position
from public.player_profiles pp
left join public.ranking_events re on re.player_id = pp.id
left join public.player_cards pc on pc.player_id = pp.id
where pp.is_public = true
group by pp.id, pp.display_name, pp.city, pp.state, pp.sex, pc.played, pc.won
order by points desc, pp.display_name;

-- Noticias
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  excerpt text not null,
  image_url text,
  published_at timestamptz not null default now(),
  tag news_tag not null default 'General',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_news_published on public.news(published_at);

-- Sponsors
create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  website text,
  tier sponsor_tier not null default 'plata',
  created_at timestamptz not null default now()
);

-- Invitaciones
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade,
  player_id uuid references public.player_profiles (id) on delete set null,
  invited_by uuid not null references auth.users (id) on delete cascade,
  status invitation_status not null default 'pending',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================
-- RLS — Políticas de seguridad a nivel de fila
-- ============================================

alter table public.clubs enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_categories enable row level security;
alter table public.pairs enable row level security;
alter table public.registrations enable row level security;
alter table public.player_profiles enable row level security;
alter table public.player_cards enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.leagues enable row level security;
alter table public.league_divisions enable row level security;
alter table public.league_teams enable row level security;
alter table public.matches enable row level security;
alter table public.ranking_events enable row level security;
alter table public.news enable row level security;
alter table public.sponsors enable row level security;
alter table public.invitations enable row level security;
alter table public.ranking_view enable row level security;

-- Helpers
create or replace function public.current_user_id()
returns uuid as $$
  select auth.uid();
$$ language sql stable strict;

-- Clubs: lectura pública, escritura admin/organizer/club
create policy "Users can view clubs"
  on public.clubs for select
  to authenticated, anon
  using (true);

create policy "Admins and organizers can modify clubs"
  on public.clubs for all
  to authenticated
  using (
    EXISTS (
      select 1 from auth.users where auth.uid() = id and raw_user_meta_data->>'role' in ('admin', 'organizer')
    ) or EXISTS (
      select 1 from auth.users where auth.uid() = user_id and raw_user_meta_data->>'role' = 'club'
    )
  );

-- Tournaments: lectura pública, escritura admin/organizer
create policy "Public can view tournaments"
  on public.tournaments for select
  to authenticated, anon
  using (status != 'draft');

create policy "Admins and organizers manage tournaments"
  on public.tournaments for all
  to authenticated
  using (
    EXISTS (
      select 1 from auth.users where auth.uid() = id and raw_user_meta_data->>'role' in ('admin', 'organizer')
    )
  );

-- Tournament categories
create policy "Public can view tournament categories"
  on public.tournament_categories for select
  to authenticated, anon
  using (true);

create policy "Admins and organizers manage categories"
  on public.tournament_categories for all
  to authenticated
  using (
    EXISTS (
      select 1 from auth.users where auth.uid() = id and raw_user_meta_data->>'role' in ('admin', 'organizer')
    )
  );

-- Pairs
create policy "Public can view pairs"
  on public.pairs for select
  to authenticated, anon
  using (true);

create policy "Users manage own pairs"
  on public.pairs for all
  to authenticated
  using (
    EXISTS (
      select 1 from auth.users where auth.uid() = id and raw_user_meta_data->>'role' in ('admin', 'organizer', 'club')
    )
  );

-- Registrations
create policy "Users can view own registrations"
  on public.registrations for select
  to authenticated
  using (user_id = current_user_id());

create policy "Users can create own registrations"
  on public.registrations for insert
  to authenticated
  with check (user_id = current_user_id());

create policy "Admins and organizers manage registrations"
  on public.registrations for all
  to authenticated
  using (
    EXISTS (
      select 1 from auth.users where auth.uid() = id and raw_user_meta_data->>'role' in ('admin', 'organizer')
    )
  );

-- Player profiles
create policy "Public profiles are viewable"
  on public.player_profiles for select
  to authenticated, anon
  using (is_public = true);

create policy "Users can view own profile"
  on public.player_profiles for select
  to authenticated
  using (user_id = current_user_id());

create policy "Users can update own profile"
  on public.player_profiles for update
  to authenticated
  using (user_id = current_user_id())
  with check (true);

create policy "Admins and organizers manage players"
  on public.player_profiles for all
  to authenticated
  using (
    EXISTS (
      select 1 from auth.users where auth.uid() = id and raw_user_meta_data->>'role' in ('admin', 'organizer')
    )
  );

-- Player cards
create policy "Player cards viewable"
  on public.player_cards for select
  to authenticated, anon
  using (true);

create policy "Admins and organizers manage player cards"
  on public.player_cards for all
  to authenticated
  using (
    EXISTS (
      select 1 from auth.users where auth.uid() = id and raw_user_meta_data->>'role' in ('admin', 'organizer')
    )
  );

-- Teams: lectura pública, escritura admin/organizer
create policy "Public can view teams"
  on public.teams for select
  to authenticated, anon
  using (active = true);

create policy "Admins and organizers manage teams"
  on public.teams for all
  to authenticated
  using (
    EXISTS (
      select 1 from auth.users where auth.uid() = id and raw_user_meta_data->>'role' in ('admin', 'organizer')
    )
  );

-- Team members
create policy "Team members viewable"
  on public.team_members for select
  to authenticated, anon
  using (true);

create policy "Admins and organizers manage team members"
  on public.team_members for all
  to authenticated
  using (
    EXISTS (
      select 1 from auth.users where auth.uid() = id and raw_user_meta_data->>'role' in ('admin', 'organizer')
    )
  );

-- Leagues
create policy "Public can view leagues"
  on public.leagues for select
  to authenticated, anon
  using (true);

create policy "Admins and organizers manage leagues"
  on public.leagues for all
  to authenticated
  using (
    EXISTS (
      select 1 from auth.users where auth.uid() = id and raw_user_meta_data->>'role' in ('admin', 'organizer')
    )
  );

-- League divisions
create policy "League divisions viewable"
  on public.league_divisions for select
  to authenticated, anon
  using (true);

create policy "Admins and organizers manage league divisions"
  on public.league_divisions for all
  to authenticated
  using (
    EXISTS (
      select 1 from auth.users where auth.uid() = id and raw_user_meta_data->>'role' in ('admin', 'organizer')
    )
  );

-- League teams (positions)
create policy "League teams viewable"
  on public.league_teams for select
  to authenticated, anon
  using (true);

create policy "Admins and organizers manage league teams"
  on public.league_teams for all
  to authenticated
  using (
    EXISTS (
      select 1 from auth.users where auth.uid() = id and raw_user_meta_data->>'role' in ('admin', 'organizer')
    )
  );

-- Matches
create policy "Public can view matches"
  on public.matches for select
  to authenticated, anon
  using (true);

create policy "Admins and organizers manage matches"
  on public.matches for all
  to authenticated
  using (
    EXISTS (
      select 1 from auth.users where auth.uid() = id and raw_user_meta_data->>'role' in ('admin', 'organizer')
    )
  );

-- Ranking events
create policy "Ranking events viewable"
  on public.ranking_events for select
  to authenticated, anon
  using (true);

create policy "Users own their ranking events"
  on public.ranking_events for all
  to authenticated
  using (
    player_id = (select auth.uid()) or
    EXISTS (
      select 1 from auth.users where auth.uid() = id and raw_user_meta_data->>'role' in ('admin', 'organizer')
    )
  );

-- News
create policy "Public can view news"
  on public.news for select
  to authenticated, anon
  using (true);

create policy "Admins and organizers manage news"
  on public.news for all
  to authenticated
  using (
    EXISTS (
      select 1 from auth.users where auth.uid() = id and raw_user_meta_data->>'role' in ('admin', 'organizer')
    )
  );

-- Sponsors
create policy "Sponsors viewable"
  on public.sponsors for select
  to authenticated, anon
  using (true);

create policy "Admins and organizers manage sponsors"
  on public.sponsors for all
  to authenticated
  using (
    EXISTS (
      select 1 from auth.users where auth.uid() = id and raw_user_meta_data->>'role' in ('admin', 'organizer')
    )
  );

-- Invitations
create policy "Invitation recipients view"
  on public.invitations for select
  to authenticated
  using (
    player_id = current_user_id() or
    EXISTS (
      select 1 from auth.users where auth.uid() = id and raw_user_meta_data->>'role' in ('admin', 'organizer')
    )
  );

create policy "Admins and organizers manage invitations"
  on public.invitations for all
  to authenticated
  using (
    EXISTS (
      select 1 from auth.users where auth.uid() = id and raw_user_meta_data->>'role' in ('admin', 'organizer')
    )
  );

-- Ranking view: lectura pública
create policy "Ranking view is public"
  on public.ranking_view for select
  to authenticated, anon
  using (true);

-- ============================================
-- Funciones utilitarias
-- ============================================

create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers para updated_at automático
create trigger trigger_clubs_updated_at
  before update on public.clubs
  for each row execute function public.update_updated_at();

create trigger trigger_tournaments_updated_at
  before update on public.tournaments
  for each row execute function public.update_updated_at();

create trigger trigger_player_profiles_updated_at
  before update on public.player_profiles
  for each row execute function public.update_updated_at();

create trigger trigger_teams_updated_at
  before update on public.teams
  for each row execute function public.update_updated_at();

create trigger trigger_news_updated_at
  before update on public.news
  for each row execute function public.update_updated_at();

create trigger trigger_matches_updated_at
  before update on public.matches
  for each row execute function public.update_updated_at();

-- Trigger para crear player_cards automáticamente
create or replace function public.handle_new_player()
returns trigger as $$
begin
  insert into public.player_cards (player_id, slug)
  values (new.id, replace(lower(new.username), '.', '-') || '-' || substr(gen_random_uuid()::text, 1, 6));
  return new;
end;
$$ language plpgsql;

create trigger trigger_create_player_card
  after insert on public.player_profiles
  for each row execute function public.handle_new_player();

-- Trigger para crear perfil cuando se crea usuario en auth
create or replace function public.handle_auth_user_created()
returns trigger as $$
begin
  insert into public.player_profiles (user_id, display_name, username, email, city, state)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.email),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    'Ciudad de México',
    'CDMX'
  );
  return new;
end;
$$ language plpgsql;

create trigger trigger_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_created();
