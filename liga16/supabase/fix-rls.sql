-- Liga16 — FIX DEFINITIVO de RLS: habilita las escrituras del admin
--
-- Síntoma: como admin logueado, cualquier escritura (crear perfil, torneo,
-- equipo, etc.) falla con 403 "permission denied for table users".
-- Causa: las policies RLS consultaban auth.users directamente, pero el rol
-- authenticated no tiene GRANT sobre esa tabla. La consulta revienta y
-- Supabase niega el acceso aunque el rol sea admin.
-- Fix: helper is_admin_or_organizer() con SECURITY DEFINER (corre como el
-- dueño del esquema, que sí puede leer auth.users).
--
-- INSTRUCCIONES: pega y ejecuta TODO en Supabase Dashboard → SQL Editor.
-- Es idempotente: puedes ejecutarlo varias veces sin romper nada.

-- ============================================================
-- 1. Helper con SECURITY DEFINER (la pieza clave)
-- ============================================================
create or replace function public.is_admin_or_organizer(allowed_roles text[])
returns boolean as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and raw_app_meta_data->>'role' = any(allowed_roles)
  );
$$ language sql stable security definer set search_path = public, auth;

revoke all on function public.is_admin_or_organizer(text[]) from anon, authenticated;
grant execute on function public.is_admin_or_organizer(text[]) to authenticated;

-- ============================================================
-- 2. Recrear las policies que consultaban auth.users directo
-- ============================================================

-- clubs
drop policy if exists "Admins and organizers can modify clubs" on public.clubs;
create policy "Admins and organizers can modify clubs"
  on public.clubs for all to authenticated
  using (is_admin_or_organizer(array['admin', 'organizer', 'club']));

-- tournaments
drop policy if exists "Admins and organizers manage tournaments" on public.tournaments;
create policy "Admins and organizers manage tournaments"
  on public.tournaments for all to authenticated
  using (is_admin_or_organizer(array['admin', 'organizer']));

-- tournament_categories
drop policy if exists "Admins and organizers manage categories" on public.tournament_categories;
create policy "Admins and organizers manage categories"
  on public.tournament_categories for all to authenticated
  using (is_admin_or_organizer(array['admin', 'organizer']))
  with check (is_admin_or_organizer(array['admin', 'organizer']));

-- pairs
drop policy if exists "Users manage own pairs" on public.pairs;
create policy "Users manage own pairs"
  on public.pairs for all to authenticated
  using (is_admin_or_organizer(array['admin', 'organizer', 'club']));

-- registrations
drop policy if exists "Admins and organizers manage registrations" on public.registrations;
create policy "Admins and organizers manage registrations"
  on public.registrations for all to authenticated
  using (is_admin_or_organizer(array['admin', 'organizer']))
  with check (is_admin_or_organizer(array['admin', 'organizer']));

-- player_profiles
drop policy if exists "Admins and organizers manage players" on public.player_profiles;
create policy "Admins and organizers manage players"
  on public.player_profiles for all to authenticated
  using (is_admin_or_organizer(array['admin', 'organizer']))
  with check (is_admin_or_organizer(array['admin', 'organizer']));

-- player_cards
drop policy if exists "Admins and organizers manage player cards" on public.player_cards;
create policy "Admins and organizers manage player cards"
  on public.player_cards for all to authenticated
  using (is_admin_or_organizer(array['admin', 'organizer']))
  with check (is_admin_or_organizer(array['admin', 'organizer']));

-- teams
drop policy if exists "Admins and organizers manage teams" on public.teams;
create policy "Admins and organizers manage teams"
  on public.teams for all to authenticated
  using (is_admin_or_organizer(array['admin', 'organizer']))
  with check (is_admin_or_organizer(array['admin', 'organizer']));

-- leagues
drop policy if exists "Admins and organizers manage leagues" on public.leagues;
create policy "Admins and organizers manage leagues"
  on public.leagues for all to authenticated
  using (is_admin_or_organizer(array['admin', 'organizer']))
  with check (is_admin_or_organizer(array['admin', 'organizer']));

-- league_divisions
drop policy if exists "Admins and organizers manage league divisions" on public.league_divisions;
create policy "Admins and organizers manage league divisions"
  on public.league_divisions for all to authenticated
  using (is_admin_or_organizer(array['admin', 'organizer']))
  with check (is_admin_or_organizer(array['admin', 'organizer']));

-- league_teams
drop policy if exists "Admins and organizers manage league teams" on public.league_teams;
create policy "Admins and organizers manage league teams"
  on public.league_teams for all to authenticated
  using (is_admin_or_organizer(array['admin', 'organizer']))
  with check (is_admin_or_organizer(array['admin', 'organizer']));

-- matches
drop policy if exists "Admins and organizers manage matches" on public.matches;
create policy "Admins and organizers manage matches"
  on public.matches for all to authenticated
  using (is_admin_or_organizer(array['admin', 'organizer']))
  with check (is_admin_or_organizer(array['admin', 'organizer']));

-- ranking_events
drop policy if exists "Users own their ranking events" on public.ranking_events;
create policy "Users own their ranking events"
  on public.ranking_events for all to authenticated
  using (
    player_id = auth.uid()
    or is_admin_or_organizer(array['admin', 'organizer'])
  )
  with check (player_id = auth.uid() or is_admin_or_organizer(array['admin', 'organizer']));

-- news
drop policy if exists "Admins and organizers manage news" on public.news;
create policy "Admins and organizers manage news"
  on public.news for all to authenticated
  using (is_admin_or_organizer(array['admin', 'organizer']))
  with check (is_admin_or_organizer(array['admin', 'organizer']));

-- sponsors
drop policy if exists "Admins and organizers manage sponsors" on public.sponsors;
create policy "Admins and organizers manage sponsors"
  on public.sponsors for all to authenticated
  using (is_admin_or_organizer(array['admin', 'organizer']))
  with check (is_admin_or_organizer(array['admin', 'organizer']));

-- invitations (2 policies)
drop policy if exists "Invitation recipients view" on public.invitations;
create policy "Invitation recipients view"
  on public.invitations for select to authenticated
  using (
    player_id = auth.uid()
    or is_admin_or_organizer(array['admin', 'organizer'])
  );

drop policy if exists "Admins and organizers manage invitations" on public.invitations;
create policy "Admins and organizers manage invitations"
  on public.invitations for all to authenticated
  using (is_admin_or_organizer(array['admin', 'organizer']))
  with check (is_admin_or_organizer(array['admin', 'organizer']));

-- ============================================================
-- 3. Perfil de jugador para el admin (el trigger no lo pudo crear antes)
-- ============================================================
insert into public.player_profiles (user_id, display_name, username, city, state)
select id, 'Julian', 'julian-' || substr(id::text, 1, 6), 'Ciudad de México', 'CDMX'
from auth.users
where email = 'julian.blackflag@gmail.com'
  and not exists (select 1 from public.player_profiles pp where pp.user_id = auth.users.id);

-- ============================================================
-- 4. Verificación
-- ============================================================
select proname as funcion_ok from pg_proc where proname = 'is_admin_or_organizer';
select count(*) as policies_con_helper
from pg_policies
where schemaname = 'public' and qual like '%is_admin_or_organizer%';
