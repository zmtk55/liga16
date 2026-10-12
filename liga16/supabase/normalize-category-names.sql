-- Normaliza los nombres de categoría al vocabulario del circuito.
--
-- El sistema habla "5ta", "4ta", "Femenil", "Varonil", "Mixto". Pero las
-- categorías se TECLEAN (nombre libre) y hay filas viejas con la forma larga:
-- "Quinta femenina", "Cuarta masculina", "Sexta femenino". Eso no es cosmético:
--
--   1. `sexFromCategory()` en src/lib/data/supabase.ts solo reconocía
--      'femenil' / 'varonil' / 'mixto'. Con "5ta Femenino" devolvía null y la
--      división salía del nivel de los jugadores — o sea, inventada.
--   2. `matches.round` lleva el nombre de la categoría DELANTE
--      ("4ta Varonil · Grupo A · J1") y `lib/groups.ts` lo parte por esa
--      etiqueta. Renombrar la categoría sin tocar `round` deja los partidos
--      apuntando a un grupo que ya no existe.
--
-- Idempotente: sólo toca palabras, así que correrlo dos veces no hace nada la
-- segunda. NO toca "Suma 9", "Suma Nueve", "Open", "Novatos" ni los que ya
-- están bien.

-- ---------------------------------------------------------------------------
-- LA regla, en un solo sitio. La misma función se aplica a las 4 columnas que
-- guardan texto de categoría; cuatro copias de la misma cadena de
-- regexp_replace serían cuatro cosas que se desincronizan.
--
-- El ordinal NO sale de un patrón común ("1ra/2da/3ra/4ta/5ta/6ta"), así que
-- va con CASE. La rama sí, y va primero para que "Quinta femenina" quede
-- "5ta Femenil" y no "5ta femenina".
-- ---------------------------------------------------------------------------
create or replace function public.liga16_normalize_label(txt text)
returns text
language sql
immutable
as $$
  with ordinal as (
    select case
      when txt ~* '\mprimera\M' then regexp_replace(txt, '\mprimera\M', '1ra', 'i')
      when txt ~* '\msegunda\M' then regexp_replace(txt, '\msegunda\M', '2da', 'i')
      when txt ~* '\mtercera\M' then regexp_replace(txt, '\mtercera\M', '3ra', 'i')
      when txt ~* '\mcuarta\M'  then regexp_replace(txt, '\mcuarta\M',  '4ta', 'i')
      when txt ~* '\mquinta\M'  then regexp_replace(txt, '\mquinta\M',  '5ta', 'i')
      when txt ~* '\msexta\M'   then regexp_replace(txt, '\msexta\M',   '6ta', 'i')
      when txt ~* '\mseptima\M' then regexp_replace(txt, '\mseptima\M', '7ta', 'i')
      else txt
    end as t
  )
  select regexp_replace(
    regexp_replace(
      regexp_replace(
        t,
        '\m(femenino|femenina|damas)\M',    'Femenil', 'gi'
      ),
      '\m(masculino|masculina|varones)\M', 'Varonil', 'gi'
    ),
    '\s{2,}', ' ', 'g'   -- "5ta  Femenil" -> "5ta Femenil"
  )
  from ordinal;
$$;

-- ===========================================================================
-- 1. CHEQUEO — correr SOLO esto primero y leer el resultado.
-- ===========================================================================

-- Qué renombraría:
select
  id,
  name                                as "ahora",
  public.liga16_normalize_label(name) as "pasaria_a",
  tournament_id
from public.tournament_categories
where name <> public.liga16_normalize_label(name)
order by tournament_id, name;

-- Si esto devuelve filas, el rename choca con `unique (tournament_id, name)` y
-- la transacción de abajo va a fallar y a hacer rollback. Renombra o borra las
-- repetidas antes:
select a.tournament_id, a.name, a.id as id_a, b.id as id_b
from public.tournament_categories a
join public.tournament_categories b
  on a.tournament_id = b.tournament_id
 and a.id < b.id
where public.liga16_normalize_label(a.name) = public.liga16_normalize_label(b.name);

-- ===========================================================================
-- 2. APLICAR — sólo si el chequeo salió limpio.
-- ===========================================================================
begin;

-- La categoría del torneo. Es la fuente: todo lo demás se deriva de acá.
update public.tournament_categories
set name = public.liga16_normalize_label(name)
where name <> public.liga16_normalize_label(name);

-- Copia del nombre dentro del partido.
update public.matches
set category_name = public.liga16_normalize_label(category_name)
where category_name is not null
  and category_name <> public.liga16_normalize_label(category_name);

-- `round` lleva la categoría DELANTE ("4ta Varonil · Grupo A · J1") y
-- `lib/groups.ts` lo parte por esa etiqueta. Si sólo se renombra la categoría,
-- los partidos quedan apuntando a un grupo que ya no existe y los filtros de
-- grupo salen vacíos.
update public.matches
set round = public.liga16_normalize_label(round)
where round is not null
  and round <> public.liga16_normalize_label(round);

-- Divisiones de liga (el ranking por divisiones).
update public.league_divisions
set name = public.liga16_normalize_label(name)
where name <> public.liga16_normalize_label(name);

update public.league_teams
set division = public.liga16_normalize_label(division)
where division is not null
  and division <> public.liga16_normalize_label(division);

commit;

-- ===========================================================================
-- 3. VERIFICAR — debe devolver 0 en todas las filas.
-- ===========================================================================
select 'tournament_categories' as tabla, count(*) as pendientes
from public.tournament_categories where name <> public.liga16_normalize_label(name)
union all
select 'matches.category_name', count(*) from public.matches
where category_name is not null and category_name <> public.liga16_normalize_label(category_name)
union all
select 'matches.round', count(*) from public.matches
where round is not null and round <> public.liga16_normalize_label(round)
union all
select 'league_divisions.name', count(*) from public.league_divisions
where name <> public.liga16_normalize_label(name)
union all
select 'league_teams.division', count(*) from public.league_teams
where division is not null and division <> public.liga16_normalize_label(division);
