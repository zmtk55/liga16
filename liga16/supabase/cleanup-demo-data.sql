-- ============================================================================
-- LIMPIEZA de datos demo/huérfanos en Supabase (Liga16).
-- Ejecutar en Supabase → SQL Editor.
--
-- Quita:
--   1. Matches huérfanos (tournament_id NULL) — residuos del seed demo.
--   2. Torneos de prueba (match 2, MATCH 16, Copa Lista Compacta,
--      Copa Kanban Test). NO toca 'Liga 16' ni 'PRUEBA TORNEO'.
--   3. Noticias y patrocinadores del seed demo (textos inventados).
--   4. Ranking_events de demo — el ranking se recalcula desde partidos reales.
--
-- NO toca: player_profiles, player_cards, clubs, courts, teams.
-- Idempotente: todo es DELETE con WHERE; re-ejecutar no hace daño.
-- ============================================================================

-- 1) Matches sin torneo (el seed demo insertó varios así)
delete from public.matches where tournament_id is null;

-- 2) Torneos de prueba (baja cascada sus categorías; las parejas y partidos
--    de esos torneos también se van por FK cascade en pairs, y matches por
--    SET NULL quedarían huérfanos → se borran primero explícitamente)
delete from public.matches
where tournament_id in (
  select id from public.tournaments
  where slug in ('match-2', 'match-16', 'copa-lista-compacta', 'copa-kanban-test')
     or lower(name) in ('match 2', 'match 16', 'copa lista compacta', 'copa kanban test')
);
delete from public.tournaments
where slug in ('match-2', 'match-16', 'copa-lista-compacta', 'copa-kanban-test')
   or lower(name) in ('match 2', 'match 16', 'copa lista compacta', 'copa kanban test');

-- 3) Noticias demo (textos inventados del seed: copa independencia, liga reforma…)
delete from public.news
where title ilike '%Copa Independencia%'
   or title ilike '%Liga Reforma%'
   or title ilike '%Reforma Challenger%'
   or title ilike '%Fuentes y Rojas%';

-- 4) Patrocinadores demo (nombres del seed)
delete from public.sponsors
where name ilike '%Reforma%'
   or name ilike '%demo%';

-- 5) Ranking events de demo: borra TODOS los puntos de ranking inventados.
--    El ranking real se reconstruye desde los partidos finished de la app.
delete from public.ranking_events;

-- ============================================================================
-- Verificación (correr aparte):
--   select count(*) from public.matches where tournament_id is null;  -- 0
--   select name from public.tournaments order by name;                 -- solo reales
--   select count(*) from public.news;                                  -- 0 si no hay noticias reales
--   select count(*) from public.ranking_events;                        -- 0
-- ============================================================================
