# ADR-0010 — El filtro del admin es una barra de facetas, no un desplegable

**Estado:** Aceptado
**Fecha:** 2026-10-20
**Decisión:** Toda lista del admin filtra con la misma pieza: `FilterBar` (buscador primero) y, debajo, una fila por eje de filtro con las opciones como botones visibles y su cuenta. Los desplegables (`<Select>`) dejan de usarse como filtro de lista en el admin.

## Por qué

Resultados —la pantalla donde el organizador pasa la tarde— tenía buscador y dos
desplegables: "Todos los torneos" y "Todos los estados". Para saber qué torneo
o qué estado había, había que abrirlos. Y las dos cosas por las que un
organizador discrimina de verdad —**la categoría** y **la jornada**— no existían
como filtro: se leían en la tarjeta de cada partido, una por una.

Un filtro que no se ve es un filtro que no se usa. Con 60 partidos en pantalla
y 54 sin capturar, el organizador no revisaba los 60: revisaba los 6 que le
importaban. Para eso sirve un filtro.

El problema no era solo de Resultados: era de todas las secciones. Ranking
—la única con la barra de botones— era la excepción, no la regla. Laéquence
dejado inconsistente: ocho pantallas de admin, cuatro patrones de filtro
distintos, y el único que funcionaba como filtro de verdad era el que nadie
había copiado.

## La regla

**Una lista = un buscador + una fila por eje de filtro.** Los ejes son las
preguntas que el organizador se hace sobre esa lista: "¿de qué estado?",
"¿de qué categoría?", "¿de qué torneo?".

1. **Las opciones se leen enteras, sin abrirlas.** Botones con su cuenta, en
   una fila que se desliza en horizontal en pantallas estrechas. El desplegable
   escondía las opciones detrás de dos clics y no había forma de saber si el
   valor que se buscaba existía.
2. **Las opciones salen de los datos, no de un catálogo escrito a mano.** Un
   estado sin elementos no se ofrece; una categoría que el circuito inventó
   ("Suma 9", "Mixtos") sí aparece. `categoryFacet`, `categoryFacetOfValues` y
   los conteos por eje hacen ese trabajo.
3. **La etiqueta de cada eje ocupa una columna de ancho fijo.** Todas las
   filas comparten el mismo borde de alineación: el ojo baja por la etiqueta y
   no tiene que cazarla fila por fila.
4. **La cuenta vive en la opción**, no en un desplegable: "Por capturar 54" dice
   cuántos partidos se van a ver antes de pinchar.
5. **El buscador va primero** y escribe `?q=` en la URL (el estándar que ya
   usaban Torneos, Equipos, Participantes, Jugadores y Ranking).
6. **"Limpiar" aparece con cualquier filtro activo**, de faceta o de texto.
   Un filtro sin salida visible es un filtro del que no se puede salir.
7. **Sin opciones mortas**: un eje con una sola opción posible no se pinta.
8. **La acción primaria va en la cabecera de la página**, no en la barra de
   filtro. La barra filtra; la cabecera manda.

## Dónde vive

| Pieza | Archivo | Qué hace |
|---|---|---|
| `FilterBar` | `src/components/ui/filter-bar.tsx` | Fila del buscador, la cuenta y "Limpiar" |
| `FilterNav` | `src/components/ui/filter-nav.tsx` | La fila de opciones; `orientation="row"` para el admin |
| `AdminFacets` / `AdminFacet` | `src/components/admin/filter-facets.tsx` | El envoltorio y la fila, con el patrón del admin ya fijado |
| `countActive` | `src/lib/filters.ts` | Cuántos filtros de faceta hay activos (para "Limpiar") |

## Secciones cubiertas

| Sección | Ejes |
|---|---|
| Resultados | Estado, Categoría, Jornada, Torneo |
| Ranking | Categoría, Rama |
| Torneos | Estado |
| Equipos | Categoría |
| Participantes | Torneo, Categoría |
| Jugadores | Verificación, Torneo |
| Bandeja de entrada | Severidad |
| Noticias | Tag |
| Sede | Superficie (canchas) |
| Detalle de torneo · Parejas | Categoría |
| Detalle de torneo · Calendario | Categoría, Día, Cancha, Jornada |

## Consecuencias

- Once pantallas de admin con el mismo gesto: buscar arriba, filtrar abajo.
- La cuenta de cada opción dice de antemano cuántos elementos hay detrás.
- Ningún filtro deja la página en un estado del que no se pueda salir.
- `FilterBar` acepta `activeCount` porque las facetas viven fuera de él: sin
  ese número, "Limpiar" no aparecía con un filtro de categoría activo.

## Verificación

Medido en el navegador (Chromium, `scripts/` de captura) a 1440 / 390 / 320 px
sobre las once secciones: **cero desbordamiento horizontal** y cero errores de
página. El desbordamiento sí apareció al principio —las píldoras inflaban la
columna del `grid` del `CardHeader` y la página se iba de ancho en el móvil— y
se corrigió con `min-w-0` en la cadena `FilterBar → AdminFacets → FilterNav`.

En Resultados el recorrido del filtro se comprobó de punta a punta: 60
partidos → "Cuarta femenil" 15 → "Por capturar" 12 → "Limpiar" 60.

## Relacionado

- `docs/decisions/0009-navbar-variants-catalog.md` (enmienda 2026-10-13: el
  toolbar del admin vive en la página)
- `src/components/ui/filter-nav.tsx`
- `src/components/admin/filter-facets.tsx`
- `src/lib/categories.ts` (`categoryFacet`, `categoryFacetOfValues`)
