// Página de prueba de variantes de Navbar (shadcn navbar-01).
// Renderiza las variantes exportables y permite toggle dark/light + selector
// sobre un slot sticky+blur para verificar sticky, backdrop, dropdown móvil,
// enlaces activos e iconos/botones de cada layout.
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { PlayerCardDemo } from "./player-card";
import { PlayerCardV2Demo } from "./player-card-v2";
import { PlayerCardV3Demo } from "./player-card-v3";
import { PlayerCardV4Demo } from "./player-card-v4";
import { PlayerCardV5Demo } from "./player-card-v5";
import { PlayerCardV6Demo } from "./player-card-v6";
import NavbarBase from "@/components/shadcn-space/blocks/navbar-01/navbar";
import {
  NavbarIcons,
  NavbarSearch,
  NavbarPlayerSearch,
  NavbarGroupFilter,
} from "@/components/shadcn-space/blocks/navbar-01/navbar-variants";

const variants = {
  1: { name: "Base (navbar-01)", node: <NavbarBase /> },
  2: { name: "Iconos + botones", node: <NavbarIcons /> },
  3: { name: "Buscar + iconos + botones + dropdown", node: <NavbarSearch /> },
  4: {
    name: "Buscar jugadores + 3 iconos + alerta + dropdown",
    node: <NavbarPlayerSearch />,
  },
  5: {
    name: "Pills grupos + dropdown letras + botones",
    node: <NavbarGroupFilter />,
  },
} as const;

export default function NavTestPage() {
  const [v, setV] = useState<keyof typeof variants>(1);

  return (
    <div className="bg-background">
      {/* Barra de controles (no sticky) */}
      <div className="border-b bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-lg font-semibold">Prueba de Navbar</h1>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">Modo:</span>
              <ThemeToggle />
              <span className="text-sm text-muted-foreground">Variante:</span>
              <div className="inline-flex items-center gap-1 rounded-md bg-muted p-1 text-xs">
                {(
                  Object.keys(variants) as unknown as Array<
                    keyof typeof variants
                  >
                ).map((k) => (
                  <button
                    key={k}
                    onClick={() => setV(k)}
                    className={cn(
                      "rounded px-2 py-1 font-medium transition",
                      v === k
                        ? "bg-background text-foreground shadow"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    aria-pressed={v === k}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {variants[v].name}
          </p>
        </div>
      </div>

      {/* Slot sticky con blur para testear sticky + backdrop en todas las variantes */}
      <div className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-lg">
        {variants[v].node}
      </div>

      {/* Contenido scrollable para probar sticky + backdrop */}
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <section className="space-y-2">
          <h2 className="text-2xl font-bold">Contenido de prueba</h2>
          <p className="text-sm text-muted-foreground">
            Hace scroll para observar el comportamiento sticky + blur. Cambia de
            variante con los botones de arriba y togglea modo night/day.
          </p>
        </section>
        {Array.from({ length: 16 }).map((_, i) => (
          <section
            key={i}
            className="flex h-40 items-center justify-center rounded-lg border border-border bg-muted/20"
          >
            <span className="text-xs text-muted-foreground">
              Bloque {i + 1}
            </span>
          </section>
        ))}

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Cards de jugador</h2>
          <p className="text-sm text-muted-foreground">
            Showcase del PlayerCard: foto full-bleed de fondo, avatar, badge de
            división, micro-animaciones hover/active y haptics. Incluye estado
            verificado.
          </p>
          <PlayerCardDemo />
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">PlayerCard v2 — banner con foto</h2>
          <p className="text-sm text-muted-foreground">
            Variante banner ancho: foto proporción adaptable, overlay de blur
            parcial, marcadores superpuestos, stats reales y micro-animaciones
            hover.
          </p>
          <PlayerCardV2Demo />
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">PlayerCard v3 — foto + recuadro blur</h2>
          <p className="text-sm text-muted-foreground">
            Foto full-bleed y texto dentro de un panel con <code className="rounded bg-muted px-1">backdrop-blur</code> en la zona inferior, sin tapar la cara.
          </p>
          <PlayerCardV3Demo />
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">PlayerCard v4 — stats + extras</h2>
          <p className="text-sm text-muted-foreground">
            Misma base que v3 con panel de stats y favorito clickeable.
          </p>
          <PlayerCardV4Demo />
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">PlayerCard v5 — versión final</h2>
          <p className="text-sm text-muted-foreground">
            v4 + acabado final: toca la card para voltearla y comparar stats.
          </p>
          <PlayerCardV5Demo />
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">
            PlayerCard v6 — comparador con gráfica
          </h2>
          <p className="text-sm text-muted-foreground">
            Más stats + gráfica G/P, dropdown para comparar contra un jugador o
            un equipo y flip ×3 que muestra las estadísticas de los dos lados.
          </p>
          <PlayerCardV6Demo />
        </section>
      </main>
    </div>
  );
}
