-- Liga16 — Migración: agregar columna scoring a tournaments
--
-- Síntoma: al crear o editar un torneo desde el admin, Supabase responde
-- 400 "Could not find the 'scoring' column of 'tournaments'" y el torneo
-- nunca se guarda. Causa: la base de datos se creó con una versión del
-- schema anterior a la columna scoring; el código sí la envía.
--
-- INSTRUCCIONES: pega y ejecuta TODO en Supabase Dashboard → SQL Editor.
-- Es idempotente.

-- 1. Columna scoring con los valores por defecto del reglamento
alter table public.tournaments
add column if not exists scoring jsonb
default '{"sets_to_win":2,"games_per_set":6,"tie_break_at":6,"tie_break_points":7,"win_by_two_tiebreak":true,"tie_breaker_rules":["points","sets_diff","games_diff","head_to_head"]}'::jsonb;

-- 2. Canchas del club (logística del torneo)
create table if not exists public.courts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references public.clubs (id) on delete cascade,
  name text not null,
  surface text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.courts enable row level security;

drop policy if exists "Courts are viewable" on public.courts;
create policy "Courts are viewable"
  on public.courts for select
  to authenticated, anon
  using (true);

drop policy if exists "Admins and organizers manage courts" on public.courts;
create policy "Admins and organizers manage courts"
  on public.courts for all
  to authenticated
  using (public.is_admin_or_organizer(array['admin', 'organizer']))
  with check (public.is_admin_or_organizer(array['admin', 'organizer']));

-- 3. Recargar el cache del schema de la API REST
notify pgrst, 'reload schema';

-- 4. Verificación
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'tournaments' and column_name = 'scoring';
