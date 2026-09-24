-- Liga16 — Backfill: liga los player1_id/player2_id de pairs con sus perfiles
-- (los pares creados antes del fix quedaron con null). Idempotente.
update public.pairs p
set player1_id = pp.id
from public.player_profiles pp
where p.player1_id is null
  and lower(trim(split_part(p.name, '/', 1))) = lower(pp.display_name);

update public.pairs p
set player2_id = pp.id
from public.player_profiles pp
where p.player2_id is null
  and lower(trim(split_part(p.name, '/', 2))) = lower(pp.display_name);

-- Verificación: los que queden con null no tienen perfil con ese nombre exacto.
select p.name, p.player1_id, p.player2_id from public.pairs p where p.player1_id is null or p.player2_id is null;
