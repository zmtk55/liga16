# ADR-0009 — Catálogo de variantes de Navbar (shadcn navbar-01)

**Estado:** Aceptado
**Fecha:** 2026-09-30
**Decisión:** Se mantiene un playground de variantes de Navbar en `src/features/nav-test/page.tsx` como único lugar verificable de los layouts, y se documenta el mapa de adopción por sección. Las variantes reutilizan `ThemeToggle`, `NavigationMenu`, `DropdownMenu` y `divisionOptions` (`src/lib/format.ts`).

## Corrección 2026-09-30 — de "best-fit" a regla por tipo

La primera versión de este documento tenía una tabla "best-fit" que asignaba una variante distinta
a cada sección —y en Home hasta decía "V1 **o** V2", sin decidir—. Resultado: ocho secciones, siete
layouts distintos. El sitio se veía armónicamente revuelto y nadie sabía por dónde empezar una sección
nueva.

La regla que sustituye a esa tabla: **una variante por tipo de sección, máximo tres tipos.**

| Tipo | Variante | Qué lleva |
|---|---|---|
| **A — Navegar** | `NavbarIcons` (V2) | Links + iconos de acción. Sin buscador, sin filtros. |
| **B — Buscar** | `NavbarSearch` (V3) | A + buscador de texto. |
| **C — Filtrar** | `NavbarGroupFilter` (V5) | A + pills de división/rama. |

El tipo lo decide **lo que la sección hace**, no lo que se le antoja a esa sección:

- **A** si no se busca ni se filtra nada (Home, Noticias, Calendario, detalle de torneo/equipo).
- **B** si su trabajo es encontrar algo por nombre (Torneos, Jugadores, Equipos).
- **C** si su trabajo es moverse dentro de un conjunto que ya está agrupado (Ranking).

Consecuencia concreta: **cada sección se elige por su función, no por excepción.** Una sección nueva
no abre una discusión de diseño: se le asigna A, B o C y ya. Si necesita un cuarto tipo, se escribe aquí
primero, con el motivo.

`NavbarPlayerSearch` (V4) queda en el catálogo pero **no se usa en producto**: su alerta de jugador es
una función de cuenta, no de navegación, y pertenece a la sesión —no al encabezado de una sección—.

## Contexto

El sitio necesita varios layouts de encabezado (tema dark/light, iconos, búsqueda, filtro por grupos) que sean responsive y reutilizables tanto en **público** (`SiteHeader` + `MobileBottomNav`) como en **admin** (sidebar de escritorio + Sheet móvil). No se quería duplicar patrones.

## Decisiones

1. **Catálogo verificable:** todas las variantes viven en `src/features/nav-test/page.tsx`, expuestas en `/test-navbar` con un selector numérico. Vite hot-reload permite validar dark/light, sticky + blur, dropdown móvil y pills sin tocar productivo. **El playground se conserva** para el próximo componente o variante que haga falta.
2. **Máximo tres variantes en producto.** El catálogo puede crecer; el sitio no. Una cuarta variante en producto requiere una entrada nueva en la tabla de arriba, con su motivo.
3. **Breakpoints:** Tailwind defaults (`sm 640 / md 768 / lg 1024 / xl 1280`), `darkMode: class` vía `next-themes` (`src/main.tsx`). No se agregan breakpoints.
4. **Reusar, no reinventar:**
   - `ThemeToggle` (`@/components/theme-toggle`) para night/day.
   - `divisionOptions`/`sexOptions` (`src/lib/format.ts`) para las pills de grupos.
   - `RankingsFilters` (`RankingFilters`) pattern (`src/components/ranking/ranking-filters.tsx`) como precedente de pills de división/sexo.
   - `Sheet` (admin `layout.tsx:177-194`) y `Badge` (admin `layout.tsx:197-209`) como patrones móviles/alertas.
5. **Componentes shadcn nuevos:** `navigation-menu.tsx` (`@radix-ui/react-navigation-menu`); `navbar.tsx`, `navbar-variants.tsx` y `group-filter-bar.tsx` bajo `src/components/shadcn-space/blocks/navbar-01/` y `src/assets/logo/`. Se preservó el stock más nuevo de `button.tsx` y `dropdown-menu.tsx`.
6. **Responsive mobile:** variantes con links de navegación usan `DropdownMenu` hamburguesa (`Menu`) en mobile; pills de grupos se colapsan a `flex-wrap` o al dropdown "Más filtros".

## Consecuencias

- Un solo lugar para validar estética y responsive antes de promover a productivo.
- Toda sección tiene un tipo declarado, así la consistencia es verificable y no una intención.
- `npm run check:ui` vigila que las dependencias del catálogo no queden colgando.

## Relacionado

- `src/features/nav-test/page.tsx`
- `src/components/shadcn-space/blocks/navbar-01/navbar-variants.tsx`
- `src/lib/format.ts` (`divisionOptions`, `sexOptions`)
- `src/components/ranking/ranking-filters.tsx` (precedente pills)
- `src/features/admin/layout.tsx` (precedente Sheet + Badge mobile)
