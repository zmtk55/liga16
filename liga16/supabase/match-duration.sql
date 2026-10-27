-- La duración real de cada partido: unos se juegan a una hora y otros a hora
-- y media, y los cruces de cancha solo son completos si se sabe cuánto ocupa
-- cada uno.
--
-- Por qué nullable y sin backfill: los partidos viejos no dicen cuánto
-- duraron. Rellenarlos con 60 sería inventar un dato y presentar cruces
-- incompletos como completos. Null = sin registrar; la interfaz lo muestra y
-- usa el `minutesPerMatch` configurado en el torneo solo como supuesto
-- visible.
--
-- Idempotente: se puede correr las veces que sea. La app escribe a prueba de
-- columna faltante: saveMatchDuration devuelve false y avisa, sin romper el
-- guardado del resto del partido (mismo patrón que
-- saveTournamentScheduleConfig).

alter table public.matches
  add column if not exists duration_minutes integer;

comment on column public.matches.duration_minutes is
  'Duración real del partido en minutos (60 u 90). Null = sin registrar: no se rellena a lo histórico.';

-- Verificación:
-- select id, scheduled_at, duration_minutes from public.matches order by scheduled_at desc limit 10;
