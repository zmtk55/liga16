-- Liga16 — Esquema de base de datos para Supabase (PostgreSQL)
-- Aplicar en SQL Editor del proyecto o con `supabase db push`.
-- Este proyecto representa la única sede: Club Pádel Reforma, Ciudad de México.

create extension if not exists "pgcrypto";

-- Tipos enumerados (PostgreSQL no soporta CREATE TYPE IF NOT EXISTS; se usan bloques DO idempotentes)
do $$ begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('player', 'captain', 'organizer', 'club', 'admin', 'sponsor');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'sex_type') then
    create type sex_type as enum ('M', 'F', 'X');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'dominant_hand') then
    create type dominant_hand as enum ('right', 'left', 'both');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'court_position') then
    create type court_position as enum ('drive', 'reves', 'both');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'tournament_status') then
    create type tournament_status as enum ('draft', 'published', 'registration_open', 'registration_closed', 'in_progress', 'finished', 'cancelled');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'tournament_format') then
    create type tournament_format as enum ('single_elimination', 'round_robin', 'groups_knockout', 'americano', 'mexicano', 'ladder', 'custom');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'tournament_modality') then
    create type tournament_modality as enum ('pairs', 'singles', 'teams', 'league');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'registration_status') then
    create type registration_status as enum ('started', 'payment_pending', 'payment_review', 'paid', 'refunded', 'cancelled', 'no_show');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum ('pending', 'review', 'paid', 'refunded', 'rejected');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type payment_method as enum ('cash', 'transfer', 'stripe', 'mercado_pago');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'match_status') then
    create type match_status as enum ('scheduled', 'live', 'finished', 'walkover', 'disputed', 'cancelled');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'dispute_status') then
    create type dispute_status as enum ('open', 'under_review', 'resolved', 'rejected');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'league_status') then
    create type league_status as enum ('upcoming', 'active', 'finished');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'invitation_status') then
    create type invitation_status as enum ('pending', 'accepted', 'declined', 'expired');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'sponsor_tier') then
    create type sponsor_tier as enum ('principal', 'oro', 'plata', 'bronce');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'news_tag') then
    create type news_tag as enum ('General', 'Resultados', 'Torneos', 'Ligas', 'Jugadores', 'Clubs');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'padel_division') then
    create type padel_division as enum ('1ra', '2da', '3ra', '4ta', '5ta', '6ta', 'Novatos');
  end if;
end $$;

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
  scoring jsonb default '{"sets_to_win":2,"games_per_set":6,"tie_break_at":6,"tie_break_points":7,"win_by_two_tiebreak":true,"tie_breaker_rules":["points","sets_diff","games_diff","head_to_head"]}'::jsonb,
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
  category padel_division not null default '1ra',
  sex sex_type not null,
  price_cents integer not null default 0,
  unique (tournament_id, name)
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

