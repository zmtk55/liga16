// Barra de filtros unificada: búsqueda + cualquier número de selects + fecha.
// Un solo componente para todas las tablas del admin — nada de barras ad-hoc.
import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
  /** Ancho aproximado, ej. "w-44". */
  className?: string;
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
  const hasFilters =
    (search ?? "") !== "" || selects.some((s) => s.value !== "all" && s.value !== "");

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {onSearch && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-56 pl-8"
            aria-label={searchPlaceholder}
          />
        </div>
      )}
      {selects.map((s) => (
        <Select key={s.key} value={s.value} onValueChange={s.onChange}>
          <SelectTrigger className={cn("h-9", s.className ?? "w-44")} aria-label={s.ariaLabel}>
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
      {children}
      {typeof resultCount === "number" && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {resultCount} {resultLabel}
        </span>
      )}
      {onClear && hasFilters && (
        <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={onClear}>
          <X className="h-3.5 w-3.5 mr-1" /> Limpiar
        </Button>
      )}
    </div>
  );
}
