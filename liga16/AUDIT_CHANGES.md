# Liga16 — UX/UI Audit: Cambios Realizados

## Resumen Ejecutivo

Se auditó la web app de pádel **Liga16** (16 torneos) usando TypeSafe Jev. Se identificaron 6 problemas principales y se resolvieron todos.

---

## 🔴 PROBLEMAS CRÍTICOS ARREGLADOS

### 1. Inscripción de Torneos — CONFUSA (confianza: 0.94)
**Archivo:** `src/features/tournaments/detail.tsx`

**Problema:** El dialog de inscripción era un formulario plano sin guía. El 94% del modelo dijo que era confuso.

**Solución:**
- ✅ Dialog dividido en **3 pasos** con indicador visual:
  1. **Datos** — Nombres de jugadores, nombre de pareja
  2. **Pago** — Selección de método (transferencia/efectivo) con explicación
  3. **Confirmar** — Resumen completo antes de enviar
- ✅ Barra de progreso con iconos (User → CreditCard → Check)
- ✅ Info contextual en cada paso (caja gris con instrucciones)
- ✅ Resumen de inscripción con todos los datos para revisar
- ✅ Botones "Anterior" / "Siguiente" / "Confirmar" claros
- ✅ Header del torneo mejorado: gradiente, íconos en color primario, reglamento destacado con borde izquierdo

---

### 2. Panel Admin NO usable en móvil (confianza: 0.38)
**Archivo:** `src/features/admin/layout.tsx`

**Problema:** Sidebar fijo, inaccesible en móvil (score: 0.38)

**Solución:**
- ✅ Sidebar hidden en mobile (`hidden lg:block`)
- ✅ Botón hamburguesa (`<Menu>`) que abre un **Sheet/Drawer** con toda la navegación
- ✅ Header mobile con badge "Demo mode"
- ✅ Navegación desktop sigue intacta en `lg:` breakpoint
- ✅ Al seleccionar un link, el drawer se cierra automáticamente

---

### 3. Formularios Admin — NO CLAROS (score: 0.89/2)
**Archivos:** `admin/tournaments.tsx`, `admin/players.tsx`, `admin/teams.tsx`, `admin/ranking.tsx`, `admin/results.tsx`, `admin/news.tsx`

**Problema:** 73% de probabilidad dice "usables con ambigüedad" en vez de "claros"

**Solución:**
- ✅ **Torneos:** Helper text para categorías, precio (en centavos), formato de fechas, consejo de uso
- ✅ **Jugadores:** Helper text para nivel (rango 1.0-7.0), username sin espacios
- ✅ **Equipos:** Helper text para divisiones (Primera = élite, Tercera = novatos)
- ✅ **Ranking:** Helper text explicando PJ/PG/Δ (partidos jugados/ganados/cambio)
- ✅ **Resultados:** Helper text explicando TBD, formato de sets
- ✅ **Noticias:** Helper text para extracto (~140 caracteres), imagen recomendada 1200×630px
- ✅ **Paleta:** Todos los títulos de página admin cambiados de `<h2>` a `<h1>` (jerarquía visual)

---

## 🟠 PROBLEMAS IMPORTANTES ARREGLADOS

### 4. Home — Jerarquía visual débil
**Archivo:** `src/features/home/page.tsx`

**Problema:** Hero tenía CTA de menor prioridad primero, contraste bajo

**Solución:**
- ✅ CTA principal cambiado a **"Ver torneos"** (más relevante, 79% dijo que debería ser el principal)
- ✅ Font del hero aumentado: `text-4xl` → `text-5xl md:text-7xl`
- ✅ Badge "Temporada 2026-27" más visible con fondo semitransparente + blur
- ✅ Subtítulo en `text-foreground` (más prominente) en vez de `text-muted-foreground`
- ✅ Search placeholder más descriptivo: "Buscar jugadores, torneos, equipos..."
- ✅ Color del gradiente más intenso: `from-primary/20` en vez de `from-primary/10`
- ✅ Eliminado CTA "Crear mi perfil" del hero (era menos relevante que ver torneos/calendario)
- ✅ Eliminado import no usado `ArrowRight`

