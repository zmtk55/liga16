# Liga16

Web del circuito de pádel Liga16 — torneos, ranking, equipos, clubes y noticias. React 19 + TypeScript + Vite + shadcn/ui + Tailwind CSS.

## Stack

- **React 19 + Vite 7** con `react-router` v7 (rutas lazy por página)
- **shadcn/ui** sobre Tailwind CSS v3
- **Supabase** (opcional) para persistencia real; por defecto corre con datos demo en memoria

## Empezar

```bash
npm install
npm run dev      # http://localhost:5173
```

## Scripts

| Script        | Descripción                                |
| ------------- | ------------------------------------------ |
| `npm run dev` | Servidor de desarrollo (HMR)               |
| `npm run build` | Typecheck + build de producción          |
| `npm run lint`  | ESLint                                     |
| `npm run preview` | Sirve el build local                    |

## Estructura

```
src/
  app/          layout y router
  components/   shadcn/ui + componentes de la app
  contexts/     AuthContext (Supabase auth)
  features/     páginas (home, torneos, calendario, ranking, equipos, jugadores, clubes, noticias)
  lib/data/     capa de datos: provider.ts (interfaz) + demo.ts + supabase.ts + seed.ts
  lib/          clientes (supabase.ts), formato (format.ts), utilidades
  types/        modelo de dominio
supabase/       esquema SQL (RLS básico incluido) para activar modo Supabase
```

## Modo de datos

La capa de datos está abstraída tras `DataProvider` (`src/lib/data/provider.ts`). Las páginas consumen `db` sin saber si hay demo o Supabase detrás.

- **Demo (default):** datos semilla en `src/lib/data/seed.ts`, todo en memoria.
- **Supabase:** define, en `.env` (o `.env.local`):

  ```
  VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
  VITE_SUPABASE_ANON_KEY=tu-anon-key
  ```

  Con ambas variables definidas, `DATA_MODE` es `supabase`. Aplica `supabase/schema.sql` en el proyecto antes.

## Funcionalidad

- **Dashboard** — métricas del circuito, torneo actual, partidos en vivo, noticias y sponsors.
- **Torneos** — listado con filtros (ciudad / estado / formato) y detalle con categorías, cupo y **inscripción de pareja** (pago por transferencia o efectivo).
- **Calendario** — partidos en vivo, programados y resultados por fecha.
- **Ranking** — clasificación oficial con filtros por rama y ciudad vinculada al detalle de jugador.
- **Equipos / Jugadores / Clubes / Noticias** — directorios del circuito.

Las rutas de jugador (`/jugadores/:id`) usan `player_cards` y `ranking_events` para mostrar títulos, récord, tendencia de nivel y movimientos de ranking.