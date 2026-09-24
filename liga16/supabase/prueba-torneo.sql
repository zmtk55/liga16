-- ============================================================================
-- PRUEBA TORNEO — torneo de simulación con datos completos y coherentes.
-- Ejecutar en Supabase → SQL Editor.
--
-- Genera:
--   1 torneo      : PRUEBA TORNEO (slug prueba-torneo, published)
--   3 categorías  : 4ta Varonil / 3ra Femenil / 4ta Mixto
--   8 parejas     : 3 varoniles + 3 femeniles + 2 mixtas (sin jugador repetido)
--   7 partidos    : round robin por categoría (3 + 3 + 1), TODOS finished,
--                   winner SIEMPRE coherente con los sets,
--                   canchas y horarios sin choques (numeración global).
--
-- Es idempotente: borra y recrea el torneo. Los perfiles de jugadores nuevos
-- se conservan entre corridas (se reutilizan por nombre).
-- ============================================================================

begin;

-- 1) Recrear limpio (idempotente).
--    OJO: matches.tournament_id es ON DELETE SET NULL (no cascade), así que
--    hay que borrar los partidos explícitamente o quedan huérfanos.
delete from public.matches
where tournament_id = (select id from public.tournaments where slug = 'prueba-torneo');
delete from public.tournaments where slug = 'prueba-torneo';

-- 2) Torneo
insert into public.tournaments (name, slug, city, state, start_date, end_date,
  registration_deadline, status, modality, format, price_cents, currency,
  rules_summary, scoring)
values (
  'PRUEBA TORNEO', 'prueba-torneo', 'Ciudad de México', 'CDMX',
  current_date, current_date + 2, current_date,
  'published', 'pairs', 'groups_knockout', 50000, 'MXN',
  'Torneo de simulación: grupos round robin, mejor de 3 sets.',
  '{"sets_to_win":2,"games_per_set":6,"tie_break_at":6,"tie_break_points":7,"win_by_two_tiebreak":true,"tie_breaker_rules":["points","sets_diff","games_diff","head_to_head"]}'::jsonb
);

-- 3) Categorías
with t as (select id from public.tournaments where slug = 'prueba-torneo')
insert into public.tournament_categories (tournament_id, name, category, sex, price_cents)
select t.id, c.name, c.category::padel_division, c.sex::sex_type, 50000
from t, (values
  ('4ta Varonil', '4ta', 'M'),
  ('3ra Femenil', '3ra', 'F'),
  ('4ta Mixto',   '4ta', 'X')
) as c(name, category, sex);

-- 4) Perfiles de jugadores (reutiliza existentes por nombre, crea los nuevos)
create temp table _jugadores (
  display_name text primary key,
  sex          sex_type,
  level        numeric(3,1)
) on commit drop;

insert into _jugadores values
  ('Diego Fuentes',    'M', 4.7),
  ('Martín Rojas',     'M', 4.5),
  ('Emilio Garza',     'M', 4.6),
  ('Valeria Montes',   'F', 4.4),
  ('Sofía Camacho',    'F', 4.3),
  ('Lucía Herrera',    'F', 4.2),
  ('Paola Suárez',     'F', 4.1),
  ('Andrés Valle',     'M', 4.0),
  ('Ricardo Anaya',    'M', 4.4),
  ('Daniela Cervantes','F', 4.0),
  ('Fernando Lira',    'M', 3.9),
  ('Javier Quintana',  'M', 3.8),
  ('Ximena Ortega',    'F', 3.8),
  ('Tomás Ledesma',    'M', 3.7),
  ('Renata Peralta',   'F', 3.6),
  ('Bruno Salinas',    'M', 3.5),
  ('Ximena Navarro',   'F', 3.6)
on conflict (display_name) do nothing;

insert into public.player_profiles (display_name, username, sex, declared_level, is_public, role)
select j.display_name,
  lower(regexp_replace(j.display_name, '[^a-zA-Z0-9]', '', 'g')) || '_' || substr(md5(random()::text), 1, 4),
  j.sex, j.level, true, 'player'
from _jugadores j
where not exists (
  select 1 from public.player_profiles pp
  where lower(pp.display_name) = lower(j.display_name)
);

-- Snapshots de ids (un solo perfil por nombre, con array_agg[1] por si ya había duplicados)
create temp table _pp
on commit drop as
select (array_agg(pp.id))[1] as id, lower(pp.display_name) as name_key
from public.player_profiles pp
join _jugadores j on lower(pp.display_name) = lower(j.display_name)
group by lower(pp.display_name);