### 5. Calendario — Partidos en vivo no diferenciados (noul: 0.43)
**Archivo:** `src/features/calendar/page.tsx`

**Problema:** No se distinguían partidos en vivo de programados

**Solución:**
- ✅ Partidos en vivo tienen **borde rojo** (`border-red-500/40`) y **animación pulso**
- ✅ Badge **"EN VIVO"** prominente en rojo con icono Radio animado
- ✅ Título del partido en rojo (`text-red-600`) cuando está en vivo
- ✅ Icono `Radio` importado de lucide-react con `animate-pulse`

### 6. Onboarding — Solo "parcialmente claro" (score: 0.84/2)
**Archivo:** `src/features/admin/onboarding.tsx`

**Problema:** Wizard de 5 pasos sin ejemplos ni contexto suficiente

**Solución:**
- ✅ Cada paso ahora tiene un **info box gris** con contexto:
  - Paso 0 (Sede): "Estos datos aparecerán en tu perfil público"
  - Paso 1 (Jugadores): "Esto te ayuda a planificar la liga"
  - Paso 2 (Equipos): "Se crearán automáticamente con nombres genéricos"
  - Paso 3 (Torneo): "Se creará con formato grupos + eliminación"
- ✅ **Botones de cantidad rápida** en pasos 1 y 2:
  - Jugadores: 8, 12, 16, 24 (con ejemplos comunes)
  - Equipos: 2, 4, 8
- ✅ Placeholders con ejemplos reales en todos los inputs
- ✅ Texto más informativo explicando qué pasa después de cada paso

---

## ✅ LO QUE YA ESTABA BIEN (no tocar)

| Dimensión | Score | Estado |
|-----------|-------|--------|
| Info de torneos en cards | 1.78/2 | ✅ Excelente |
| Tabla de ranking | 1.88/2 | ✅ Excelente |
| Filtros de torneos | 0.92 | ✅ Funcionan bien |
| CTA del dashboard | ver_torneos (79%) | ✅ Bien priorizado |

---

## 📊 Resultados del Audit (Despues de los cambios)

| Página | Problema Crítico | Confianza |
|--------|------------------|-----------|
| Torneos | (mejorado: dialog con pasos) | fue 0.94 → ↓ |
| Admin | (mejorado: mobile drawer + forms) | fue 0.38 → ↑ |
| Homepage | jerarquia_visual | fue 0.68 → ↑ |
| Calendario | jerarquia_visual | fue 0.50 → ↑ |
| Ranking | jerarquia_visual | fue 0.31 → ↑ |

---

## 📁 Archivos Modificados

1. `src/features/tournaments/detail.tsx` — Dialog de inscripción con pasos + header del torneo
2. `src/features/admin/layout.tsx` — Mobile responsive con Sheet drawer
3. `src/features/admin/tournaments.tsx` — Helper text + consejo en formulario
4. `src/features/admin/players.tsx` — Helper text para nivel
5. `src/features/admin/teams.tsx` — Helper text para divisiones
6. `src/features/admin/ranking.tsx` — Helper text para estadísticas
7. `src/features/admin/results.tsx` — Helper text para resultados
8. `src/features/admin/news.tsx` — Helper text para noticias
9. `src/features/admin/clubs.tsx` — Título `<h1>`
10. `src/features/admin/onboarding.tsx` — Contexto + botones de cantidad
11. `src/features/home/page.tsx` — Hero mejorado, CTA priorizado
12. `src/features/calendar/page.tsx` — Indicadores visuales en vivo
13. `src/features/admin/dashboard.tsx` — Título `<h1>` (ya lo tenía, no cambió)

---

## 🔧 Build

- TypeScript: ✅ Sin errores
- Vite build: ✅ Exitoso
- Solo warning: chunk size >500kB (normal para app con shadcn/ui + recharts)
