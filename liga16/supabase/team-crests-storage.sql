-- Fotos de equipo en Supabase Storage (bucket público `team-crests`).
--
-- La columna pairs.crest_url ya existe (migración add_crest_url_to_pairs).
-- Este script crea el bucket, sus límites y las políticas RLS de storage.
-- Idempotente: se puede re-ejecutar sin error.
--
-- Nota: el rol de admin vive en auth.users.raw_app_meta_data->'role' = 'admin'
-- (mismo criterio que usa AuthContext para autorizar el panel /admin).

-- 1) Bucket público: solo imágenes, máx. 2 MB por archivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('team-crests', 'team-crests', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Nota: en versiones nuevas de storage existe storage.buckets.headers para
-- fijar Cache-Control (los reemplazos suben un archivo nuevo con otro nombre,
-- así que se podría usar max-age=31536000, immutable). Esta instancia no
-- tiene esa columna; los headers por defecto funcionan correctamente.

-- 2) Lectura pública (las URLs /object/public/... las respetan estas políticas).
drop policy if exists "Lectura publica de crests" on storage.objects;
create policy "Lectura publica de crests" on storage.objects
  for select
  using (bucket_id = 'team-crests');

-- 3) Escritura solo para usuarios con rol admin en app_metadata (el JWT del admin).
drop policy if exists "Subida de crests solo admin" on storage.objects;
create policy "Subida de crests solo admin" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'team-crests'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Actualizacion de crests solo admin" on storage.objects;
create policy "Actualizacion de crests solo admin" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'team-crests'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    bucket_id = 'team-crests'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Borrado de crests solo admin" on storage.objects;
create policy "Borrado de crests solo admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'team-crests'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