-- 5) Parejas (8: 3 varoniles, 3 femeniles, 2 mixtas — ningún jugador repetido)
with t as (select id from public.tournaments where slug = 'prueba-torneo'),
cats as (
  select id, name from public.tournament_categories
  where tournament_id = (select id from t)
)
insert into public.pairs (tournament_id, category_id, name, player1_id, player2_id, status)
select
  (select id from t),
  (select id from cats where name = v.cat),
  v.pair_name,
  (select id from _pp where name_key = lower(v.j1) limit 1),
  (select id from _pp where name_key = lower(v.j2) limit 1),
  'confirmed'
from (values
  ('4ta Varonil', 'Diego Fuentes / Martín Rojas',     'Diego Fuentes',    'Martín Rojas'),
  ('4ta Varonil', 'Emilio Garza / Ricardo Anaya',     'Emilio Garza',     'Ricardo Anaya'),
  ('4ta Varonil', 'Andrés Valle / Fernando Lira',     'Andrés Valle',     'Fernando Lira'),
  ('3ra Femenil', 'Valeria Montes / Sofía Camacho',   'Valeria Montes',   'Sofía Camacho'),
  ('3ra Femenil', 'Lucía Herrera / Daniela Cervantes','Lucía Herrera',    'Daniela Cervantes'),
  ('3ra Femenil', 'Paola Suárez / Ximena Ortega',     'Paola Suárez',     'Ximena Ortega'),
  ('4ta Mixto',   'Tomás Ledesma / Renata Peralta',   'Tomás Ledesma',    'Renata Peralta'),
  ('4ta Mixto',   'Bruno Salinas / Ximena Navarro',   'Bruno Salinas',    'Ximena Navarro')
) as v(cat, pair_name, j1, j2);

-- 6) Partidos round robin por categoría, todos finished con marcador.
--    rn  = numeración GLOBAL (sin reiniciar por categoría) → cancha y hora únicas.
--    cat_n = numeración por categoría → solo para el número de jornada.
--    winner derivado del patrón de sets (rn % 4 = 3 gana B, el resto gana A):
--      0: 6-4, 6-3            → A
--      1: 4-6, 6-4, 10-8      → A
--      2: 6-2, 3-6, 7-5       → A
--      3: 6-4, 2-6, 4-6       → B
with t as (select id from public.tournaments where slug = 'prueba-torneo'),
pares as (
  select p.id, p.name, c.name as cat
  from public.pairs p
  join public.tournament_categories c on c.id = p.category_id
  where p.tournament_id = (select id from t)
),
enfre as (
  select
    a.id as id_a, a.name as name_a, b.id as id_b, b.name as name_b, a.cat,
    row_number() over (partition by a.cat order by a.name, b.name) as cat_n,
    row_number() over (order by a.cat, a.name, b.name) as rn
  from pares a
  join pares b on b.cat = a.cat and a.name < b.name
)
insert into public.matches (
  tournament_id, tournament_name, category_name, round, court_name,
  scheduled_at, status, side_a_pair_id, side_b_pair_id,
  side_a_name, side_b_name, winner, sets
)
select
  (select id from t),
  'PRUEBA TORNEO',
  enfre.cat,
  enfre.cat || ' · J' || ((enfre.cat_n - 1) / 2 + 1),
  'Cancha ' || (1 + ((enfre.rn - 1) % 2)),
  current_date + interval '10 hours' + ((enfre.rn - 1) * interval '45 minutes'),
  'finished',
  enfre.id_a, enfre.id_b,
  enfre.name_a, enfre.name_b,
  case when enfre.rn % 4 = 3 then 'b' else 'a' end,
  case (enfre.rn - 1) % 4
    when 0 then '[{"a":6,"b":4},{"a":6,"b":3}]'::jsonb
    when 1 then '[{"a":4,"b":6},{"a":6,"b":4},{"a":10,"b":8}]'::jsonb
    when 2 then '[{"a":6,"b":2},{"a":3,"b":6},{"a":7,"b":5}]'::jsonb
    else        '[{"a":6,"b":4},{"a":2,"b":6},{"a":4,"b":6}]'::jsonb
  end
from enfre;

commit;

-- ============================================================================
-- Verificación (correr aparte):
--   select count(*) from public.pairs p join public.tournaments t on t.id = p.tournament_id
--     where t.slug = 'prueba-torneo';                    -- 8 parejas
--   select count(*) from public.matches m join public.tournaments t on t.id = m.tournament_id
--     where t.slug = 'prueba-torneo' and m.status = 'finished';  -- 7 partidos (3+3+1)
--   -- winner coherente con sets (debe devolver 0 filas):
--   select m.id from public.matches m join public.tournaments t on t.id = m.tournament_id
--     where t.slug = 'prueba-torneo'
--       and m.winner <> case
--         when (select sum((s->>'a')::int) > sum((s->>'b')::int) from jsonb_array_elements(m.sets) s)
--         then 'a' else 'b' end;
-- ============================================================================
