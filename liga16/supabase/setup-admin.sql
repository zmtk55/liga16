-- Liga16 — Setup inicial de administrador en Supabase
--
-- Pasos:
-- 1. Ve a Supabase Dashboard → SQL Editor y ejecuta primero `supabase/schema.sql` completo.
-- 2. Crea el usuario admin desde el dashboard:
--    Authentication → Users → Add user → Create new user
--    Email: julian.blackflag@gmail.com
--    Password: 123456
-- 3. Ejecuta el siguiente SQL para asignarle rol admin:

update auth.users
set raw_app_meta_data = jsonb_set(
  coalesce(raw_app_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'::jsonb
)
where email = 'julian.blackflag@gmail.com';

-- Verificación
select id, email, raw_app_meta_data->>'role' as role
from auth.users
where email = 'julian.blackflag@gmail.com';
