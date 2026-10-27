-- Baja de una pareja, atómica y decidida EN LA BASE. NO APLICADA: revisar con
-- pair-withdrawal-check.sql y ejecutar a mano en el editor SQL de Supabase.
--
-- La app solo envía el id de la pareja. La función lee el estado ACTUAL bajo bloqueo
-- (pareja, parejas de su categoría y cruces eliminatorios con FOR UPDATE) y decide:
--   * hay cruces eliminatorios pero ninguno con actividad -> borra esos cruces y
--     libera la siembra de la categoría (se vuelve a "Crear eliminatorias");
--   * algún cruce con actividad (llave empezada) -> el rival gana por walkover los
--     cruces eliminatorios pendientes de la pareja que tengan rival definido;
--   * sin cruces eliminatorios -> solo el estado de baja.
-- En todos los casos marca pairs.status = 'withdrawn'. Una transacción: si algo falla
-- (permiso, bloqueo, error), no cambia nada. La pareja y sus resultados se conservan.
-- Devuelve {mode, deleted, seeds_cleared, walkovers}.

create or replace function public.withdraw_pair_installed()
returns boolean
language sql stable
as $$ select true $$;

-- Firma anterior (arrays enviados por el cliente), por si se instaló una versión previa.
drop function if exists public.withdraw_pair(uuid, uuid[], uuid[], jsonb);

create or replace function public.withdraw_pair(p_pair_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tournament uuid;
  v_category uuid;
  v_status text;
  v_cat_pairs uuid[];
  v_ko_ids uuid[];
  v_locked boolean;
  v_started boolean;
  v_mode text := 'status_only';
  v_deleted int := 0;
  v_seeds int := 0;
  v_wo int := 0;
  m record;
  v_ko constant text := '\y(octavos|cuartos|semifinal(es)?|final|eliminatoria|play-?offs?|tercer lugar|3er lugar)\y';
begin
  if not public.is_admin_or_organizer(array['admin', 'organizer']) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select tournament_id, category_id, status into v_tournament, v_category, v_status
    from public.pairs where id = p_pair_id for update;
  if not found then raise exception 'pair_not_found'; end if;
  if v_status = 'withdrawn' then raise exception 'already_withdrawn'; end if;

  -- Parejas de la misma categoría del torneo (bloqueadas).
  select coalesce(array_agg(id order by id), '{}') into v_cat_pairs
    from (select id from public.pairs
           where tournament_id = v_tournament and category_id is not distinct from v_category
           order by id for update) s;

  -- Cruces eliminatorios de la categoría (ambos lados de ella), bloqueados.
  select coalesce(array_agg(id order by id), '{}') into v_ko_ids
    from (select id from public.matches
           where tournament_id = v_tournament
             and side_a_pair_id = any (v_cat_pairs) and side_b_pair_id = any (v_cat_pairs)
             and round ~* v_ko and round !~* '\ygrupo\y' and round !~* 'jornada\s*[0-9]'
           order by id for update) s;

  v_locked := coalesce(array_length(v_ko_ids, 1), 0) > 0;
  select exists (
    select 1 from public.matches
     where id = any (v_ko_ids)
       and (status <> 'scheduled' or winner is not null or (sets is not null and jsonb_array_length(sets) > 0))
  ) into v_started;

  if v_locked and not v_started then
    v_mode := 'rebuild';
    delete from public.matches where id = any (v_ko_ids);
    get diagnostics v_deleted = row_count;
    update public.pairs set seed = null where id = any (v_cat_pairs);
    get diagnostics v_seeds = row_count;
  elsif v_locked then
    v_mode := 'walkover';
    for m in
      select id, side_a_pair_id, side_b_pair_id from public.matches
       where id = any (v_ko_ids)
         and winner is null and status in ('scheduled', 'live', 'disputed')
         and side_a_pair_id is not null and side_b_pair_id is not null
         and (side_a_pair_id = p_pair_id or side_b_pair_id = p_pair_id)
    loop
      update public.matches
         set status = 'walkover',
             winner = case when m.side_a_pair_id = p_pair_id then 'b' else 'a' end,
             updated_at = now()
       where id = m.id;
      v_wo := v_wo + 1;
    end loop;
  end if;

  update public.pairs set status = 'withdrawn' where id = p_pair_id;

  return jsonb_build_object('mode', v_mode, 'deleted', v_deleted, 'seeds_cleared', v_seeds, 'walkovers', v_wo);
end;
$$;

revoke all on function public.withdraw_pair(uuid) from public, anon;
revoke all on function public.withdraw_pair_installed() from public, anon;
grant execute on function public.withdraw_pair(uuid) to authenticated;
grant execute on function public.withdraw_pair_installed() to authenticated;
