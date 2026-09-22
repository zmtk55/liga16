-- Liga16 — Esquema de base de datos para Supabase (PostgreSQL)
-- Aplicar en: SQL Editor del proyecto Supabase, o `supabase db push`.
-- Incluye RLS básico. Ver README.md «Conectar Supabase».

create extension if not exists "pgcrypto";

-- Tipos enumerados
create type user_role as enum ('player', 'captain', 'organizer', 'club', 'admin', 'sponsor');
create type sex_type as enum ('M', 'F', 'X');
create type dominant_hand as enum ('right', 'left', 'both');
create type court_position as enum ('drive', 'reves', 'both');
create type tournament_status as enum ('draft','published','registration_open','registration_closed','in_progress','finished','cancelled');
create type tournament_format as enum ('single_elimination','round_robin','groups_knockout','americano','mexicano','ladder','custom');
create type tournament_modality as enum ('pairs','singles','teams','league');
create type registration_status as enum ('started','payment_pending','payment_review','paid','refunded','cancelled','no_show');
create type payment_status as enum ('pending','review','paid','refunded','rejected');
create type payment_method as enum ('cash','transfer','stripe','mercado_pago');
create type match_status as enum ('scheduled','live','finished','walkover','disputed','cancelled');
create type dispute_status as enum ('open','under_review','resolved','rejected');
create type league_status as enum ('upcoming','active','finished');
create type invitation_status as enum ('pending','accepted','declined','expired');
create type sponsor_tier as enum ('principal','oro','plata','bronce');

-- Identidad y perfiles
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role user_role not null default 'player',
  created_at timestamptz not null default now()
);

create table public.player_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  display_name text not null,
  username text not null unique,
  photo_url text,
  city text not null default '',
  state text not null default '',
  country text not null default 'México',
  birth_date date,
  sex sex_type not null default 'X',
  declared_level numeric(2,1) not null default 3.0 check (declared_level between 1.0 and 7.0),
  official_level numeric(2,1) check (official_level between 1.0 and 7.0),
  dominant_hand dominant_hand not null default 'right',
  preferred_position court_position not null default 'both',
  bio text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.level_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.player_profiles (id) on delete cascade,
  old_level numeric(2,1),
  new_level numeric(2,1) not null,
  reason text not null,
  changed_by uuid references public.users (id),
  created_at timestamptz not null default now()
);

-- Clubes y canchas
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  city text not null,
  state text not null,
  address text,
  photo_url text,
  phone text,
  description text,
  created_at timestamptz not null default now()
);

create table public.courts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  name text not null,
  surface text not null default 'cemento',
  indoor boolean not null default false
);

-- Organizadores
create table public.organizers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  club_id uuid references public.clubs (id) on delete set null
);

-- Torneos
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  cover_url text,
  club_id uuid not null references public.clubs (id) on delete cascade,
  city text not null,
  state text not null,
  start_date date not null,
  end_date date not null,
  registration_deadline date not null,
  status tournament_status not null default 'draft',
  modality tournament_modality not null default 'pairs',
  format tournament_format not null default 'groups_knockout',
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  price_cents integer not null default 0,
  currency text not null default 'MXN',
  rules_summary text,
  description text,
  created_at timestamptz not null default now()
);

create table public.tournament_categories (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  name text not null,
  sex sex_type not null default 'X',
  min_level numeric(2,1) check (min_level between 1.0 and 7.0),
  max_level numeric(2,1) check (max_level between 1.0 and 7.0),
  max_pairs integer not null default 16,
  price_cents integer not null default 0
);

-- Parejas e inscripciones
create table public.pairs (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  category_id uuid not null references public.tournament_categories (id) on delete cascade,
  name text not null,
  player1_id uuid references public.player_profiles (id),
  player2_id uuid references public.player_profiles (id),
  seed integer
);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  category_id uuid not null references public.tournament_categories (id) on delete cascade,
  pair_id uuid not null references public.pairs (id) on delete cascade,
  status registration_status not null default 'payment_pending',
  rules_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  amount_cents integer not null,
  currency text not null default 'MXN',
  method payment_method not null,
  status payment_status not null default 'pending',
  provider_ref text,
  receipt_url text,
  created_at timestamptz not null default now()
);

