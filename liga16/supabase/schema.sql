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

-- Identidad y perfiles
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role user_role not null default 'player',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  display_name text not null,
  username text not null unique,
  photo_url text,
  city text not null default 'Ciudad de México',
  state text not null default 'CDMX',
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

create table if not exists public.level_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.player_profiles (id) on delete cascade,
  old_level numeric(2,1),
  new_level numeric(2,1) not null,
  reason text not null,
  changed_by uuid references public.users (id),
  created_at timestamptz not null default now()
);

-- Clubes y canchas
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
  created_at timestamptz not null default now()
);

create table if not exists public.courts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  name text not null,
  surface text not null default 'cemento',
  indoor boolean not null default false
);

-- Organizadores
create table if not exists public.organizers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  name text not null,
  club_id uuid references public.clubs (id) on delete set null
);

-- Torneos
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  cover_url text,
  club_id uuid not null references public.clubs (id) on delete cascade,
  city text not null default 'Ciudad de México',
  state text not null default 'CDMX',
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

create table if not exists public.tournament_categories (
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
create table if not exists public.pairs (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  category_id uuid not null references public.tournament_categories (id) on delete cascade,
  name text not null,
  player1_id uuid references public.player_profiles (id),
  player2_id uuid references public.player_profiles (id),
  seed integer
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  category_id uuid not null references public.tournament_categories (id) on delete cascade,
  pair_id uuid not null references public.pairs (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  status registration_status not null default 'payment_pending',
  rules_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tournament_id, pair_id)
);

create table if not exists public.payments (
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
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  category_id uuid references public.tournament_categories (id) on delete set null,
  round text not null default 'Ronda 1',
  court_id uuid references public.courts (id) on delete set null,
  scheduled_at timestamptz,
  status match_status not null default 'scheduled',
  winner text check (winner in ('a', 'b') or winner is null),
  sets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Disputas
create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  reporter_id uuid not null references public.player_profiles (id),
  reason text not null,
  status dispute_status not null default 'open',
  resolution_note text,
  created_at timestamptz not null default now()
);

-- Ligas por equipos
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  crest_url text,
  city text not null default 'Ciudad de México',
  state text not null default 'CDMX',
  captain_id uuid references public.player_profiles (id),
  category text,
  division text,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  player_id uuid not null references public.player_profiles (id) on delete cascade,
  role text not null default 'player',
  unique (team_id, player_id)
);

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
  created_at timestamptz not null default now()
);

create table if not exists public.league_divisions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  name text not null,
  teams integer not null default 0 check (teams >= 0)
);

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

-- Ranking
create table if not exists public.ranking_events (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.player_profiles (id) on delete cascade,
  tournament_id uuid references public.tournaments (id) on delete set null,
  points integer not null default 0,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.player_cards (
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

-- Noticias y sponsors
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  excerpt text not null,
  image_url text,
  published_at timestamptz not null default now(),
  tag text not null default 'General'
);

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  website text,
  tier sponsor_tier not null default 'plata'
);

-- Helpers usados por las políticas RLS
create or replace function public.is_admin_or_organizer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.role in ('organizer', 'admin')
    );
$$;

create or replace function public.pair_belongs_to_current_user(target_pair_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pairs p
    join public.player_profiles p1 on p1.id = p.player1_id
    join public.player_profiles p2 on p2.id = p.player2_id
    where p.id = target_pair_id
      and (p1.user_id = auth.uid() or p2.user_id = auth.uid())
  );
$$;

-- RLS: los datos públicos son legibles; las escrituras requieren autenticación o rol operativo.
alter table public.users enable row level security;
alter table public.player_profiles enable row level security;
alter table public.level_history enable row level security;
alter table public.clubs enable row level security;
alter table public.courts enable row level security;
alter table public.organizers enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_categories enable row level security;
alter table public.pairs enable row level security;
alter table public.registrations enable row level security;
alter table public.payments enable row level security;
alter table public.matches enable row level security;
alter table public.disputes enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.leagues enable row level security;
alter table public.league_divisions enable row level security;
alter table public.league_teams enable row level security;
alter table public.ranking_events enable row level security;
alter table public.player_cards enable row level security;
alter table public.news enable row level security;
alter table public.sponsors enable row level security;
alter table public.ranking_view enable row level security;

