-- Liga16: perfiles de jugador SIN cuenta de auth
--
-- Problema: crear un jugador desde el admin hacía auth.signUp con un email
-- inventado (username@liga16.example). Eso agotaba el rate limit de emails
-- de Supabase y generaba registros falsos de usuarios.
--
-- Este script permite que user_id sea NULL: el perfil vive sin cuenta hasta
-- que el jugador real se registre.
--
-- INSTRUCCIONES: pega y ejecuta TODO en Supabase Dashboard → SQL Editor.

-- 1. user_id nullable
alter table public.player_profiles
  alter column user_id drop not null;

-- 2. Confirmar
select column_name, is_nullable
from information_schema.columns
where table_name = 'player_profiles' and column_name = 'user_id';