-- Pares (inscripciones)
create table if not exists public.pairs (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  category_id uuid references public.tournament_categories (id) on delete set null,
  name text not null,
  player1_id uuid references public.player_profiles (id) on delete set null,
  player2_id uuid references public.player_profiles (id) on delete set null,
  seed integer,
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

-- Equipos: en padel, un equipo es una pareja de 2 jugadores en una división.
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,                       -- Ej: "Fuentes / Rojas"
  crest_url text,
  city text not null default 'Ciudad de México',
  club_id uuid references public.clubs (id) on delete set null,
  division text not null default '1ra',     -- 1ra, 2da, 3ra, 4ta, 5ta, 6ta, Novatos
  sex text not null default 'M',            -- M, F, X
  player1_name text,                        -- Jugador 1 de la pareja
  player1_level numeric(3,1),               -- Nivel 1.0-7.0
  player2_name text,                        -- Jugador 2 de la pareja
  player2_level numeric(3,1),               -- Nivel 1.0-7.0
  position integer not null default 0,
  points integer not null default 0,
  played integer not null default 0,
  won integer not null default 0,
  lost integer not null default 0,
  sets_for integer not null default 0,
  sets_against integer not null default 0,
  titles integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_teams_slug on public.teams(slug);
create index if not exists idx_teams_division on public.teams(division);

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
  side_a_name text,
  side_b_name text,
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
create or replace view public.ranking_view
with (security_invoker = true) as
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
alter table public.leagues enable row level security;
alter table public.league_divisions enable row level security;
alter table public.league_teams enable row level security;
alter table public.matches enable row level security;
alter table public.ranking_events enable row level security;
alter table public.news enable row level security;
alter table public.sponsors enable row level security;
alter table public.invitations enable row level security;

-- Helpers
create or replace function public.current_user_id()
returns uuid as $$
  select auth.uid();
$$ language sql stable strict;

-- Helper de rol admin/organizer/club para policies RLS.
-- SECURITY DEFINER: la función corre con los privilegios del dueño (postgres),
-- que sí puede leer auth.users. Con una subquery directa desde una policy,
-- el rol authenticated no tiene GRANT sobre auth.users y toda policy que la
-- consulte falla con "permission denied for table users".
create or replace function public.is_admin_or_organizer(allowed_roles text[])
returns boolean as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and raw_app_meta_data->>'role' = any(allowed_roles)
  );
$$ language sql stable security definer set search_path = public, auth;

-- Clubs: lectura pública, escritura admin/organizer/club
create policy "Users can view clubs"
  on public.clubs for select
  to authenticated, anon
  using (true);

create policy "Admins and organizers can modify clubs"
  on public.clubs for all
  to authenticated
  using (
    is_admin_or_organizer(['admin', 'organizer', 'club'])
  );

-- Tournaments: lectura pública, escritura admin/organizer
-- Nota: usa raw_app_meta_data (NO raw_user_meta_data) porque este último es editable por el usuario.
-- El rol debe guardarse en raw_app_meta_data al crear el usuario.
create policy "Public can view tournaments"
  on public.tournaments for select
  to anon, authenticated
  using (status != 'draft');

create policy "Admins and organizers manage tournaments"
  on public.tournaments for all
  to authenticated
  using (
    is_admin_or_organizer(['admin', 'organizer'])
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
    is_admin_or_organizer(['admin', 'organizer'])
  )
  with check (true);

-- Pairs
create policy "Public can view pairs"
  on public.pairs for select
  to authenticated, anon
  using (true);

create policy "Users manage own pairs"
  on public.pairs for all
  to authenticated
  using (
    is_admin_or_organizer(['admin', 'organizer', 'club'])
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
    is_admin_or_organizer(['admin', 'organizer'])
  )
  with check (true);

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
  with check (user_id = current_user_id());

create policy "Admins and organizers manage players"
  on public.player_profiles for all
  to authenticated
  using (
    is_admin_or_organizer(['admin', 'organizer'])
  )
  with check (true);

-- Player cards
create policy "Player cards viewable"
  on public.player_cards for select
  to authenticated, anon
  using (true);

create policy "Admins and organizers manage player cards"
  on public.player_cards for all
  to authenticated
  using (
    is_admin_or_organizer(['admin', 'organizer'])
  )
  with check (true);

-- Teams: lectura pública, escritura admin/organizer
create policy "Public can view teams"
  on public.teams for select
  to authenticated, anon
  using (true);

create policy "Admins and organizers manage teams"
  on public.teams for all
  to authenticated
  using (
    is_admin_or_organizer(['admin', 'organizer'])
  )
  with check (true);

-- Leagues
create policy "Public can view leagues"
  on public.leagues for select
  to authenticated, anon
  using (true);

create policy "Admins and organizers manage leagues"
  on public.leagues for all
  to authenticated
  using (
    is_admin_or_organizer(['admin', 'organizer'])
  )
  with check (true);

-- League divisions
create policy "League divisions viewable"
  on public.league_divisions for select
  to authenticated, anon
  using (true);