-- Partidos
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  category_id uuid references public.tournament_categories (id) on delete set null,
  round text not null default 'Ronda 1',
  court_id uuid references public.courts (id) on delete set null,
  scheduled_at timestamptz,
  status match_status not null default 'scheduled',
  winner text check (winner in ('a','b') or winner is null),
  sets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Disputas
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  reporter_id uuid not null references public.player_profiles (id),
  reason text not null,
  status dispute_status not null default 'open',
  resolution_note text,
  created_at timestamptz not null default now()
);

-- Ligas por equipos
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  crest_url text,
  city text not null,
  captain_id uuid references public.player_profiles (id),
  category text,
  division text,
  created_at timestamptz not null default now()
);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  player_id uuid not null references public.player_profiles (id) on delete cascade,
  role text not null default 'player',
  unique (team_id, player_id)
);

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  season text not null,
  city text not null default 'Circuito nacional',
  format tournament_format not null default 'round_robin',
  status league_status not null default 'upcoming',
  rules_summary text,
  created_at timestamptz not null default now()
);

create table public.league_divisions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  name text not null,
  teams integer not null default 0
);

create table public.league_teams (
  league_id uuid not null references public.leagues (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  division text,
  played integer not null default 0,
  won integer not null default 0,
  lost integer not null default 0,
  position integer,
  primary key (league_id, team_id)
);

-- Ranking
create table public.ranking_events (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.player_profiles (id) on delete cascade,
  tournament_id uuid references public.tournaments (id) on delete set null,
  points integer not null default 0,
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.player_cards (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique references public.player_profiles (id) on delete cascade,
  slug text not null unique,
  titles integer not null default 0,
  played integer not null default 0,
  won integer not null default 0,
  frequent_partner text,
  recent_results jsonb not null default '[]'::jsonb,
  trend jsonb not null default '[]'::jsonb
);

-- Ranking consolidado (vista)
create or replace view public.ranking_view as
select
  pp.id as player_id,
  pp.display_name as player_name,
  pp.city,
  pp.sex,
  coalesce(pp.official_level, pp.declared_level) as level,
  coalesce(sum(re.points), 0) as points,
  pc.played,
  pc.won,
  row_number() over () as position
from public.player_profiles pp
left join public.ranking_events re on re.player_id = pp.id
left join public.player_cards pc on pc.player_id = pp.id
where pp.is_public = true
group by pp.id, pc.played, pc.won
order by points desc;

-- Noticias y sponsors
create table public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  excerpt text not null,
  image_url text,
  published_at timestamptz not null default now(),
  tag text not null default 'General'
);

create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  website text,
  tier sponsor_tier not null default 'plata'
);

-- RLS (lectura pública para datos del circuito)
alter table public.clubs enable row level security;
alter table public.courts enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_categories enable row level security;
alter table public.pairs enable row level security;
alter table public.matches enable row level security;
alter table public.leagues enable row level security;
alter table public.teams enable row level security;
alter table public.ranking_events enable row level security;
alter table public.player_cards enable row level security;
alter table public.news enable row level security;
alter table public.sponsors enable row level security;

create policy "lectura publica datos circuito" on public.clubs for select using (true);
create policy "lectura publica canchas" on public.courts for select using (true);
create policy "lectura publica torneos" on public.tournaments for select using (true);
create policy "lectura publica categorias torneo" on public.tournament_categories for select using (true);
create policy "lectura publica parejas" on public.pairs for select using (true);
create policy "lectura publica partidos" on public.matches for select using (true);
create policy "lectura publica ligas" on public.leagues for select using (true);
create policy "lectura publica equipos" on public.teams for select using (true);
create policy "lectura publica eventos ranking" on public.ranking_events for select using (true);
create policy "lectura publica tarjetas jugador" on public.player_cards for select using (true);
create policy "lectura publica noticias" on public.news for select using (true);
create policy "lectura publica sponsors" on public.sponsors for select using (true);

-- Perfil de jugador: lectura pública limitada
create policy "lectura perfiles publicos" on public.player_profiles for select using (is_public = true);
alter table public.player_profiles enable row level security;

-- Inscripciones: el organizador y el admin gestionan; el jugador puede leer las propias.
alter table public.registrations enable row level security;
create policy "registros propios" on public.registrations
  for select using (auth.uid() in (
    select user_id from public.player_profiles where id = pair_id
  ));
create policy "admin gestiona registros" on public.registrations
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role in ('admin','organizer'))
  );

-- Disparadores: crea perfil al registrarse un usuario
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email) values (new.id, coalesce(new.email, ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nota: el esquema demo (src/lib/data/seed.ts) es la referencia de datos para desarrollo.
-- Este esquema replica las mismas tablas para el modo Supabase (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY).