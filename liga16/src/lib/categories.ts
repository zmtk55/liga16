// Validación y formato de categorías de torneo (nombre libre + rama).
import type { Sex } from "@/types";

export interface CategoryValue {
  label: string; // nombre libre: "4ta Varonil", "Suma Nueve"…
  sex: Sex;
}

/** Valida: no vacías, no duplicadas (insensible a mayúsculas). */
export function categoriasValidas(cats: CategoryValue[]): boolean {
  return (
    cats.length > 0 &&
    cats.every((c) => c.label.trim()) &&
    new Set(cats.map((c) => c.label.trim().toLowerCase())).size === cats.length
  );
}

/** Label legible para mostrar una categoría en cualquier lista. */
export function categoriaLabel(c: { label: string; sex: Sex }): string {
  const rama = c.sex === "M" ? "Varonil" : c.sex === "F" ? "Femenil" : "Mixto";
  return `${c.label.trim()} · ${rama}`;
}