create policy "Admins and organizers manage league divisions"
  on public.league_divisions for all
  to authenticated
  using (
    is_admin_or_organizer(['admin', 'organizer'])
  )
  with check (true);

-- League teams (positions)
create policy "League teams viewable"
  on public.league_teams for select
  to authenticated, anon
  using (true);

create policy "Admins and organizers manage league teams"
  on public.league_teams for all
  to authenticated
  using (
    is_admin_or_organizer(['admin', 'organizer'])
  )
  with check (true);

-- Matches
create policy "Public can view matches"
  on public.matches for select
  to authenticated, anon
  using (true);

create policy "Admins and organizers manage matches"
  on public.matches for all
  to authenticated
  using (
    is_admin_or_organizer(['admin', 'organizer'])
  )
  with check (true);

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
    is_admin_or_organizer(['admin', 'organizer'])
  )
  with check (player_id = (select auth.uid()));

-- News
create policy "Public can view news"
  on public.news for select
  to authenticated, anon
  using (true);

create policy "Admins and organizers manage news"
  on public.news for all
  to authenticated
  using (
    is_admin_or_organizer(['admin', 'organizer'])
  )
  with check (true);

-- Sponsors
create policy "Sponsors viewable"
  on public.sponsors for select
  to authenticated, anon
  using (true);

create policy "Admins and organizers manage sponsors"
  on public.sponsors for all
  to authenticated
  using (
    is_admin_or_organizer(['admin', 'organizer'])
  )
  with check (true);

-- Invitations
create policy "Invitation recipients view"
  on public.invitations for select
  to authenticated
  using (
    player_id = current_user_id() or
    is_admin_or_organizer(['admin', 'organizer'])
  );

create policy "Admins and organizers manage invitations"
  on public.invitations for all
  to authenticated
  using (
    is_admin_or_organizer(['admin', 'organizer'])
  )
  with check (true);

-- Ranking view: lectura pública
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
-- Lee de raw_app_meta_data con fallback a raw_user_meta_data por seguridad
-- Tolerante a fallos: si el perfil no se puede crear, el usuario SÍ se crea
create or replace function public.handle_auth_user_created()
returns trigger as $$
begin
  begin
    insert into public.player_profiles (user_id, display_name, username, city, state)
    values (
      new.id,
      coalesce(new.raw_app_meta_data->>'display_name', new.raw_user_meta_data->>'display_name', new.email),
      coalesce(new.raw_app_meta_data->>'username', new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)) || '-' || substr(new.id::text, 1, 6),
      'Ciudad de México',
      'CDMX'
    );
  exception when others then
    raise warning 'handle_auth_user_created: no se pudo crear perfil para %: %', new.email, sqlerrm;
  end;
  return new;
end;
$$ language plpgsql;

create trigger trigger_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_created();

-- Sincroniza role de raw_user_meta_data a raw_app_meta_data para RLS seguro
-- Tras signup, el role viaja en raw_user_meta_data pero RLS lo lee de raw_app_meta_data
create or replace function public.sync_role_app_metadata()
returns trigger as $$
begin
  if new.raw_user_meta_data ? 'role' then
    new.raw_app_meta_data := jsonb_set(
      coalesce(new.raw_app_meta_data, '{}'::jsonb),
      '{role}',
      new.raw_user_meta_data->'role'
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trigger_sync_role_app_metadata
  before insert or update on auth.users
  for each row execute function public.sync_role_app_metadata();

-- Actualiza raw_app_metadata cuando cambia raw_user_metadata (rol update)
create or replace function public.sync_role_on_update()
returns trigger as $$
begin
  if new.raw_user_meta_data ->> 'role' is distinct from old.raw_user_meta_data ->> 'role' then
    new.raw_app_meta_data := jsonb_set(
      coalesce(new.raw_app_meta_data, '{}'::jsonb),
      '{role}',
      new.raw_user_meta_data->'role'
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trigger_sync_role_update
  before update on auth.users
  for each row execute function public.sync_role_on_update();
