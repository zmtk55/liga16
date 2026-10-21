-- Los partidos de un torneo con varias categorías necesitan la categoría EN EL
-- NOMBRE DE LA RONDA.
--
-- Qué pasó: una versión anterior del sorteo generaba un round-robin sobre TODAS
-- las parejas del torneo a la vez y nombraba los grupos "Jornada 1..N". Como el
-- nombre no llevaba la categoría, el round-robin de 4tas y el de 5tas acababan
-- dentro de la MISMA "Jornada 1". El emparejamiento en sí era correcto: cada
-- (categoría, jornada) tiene exactamente 3 partidos con 6 parejas distintas, que
-- es el round-robin de 6 parejas. Lo que faltaba era la etiqueta.
--
-- Por qué importa (no era cosmético):
--
--   1. "Grupos y sorteo" reconstruye los grupos desde `matches.round`. Con el
--      nombre viejo mostraba 5 grupos de 24 parejas en vez de 4 grupos de 6,
--      y la nota "las categorías no se mezclan" era falsa en pantalla.
--   2. "Posiciones" compara la tabla dentro del grupo. Con las 4 categorías en
--      el mismo grupo, la posición de una pareja de 4ta competía contra la de
--      una de 5ta — justo lo que el propio producto prohíbe ("una categoría es
--      una competencia cerrada").
--   3. El bracket sacaba las clasificaciones de esas mismas tablas mezcladas.
--
-- El nombre nuevo es EXACTAMENTE el que produce hoy el sorteo por categoría
-- (`drawGroupsByCategory` en src/lib/groups.ts): "<Categoría> · Grupo A · J<n>".
-- Así un torneo viejo y uno nuevo se leen igual, y `parseRound` sigue sacando
-- la jornada del final.
--
-- Es un renombrado: no toca fechas, canchas, parejas, sets, ganador ni estado.
-- Los resultados capturados se conservan.
--
-- Idempotente: sólo toca rondas con la forma antigua ("Jornada 12"), así que
-- correrlo dos veces no hace nada la segunda vez.

update public.matches m
set round =
      coalesce(nullif(m.category_name, ''), 'Grupo')
      || ' · Grupo A · J'
      || (regexp_match(m.round, '([0-9]+)\s*$'))[1]
where m.round ~ '^Jornada\s+[0-9]+\s*$'
  and nullif(m.category_name, '') is not null;

-- Verificación: cada (categoría, jornada) debe seguir con el mismo número de
-- partidos, y ahora las rondas deben distinguir la categoría.
-- select category_name, round, count(*)
--   from public.matches
--  group by 1, 2
--  order by 1, 2;
