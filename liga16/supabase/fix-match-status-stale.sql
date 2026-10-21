-- Cierra los partidos que tienen marcador pero siguen marcados 'scheduled'.
--
-- El estado se cerraba a mano en el diálogo de captura y quedó desincronizado
-- del marcador: de 60 partidos, 27 tienen sets completos (25 con `winner`
-- guardado) y seguían en 'scheduled'. Con el campo a la vista, el admin veía
-- "54 por capturar" y 27 cards con trofeo y "Finalizado" en la misma
-- pantalla.
--
-- Por qué importa (no era cosmético):
--
--   1. La captura de resultados ya cierra el estado al guardar (ver
--      `updateMatch` en src/lib/data/supabase.ts), así que esto solo afecta a
--      las filas viejas.
--   2. Todo lo que lea `matches.status` en crudo sigue mintiendo hasta que se
--      corra esto: informes, consultas y cualquier script que no pase por la
--      regla de `src/lib/match-state.ts`.
--
-- Misma regla que el código: un partido está terminado si tiene ganador, o
-- si un lado ganó 2 sets o más (sets_to_win). El super tie-break a 10 cuenta
-- como un set más, así que 6-3, 4-6, 10-8 decide 2-1.
--
-- Es idempotente: la segunda vez no cambia nada (ya no quedan filas
-- 'scheduled' con marcador completo).
-- No toca fechas, canchas, parejas, sets ni ganador: solo el estado.

update public.matches m
set status = 'finished'
where m.status = 'scheduled'
  and (
    m.winner is not null
    or (
      select count(*)
      from jsonb_array_elements(coalesce(m.sets, '[]'::jsonb)) s
      where coalesce((s->>'a')::numeric, 0) > coalesce((s->>'b')::numeric, 0)
    ) >= 2
    or (
      select count(*)
      from jsonb_array_elements(coalesce(m.sets, '[]'::jsonb)) s
      where coalesce((s->>'b')::numeric, 0) > coalesce((s->>'a')::numeric, 0)
    ) >= 2
  );

-- Verificación: ya no debe quedar ningún partido 'scheduled' con marcador
-- completo. Debe salir 0 filas.
-- select id, status, winner, sets
--   from public.matches
--  where status = 'scheduled'
--    and (
--      winner is not null
--      or (
--        select count(*)
--        from jsonb_array_elements(coalesce(sets, '[]'::jsonb)) s
--        where coalesce((s->>'a')::numeric, 0) > coalesce((s->>'b')::numeric, 0)
--      ) >= 2
--      or (
--        select count(*)
--        from jsonb_array_elements(coalesce(sets, '[]'::jsonb)) s
--        where coalesce((s->>'b')::numeric, 0) > coalesce((s->>'a')::numeric, 0)
--      ) >= 2
--    );
