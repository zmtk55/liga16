-- ============================================================================
-- Restricción única sobre el nombre normalizado de player_profiles.
--
-- Impide duplicados aunque el código falle (carreras, bugs, edición manual):
-- 'julian arocha', 'Julián   Arocha' y 'JULIAN AROCHA' comparten clave y solo
-- uno puede existir. Idempotente — seguro de re-ejecutar.
--
-- Nota: los acentos van generados con chr() para que la función sobreviva
-- cualquier transporte/escape; el resultado es equivalente a la lista literal
-- 'áàäâéèëêíìïîóòöôúùüûñç' → 'aaaaeeeeiiiioooouuuunc'.
-- ============================================================================

-- 1) Función de normalización: minúsculas, sin acentos, espacios colapsados.
--    IMMUTABLE (requerido para índices) + PARALLEL SAFE.
create or replace function public.normalized_player_name(p_name text)
returns text
language sql
immutable
parallel safe
as $$
  select trim(
    regexp_replace(
      translate(
        lower(p_name),
        chr(225)||chr(224)||chr(228)||chr(226)||chr(233)||chr(232)||chr(235)||chr(234)||
        chr(237)||chr(236)||chr(239)||chr(238)||chr(243)||chr(242)||chr(246)||chr(244)||
        chr(250)||chr(249)||chr(252)||chr(251)||chr(241)||chr(231),
        'aaaaeeeeiiiioooouuuunc'
      ),
      '\s+', ' ', 'g'
    )
  )
$$;

-- 2) Verificación previa: si esta consulta devuelve filas, hay duplicados que
--    fusionar ANTES de crear el índice (última vez: Julian Arocha, ya fusionado).
-- select normalized_player_name(display_name) as norm, count(*), string_agg(id::text, ' | ')
-- from player_profiles group by 1 having count(*) > 1;

-- 3) Índice único funcional.
create unique index if not exists player_profiles_display_name_norm_key
  on public.player_profiles (normalized_player_name(display_name));

-- 4) Prueba de humo (descomentar para verificar):
--    debe fallar con 23505 mientras exista "Julian Arocha":
-- insert into player_profiles (display_name, username) values ('julian   arocha', 'probe');
