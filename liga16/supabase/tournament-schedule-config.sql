-- La disponibilidad de cada torneo: qué días hay juego, a qué horas y con qué
-- canchas.
--
-- Por qué una columna y no un valor único en la app: cada torneo juega distinto.
-- Un torneo de fin de semana en la mañana y otro de entre semana por la noche no
-- comparten ni un solo día, ni una sola hora, ni las mismas canchas. Con la
-- disponibilidad en el estado de la pantalla, se perdía al recargar y el
-- calendario del siguiente torneo arrancaba con los defaults de siempre.
--
-- La columna es jsonb con esta forma:
--
--   {
--     "days": ["2026-10-06", "2026-10-07"],
--     "hours": [9, 11, 13, 15, 17, 19],
--     "courtNames": ["Cancha 1", "cancha 2"],
--     "minutesPerMatch": 60
--   }
--
-- `days` son fechas locales ("YYYY-MM-DD"), `hours` son horas de inicio en
-- punto (0-23) y `courtNames` son los NOMBRES exactos de las canchas del club:
-- si el nombre no coincide, el partido se queda sin cancha.
--
-- Idempotente: se puede correr las veces que sea. La app lee la columna si
-- existe; si no existe, sigue funcionando (deduciendo la disponibilidad de los
-- partidos ya agendados) y solo se pierde el recuerdo entre recargas. Por eso
-- la escritura es a prueba de columna faltante.

alter table public.tournaments
  add column if not exists schedule_config jsonb;

-- Un torneo sin disponibilidad guardada no es un error: la deduce de sus
-- partidos. Un torneo con la disponibilidad a medias tampoco.
comment on column public.tournaments.schedule_config is
  'Disponibilidad del torneo: days (YYYY-MM-DD), hours (0-23), courtNames y minutesPerMatch. Null = se deduce de los partidos ya agendados.';

-- Verificación:
-- select slug, schedule_config from public.tournaments where schedule_config is not null;
