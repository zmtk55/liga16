-- ============================================================================
-- PRUEBA TORNEO — torneo de simulación con datos completos y coherentes.
-- Ejecutar en Supabase → SQL Editor (service role / dashboard, sin RLS issues).
--
-- Genera:
--   1 torneo      : PRUEBA TORNEO (slug prueba-torneo, published)
--   3 categorías  : 4ta Varonil / 3ra Femenil / 4ta Mixto
--   8 parejas     : mezcla de perfiles existentes (por nombre) y nuevos
--   14 partidos   : round robin por categoría, TODOS finished con marcador
--
-- Es idempotente: si ya existe el slug 'prueba-torneo', borra y recrea todo
-- (CASCADE se lleva categorías, parejas y partidos).
-- ============================================================================

begin;

-- 1) Recrear limpio (idempotente)
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
  '{"sets_to_win":2,"games_per_set":6,"tie_break_at":6,"tie_break_points":7,"win_by_two_tiebreak":true,"tie_breaker_rules":"Puntos corridos"}'::jsonb
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
  ('Diego Fuentes',   'M', 4.7),
  ('Martín Rojas',    'M', 4.5),
  ('Emilio Garza',    'M', 4.6),
  ('Valeria Montes',  'F', 4.4),
  ('Sofía Camacho',   'F', 4.3),
  ('Lucía Herrera',   'F', 4.2),
  ('Paola Suárez',    'F', 4.1),
  ('Andrés Valle',    'M', 4.0),
  ('Ricardo Anaya',   'M', 4.4),
  ('Daniela Cervantes','F', 4.0),
  ('Fernando Lira',   'M', 3.9),
  ('Javier Quintana', 'M', 3.8),
  ('Ximena Ortega',   'F', 3.8),
  ('Tomás Ledesma',   'M', 3.7),
  ('Renata Peralta',  'F', 3.6),
  ('Bruno Salinas',   'M', 3.5)
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

create temp table _pp as
select pp.id, pp.display_name from public.player_profiles pp
join _jugadores j on lower(pp.display_name) = lower(j.display_name)
on commit drop;

-- 5) Parejas (8: 3 varoniles, 3 femeniles, 2 mixtas)
with t as (select id from public.tournaments where slug = 'prueba-torneo'),
cats as (
  select id, name from public.tournament_categories tc
  where tc.tournament_id = (select id from t)
),
p1 as (
  select id, display_name from _pp where display_name in
    ('Diego Fuentes','Emilio Garza','Andrés Valle','Valeria Montes','Lucía Herrera','Paola Suárez','Diego Fuentes','Martín Rojas')
),
p2 as (
  select id, display_name from _pp where display_name in
    ('Martín Rojas','Ricardo Anaya','Fernando Lira','Sofía Camacho','Daniela Cervantes','Ximena Ortega','Valeria Montes','Tomás Ledesma')
)
insert into public.pairs (tournament_id, category_id, name, player1_id, player2_id, status)
select
  (select id from t),
  (select id from cats where name = v.cat),
  v.pair_name,
  (select id from p1 where p1.display_name = v.j1),
  (select id from p2 where p2.display_name = v.j2),
  'confirmed'
from (values
  ('4ta Varonil', 'Diego Fuentes / Martín Rojas',   'Diego Fuentes',   'Martín Rojas'),
  ('4ta Varonil', 'Emilio Garza / Ricardo Anaya',   'Emilio Garza',    'Ricardo Anaya'),
  ('4ta Varonil', 'Andrés Valle / Fernando Lira',   'Andrés Valle',    'Fernando Lira'),
  ('3ra Femenil', 'Valeria Montes / Sofía Camacho', 'Valeria Montes',  'Sofía Camacho'),
  ('3ra Femenil', 'Lucía Herrera / Daniela Cervantes','Lucía Herrera', 'Daniela Cervantes'),
  ('3ra Femenil', 'Paola Suárez / Ximena Ortega',   'Paola Suárez',    'Ximena Ortega'),
  ('4ta Mixto',   'Diego Fuentes / Valeria Montes', 'Diego Fuentes',   'Valeria Montes'),
  ('4ta Mixto',   'Martín Rojas / Tomás Ledesma',   'Martín Rojas',    'Tomás Ledesma')
) as v(cat, pair_name, j1, j2);

-- Nota: 'Diego Fuentes / Valeria Montes' reusa a Diego (j1) que ya juega varonil —
-- así probamos la validación de jugador repetido en distintas categorías.
-- Si el sistema debe rechazarla, se ve en la UI; en BD se permite (categorías distintas).

-- 6) Partidos round robin por categoría, todos finished con marcador
with t as (select id from public.tournaments where slug = 'prueba-torneo'),
pares as (
  select p.id, p.name, c.name as cat
  from public.pairs p
  join public.tournament_categories c on c.id = p.category_id
  where p.tournament_id = (select id from t)
),
enfre as (
  select a.id as id_a, a.name as name_a, b.id as id_b, b.name as name_b, a.cat,
         row_number() over (partition by a.cat order by a.name, b.name) as n
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
  enfre.cat || ' · J' || ((enfre.n - 1) / 2 + 1),
  'Cancha ' || (1 + (enfre.n % 2)),
  now() - interval '1 day' + (enfre.n * interval '45 minutes'),
  'finished',
  enfre.id_a, enfre.id_b,
  enfre.name_a, enfre.name_b,
  case when enfre.n % 3 = 0 then 'b' else 'a' end,
  case enfre.n % 4
    when 0 then '[{"a":6,"b":4},{"a":6,"b":3}]'::jsonb
    when 1 then '[{"a":4,"b":6},{"a":6,"b":4},{"a":10,"b":8}]'::jsonb
    when 2 then '[{"a":6,"b":2},{"a":3,"b":6},{"a":7,"b":5}]'::jsonb
    else        '[{"a":6,"b":4},{"a":2,"b":6},{"a":4,"b":6}]'::jsonb
  end
from enfre;

commit;

-- ============================================================================
-- Verificación rápida (correr aparte si quieres revisar):
--   select name from public.tournaments where slug = 'prueba-torneo';
--   select count(*) from public.pairs p join public.tournaments t on t.id = p.tournament_id
--     where t.slug = 'prueba-torneo';           -- debe ser 8
--   select count(*) from public.matches m
--     where m.tournament_id = (select id from public.tournaments where slug='prueba-torneo')
--       and m.status = 'finished';              -- debe ser el total de parejas por cat: C(3,2)*3cats = 9
-- ============================================================================
