# Componentes Kokonut UI en Liga16

Nueve componentes de [Kokonut UI](https://github.com/kokonut-labs/kokonutui) (licencia MIT) instalados con `npx shadcn@latest add https://kokonutui.com/r/<nombre>.json` y adaptados a este repo (Vite + React, tema claro/oscuro con next-themes). Viven en `liga16/src/components/kokonutui/`.

- Seis estan integrados localmente (aun no publicados) con datos reales: **card-flip** en las cards de `/admin/equipos`, **metric-card** y **card-stack** en el Panel (`/admin`), **smooth-tab** en el detalle de torneo, **slot-picker** en el dialogo de editar partido y **switch-button** como boton de tema (admin y sitio publico).
- Tres quedan instalados sin seccion funcional: **team-selector** (la liga maneja parejas fijas de 2, sin lugares ni precio por asiento), **stay-picker** (precios por noche son de hospedaje, sin flujo equivalente) y **focal-point-picker** (para persistir el punto focal hace falta una columna nueva en la base; propuesta aparte).
- Cada ejemplo es un componente completo y copiable: imports, datos y manejo de estado incluidos.

---

## 1. card-flip (integrado localmente en /admin/equipos, aun no publicado)

Tarjeta con dos caras que gira al clic. En Equipos el frente muestra portada, categoria, nombre y partidos; el reverso muestra iniciales, datos y los botones Editar/Eliminar. La altura se compacto a 14rem para que la cuadricula respire mejor.

```tsx
import CardFlip from "@/components/kokonutui/card-flip";

export function EjemploCardFlip() {
  return (
    <CardFlip
      label="Pareja LK"
      front={
        <div className="flex h-full flex-col justify-end p-4">
          <p className="text-lg font-bold text-white">Lina &amp; Karla</p>
          <p className="text-sm text-white/70">Quinta femenil · 5 partidos</p>
        </div>
      }
      back={
        <div className="flex h-full flex-col justify-between p-4">
          <p className="font-semibold">Acciones</p>
          <div className="flex gap-2">
            <button className="flex-1 rounded-md bg-primary px-3 py-2 text-sm">Editar</button>
            <button className="flex-1 rounded-md border px-3 py-2 text-sm">Eliminar</button>
          </div>
        </div>
      }
    />
  );
}
```

Props: `front`/`back` (ReactNode de cada cara), `label` (accesibilidad), `flipped` + `onFlippedChange` (controlado) o `defaultFlipped`, `axis` ("x" u "y", por defecto gira en Y), `className` (tamano del contenedor) y `faceClassName`.

## 2. card-stack (integrado localmente en Panel > Torneos en curso, aun no publicado)

Mazo de tarjetas apiladas que se recorren con clic. Datos de ejemplo:

> En la app reemplaza la lista de «Torneos en curso» del Panel: cada tarjeta es un torneo real (nombre, sede, fechas), «Abrir torneo» navega a su detalle y bajo el mazo quedan los accesos directos «Ver bracket» y «Jornada» de la tarjeta al frente. Con un solo torneo en curso el mazo no rota.

```tsx
import CardStack, { type DeckCard } from "@/components/kokonutui/card-stack";

const torneos: DeckCard[] = [
  {
    id: "liga16-4ta",
    title: "Liga16 4ta Edicion",
    subtitle: "Caborca · 2026",
    description: "Torneo principal de la temporada.",
    art: <div className="h-full w-full rounded-xl bg-orange-500/80" />,
    specs: [
      { label: "Parejas", value: "24" },
      { label: "Categorias", value: "4" },
    ],
    price: "29 sep - 28 nov",
  },
];

export function EjemploCardStack() {
  return (
    <CardStack
      cards={torneos}
      actionLabel="Ver torneo"
      onChange={(card) => console.log("tarjeta activa:", card.id)}
      onAction={(card) => console.log("accion en:", card.id)}
    />
  );
}
```

Props: `cards` (DeckCard[]), `onChange` (tarjeta al frente), `onAction` (boton de accion de la tarjeta). Cada DeckCard lleva `id`, `title`, `subtitle`, `description`, `art` (ReactNode visual), `specs` (pares label/value) y `price` opcional. En el componente, `accent` (color de acento) y `actionLabel` (etiqueta del boton de accion) son props propias.

## 3. metric-card (integrado localmente en Panel > Actividad semanal, aun no publicado)

Tarjeta de metrica con grafica por periodos y segmentos.

> En la app reemplaza la grafica de «Actividad semanal» del Panel: serie real de 60 dias (la comparacion de 30D necesita los 30 previos) con dos segmentos que no se solapan, Por jugar y Jugados, y periodos de 7, 14 y 30 dias. Si no hay periodo previo con datos, la tarjeta dice «sin periodo previo para comparar» en vez de mostrar un porcentaje enganoso.

```tsx
import MetricCard, { type MetricPoint } from "@/components/kokonutui/metric-card";

const partidosPorDia: MetricPoint[] = [
  { date: "2026-10-15", parts: [2, 1] },
  { date: "2026-10-16", parts: [3, 2] },
  { date: "2026-10-17", parts: [1, 2] },
  { date: "2026-10-18", parts: [4, 1] },
  { date: "2026-10-19", parts: [3, 1] },
  { date: "2026-10-20", parts: [4, 2] },
  { date: "2026-10-21", parts: [2, 3] },
  { date: "2026-10-22", parts: [5, 2] },
];

export function EjemploMetricCard() {
  return (
    <MetricCard
      label="Partidos jugados"
      data={partidosPorDia}
      segments={["Femenil", "Varonil"]}
      periods={[7, 14, 30]}
      defaultPeriod={7}
      format="number"
    />
  );
}
```

Props: `label`, `data` (puntos con `date` YYYY-MM-DD y `parts`, un valor por segmento), `segments` (nombres de series), `periods` (dias seleccionables), `defaultPeriod`, `format` ("number" o "currency", con `currency` tipo "MXN"), y `events` (marcadores `{ date, label }`). Cuidado: el periodo seleccionado (7, 14, 30 dias) necesita al menos esa cantidad de puntos en `data` para llenar la grafica; por eso el ejemplo trae 8 dias.

## 4. smooth-tab (integrado localmente en el detalle de torneo, aun no publicado)

Pestañas con transicion animada entre paneles.

> En la app reemplaza las pestañas del detalle de torneo (Jornada, Parejas, Grupos y sorteo, Posiciones, Calendario, Bracket). Solo se monta el panel activo, como antes.

```tsx
import { useState } from "react";
import { Trophy, Users } from "lucide-react";
import SmoothTab, { type SwipeTabItem } from "@/components/kokonutui/smooth-tab";

const pestanas: SwipeTabItem[] = [
  {
    id: "posiciones",
    title: "Posiciones",
    icon: Trophy,
    content: <p className="p-4 text-sm">Tabla de posiciones aqui.</p>,
  },
  {
    id: "parejas",
    title: "Parejas",
    icon: Users,
    content: <p className="p-4 text-sm">Listado de parejas aqui.</p>,
  },
];

export function EjemploSmoothTab() {
  const [tab, setTab] = useState("posiciones");
  return (
    <SmoothTab
      items={pestanas}
      value={tab}
      onChange={setTab}
    />
  );
}
```

Props: `items` (cada uno con `id`, `title`, opcional `icon` (Lucide) y `content`), `value` + `onChange` (controlado) o `defaultTabId`, y opcionales `activeColor` / `activeTextColor`.

## 5. team-selector (instalado, sin seccion funcional)

Selector de tamaño de equipo con stepper, integrantes y precio por lugar. No se aplico a una seccion: la liga maneja parejas fijas de 2 jugadores y no hay lugares ni precio por asiento que seleccionar; meterlo seria decorativo.

```tsx
import { useState } from "react";
import TeamSelector, { type TeamMember } from "@/components/kokonutui/team-selector";

const integrantes: TeamMember[] = [
  { id: "1", name: "Lina Reyes" },
  { id: "2", name: "Karla Pesqueira" },
  { id: "3", name: "Sofia Pesqueira" },
];

export function EjemploTeamSelector() {
  const [lugares, setLugares] = useState(2);
  return (
    <TeamSelector
      members={integrantes}
      value={lugares}
      onChange={setLugares}
      min={2}
      max={4}
      pricePerSeat={500}
      currency="MXN"
    />
  );
}
```

Props: `members` (con `avatarUrl` opcional; sin foto usa iniciales), `value` + `onChange` (controlado) o `defaultValue`, `min`/`max`, `pricePerSeat` + `currency`.

## 6. slot-picker (integrado localmente en Resultados > Editar partido, aun no publicado)

Selector visual de horario: muestra dias, huecos libres entre citas ocupadas y duraciones. El callback `onBook` solo reporta la eleccion; aqui no crea ninguna reserva.

> En la app vive en el dialogo «Editar partido» de Resultados, dentro del desplegable «Explorar horarios en calendario»: muestra los proximos 7 dias en bloques de 60 o 90 min (hay partidos de hora y media) marcando solo los cruces con partidos ya registrados en la misma cancha; cada partido ocupa su `duration_minutes` (migración `supabase/match-duration.sql`, pendiente de aplicar) y los que no la tienen registrada se suponen del `minutesPerMatch` del torneo. El diálogo tambien tiene campo Duración (1 hora / 1 hora y media) y confirmar un hueco lo rellena. Los partidos nuevos (wizard y calendario del torneo) nacen con `duration_minutes` = `minutesPerMatch` del torneo, y la cuadrícula del wizard usa ese valor en vez de 60 fijo, y al confirmar un hueco llena el campo Fecha y hora (nada se guarda hasta Guardar). Es una ventana de exploracion 9:00-21:00, no disponibilidad confirmada de la sede.

```tsx
import { useState } from "react";
import SlotPicker, { type SlotDay } from "@/components/kokonutui/slot-picker";

const dias: SlotDay[] = [
  {
    date: "2026-10-28",
    open: [9 * 60, 18 * 60],
    busy: [
      [10 * 60, 11 * 60],
      [13 * 60, 14 * 60],
    ],
  },
  { date: "2026-10-29", open: [9 * 60, 18 * 60], busy: [] },
];

export function EjemploSlotPicker() {
  const [elegido, setElegido] = useState("");
  return (
    <div className="space-y-3">
      <SlotPicker
        days={dias}
        durations={[30, 60]}
        host={{ name: "Canchas Liga16", city: "Caborca" }}
        timezone="America/Hermosillo"
        onBook={({ date, start, minutes }) =>
          setElegido(`${date} a las ${Math.floor(start / 60)}:${String(start % 60).padStart(2, "0")} por ${minutes} min`)
        }
      />
      {elegido && <p className="text-sm text-muted-foreground">Elegiste: {elegido}</p>}
    </div>
  );
}
```

Props: `days` (cada dia con `open: [desde, hasta]` en minutos desde medianoche y `busy` con los tramos ocupados), `durations` (minutos), `host` (nombre/titulo/ciudad del anfitrion), `timezone` (IANA, opcional) y `onBook` (recibe `{ date, start, minutes }`).

## 7. focal-point-picker (instalado, sin seccion funcional)

Permite elegir el punto focal de una imagen y previsualizar recortes. No se aplico aun: para que el punto elegido sobreviva al guardado hace falta una columna nueva (focal) en la tabla de equipos/torneos, es decir una migracion de base de datos. Queda como propuesta aparte.

```tsx
import { useState } from "react";
import FocalPointPicker, { type FocalPoint } from "@/components/kokonutui/focal-point-picker";

export function EjemploFocalPointPicker() {
  const [punto, setPunto] = useState<FocalPoint>({ x: 0.5, y: 0.5 });
  return (
    <div className="space-y-3">
      {/* Imagen real del repo (public/images/hero-padel.jpg); sustituyela por el archivo que uses. */}
      <FocalPointPicker
        src="/images/hero-padel.jpg"
        alt="Portada del equipo"
        defaultValue={{ x: 0.5, y: 0.5 }}
        onValueChange={setPunto}
        crops={[
          { label: "Card", ratio: 4 / 3 },
          { label: "Banner", ratio: 16 / 9 },
        ]}
      />
      <p className="text-sm text-muted-foreground">
        Punto focal: {Math.round(punto.x * 100)}%, {Math.round(punto.y * 100)}%
      </p>
    </div>
  );
}
```

Props: `src` + `alt`, `defaultValue` (punto inicial `{ x, y }` de 0 a 1; el componente maneja su estado interno) + `onValueChange` (callback con cada cambio), `crops` (vistas previas por proporcion), `imageRatio` (ancho/alto de la imagen original). Nota de adaptacion: el original usaba `next/image`; en este repo (Vite) usa `<img>` normal.

## 8. switch-button (integrado localmente como boton de tema, aun no publicado)

Boton sol/luna para alternar claro/oscuro. Integrado con el `next-themes` del proyecto.

> En la app es el boton de tema del panel admin y del sitio publico (antes un toggle propio con iconos Sun/Moon).

```tsx
import { useTheme } from "next-themes";
import SwitchButton from "@/components/kokonutui/switch-button";

export function EjemploSwitchButton() {
  const { resolvedTheme, setTheme } = useTheme();
  // resolvedTheme resuelve el valor "system" al tema real; theme puede ser "system".
  const actual = resolvedTheme === "dark" ? "dark" : "light";
  return (
    <SwitchButton
      theme={actual}
      onThemeChange={setTheme}
      showLabel
      size="default"
    />
  );
}
```

Props: `theme` ("light" | "dark") + `onThemeChange` para controlarlo, `size` ("sm" | "default" | "lg"), `showLabel` y `reveal` (animacion de barrido circular al cambiar).

## 9. stay-picker (instalado, sin seccion funcional)

Calendario de estancia con precios por noche, noches bloqueadas y minimo de noches. No se aplico a una seccion: su dominio es hospedaje (noches, tarifas) y liga16 no tiene un flujo equivalente; usarlo para fechas de torneo mostraria precios por noche que no existen.

```tsx
import StayPicker, { type Night } from "@/components/kokonutui/stay-picker";

const precios: Record<string, Night> = {
  "2026-11-06": { price: 1200 },
  "2026-11-07": { price: 1200 },
  "2026-11-08": { price: 950, blocked: true },
  "2026-11-09": { price: 950 },
};

export function EjemploStayPicker() {
  return (
    <StayPicker
      month="2026-11"
      currency="MXN"
      minNights={2}
      getNight={(date) => precios[date]}
      onReserve={({ checkIn, checkOut, total }) =>
        console.log(`Estancia ${checkIn} a ${checkOut}: $${total}`)
      }
    />
  );
}
```

Props: `month` ("YYYY-MM"), `getNight` (devuelve `{ price, blocked? }` por fecha YYYY-MM-DD), `currency`, `minNights` y `onReserve` (recibe `{ checkIn, checkOut, total }`; aqui solo se muestra en consola).

---

## Notas de instalacion en este repo

- Dependencia agregada: `motion` (animaciones de card-flip, card-stack y smooth-tab).
- Adaptaciones locales marcadas en el codigo: textos pequeños subidos a `text-xs` (el repo exige 12px minimo), comentarios `eslint-disable` de react-hooks en patrones propios de la libreria, y `next/image` reemplazado por `<img>` en focal-point-picker.
- Todos respetan el tema claro/oscuro via las variables CSS y clases `dark:` existentes.
