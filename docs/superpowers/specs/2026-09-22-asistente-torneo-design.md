# Diseño: Asistente unificado de torneo + captura rápida de scores

Fecha: 2026-09-22
Estado: Aprobado por el usuario

## Problema

Existen dos flujos paralelos que se traslapan:

1. **"Nuevo torneo"** (Torneos): crea el torneo con puntuación, pero sus
   categorías van a un campo de texto libre (`category_names`) que no crea
   categorías reales en la BD.
2. **"Onboarding"**: crea sede + torneo + categorías + equipos, pero se
   plantea como configuración de una sola vez, no incluye canchas y no
   conecta con el detalle del torneo (sorteo, calendario).

Resultado: ningún solo camino lleva de "quiero un torneo" a "torneo
jugable" sin huecos.

## Decisión (enfoque A + edición total)

Un único asistente de 5 pasos reemplaza ambos flujos. Todo paso es
editable después: el asistente se reutiliza en modo edición con los datos
precargados, y cada paso persiste al avanzar.

## El asistente (5 pasos)

1. **Sede y canchas** — datos del club (precargados si ya existe; se
   actualiza, nunca duplica) + alta de canchas (nombre, superficie).
2. **Torneo** — nombre, fechas, precio, formato y sistema de puntuación
   (sets, juegos, tie-break, desempates), hoy escondido en el diálogo viejo.
3. **Categorías** — CategoryPicker de chips existente (división + rama + cupo).
4. **Equipos** — diseño reciente: agrupados por categoría, nombre automático
   por jugadores, selector de jugadores ya registrados (Command + Popover).
5. **Sorteo y calendario** — sorteo aleatorio por grupos (groups.ts), ajuste
   drag-and-drop, canchas disponibles y generación del calendario. Al
   completar se aterriza en el detalle del torneo.

## Edición después de crear

- "Editar" en la lista de torneos abre el mismo asistente empezando en el
  paso 2, con datos, puntuación, categorías y equipos precargados de la BD.
- Cada paso persiste al avanzar (no hay que llegar al final).
- Sede/canchas también editables desde la sección "Sede" del admin.
- Categorías/equipos también editables desde el detalle del torneo (ya existe).
- Re-sortear/re-programar desde el paso 5 o el detalle; si hay partidos con
  marcador capturado, se advierte antes de sobreescribir.

## Captura de scores (pestaña "Jornada")

Nueva pestaña en el detalle del torneo:

- Lista solo los partidos del día en curso (selector para otro día),
  ordenados por cancha y hora — la agenda viva.
- Marcador inline por partido; tap abre el diálogo optimizado: sets con
  inputs numéricos, Enter guarda y abre el siguiente partido de la jornada.
- Estados visuales: pendiente / en juego / terminado, ganador calculado al
  instante.
- Los resultados alimentan las tablas de posiciones en vivo (ya existe).

## Navegación

- "Nuevo torneo" (lista de torneos) abre el asistente en modo creación.
- El ítem "Onboarding" desaparece del menú admin.
- Dashboard enlaza "Crear torneo" al asistente.

## Arquitectura

- `src/features/admin/tournament-wizard.tsx` — el asistente (componente
  nuevo, un paso por subcomponente interno).
- Reutiliza: `CategoryPicker`, `PlayerSlot` (se extrae de onboarding a
  `src/components/players/player-slot.tsx`), lógica de `lib/groups.ts`,
  `db.listCourts/createCourt/deleteCourt`, `db.createMatches`,
  `db.drawGroups` vía `lib/groups.ts`.
- Persistencia por paso: step 1 → `db.updateClub` + `db.createCourt`;
  step 2 → `db.createTournament`/`db.updateTournament` (guarda `scoring`);
  step 3 → `db.createTournamentCategory` (mapeo al schema real ya corregido);
  step 4 → `db.createTeam`; step 5 → sorteo local + `db.createMatches`.
- Rutas: `/admin/torneos/nuevo` (creación), `/admin/torneos/:slug/editar`
  (edición, step inicial 2). Onboarding `/admin/onboarding` redirige a
  `/admin/torneos/nuevo`.

## Errores y casos borde

- Sin categorías no se puede avanzar al paso 4 (mensaje orienta a crearlas).
- Menos de 2 equipos en una categoría: se advierte pero se permite avanzar
  (se puede completar después desde el detalle).
- Regenerar calendario con partidos capturados: confirmación explícita.
- Sede inexistente en creación: el paso 1 la crea vía `db.updateClub` del
  primer club o alta nueva (createClub en Supabase si no existe).
- Jugador duplicado en la misma categoría: warning no bloqueante.

## Testing

- Flujo E2E verificado contra Supabase real (ya existe el script de
  verificación usado en esta sesión).
- Manual: crear torneo completo, editar cada paso, capturar jornada.
