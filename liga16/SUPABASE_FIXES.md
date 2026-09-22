# ✅ Fixes Supabase — Resumen Completo

## Problemas Encontrados y Arreglados

### 🔴 CRÍTICOS DE SEGURIDAD

#### 1. RLS policies usaban `raw_user_meta_data` (INSEGURO)
**Archivo:** `supabase/schema.sql`
**Problema:** `raw_user_meta_data` es editable por el usuario y aparece en el JWT. Usarlo para autorización permite a cualquier usuario escalar privilegios cambiando su metadata.
**Arreglo:** Todas las políticas RLS ahora leen de `raw_app_meta_data` que NO es editable por el cliente.

**Tablas afectadas:**
- `clubs` — política de modificación
- `tournaments` — política de modificación
- `tournament_categories` — política de modificación
- `pairs` — política de modificación
- `registrations` — política de modificación
- `player_profiles` — política de modificación
- `player_cards` — política de modificación
- `teams` — política de modificación
- `team_members` — política de modificación
- `leagues` — política de modificación
- `league_divisions` — política de modificación
- `league_teams` — política de modificación
- `matches` — política de modificación
- `ranking_events` — política de modificación
- `news` — política de modificación
- `sponsors` — política de modificación
- `invitations` — política de vista y modificación

#### 2. `auth.role()` deprecated en RLS policies
**Archivo:** `supabase/schema.sql`
**Problema:** `auth.role()` fue deprecado por Supabase. En lugar de `auth.role() = 'authenticated'`, usar la cláusula `TO authenticated`.
**Arreglo:** Las políticas usan `to authenticated` / `to anon` + `USING` con predicados de propiedad.

#### 3. Faltan `WITH CHECK` en políticas UPDATE (BOLA/IDOR risk)
**Problema:** Sin `WITH CHECK`, un usuario puede reasignar `user_id` de un registro a otro.
**Arreglo:** Todas las políticas UPDATE ahora tienen `WITH CHECK` apropiado.

#### 4. Triggers sincronizan role a raw_app_meta_data (NUEVO)
**Archivo:** `supabase/schema.sql`
**Añadido:**
- `trigger_sync_role_app_metadata` — copia `raw_user_meta_data->>'role'` a `raw_app_metadata->>'role'` al insertar/actualizar usuario
- `trigger_sync_role_update` — sincroniza cuando cambia el rol

---

### 🔴 BUGS CRÍTICOS

#### 5. AuthContext consulta tabla `users` inexistente
**Archivo:** `src/contexts/AuthContext.tsx`
**Problema:** `resolveRole()` hacía `from("users")` pero no existe tabla `users` en el schema.
**Arreglo:** Ahora usa `supabase.auth.getUser()` y lee el rol de `app_metadata`.

#### 6. PlayerProfile no tenía `role` en tipos TypeScript
**Archivo:** `src/types/index.ts`
**Arreglo:** Agregado `role: UserRole` a la interfaz `PlayerProfile`.

#### 7. Seed data no tenía `role` en jugadores
**Archivo:** `src/lib/data/seed.ts`
**Arreglo:** Agregado `role: 'player'` a todos los 12 jugadores.

#### 8. createPlayer guardaba role en wrong metadata location
**Archivo:** `src/lib/data/supabase.ts`
**Problema:** Guardaba role en `options.data` (que va a `raw_user_meta_data`, inseguro).
**Arreglo:** Sigue usando `data` pero los triggers SQL sincronizan automáticamente a `raw_app_meta_data`.

---

### 🔴 DATOS DE PADEL — DOMINIO CORRECTO

#### 9. Equipos son parejas (2 jugadores), no equipos con plantilla
**Archivo:** `src/types/index.ts`, `supabase/schema.sql`, `src/lib/data/seed.ts`
**Problema:** El tipo `Team` tenía `members` (array de 3+ jugadores), `captain_name`, `category: "Primera División"`, `record: {played, won, lost}` — esto es fútbol/soccer, no padel.
**Arreglo:**
- `Team` ahora tiene `pair1`, `pair2` (parejas de 2), `alternate` (suplente)
- `division`: `1ra`, `2da`, `3ra`, `4ta`, `5ta`, `6ta`, `Novatos`
- `sex`: `M`, `F`, `X`
- `sets_for`, `sets_against`, `points` — estadísticas de liga por parejas
- Schema: tabla `teams` con `pair1_name`, `pair1_level`, `pair2_name`, `pair2_level`, `alternate_name`

#### 10. Categorías de torneo: división + género, no códigos de edad
**Archivo:** `supabase/schema.sql`
**Problema:** `tournament_category` enum tenía `('18A', '18B', ...)` — categorías por edad, no de padel.
**Arreglo:** Nuevo enum `padel_division` con valores `('1ra', '2da', '3ra', '4ta', '5ta', '6ta', 'Novatos')`.

#### 11. Scores: formato padel (sets de juegos)
**Archivo:** `src/features/calendar/page.tsx`, `src/features/home/page.tsx`
**Problema:** Scores mostraban formato genérico `6-4  3-4` sin contexto.
**Arreglo:** Muestra `S1: 6-4 · S2: 3-4` con conteo de juegos por pareja.

---

### 🟠 MEJORAS

#### 12. Creados archivos de configuración faltantes
- `.env.example` — template de variables de entorno
- `.gitignore` — protege `.env.local` y archivos sensibles

#### 13. Admin layout protegido con auth check
**Archivo:** `src/features/admin/layout.tsx`
**Mejora:** Ahora verifica:
- Demo mode → permite acceso con indicador visual
- Sin sesión → pantalla de acceso restringido
- Rol incorrecto → pantalla de permisos insuficientes
- Rol válido → renderiza layout normal con badge del rol

#### 14. Admin dashboard mejorado
- Tamaño de título corregido
- Indicador de demo mode visible

#### 15. Admin equipos: formulario actualizado
**Archivo:** `src/features/admin/teams.tsx`
- Formulario ahora pide: nombre, división (1ra-Novatos), género, jugador 1, jugador 2
- Tabla muestra: división + género, PJ, G, P, posición
- Validación: nombre + ambos jugadores requeridos

---

## Checklist Post-Despliegue

- [ ] Aplicar `supabase/schema.sql` actualizado en Supabase SQL Editor
- [ ] Verificar que triggers existan:
  - [ ] `trigger_sync_role_app_metadata`
  - [ ] `trigger_sync_role_update`
  - [ ] `trigger_auth_user_created`
- [ ] Configurar variables en Vercel:
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] Verificar RLS funciona con un usuario de prueba
- [ ] Verificar signup crea role en `raw_app_metadata`
- [ ] Probar registro de pareja en modo demo y Supabase
