-- Liga16 — REPARACIÓN DEFINITIVA del registro de usuarios (v2)
--
-- Síntoma: todo signup devuelve 500 "Database error saving new user".
-- Causas corregidas aquí:
--   1. Los triggers sync_role_* referenciaban la columna inexistente
--      `raw_app_metadata` (la real es `raw_app_meta_data`).
--   2. Si crear el perfil del jugador falla por cualquier motivo
--      (username duplicado, dato faltante), el signup entero se cae.
--      Ahora el trigger de perfil es tolerante a fallos: registra el error
--      y permite crear el usuario de todas formas.
--
-- INSTRUCCIONES: pega y ejecuta TODO este script en Supabase Dashboard → SQL Editor.
-- Es idempotente: puedes ejecutarlo varias veces sin romper nada.

-- ============================================================
-- 1. Funciones de sincronización de rol (columnas correctas)
-- ============================================================
create or replace function public.sync_role_app_metadata()
returns trigger as $$
begin
  if new.raw_user_meta_data ? 'role' then
    new.raw_app_meta_data := jsonb_set(
      coalesce(new.raw_app_meta_data, '{}'::jsonb),
      '{role}',
      new.raw_user_meta_data->'role'
    );
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function public.sync_role_on_update()
returns trigger as $$
begin
  if new.raw_user_meta_data ->> 'role' is distinct from old.raw_user_meta_data ->> 'role' then
    new.raw_app_meta_data := jsonb_set(
      coalesce(new.raw_app_meta_data, '{}'::jsonb),
      '{role}',
      new.raw_user_meta_data->'role'
    );
  end if;
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- 2. Trigger de perfil tolerante a fallos
--    Si falla la creación del perfil, el usuario SÍ se crea
--    y el error queda registrado en los logs de Supabase.
-- ============================================================
create or replace function public.handle_auth_user_created()
returns trigger as $$
begin
  begin
    insert into public.player_profiles (user_id, display_name, username, city, state)
    values (
      new.id,
      coalesce(new.raw_app_meta_data->>'display_name', new.raw_user_meta_data->>'display_name', new.email),
      coalesce(new.raw_app_meta_data->>'username', new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)) || '-' || substr(new.id::text, 1, 6),
      'Ciudad de México',
      'CDMX'
    );
  exception when others then
    -- No bloquear el signup: el perfil se puede crear después desde el admin
    raise warning 'handle_auth_user_created: no se pudo crear perfil para %: %', new.email, sqlerrm;
  end;
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- 3. Recrear los triggers limpiamente (drop + create)
-- ============================================================
drop trigger if exists trigger_sync_role_app_metadata on auth.users;
create trigger trigger_sync_role_app_metadata
  before insert on auth.users
  for each row execute function public.sync_role_app_metadata();

drop trigger if exists trigger_sync_role_update on auth.users;
create trigger trigger_sync_role_update
  before update on auth.users
  for each row execute function public.sync_role_on_update();

drop trigger if exists trigger_auth_user_created on auth.users;
create trigger trigger_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_created();

-- ============================================================
-- 4. Verificación: estos triggers deben existir en auth.users
-- ============================================================
select tgname
from pg_trigger
where tgrelid = 'auth.users'::regclass and not tgisinternal
order by tgname;

-- Resultado esperado (4 filas):
--   trigger_auth_user_created
--   trigger_sync_role_app_metadata
--   trigger_sync_role_update
--   trigger_on_auth_user_created   (si existe de antes, es de otra versión del schema; ignóralo)

-- ============================================================
-- 5. Crear / promover tu admin (edita el correo)
-- ============================================================
-- update auth.users
-- set raw_app_meta_data = jsonb_set(
--   coalesce(raw_app_meta_data, '{}'::jsonb),
--   '{role}',
--   '"admin"'::jsonb
-- )
-- where email = 'TU_CORREO@gmail.com';
--
-- O crea el usuario en Authentication → Users → Add user
-- marcando "Auto Confirm User", y luego corre el update de arriba.
