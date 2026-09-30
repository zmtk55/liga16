-- ============================================================================
-- Cuántas parejas pasan a semifinales
-- ============================================================================
-- Antes esta información no existía en ningún lado: el corte se suponía. Es
-- parte del torneo (lo define el organizador al crearlo o editarlo) porque de
-- ella dependen dos cosas: la probabilidad de clasificar que ve el jugador y,
-- más adelante, el bracket de semis (quién se enfrenta a quién).
--
-- No se restringe a potencias de 2: pasar 6 de 8 es un corte válido (4 a semis y
-- 2 con pase directo), así que el límite real es 2 o más.
--
-- Idempotente.
-- ============================================================================

alter table public.tournaments
  add column if not exists semifinal_slots integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tournaments_semifinal_slots_check'
  ) then
    alter table public.tournaments
      add constraint tournaments_semifinal_slots_check
      check (semifinal_slots is null or semifinal_slots >= 2);
  end if;
end $$;

comment on column public.tournaments.semifinal_slots is
  'Cuántas parejas clasifican a la ronda de semifinales. Lo define el organizador.';

-- Torneos ya existentes: 4 por defecto, para que la probabilidad de clasificar
-- no quede en null para nadie que ya tenía tabla de posiciones.
update public.tournaments
   set semifinal_slots = 4
 where semifinal_slots is null;
