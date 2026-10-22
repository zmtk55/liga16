-- ============================================================================
-- Corregir el trigger de sincronización de roles.
--
-- Pega esto en Supabase → SQL Editor → Run. Es idempotente: se puede correr
-- las veces que haga falta.
--
-- El problema: sync_role_app_metadata copiaba el rol de raw_user_meta_data
-- (que escribe el cliente en el body del signup) hacia raw_app_meta_data
-- (del que leen las políticas RLS). Con esa cadena, cualquiera podía
-- registrarse con {data:{role:"admin"}} y quedarse con escritura sobre toda
-- la base: el trigger deshacía la propia defensa que describe
-- SUPABASE_FIXES.md.
--
-- El arreglo: el trigger solo sincroniza roles que no dan privilegio, y
-- nunca degrada un admin/organizer que ya está en app_metadata.
--
-- Para dar de alta cuentas de organización, ver supabase/grant-admin.sql.
-- ============================================================================

-- ── 1. Corregir la función del INSERT/UPDATE ──────────────────────────────
create or replace function public.sync_role_app_metadata()
returns trigger as $$
begin
  if new.raw_user_meta_data ? 'role'
     and new.raw_user_meta_data->>'role' = any (array['player','captain','club','sponsor'])
     and coalesce(new.raw_app_meta_data->>'role','') not in ('admin','organizer') then
    new.raw_app_meta_data := jsonb_set(
      coalesce(new.raw_app_meta_data, '{}'::jsonb),
      '{role}',
      new.raw_user_meta_data->'role'
    );
  end if;
  return new;
end;
$$ language plpgsql;

-- ── 2. Corregir la función del UPDATE (misma regla) ───────────────────────
create or replace function public.sync_role_on_update()
returns trigger as $$
begin
  if new.raw_user_meta_data ->> 'role' is distinct from old.raw_user_meta_data ->> 'role'
     and new.raw_user_meta_data->>'role' = any (array['player','captain','club','sponsor'])
     and coalesce(new.raw_app_meta_data->>'role','') not in ('admin','organizer') then
    new.raw_app_meta_data := jsonb_set(
      coalesce(new.raw_app_meta_data, '{}'::jsonb),
      '{role}',
      new.raw_user_meta_data->'role'
    );
  end if;
  return new;
end;
$$ language plpgsql;

-- ── 3. Comprobar que los triggers siguen enganchados ──────────────────────
-- SELECT tgname, pg_get_triggerdef(oid)
-- FROM pg_trigger
-- WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal;

-- ── 4. Ver quién es admin ahora mismo ─────────────────────────────────────
-- SELECT email, raw_app_meta_data->>'role' AS role
-- FROM auth.users
-- WHERE raw_app_meta_data->>'role' IN ('admin','organizer');

-- ── 5. Comprobar que el arreglo corta la escalada ─────────────────────────
-- Registrarse con role=admin ya NO debe dar permisos. La cuenta de la
-- columna user_metadata queda intacta, pero app_metadata no recibe el rol.
