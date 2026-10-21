import { cn } from "@/lib/utils";

export interface FacetOption {
  key: string;
  label: string;
  /** Parejas/jugadores que hay detrás. Opcional. */
  n?: number;
}

/**
 * El filtro como BARRA DE NAVEGACIÓN, no como desplegable.
 *
 * El <Select> escondía las opciones detrás de dos clics y había que abrirlas
 * para saber si la categoría que buscabas existía. Una fila de botones se lee
 * entera de un vistazo y el filtro se elige con uno. En pantallas estrechas la
 * fila se desliza en horizontal en vez de partirse en tres líneas.
 */
export function FilterNav({
  label,
  value,
  onChange,
  options,
  allLabel = "Todas",
  showCount = false,
  orientation = "stack",
  className,
}: {
  /** Texto del grupo: "Categoría", "Rama". */
  label: string;
  value: string;
  onChange: (key: string) => void;
  options: FacetOption[];
  allLabel?: string;
  showCount?: boolean;
  /**
   * "stack": la etiqueta arriba y las opciones debajo (páginas públicas, donde
   * la etiqueta introduce la lista). "row": la etiqueta a la izquierda, en una
   * columna de ancho fijo, y las opciones a la derecha — el patrón de las
   * barras de herramientas del admin, donde cada eje de filtro es una fila y
   * todas las etiquetas comparten el mismo borde de alineación.
   */
  orientation?: "stack" | "row";
  className?: string;
}) {
  // La barra se oculta si no hay nada que elegir, SALVO que haya un filtro
  // activo. Antes, con una sola categoría en el circuito la barra desaparecía
  // entera y un enlace guardado con `?categoria=suma-9` dejaba la página en
  // "no hay equipos" sin ningún control para quitarlo: un filtro del que no se
  // puede salir.
  if (options.length === 0 && value === "all") return null;

  const items: FacetOption[] = [{ key: "all", label: allLabel }, ...options];

  return (
    <nav
      aria-label={`Filtrar por ${label.toLowerCase()}`}
      className={cn(
        "flex min-w-0 max-w-full",
        orientation === "row" ? "items-center gap-3" : "flex-col gap-1.5",
        className,
      )}
    >
      <p
        className={cn(
          "text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground",
          orientation === "row" ? "w-20 shrink-0 sm:w-24" : "px-0.5",
        )}
      >
        {label}
      </p>
      <div
        className={cn(
          "-mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:thin]",
          orientation === "row" && "min-w-0 max-w-full flex-1",
        )}
      >
        {items.map((o) => {
          const active = value === o.key;
          return (
            <button
              key={o.key}
              type="button"
              aria-current={active ? "true" : undefined}
              onClick={() => onChange(o.key)}
              className={cn(
                "inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap transition-colors",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                active
                  ? "border-primary/40 bg-primary/10 text-primary-strong"
                  : "border-border text-muted-foreground hover:border-foreground/30 hover:bg-muted hover:text-foreground",
              )}
            >
              {o.label}
              {showCount && o.n != null && (
                <span className={cn("text-xs tabular-nums", active ? "text-primary-strong/70" : "text-muted-foreground/70")}>
                  {o.n}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}