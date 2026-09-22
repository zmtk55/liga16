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
