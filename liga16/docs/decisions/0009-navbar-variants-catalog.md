# ADR-0009 — Catálogo de variantes de Navbar (shadcn navbar-01)

**Estado:** Aceptado
**Fecha:** 2026-09-30
**Decisión:** Se mantiene un playground de variantes de Navbar en `src/features/nav-test/page.tsx` como único lugar verificable de los layouts, y se documenta el mapa de adopción por sección. Las variantes reutilizan `ThemeToggle`, `NavigationMenu`, `DropdownMenu` y `divisionOptions` (`src/lib/format.ts`).

## Contexto

El sitio necesita varios layouts de encabezado (tema dark/light, iconos, búsqueda, jugador con alerta, filtro por grupos) que sean responsive y reutilizables tanto en **público** (`SiteHeader` + `MobileBottomNav`) como en **admin** (sidebar de escritorio + Sheet móvil). No se quería duplicar patrones.

## Decisiones

1. **Catálogo verificable:** todas las variantes viven en `src/features/nav-test/page.tsx`, expuestas en `/test-navbar` con un selector numérico. Vite hot-reload permite validar dark/light, sticky + blur, dropdown móvil y pills sin tocar productivo.
2. **Breakpoints:** Tailwind defaults (`sm 640 / md 768 / lg 1024 / xl 1280`), `darkMode: class` vía `next-themes` (`src/main.tsx`). No se agregan breakpoints.
3. **Reusar, no reinventar:**
   - `ThemeToggle` (`@/components/theme-toggle`) para night/day.
   - `divisionOptions`/`sexOptions` (`src/lib/format.ts`) para las pills de grupos.
   - `RankingsFilters` (`RankingFilters`) pattern (`src/components/ranking/ranking-filters.tsx`) como precedente de pills de división/sexo.
   - `Sheet` (admin `layout.tsx:177-194`) y `Badge` (admin `layout.tsx:197-209`) como patrones móviles/alertas.
4. **Componentes shadcn nuevos:** `navigation-menu.tsx` (`@radix-ui/react-navigation-menu`); `navbar.tsx` y `logo.tsx` bajo `src/components/shadcn-space/blocks/navbar-01/` y `src/assets/logo/`. Se preservó el stock más nuevo de `button.tsx` y `dropdown-menu.tsx`.
5. **Responsive mobile:** variantes con links de navegación usan `DropdownMenu` hamburguesa (`Menu`) en mobile; pills de grupos se colapsan a `flex-wrap` o al dropdown "Más filtros"; el icono de alerta (`Bell`) permanece visible con badge.

## Mapa de adopción por sección (best-fit)

| Sección | Layout actual | Variantes recomendadas |
|---|---|---|
| `/` Home | SiteHeader | V1 (base) / V2 (iconos) |
| `/torneos` | SiteHeader | V3 (buscar) |
| `/equipos` | SiteHeader + pills inline | V5 (pills grupos) |
| `/jugadores` | SiteHeader + búsqueda | V4 (buscar jugador) |
| `/ranking` | SiteHeader + `RankingFilters` | V5 (pills) |
| `/calendario` | SiteHeader | V2 (icono calendario) |
| `/noticias` | SiteHeader | V1 |
| `/admin/*` | sidebar lg + Sheet mobile header | V5 en mobile header; V3/V4 en header admin según entidad |
| Admin → torneos/players/results/teams | FilterBar | V3/V4 en header |
| Admin → ranking | selects división/sexo | V5 (pills, reemplaza selects) |

## Consecuencias

- Un solo lugar para validar estética y responsive antes de promover a productivo.
- Para productivo: exportar la variante seleccionada como componente real (`src/components/shadcn-space/blocks/navbar-01/<variante>.tsx`) y reemplazar `SiteHeader`/header admin de forma incremental (fuera del alcance de este ADR).

## Relacionado

- `src/features/nav-test/page.tsx`
- `src/lib/format.ts` (`divisionOptions`, `sexOptions`)
- `src/components/ranking/ranking-filters.tsx` (precedente pills)
- `src/features/admin/layout.tsx` (precedente Sheet + Badge mobile)
- `docs/decisions/0009-navbar-variants-catalog.md`
