// Facetas del admin: los mismos filtros compactos y etiquetados de las listas públicas.
import type { ReactNode } from "react";
import { FilterMenu, type FacetOption } from "@/components/ui/filter-menu";

/** Los filtros se acomodan en varias líneas cuando falta ancho. */
export function AdminFacets({ children }: { children: ReactNode }) {
  return <div className="grid w-full min-w-0 grid-cols-2 gap-2 [&>*:nth-child(odd):last-child]:col-span-2 sm:flex sm:flex-wrap sm:items-center">{children}</div>;
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
    <FilterMenu label={label} value={value} onChange={onChange} options={options} allLabel={allLabel} showCount={showCount} className="w-full min-w-0 rounded-xl sm:w-auto" />
  );
}
