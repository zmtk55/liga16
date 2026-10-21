# PENDIENTES — cambios de base de datos en Supabase

Proyecto de producción: `kmvjslcpemwssqtllosk`.

Verificado el 2026-10-21 contra la base real (no contra el repo). Cada línea
de abajo se comprobó con una consulta o con la API de storage.

---

## 🔴 FALTA — bloquea funciones de la app

### 1. Los buckets de Storage: **no existe ninguno**

Comprobado: `NoSuchBucket` para `team-crests`, `tournament-covers` y
cualquier otro. **El proyecto de Storage está vacío.**

```
storage/v1/object/list/team-crests        -> 404 NoSuchBucket
storage/v1/object/list/tournament-covers  -> 404 NoSuchBucket
```

**Lo que la app hace con ellos** (y hoy falla):

| Bucket | Quién lo usa | Qué pasa sin él |
|---|---|---|
| `team-crests` | `admin/teams.tsx:547` (subir escudo de pareja), `admin/tournament-wizard.tsx:125` | **Subir un escudo falla** |
| `tournament-covers` | `admin/tournament-wizard.tsx:1442` (portada del torneo) | **Subir una portada falla** |

**Cómo se arregla** (idempotente, se puede correr las veces que sea):

- [`team-crests-storage.sql`](./team-crests-storage.sql) — bucket público, solo
  imágenes, máx. 2 MB, con sus políticas de lectura pública y escritura solo
  para admin.
- [`tournament-covers-storage.sql`](./tournament-covers-storage.sql) — lo mismo,
  máx. 5 MB.

Corre los dos en el **Supabase Dashboard → SQL Editor** (o con el token de
administración, que es lo que quedó agendado).

---

## 🟢 YA APLICADO (verificado en la base, no en el repo)

| Cambio | Archivo | Estado |
|---|---|---|
| `tournaments.schedule_config` jsonb — la disponibilidad por torneo (días, horas, canchas) | [`tournament-schedule-config.sql`](./tournament-schedule-config.sql) | **aplicado** ✓ |
| `pairs.group_name` text + índice — el grupo al que pertenece cada pareja | [`pairs-group-name.sql`](./pairs-group-name.sql) | **aplicado** ✓ |
| `tournaments.scoring`, `semifinal_slots`, `cover_url` | `migrate-scoring-courts.sql`, `tournament-semifinal-slots.sql` | aplicados ✓ |
| `pairs.crest_url` | `schema.sql` | aplicado ✓ |
| `player_profiles.status`, `user_id`, `username` | `self-registration.sql`, `fix-player-profiles.sql` | aplicados ✓ |
| Función `is_admin_or_organizer(text[])` | `fix-rls.sql` | aplicada ✓ |
| Función `normalized_player_name(text)` + índice único | `player-name-unique.sql` | aplicados ✓ |
| Nombres de categoría normalizados | `normalize-category-names.sql` | aplicados ✓ |

---

## 🟡 POR CONFIRMAR (la API de datos no alcanza a verlo)

Tres objetos que no se pueden comprobar desde PostgREST: el **RPC devuelve
404** tanto si el objeto no existe como si la caché del esquema está vieja, y
las **funciones de trigger no son invocables** por API.

| Objeto | Archivo | Cómo comprobarlo |
|---|---|---|
| `liga16_normalize_label(txt)` | [`normalize-category-names.sql`](./normalize-category-names.sql) | El RPC dio 404, pero los datos **sí** están normalizados ("Cuarta femenil", "Suma 9 varonil"). Probablemente caché del esquema. |
| `handle_auth_user_created()`, `guard_player_self_update()` | [`self-registration.sql`](./self-registration.sql) | Trigger: no invocable. La columna `player_profiles.status` sí existe, que es lo que agrega ese archivo. |
| `sync_role_app_metadata()`, `sync_role_on_update()` | [`fix-signup.sql`](./fix-signup.sql) | Trigger: no invocable. |

Una sola consulta los resuelve todos:

```sql
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

## Nota sobre `schema.sql`

[`schema.sql`](./schema.sql) es la base completa para instalar desde cero. La
base de producción **ya está sincronizada** con ella (las dos columnas que
faltaban se aplicaron).

Los archivos `*.sql` de esta carpeta son los parches, no el estado: algunos ya
están aplicados y otros no. **El único fiable es el de arriba, comprobado
contra la base.**