create policy if not exists "usuarios propios" on public.users
  for select to authenticated
  using (id = auth.uid() or public.is_admin_or_organizer());

create policy if not exists "administradores gestionan usuarios" on public.users
  for all
  using (public.is_admin_or_organizer())
  with check (public.is_admin_or_organizer());

create policy if not exists "perfiles publicos" on public.player_profiles
  for select
  using (is_public = true or user_id = auth.uid() or public.is_admin_or_organizer());

create policy if not exists "crear perfil autogestionado" on public.player_profiles
  for insert to authenticated
  with check (user_id = auth.uid());

create policy if not exists "editar perfil propio" on public.player_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy if not exists "administradores gestionan perfiles" on public.player_profiles
  for all
  using (public.is_admin_or_organizer())
  with check (public.is_admin_or_organizer());

create policy if not exists "lectura publica clubes" on public.clubs for select using (true);
create policy if not exists "administradores gestionan clubes" on public.clubs for all using (public.is_admin_or_organizer()) with check (public.is_admin_or_organizer());
create policy if not exists "lectura publica canchas" on public.courts for select using (true);
create policy if not exists "administradores gestionan canchas" on public.courts for all using (public.is_admin_or_organizer()) with check (public.is_admin_or_organizer());
create policy if not exists "lectura publica organizadores" on public.organizers for select using (true);
create policy if not exists "administradores gestionan organizadores" on public.organizers for all using (public.is_admin_or_organizer()) with check (public.is_admin_or_organizer());
create policy if not exists "lectura publica torneos" on public.tournaments for select using (true);
create policy if not exists "administradores gestionan torneos" on public.tournaments for all using (public.is_admin_or_organizer()) with check (public.is_admin_or_organizer());
create policy if not exists "lectura publica categorias torneo" on public.tournament_categories for select using (true);
create policy if not exists "administradores gestionan categorias" on public.tournament_categories for all using (public.is_admin_or_organizer()) with check (public.is_admin_or_organizer());

create policy if not exists "lectura publica parejas" on public.pairs for select using (true);
create policy if not exists "crear pareja propia" on public.pairs
  for insert to authenticated
  with check (auth.uid() is not null and (
    (player1_id is not null and exists (select 1 from public.player_profiles where id = player1_id and user_id = auth.uid()))
    or (player2_id is not null and exists (select 1 from public.player_profiles where id = player2_id and user_id = auth.uid()))
  ));
create policy if not exists "administradores gestionan parejas" on public.pairs for all using (public.is_admin_or_organizer()) with check (public.is_admin_or_organizer());

create policy if not exists "registros propios" on public.registrations
  for select to authenticated
  using (user_id = auth.uid());
create policy if not exists "registrar pareja propia" on public.registrations
  for insert to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy if not exists "actualizar registro propio" on public.registrations
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy if not exists "cancelar registro propio" on public.registrations
  for delete to authenticated
  using (user_id = auth.uid());
create policy if not exists "administradores gestionan registros" on public.registrations
  for all
  using (public.is_admin_or_organizer())
  with check (public.is_admin_or_organizer());

create policy if not exists "lectura publica pagos" on public.payments for select using (true);
create policy if not exists "administradores gestionan pagos" on public.payments for all using (public.is_admin_or_organizer()) with check (public.is_admin_or_organizer());
create policy if not exists "lectura publica partidos" on public.matches for select using (true);
create policy if not exists "administradores gestionan partidos" on public.matches for all using (public.is_admin_or_organizer()) with check (public.is_admin_or_organizer());
create policy if not exists "disputas propias" on public.disputes
  for select to authenticated
  using (reporter_id = (select id from public.player_profiles where user_id = auth.uid()) or public.is_admin_or_organizer());
