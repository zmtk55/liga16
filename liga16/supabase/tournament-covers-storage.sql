-- Portadas de torneo en Supabase Storage (bucket público `tournament-covers`).
--
-- La columna tournaments.cover_url ya existía; este script crea el bucket,
-- sus límites y las políticas RLS de storage. Idempotente.
-- Aplicado vía MCP (execute_sql) el 2026-09-30.
--
-- Nota: el rol de admin vive en auth.users.raw_app_meta_data->'role' = 'admin'
-- (mismo criterio que team-crests-storage.sql).

-- 1) Bucket público: solo imágenes, máx. 5 MB por archivo (los pósteres
--    se reescalan a máx. 1600px JPEG en el cliente antes de subir).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tournament-covers', 'tournament-covers', true, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2) Lectura pública.
drop policy if exists "Lectura publica de covers" on storage.objects;
create policy "Lectura publica de covers" on storage.objects
  for select
  using (bucket_id = 'tournament-covers');

-- 3) Escritura solo para admins.
drop policy if exists "Subida de covers solo admin" on storage.objects;
create policy "Subida de covers solo admin" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'tournament-covers'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Actualizacion de covers solo admin" on storage.objects;
create policy "Actualizacion de covers solo admin" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'tournament-covers'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    bucket_id = 'tournament-covers'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Borrado de covers solo admin" on storage.objects;
create policy "Borrado de covers solo admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'tournament-covers'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
