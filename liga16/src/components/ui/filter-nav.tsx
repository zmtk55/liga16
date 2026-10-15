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
  className,
}: {
  /** Texto del grupo: "Categoría", "Rama". */
  label: string;
  value: string;
  onChange: (key: string) => void;
  options: FacetOption[];
  allLabel?: string;
  showCount?: boolean;
  className?: string;
}) {
  if (options.length === 0) return null;

  const items: FacetOption[] = [{ key: "all", label: allLabel }, ...options];

  return (
    <nav
      aria-label={`Filtrar por ${label.toLowerCase()}`}
      className={cn("flex min-w-0 flex-col gap-1.5", className)}
    >
      <p className="px-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:thin]">
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