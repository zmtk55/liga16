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
  components/cards/  tarjetas reutilizables responsive (ResourceCard, TournamentCard)
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

  > **Nota de seguridad:** `SUPABASE_SERVICE_ROLE_KEY` nunca debe exponerse en variables de entorno del frontend. El uso de RLS en el esquema permite operar únicamente con la anon key.

## Funcionalidad

- **Dashboard** — métricas del circuito, torneo actual, partidos en vivo, noticias y sponsors.
- **Torneos** — listado con filtros (estado / formato) y detalle con categorías, cupo y **inscripción de pareja** (pago por transferencia o efectivo).
- **Calendario** — partidos en vivo, programados y resultados por fecha.
- **Ranking** — clasificación oficial con filtros por rama y ciudad vinculado al detalle de jugador.
- **Equipos / Jugadores / Clubes / Noticias** — directorios del circuito.
- **Administración** (`/admin`) — CRUD completo para torneos, jugadores, equipos, resultados, ranking, noticias y configuración del padel. Incluye **wizard de onboarding** para configuración inicial.

Las rutas de jugador (`/jugadores/:id`) usan `player_cards` y `ranking_events` para mostrar títulos, récord, tendencia de nivel y movimientos de ranking.

## Administración

El panel admin (`/admin`) permite gestionar todos los datos del circuito:

| Página | Rutas | CRUD |
|--------|-------|------|
| Overview | `/admin` | Estadísticas + acciones rápidas |
| Torneos | `/admin/torneos` | Crear, editar, eliminar |
| Jugadores | `/admin/jugadores` | Crear, editar, eliminar |
| Equipos | `/admin/equipos` | Crear, editar, eliminar |
| Resultados | `/admin/resultados` | Editar estado, sets, ganador |
| Ranking | `/admin/ranking` | Editar posiciones, agregar jugadores |
| Padel | `/admin/padel` | Editar configuración de sede |
| Noticias | `/admin/noticias` | Crear, editar, eliminar |
| Onboarding | `/admin/onboarding` | Wizard de 5 pasos para configuración inicial |

En **demo mode**, todas las operaciones son locales (toast de confirmación, sin persistencia). En **Supabase mode**, las operaciones se ejecutan contra la base de datos con RLS.

## Supabase

### 1. Crear proyecto

1. Crea un proyecto en [Supabase](https://supabase.com/)
2. Copia la URL y la anon key desde Settings → API

### 2. Configurar variables de entorno

Crea `.env.local` en `liga16/`:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

> **Seguridad:** `SUPABASE_SERVICE_ROLE_KEY` nunca debe estar en variables de entorno del frontend. El esquema usa RLS que permite operar con la anon key.

### 3. Aplicar esquema

Abre el SQL Editor en Supabase y ejecuta `supabase/schema.sql`. Esto crea:

- Todas las tablas (clubs, tournaments, players, teams, matches, news, etc.)
- Políticas RLS (lectura pública, escritura admin/organizer)
- Vistas (ranking_view)
- Triggers (updated_at automático, creación de player_cards, perfil desde auth)

### 4. Verificar RLS

El esquema incluye RLS habilitado en todas las tablas. Las políticas permiten:

- **Lectura pública** en la mayoría de tablas (torneos, equipos, jugadores, noticias, ranking)
- **Escritura** solo para roles `admin` y `organizer` (en `player_profiles`, `tournaments`, `teams`, `matches`, `news`, etc.)
- **Usuarios** pueden gestionar sus propios datos (registros, perfil)

### 5. Activar modo Supabase

Con `.env.local` configurado, la app detecta automáticamente `DATA_MODE = 'supabase'` y usa las operaciones CRUD reales. Sin las variables, corre en modo demo.