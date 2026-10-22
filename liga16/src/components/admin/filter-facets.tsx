// Las facetas del admin: un eje de filtro por fila.
//
// Una faceta es una pregunta que el organizador se hace sobre la lista:
// "¿de qué estado?", "¿de qué categoría?", "¿de qué torneo?".
//
// Por qué un popover y no una fila de píldoras: la fila ocupaba una banda
// entera con un scrollbar horizontal en el medio de la pantalla y, con
// veinte opciones, era un muro de píldoras. El botón muestra el valor
// elegido y el popover lista los valores con su cuenta y con búsqueda.
//
// La columna de etiqueta tiene ancho fijo para que todas las filas compartan
// el mismo borde de alineación: el ojo baja por la etiqueta y no tiene que
// cazarla en cada fila.
import type { ReactNode } from "react";
import { FilterMenu, type FacetOption } from "@/components/ui/filter-menu";

/** Las filas de facetas, una debajo de otra, con el mismo paso de espaciado. */
export function AdminFacets({ children }: { children: ReactNode }) {
  return <div className="grid gap-2 sm:grid-cols-2 pt-1">{children}</div>;
}

export function AdminFacet({
  label,
  value,
  onChange,
  options,
  allLabel = "Todas",
  showCount = true,
}: {
  /** Texto del eje: "Estado", "Categoría", "Torneo". */
  label: string;
  value: string;
  onChange: (key: string) => void;
  options: FacetOption[];
  allLabel?: string;
  showCount?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <p className="w-20 shrink-0 text-caption uppercase text-muted-foreground sm:w-24">
        {label}
      </p>
      <FilterMenu
        label=""
        value={value}
        onChange={onChange}
        options={options}
        allLabel={allLabel}
        showCount={showCount}
        className="min-w-0"
      />
    </div>
  );
}
