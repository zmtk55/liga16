# 🚀 Despliegue en Vercel — Liga16

## Opción 1: Vercel CLI (recomendado)

```bash
# 1. Instalar Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Desplegar (desde la carpeta liga16/liga16/)
cd /Users/julianarocha/Documents/Default\ Project/liga16/liga16
vercel

# 4. Agregar variables de entorno en Vercel dashboard:
#    VITE_SUPABASE_URL
#    VITE_SUPABASE_ANON_KEY

# 5. Para producción:
vercel --prod
```

## Opción 2: GitHub Integration

1. Sube el repo a GitHub: `git push`
2. Ve a https://vercel.com/new
3. Importa el repositorio `zmtk55/liga16` (o tu fork)
4. Verifica el framework: **Vite**
5. Agrega env vars:
   - `VITE_SUPABASE_URL` = tu URL de Supabase
   - `VITE_SUPABASE_ANON_KEY` = tu anon key
6. Click **Deploy**

## Opción 3: Directo (ya está deployado)

La app ya está en **https://liga16.vercel.app** (deploy anterior).

Para actualizar después de estos cambios:
```bash
# Desde la carpeta del proyecto
vercel --prod
```

## Notas importantes

### Schema SQL en Supabase
Antes de que el modo Supabase funcione, **aplica el schema actualizado** en el SQL Editor de Supabase:
1. Copia el contenido de `supabase/schema.sql` (ya actualizado con RLS seguro)
2. Ve a Supabase Dashboard → SQL Editor
3. Ejecuta el SQL completo
4. Verifica que los triggers estén creados:
   - `trigger_sync_role_app_metadata`
   - `trigger_sync_role_update`
   - `trigger_auth_user_created`

### Verificación post-deploy
```bash
# Verificar build local
npm run build

# Verificar TypeScript
npx tsc --noEmit
```

O, mejor, el gate completo (lo mismo que corre el hook de pre-push):

```bash
npm run verify
```

`verify` corre `check:ui` (imports rotos, componentes muertos, texto por debajo
de 12px), `lint`, `typecheck` y `build`. Si algo falla, sale con código distinto
de cero.

El hook `pre-push` (en `githooks/`) repite esas comprobaciones sobre el **árbol
exacto del push** y solo bloquea `master`, que es la rama que despliega Vercel.
Para activarlo en una copia nueva del repo:

```bash
git config core.hooksPath githooks
```

Si estorba en un push puntual: `git push --no-verify` (con intención).

### El primer admin

El panel `/admin` solo abre para cuentas con rol `admin` u `organizer`, y ese
rol **no se puede pedir en el registro**: el trigger `sync_role_app_metadata`
solo sincroniza roles sin privilegio (`player`, `captain`, `club`, `sponsor`),
a propósito, porque `raw_user_meta_data` lo controla el usuario y copiarlo
hacia `app_metadata` dejaría que cualquiera se auto-asigne admin.

Para dar de alta la primera cuenta de organización, en el **SQL Editor** de
Supabase, usa `supabase/grant-admin.sql`:

```sql
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
      coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', '"admin"'
    )
WHERE email = 'tu@correo.com';
```

Para comprobar quién es admin:

```sql
SELECT email, raw_app_meta_data->>'role' AS role
FROM auth.users
WHERE raw_app_meta_data->>'role' IN ('admin','organizer');
```

### Nota sobre el trigger de roles

`SUPABASE_FIXES.md` explica que las políticas RLS leen `raw_app_meta_data` en
vez de `raw_user_meta_data` porque el segundo lo puede editar el cliente. Ese
cambio solo es seguro si **nada** copia el rol desde `raw_user_meta_data`:
por eso el trigger ahora filtra los roles privilegiados y el alta de admins se
hace a mano (ver arriba). Si se reaplica una versión vieja de `schema.sql`, el
agujero vuelve.
