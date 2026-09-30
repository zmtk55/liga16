// Barra de filtros unificada: búsqueda + filtros. Un solo componente para
// todas las tablas del admin — nada de hileras de dropdowns sueltos.
//
// Comportamiento:
//  - La búsqueda siempre queda visible.
//  - Con más de MAX_INLINE filtros se colapsan detrás de un solo botón
//    "Filtros" que abre un panel (popover); el botón muestra cuántos hay
//    activos. Con 1-2 filtros se muestran en línea, que no estorban.
//  - Los filtros activos se ven como chips removibles debajo de la barra.
import * as React from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MAX_INLINE = 2;

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSelect {
  key: string;
  ariaLabel: string;
  placeholder?: string;
  allLabel?: string; // etiqueta del valor "all"
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  /** Ancho en escritorio, ej. "sm:w-60". En móvil siempre ocupa el ancho completo. */
  className?: string;
}

/** "Filtrar por categoría" → "Categoría" (para chips y títulos del panel). */
function shortLabel(s: FilterSelect): string {
  const stripped = s.ariaLabel.replace(/^Filtrar por /i, "");
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

function chipValue(s: FilterSelect): string {
  return s.options.find((o) => o.value === s.value)?.label ?? s.value;
}

function FilterChip({
  label,
  value,
  onRemove,
}: {
  label: string;
  value: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted/50 py-0.5 pl-2 pr-1 text-xs">
      <span className="truncate">
        <span className="text-muted-foreground">{label}:</span>{" "}
        <span className="font-medium">{value}</span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
        aria-label={`Quitar filtro de ${label.toLowerCase()}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export function FilterBar({
  search,
  onSearch,
  searchPlaceholder = "Buscar…",
  selects = [],
  children,
  resultCount,
  resultLabel = "resultados",
  onClear,
  className,
}: {
  search?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  selects?: FilterSelect[];
  children?: React.ReactNode;
  resultCount?: number;
  resultLabel?: string;
  /** Se muestra solo si hay filtros activos. */
  onClear?: () => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const collapsed = selects.length > MAX_INLINE;
  const inlineSelects = collapsed ? [] : selects;
  const panelSelects = collapsed ? selects : [];
  const active = selects.filter((s) => s.value !== "all" && s.value !== "");
  const hasFilters = (search ?? "") !== "" || active.length > 0;
  const meta = typeof resultCount === "number" && (
    <span aria-live="polite" className="shrink-0 text-xs tabular-nums text-muted-foreground">
      {resultCount} {resultCount === 1 ? resultLabel.replace(/s$/, "") : resultLabel}
    </span>
  );
  const clearBtn = onClear && hasFilters && (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 shrink-0 text-xs text-muted-foreground"
      onClick={onClear}
    >
      <X className="mr-1 h-3.5 w-3.5" /> Limpiar
    </Button>
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {onSearch && (
          <div className="relative min-w-0 flex-1 sm:max-w-60">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-full pl-8"
              aria-label={searchPlaceholder}
            />
          </div>
        )}
        {inlineSelects.map((s) => (
          <Select key={s.key} value={s.value} onValueChange={s.onChange}>
            <SelectTrigger
              className={cn("h-9 w-full sm:w-44", s.className)}
              aria-label={s.ariaLabel}
            >
              <SelectValue placeholder={s.placeholder ?? s.ariaLabel} />
            </SelectTrigger>
            <SelectContent>
              {s.allLabel && <SelectItem value="all">{s.allLabel}</SelectItem>}
              {s.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {collapsed && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-9 shrink-0 gap-1.5"
                aria-label={`Filtros (${active.length} activos)`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {active.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-1.5 text-2xs font-bold text-primary">
                    {active.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              collisionPadding={16}
              className="max-h-[70vh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto p-3"
            >
              <div className="grid gap-3">
                {panelSelects.map((s) => (
                  <div key={s.key} className="grid gap-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      {shortLabel(s)}
                    </span>
                    <Select value={s.value} onValueChange={s.onChange}>
                      <SelectTrigger
                        className="h-9 w-full"
                        aria-label={s.ariaLabel}
                      >
                        <SelectValue placeholder={s.placeholder ?? s.ariaLabel} />
                      </SelectTrigger>
                      <SelectContent>
                        {s.allLabel && (
                          <SelectItem value="all">{s.allLabel}</SelectItem>
                        )}
                        {s.options.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
        {active.length === 0 && (
          <>
            {meta}
            {clearBtn}
          </>
        )}
      </div>

      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {active.map((s) => (
            <FilterChip
              key={s.key}
              label={shortLabel(s)}
              value={chipValue(s)}
              onRemove={() => s.onChange("all")}
            />
          ))}
          {meta}
          {clearBtn}
        </div>
      )}

      {children}
    </div>
  );
}
