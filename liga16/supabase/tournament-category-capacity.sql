-- Ejecutar antes de desplegar el PR del asistente. 0 = sin límite.
-- No cambia divisiones, nombres, precios ni datos de parejas existentes.
alter table public.tournament_categories
  add column if not exists max_pairs integer not null default 0;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tournament_categories_max_pairs_check') then
    alter table public.tournament_categories add constraint tournament_categories_max_pairs_check check (max_pairs >= 0);
  end if;
end $$;
