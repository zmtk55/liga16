-- ============================================================================
-- Opción A — Autoregistro: el perfil es del jugador, la inscripción al torneo es del admin
-- ============================================================================
-- El trigger `handle_auth_user_created` YA crea un perfil al registrarse, pero con
-- datos de relleno (nombre = email, username = "juan-a1b2c3") y el jugador no
-- tenía ninguna forma de corregirlo: las políticas de RLS solo permitían escribir al admin.
--
-- Este script añade:
--   1. La columna `status` para separar "creado" de "verificado por el admin".
--   2. RLS para que un jugador cree, lea y edite SU propio perfil.
--   3. Un trigger que impide que un jugador se auto-verifique o se eleve de rol.
--
-- Idempotente: se puede aplicar más de una vez.
-- ============================================================================

-- 1) Estado del perfil --------------------------------------------------------
-- Default 'verificado' para no bloquear a los perfiles que ya existen (creados
-- por el admin) ni los del seed: solo los nuevos autoregistros nacen 'pendiente'.
alter table public.player_profiles
  add column if not exists status text not null default 'verificado';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'player_profiles_status_check'
  ) then
    alter table public.player_profiles
      add constraint player_profiles_status_check
      check (status in ('pendiente', 'verificado', 'rechazado'));
  end if;
end $$;

create index if not exists idx_player_profiles_status
  on public.player_profiles (status);

-- Los perfiles que el trigger crea al registrarse entran como pendientes.
create or replace function public.handle_auth_user_created()
returns trigger as $$
begin
  begin
    insert into public.player_profiles (user_id, display_name, username, city, state, status)
    values (
      new.id,
      coalesce(new.raw_app_meta_data->>'display_name', new.raw_user_meta_data->>'display_name', new.email),
      coalesce(new.raw_app_meta_data->>'username', new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)) || '-' || substr(new.id::text, 1, 6),
      'Ciudad de México',
      'CDMX',
      'pendiente'
    );
  exception when others then
    raise warning 'handle_auth_user_created: no se pudo crear perfil para %: %', new.email, sqlerrm;
  end;
  return new;
end;
$$ language plpgsql;

-- 2) RLS: el jugador controla su perfil --------------------------------------
drop policy if exists "Users read own profile" on public.player_profiles;
create policy "Users read own profile"
  on public.player_profiles for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users create own profile" on public.player_profiles;
create policy "Users create own profile"
  on public.player_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users update own profile" on public.player_profiles;
create policy "Users update own profile"
  on public.player_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 3) El jugador no se auto-verifica ni se promueve ---------------------------
-- RLS decide filas, no columnas: sin esto un jugador podría mandar
-- status='verificado' o role='admin' en su propio UPDATE.
create or replace function public.guard_player_self_update()
returns trigger as $$
begin
  if public.is_admin_or_organizer(array['admin', 'organizer']) then
    return new;
  end if;
  new.status := old.status;
  new.official_level := old.official_level;
  new.role := old.role;
  new.active := old.active;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_guard_player_self_update on public.player_profiles;
create trigger trigger_guard_player_self_update
  before update on public.player_profiles
  for each row execute function public.guard_player_self_update();

-- Verificación rápida (opcional, descomentar):
-- select status, count(*) from public.player_profiles group by status;
