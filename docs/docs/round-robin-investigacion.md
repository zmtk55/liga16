# Investigación: round robins en Liga16

Rama: `investigacion/round-robin` · Fecha: 2026-11-18 · Base: `master` en `0bf3231` (post PR #36).

Pedido de Julian (WhatsApp, 18 nov 2026): *"quiero que hagas otro branch para no entorpecer pero investiga como hacer roundrobins"* y *"Si una de prueba a ver como se comporta"*.

Esta rama NO toca torneos, resultados, base de datos ni producción. Todo lo nuevo vive aislado aquí.

---

## 1. Lo que Liga16 YA hace (no hay que reinventarlo)

La fase de grupos actual **ya es un round robin**: todos contra todos dentro de cada grupo.

| Pieza | Archivo | Qué resuelve |
| --- | --- | --- |
| `roundRobinRounds()` | `src/lib/groups.ts` | Método del círculo: genera las jornadas (J1, J2…) donde cada pareja enfrenta a todas las demás una sola vez. Con número impar mete un bye (una pareja descansa por jornada). |
| `drawGroupsByCategory()` | `src/lib/groups.ts` | Reparte parejas en grupos por categoría, sin mezclar categorías, con preservación de sorteos previos. |
| `scheduleRounds()` / `scheduleWithAvailability()` | `src/lib/groups.ts` | Convierte jornadas en calendario con canchas, días, horas y duración (60/90 min). |
| `groupMatchDrafts()` / `reconcileMatches()` | `src/lib/tournament-flow.ts` | Crea los partidos "Grupo X · Jn" y reconcilia sin borrar partidos con actividad. |
| `computeStandings()` | `src/lib/groups.ts` | Tabla en vivo con el orden real de la liga (partidos ganados → dominio → puntos / % de puntos estilo Excel). |
| `checkFinishedMatch()` | `src/lib/match-result.ts` | La misma validación de marcadores que usa Resultados (2 sets + súper TB). |

Conclusión: el algoritmo de round robin **ya existe, está probado (487 pruebas pasan) y se usa en producción**. Lo que no existe es ofrecer el round robin como **formato de torneo completo**.

## 2. Qué significaría "hacer round robins" (modalidades)

Julian no especificó la modalidad; estas son las opciones, con lo que cada una implica. Ninguna regla está confirmada: son decisiones de diseño a validar con él.

### Opción A — Round robin puro (todos contra todos, campeón por tabla)
- Un solo grupo por categoría; al terminar las jornadas, el líder de la tabla es campeón. Sin eliminatoria.
- **Reutiliza casi todo**: sorteo, jornadas, calendario y tabla ya existen. Lo nuevo sería:
  1. Un campo de formato en el torneo ("Round robin" vs "Grupos + eliminatoria").
  2. Cerrar el torneo desde la tabla (hoy el flujo empuja hacia la llave: "Siembra" → eliminatoria).
  3. Vista pública del campeón por tabla.
- Es el cambio más barato: días de trabajo, no semanas.

### Opción B — Lo de hoy: grupos + eliminatoria
- Ya existe y se acaba de reforzar (PR #36: finalizar, cambiar parejas, final a 2 de 3).

### Opción C — Americano / Mexicano (rotación de parejas, puntos individuales)
- Jugadores individuales, parejas rotativas por ronda, ranking individual por puntos de juego.
- **NO está confirmado que Julian quiera esto.** Implica otro modelo de datos (jugador en vez de pareja como entidad del torneo, generador de rotaciones, tabla individual). Es un proyecto aparte, no una extensión.
- Si lo quiere, conviene torneo tipo "evento" separado del formato liga.

### Números que importan para decidir
- Con `n` parejas, todos contra todos son `n·(n-1)/2` partidos y `n-1` jornadas (o `n` si `n` es impar, por el bye).
- 8 parejas = 28 partidos en 7 jornadas. 12 parejas = 66 partidos en 11 jornadas. A 90 min por partido y 2 canchas, 12 parejas ≈ 33 turnos de cancha: hay que verificar que quepa en las fechas del torneo (la app ya calcula esto con `scheduleRounds`).

## 3. Referencias externas evaluadas (regla: investigar GitHub antes de construir)

| Proyecto | Licencia | Mantenimiento | Seguridad / dependencias | Veredicto |
| --- | --- | --- | --- | --- |
| [slashinfty/tournament-pairings](https://github.com/slashinfty/tournament-pairings) | GPL-3.0 | Activo (último push oct 2026), TS | 1 dependencia runtime (`edmonds-blossom-fixed`) | **Descartado por licencia**: GPL-3.0 obligaría a abrir todo Liga16 si se distribuye; además apunta a eliminatorias (single/double elim, suizo), no aporta nada sobre lo que ya hay. |
| [tournament-js/roundrobin](https://github.com/tournament-js/roundrobin) | MIT | Sin commits desde 2022 (estable, 80★), JS | 0 dependencias | Referencia válida del método del círculo; **no hace falta**: `roundRobinRounds()` ya hace lo mismo. |
| [iassia/round-robin-tournament](https://github.com/iassia/round-robin-tournament) | MIT | Último push feb 2025, TS, 3★ | 0 dependencias | Mismo algoritmo que el actual. Sin ventaja. |
| [mnito/round-robin](https://github.com/mnito/round-robin) | MIT | Activo (jun 2026), 62★ | **PHP**: no aplica al stack | Descartado por lenguaje. |
| [EnrickyHip/roundrobin-tournament-js](https://github.com/EnrickyHip/roundrobin-tournament-js) | MIT | Sin mantenimiento desde 2022, 3★ | Sin revisar a fondo por baja adopción | Descartado por madurez. |

**Conclusión de la investigación: no conviene adoptar ninguna librería.** El método del círculo propio ya cubre el algoritmo, está integrado con categorías/calendario/tabla, tiene pruebas y no agrega dependencias ni riesgo de licencia. Las referencias sirvieron para confirmar que la implementación actual es la estándar (mismo algoritmo, mismo manejo de bye).

## 4. Demo aislada (la "prueba para ver cómo se comporta")

- Ruta: **`/demo/round-robin`** (pública, sin login, solo en esta rama).
- Todo en memoria con 12 parejas ficticias; no llama a Supabase ni escribe nada.
- Permite: elegir número de parejas (4–12) y formato (todos contra todos / 2 grupos), generar jornadas con el sorteo real, capturar resultados con el formato Excel (Set 1, Set 2, súper TB) y la validación real, simular resultados aleatorios, y ver la tabla de posiciones recalcularse en vivo con el orden real de la liga.
- Decisiones de diseño marcadas como pendientes en la propia página (campeón por tabla vs eliminatoria; americano/mexicano no incluido).

## 5. Si Julian dice "dale" — plan de implementación real (Opción A)

1. Campo `format` en torneo (columna nueva vía SQL que él corre, como siempre) con default al formato actual.
2. Wizard: preguntar el formato "de forma fácil" al crear el torneo.
3. Detalle de torneo: en formato round robin, ocultar "Siembra"/llave y ofrecer "Finalizar" desde la tabla completa; campeón = líder.
4. Vista pública: tabla final con campeón marcado; palmarés y ranking individual ya se derivan de resultados, habría que mapear "campeón por tabla" a los puntos de campeón.
5. Pruebas: round robin puro con 4–12 parejas, impar con bye, empates en tabla con dominio.

Sin paso 1 (SQL) no se guarda nada nuevo; hasta entonces todo puede quedar solo en esta rama.
