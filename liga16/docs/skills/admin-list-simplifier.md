# Skill: admin-list-simplifier

Patrón de diseño reutilizable para vistas de administración con caos de cards planas (match cards, tournament cards, player cards, etc.).

## Cuándo usar

- La vista muestra muchas cards (>15) en un grid plano sin puntos de referencia.
- Las cards repiten texto (estado en pastilla + texto en footer + botón).
- Hay filtros apilados verticalmente que consumen mucho chrome vertical.
- La acción principal es ver/capturar un item individual (match, jugador, torneo).

## Diseño

1. **Agrupar por entidad única** (no por item).
2. **Card colapsable** por entidad con toggle (+/−) para expandir detalle.
3. **Facetas** en grid `sm:grid-cols-2` (no vertical `flex-col`).
4. **Botón único de acción** por item (sin texto redundante).

## Aplicación

```tsx
// Ejemplo: resultados por pareja (ya implementado en src/features/admin/results.tsx)
const pairViews = useMemo(() => {
  const map = new Map();
  for (const m of filtered) {
    for (const side of ["a", "b"] as const) {
      const pair = side === "a" ? m.side_a : m.side_b;
      const key = `${m.tournament_id}::${pair.pair_name}`;
      // ...
    }
  }
  return Array.from(map.values());
}, [filtered]);
```

### Roadmap

| Sección | Estado actual | Aplicación del patrón |
|---|---|---|
| `/admin/resultados` | ✅ Rediseñado con pair cards colapsables | Modelo base para reutilizar |
| `/admin/torneos` | Lista plana de torneos con datos duplicados | Agrupar por categoría → cards colapsables |
| `/admin/jugadores` | Cards individuales de jugadores | Agrupar por pareja → card colapsable con stats combinados |
| `/admin/partidos` | Grid de matches sin agrupación | Secciones colapsables por ronda/fecha |

### Componentes reutilizables

- `AdminFacets` con `grid gap-2 sm:grid-cols-2`
- Card colapsable: `button` con `aria-expanded`, `sticky` header opcional, toggle `+`/`-`
- Acción única: botón `h-7 shrink-0` con `rounded-full` para captura/edit

## Prohibido

- Cards planas sin agrupación estructural.
- Facetas verticales (`flex-col gap-2`) en desktop.
- Texto redundante de estado duplicado (pastilla + footer + botón).
- `backdrop-blur` en headers sticky (prohibido por `impeccable`).
