-- Liga16 — REPARACIÓN URGENTE del registro de usuarios
--
-- Problema: los triggers sync_role_* referenciaban la columna inexistente
-- `raw_app_metadata` (el nombre real es `raw_app_meta_data`), así que TODO
-- signup fallaba con 500 "Database error saving new user".
--
-- INSTRUCCIONES: pega y ejecuta TODO este script en Supabase Dashboard → SQL Editor.
-- Es idempotente: puedes ejecutarlo varias veces sin romper nada.

-- 1. Corregir las funciones del trigger (nombres de columna correctos)
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

-- 2. Verificación: probar que los triggers ya no rompen
--    (opcional) revisa que existen las funciones corregidas:
select proname from pg_proc where proname in ('sync_role_app_metadata', 'sync_role_on_update');

-- 3. Después de ejecutar esto, crea tu usuario admin:
--    Opción A: regístrate normal desde la web (ya debería funcionar) y luego corre:
--
--    update auth.users
--    set raw_app_meta_data = jsonb_set(
--      coalesce(raw_app_meta_data, '{}'::jsonb),
--      '{role}',
--      '"admin"'::jsonb
--    )
--    where email = 'TU_CORREO@gmail.com';
--
--    Opción B: crea el usuario desde Dashboard → Authentication → Users → Add user
--    (marca "Auto Confirm User") y luego corre el update de arriba.
--
-- 4. Cierra sesión y vuelve a entrar en la web para que el rol se hidrate.
