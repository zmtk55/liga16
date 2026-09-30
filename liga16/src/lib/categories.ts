// Validación y formato de categorías de torneo (nombre libre + rama).
import type { PadelDivision, Sex, Team } from "@/types";

export interface CategoryValue {
  label: string; // nombre libre: "4ta Varonil", "Suma Nueve"…
  sex: Sex;
}

/** El orden de las divisiones: de la más fuerte a la más nueva. */
export const DIVISION_ORDER: PadelDivision[] = ["1ra", "2da", "3ra", "4ta", "5ta", "6ta", "Novatos"];

/** Valida: no vacías, no duplicadas (insensible a mayúsculas). */
export function categoriasValidas(cats: CategoryValue[]): boolean {
  return cats.length > 0 &&
    cats.every((c) => c.label.trim()) &&
    new Set(cats.map((c) => c.label.trim().toLowerCase())).size === cats.length;
}

/** Cómo se llama la rama en español. */
export function ramaLabel(sex: Sex): string {
  return sex === "M" ? "Varonil" : sex === "F" ? "Femenil" : "Mixto";
}

/** Label legible para mostrar una categoría en cualquier lista. */
export function categoriaLabel(c: { label: string; sex: Sex }): string {
  return `${c.label.trim()} · ${ramaLabel(c.sex)}`;
}

/**
 * Una pareja compite dentro de su división y rama: la posición y los puntos
 * solo significan algo ahí adentro. Por eso "el primero" del ranking es "el
 * primero de SU división", y mezclar divisiones en una tabla —o en un podio—
 * compara cosas que no son comparables (el 1 de 3ra contra el 1 de 1ra).
 */
export interface DivisionGroup {
  division: PadelDivision;
  sex: Sex;
  /** "4ta · Femenil", para encabezar la lista. */
  label: string;
  teams: Team[];
}

/** Agrupa por división + rama y ordena cada grupo como el ranking oficial. */
export function groupByDivision(teams: Team[]): DivisionGroup[] {
  const groups = new Map<string, Team[]>();
  for (const t of teams) {
    const key = `${t.division}|${t.sex}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const [division, sex] = key.split("|") as [PadelDivision, Sex];
      return {
        division,
        sex,
        label: `${division} · ${ramaLabel(sex)}`,
        // Mismo criterio que la tabla de posiciones: posición, luego puntos.
        teams: list.sort((a, b) => a.position - b.position || b.points - a.points),
      };
    })
    .sort(
      (a, b) =>
        DIVISION_ORDER.indexOf(a.division) - DIVISION_ORDER.indexOf(b.division) ||
        a.sex.localeCompare(b.sex),
    );
}
