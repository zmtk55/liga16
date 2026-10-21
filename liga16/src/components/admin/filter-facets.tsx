// Las facetas del admin: un eje de filtro por fila.
//
// Una faceta es una pregunta que el organizador se hace sobre la lista:
// "¿de qué estado?", "¿de qué categoría?", "¿de qué torneo?". Cada eje es una
// fila —etiqueta a la izquierda, opciones a la derecha— y las opciones son
// botones que se leen enteros, con su cuenta, sin abrirlos.
//
// Por qué no un desplegable: el <Select> escondía las opciones detrás de dos
// clics y no había forma de saber si el valor que se buscaba existía. Un
// filtro que no se ve es un filtro que no se usa — y un admin que no filtra
// termina revisando 60 partidos para encontrar los 6 que le importan.
//
// La columna de etiqueta tiene ancho fijo para que todas las filas compartan
// el mismo borde de alineación: el ojo baja por la etiqueta y no tiene que
// cazarla en cada fila.
import type { ReactNode } from "react";
import { FilterNav, type FacetOption } from "@/components/ui/filter-nav";

/** Las filas de facetas, una debajo de otra, con el mismo paso de espaciado. */
export function AdminFacets({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-2 pt-1">{children}</div>;
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
    <FilterNav
      orientation="row"
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      allLabel={allLabel}
      showCount={showCount}
    />
  );
}
