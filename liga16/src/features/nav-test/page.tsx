// Página de prueba de variantes de Navbar (shadcn navbar-01).
// Renderiza las variantes exportables y permite toggle dark/light + selector
// sobre un slot sticky+blur para verificar sticky, backdrop, dropdown móvil,
// enlaces activos e iconos/botones de cada layout.
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
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
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Prueba de Navbar</h1>
            <div className="flex items-center gap-3">
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
      </main>
    </div>
  );
}
