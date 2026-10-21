import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface FacetOption {
  key: string;
  label: string;
  /** Parejas/jugadores que hay detrás. Opcional. */
  n?: number;
}

/**
 * Filtro facetado, patrón shadcn: un botón que abre un popover con búsqueda.
 *
 * Antes era una fila de píldoras que se deslizaba en horizontal. En móvil
 * ocupaba dos bandas de alto, con un scrollbar en medio de la pantalla y
 * opciones cortadas a la mitad; en escritorio era un muro de píldoras. Con el
 * popover, la barra de filtros ocupa una línea, no hay scroll horizontal y
 * las opciones se pueden buscar por nombre (con 60 equipos, "cuarta" encuentra
 * la categoría sin leer la lista entera).
 *
 * El botón muestra SIEMPRE el valor elegido, así que el filtro activo no
 * queda escondido dentro de un desplegable.
 */
export function FilterMenu({
  label,
  value,
  onChange,
  options,
  allLabel = "Todas",
  showCount = true,
  className,
}: {
  /** Texto del eje: "Categoría", "Rama", "Estado". Vacío si la etiqueta la
   *  pone el contenedor (el admin alinea las suyas en una columna). */
  label: string;
  value: string;
  onChange: (key: string) => void;
  options: FacetOption[];
  allLabel?: string;
  showCount?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const items: FacetOption[] = [{ key: "all", label: allLabel }, ...options];
  const current = items.find((o) => o.key === value) ?? items[0];
  const active = value !== "all";

  // Sin opciones y sin filtro activo, el botón no haría nada: no se muestra.
  if (options.length === 0 && !active) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 shrink-0 justify-start gap-2 px-3",
            active &&
              "border-primary/40 bg-primary/10 text-primary-strong hover:bg-primary/15 hover:text-primary-strong",
            className,
          )}
        >
          {label && <span className="text-muted-foreground">{label}</span>}
          <span className="max-w-[12rem] truncate font-semibold text-foreground">
            {current.label}
          </span>          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-56 p-0"
      >
        <Command>
          <CommandInput placeholder={`Buscar ${label.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandGroup>
              {items.map((o) => (
                <CommandItem
                  key={o.key}
                  value={o.label}
                  onSelect={() => {
                    onChange(o.key);
                    setOpen(false);
                  }}
                  className="gap-2"
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      value === o.key ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex-1 truncate">{o.label}</span>
                  {showCount && o.n != null && (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {o.n}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