create policy if not exists "disputas propias insertar" on public.disputes
  for insert to authenticated
  with check (reporter_id = (select id from public.player_profiles where user_id = auth.uid()) or public.is_admin_or_organizer());
create policy if not exists "administradores gestionan disputas" on public.disputes for all using (public.is_admin_or_organizer()) with check (public.is_admin_or_organizer());

create policy if not exists "lectura publica equipos" on public.teams for select using (true);
create policy if not exists "administradores gestionan equipos" on public.teams for all using (public.is_admin_or_organizer()) with check (public.is_admin_or_organizer());
create policy if not exists "lectura publica integrantes" on public.team_members for select using (true);
create policy if not exists "administradores gestionan integrantes" on public.team_members for all using (public.is_admin_or_organizer()) with check (public.is_admin_or_organizer());
create policy if not exists "lectura publica ligas" on public.leagues for select using (true);
create policy if not exists "administradores gestionan ligas" on public.leagues for all using (public.is_admin_or_organizer()) with check (public.is_admin_or_organizer());
create policy if not exists "lectura publica divisiones liga" on public.league_divisions for select using (true);
create policy if not exists "administradores gestionan divisiones" on public.league_divisions for all using (public.is_admin_or_organizer()) with check (public.is_admin_or_organizer());
create policy if not exists "lectura publica integrantes liga" on public.league_teams for select using (true);
create policy if not exists "administradores gestionan integrantes liga" on public.league_teams for all using (public.is_admin_or_organizer()) with check (public.is_admin_or_organizer());
create policy if not exists "lectura publica eventos ranking" on public.ranking_events for select using (true);
create policy if not exists "administradores gestionan ranking" on public.ranking_events for all using (public.is_admin_or_organizer()) with check (public.is_admin_or_organizer());
create policy if not exists "lectura publica tarjetas jugador" on public.player_cards for select using (true);
create policy if not exists "administradores gestionan tarjetas" on public.player_cards for all using (public.is_admin_or_organizer()) with check (public.is_admin_or_organizer());
create policy if not exists "lectura publica niveles" on public.level_history for select using (true);
create policy if not exists "administradores gestionan niveles" on public.level_history for all using (public.is_admin_or_organizer()) with check (public.is_admin_or_organizer());
create policy if not exists "lectura publica noticias" on public.news for select using (true);
create policy if not exists "administradores gestionan noticias" on public.news for all using (public.is_admin_or_organizer()) with check (public.is_admin_or_organizer());
create policy if not exists "lectura publica sponsors" on public.sponsors for select using (true);
create policy if not exists "administradores gestionan sponsors" on public.sponsors for all using (public.is_admin_or_organizer()) with check (public.is_admin_or_organizer());
create policy if not exists "lectura publica ranking" on public.ranking_view for select using (true);

-- Al registrarse, Supabase crea el usuario de auth y este disparador crea
-- el registro de identidad y el perfil público inicial del jugador.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_username text;
begin
  v_email := coalesce(new.email, 'user-' || new.id::text);
  v_username := lower(regexp_replace(split_part(v_email, '@', 1), '[^a-z0-9_]+', '', 'g'));

  if v_username = '' then
    v_username := 'user-' || substr(new.id::text, 1, 8);
  end if;

  loop
    exit when not exists (
      select 1 from public.player_profiles where username = v_username
    );
    v_username := v_username || '_' || substr(new.id::text, 1, 8);
  end loop;

  insert into public.users (id, email, role)
  values (new.id, v_email, 'player')
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  insert into public.player_profiles (
    user_id, display_name, username, city, state, country, is_public
  )
  values (
    new.id,
    initcap(replace(v_username, '_', ' ')),
    v_username,
    'Ciudad de México',
    'CDMX',
    'México',
    true
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nota: el esquema demo (src/lib/data/seed.ts) es la referencia de datos para desarrollo.
-- Este esquema replica las mismas tablas para el modo Supabase
-- (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY).
