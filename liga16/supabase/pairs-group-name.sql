-- El grupo al que pertenece cada pareja.
--
-- El sorteo vive en la memoria de la pantalla: al recargar, los grupos se
-- reconstruían desde los partidos ya generados. Con esta columna, cada pareja
-- recuerda a qué grupo quedó asignada ("4ta · Grupo A"), y el sorteo no se
-- pierde.
--
-- Va también en schema.sql para que una base nueva salga igual que la de
-- producción.
--
-- Idempotente: se puede correr las veces que sea.

alter table public.pairs
  add column if not exists group_name text;

create index if not exists idx_pairs_tournament_group
  on public.pairs (tournament_id, group_name);

-- Verificación:
-- select group_name, count(*) from public.pairs
--  where tournament_id is not null
--  group by 1 order by 1;
