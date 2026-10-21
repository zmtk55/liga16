# PENDIENTES — cambios de base de datos en Supabase

Todo lo que falta aplicar en el proyecto de producción
(`kmvjslcpemwssqtllosk`), verificado contra la base el 2026-10-21.

Estos cambios no se pueden aplicar desde la app: el agente no tiene
`service_role` ni token de administración, y la API de datos (PostgREST) no
ejecuta DDL. Se aplican desde el **Supabase Dashboard → SQL Editor** (o con un
token de administración, que es como quedó agendado).

**Los tres archivos son idempotentes**: se pueden correr las veces que sea, en
cualquier orden, sin romper nada.

---

## 1. `tournaments.schedule_config` — la disponibilidad de cada torneo

```sql
alter table public.tournaments
  add column if not exists schedule_config jsonb;
```

Archivo: [`tournament-schedule-config.sql`](./tournament-schedule-config.sql)

Guarda qué días hay juego, a qué horas y con qué canchas, **por torneo** (cada
torneo juega distinto). Sin la columna la app sigue funcionando: deduce la
disponibilidad de los partidos ya agendados y avisa en el toast que no se pudo
guardar. Con la columna, el calendario de un torneo se abre con su propia
disponibilidad.

**Verificación actual:** `FALTA` — `column tournaments.schedule_config does not
exist` (HTTP 400 / 42703).

---

## 2. `pairs.group_name` — el grupo al que pertenece cada pareja

```sql
alter table public.pairs
  add column if not exists group_name text;

create index if not exists idx_pairs_tournament_group
  on public.pairs (tournament_id, group_name);
```

Se agrega también a [`schema.sql`](./schema.sql) (columna e índice) para que una
base nueva salga igual que la de producción.

Guarda a qué grupo ("4ta · Grupo A") quedó asignada cada pareja, para que el
sorteo no se pierda al recargar la página.

**Verificación actual:** `FALTA` — `column pairs.group_name does not exist`.

> **Ojo:** esta migración es la que necesita el trabajo que hay sin commitear en
> `src/features/admin/tournament-detail.tsx` y `src/features/admin/tournament-wizard.tsx`
> (guardar el grupo de cada pareja en la base). Si ese código llega a
> producción antes de aplicar la columna, **guardar una pareja falla**.

---

## 3. Bucket `team-crests` — las fotos de escudo de los equipos

Archivo: [`team-crests-storage.sql`](./team-crests-storage.sql)

Crea el bucket público (solo imágenes, máx. 2 MB) y sus políticas: lectura
pública, y subida/actualización/borrado solo para admin.

**Verificación actual:** `NO EXISTE` — `Bucket not found` (storage API).

> **Ojo:** la app sube los escudos a este bucket
> (`src/features/admin/teams.tsx:547`, `src/features/admin/tournament-wizard.tsx:122`).
> **Hoy, subir un escudo falla.**

---

## 4. Bucket `tournament-covers` — las portadas de los torneos

Archivo: [`tournament-covers-storage.sql`](./tournament-covers-storage.sql)

Bucket público (solo imágenes, máx. 5 MB) y sus políticas, con el mismo
criterio de admin.

**Verificación actual:** `NO EXISTE` — `Bucket not found` (storage API).

> **Ojo:** la app sube las portadas a este bucket
> (`src/features/admin/tournament-wizard.tsx:1439`). **Hoy, subir una portada
> falla.**

---

## 5. Por confirmar (necesita el SQL Editor para salir de dudas)

Estas comprobaciones se hicieron contra la API de datos, que no expone las
funciones de trigger y puede tener la caché del esquema sin recargar:

| Objeto | Archivo | Nota |
|---|---|---|
| `liga16_normalize_label(txt)` | [`normalize-category-names.sql`](./normalize-category-names.sql) | La RPC devolvió 404, pero los datos **sí** están normalizados (las categorías se leen "Cuarta femenil", "Suma 9 varonil"). Probablemente es la caché del esquema. |
| `handle_auth_user_created()`, `guard_player_self_update()` | [`self-registration.sql`](./self-registration.sql) | Son funciones de trigger: no se pueden llamar por la API, así que la comprobación no dice nada. La columna `player_profiles.status` **sí** existe, que es lo que agrega ese archivo. |
| `sync_role_app_metadata()`, `sync_role_on_update()` | [`fix-signup.sql`](./fix-signup.sql) | Funciones de trigger, misma razón. |

```sql
-- Una sola consulta para ver qué hay de verdad:
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'liga16_normalize_label', 'normalized_player_name', 'is_admin_or_organizer',
    'handle_auth_user_created', 'guard_player_self_update',
    'sync_role_app_metadata', 'sync_role_on_update'
  )
order by p.proname;
```

---

## Orden recomendado

1. `tournament-schedule-config.sql` (columna del torneo)
2. `pairs.group_name` + su índice (de arriba, en el mismo bloque)
3. `team-crests-storage.sql` (bucket de escudos)
4. `tournament-covers-storage.sql` (bucket de portadas)
5. La consulta de verificación del punto 5, y si falta algo, correr su archivo.

Todos son idempotentes: si se corre dos veces, la segunda no cambia nada.

---

## Lo que YA está aplicado (no hay que tocarlo)

Verificado contra la base el 2026-10-21:

- `tournaments.scoring`, `tournaments.semifinal_slots`, `tournaments.cover_url`
- `pairs.crest_url`
- `player_profiles.status`, `player_profiles.user_id`, `player_profiles.username`
- Función `is_admin_or_organizer(text[])` — la que da permisos de escritura al admin
- Función `normalized_player_name(text)` y el índice único `player_profiles_display_name_norm_key`
- La normalización de los nombres de categoría (los datos ya están normalizados)

---

## Nota sobre `schema.sql`

[`schema.sql`](./schema.sql) es la base completa para instalar desde cero. La
base de producción **no** está sincronizada con él: le faltan las columnas de
los puntos 1 y 2. Los archivos `*.sql` de esta carpeta son los parches; cuando
se apliquen, `schema.sql` y la base quedarán alineados.
