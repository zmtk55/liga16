// Validación y formato de categorías de torneo (nombre libre + rama).
import type { PadelDivision, Sex, Team } from "@/types";

export interface CategoryValue {
  label: string; // nombre libre: "4ta Varonil", "Suma Nueve"…
  sex: Sex;
}

/** El orden de las divisiones: de la más fuerte a la más nueva. */
export const DIVISION_ORDER: PadelDivision[] = ["1ra", "2da", "3ra", "4ta", "5ta", "6ta", "Novatos"];

/**
 * En qué división compite una categoría.
 *
 * El nombre es la vía normal porque así funcionan las categorías reales
 * ("4ta Masculino", "Novatos Mixto", "Suma 9"): las que existen en el circuito
 * se llaman así y se reconocen.
 *
 * Los NIVELES son el respaldo, no la fuente. Antes, cualquier categoría que el
 * nombre no reconocía caía en silencio a '4ta' —una pareja de "Suma 11", "Open"
 * o "Intermedio" quedaba rankeada dentro de 4ta, mezclada con parejas de 4ta de
 * verdad, y no había forma de enterarse—. Ahora, si el nombre no dice nada, la
 * división sale del rango de niveles del torneo y, si tampoco lo hay, del nivel
 * de los propios jugadores de la pareja.
 *
 * El orden importa: los niveles solo se miran cuando el NOMBRE falla. Así una
 * categoría que hoy funciona ("3ra Masculino" con niveles 5.0–5.9) sigue
 * saliendo por el nombre y no cambia de división por culpa de esto.
 */
export function divisionFromCategory(
  name: string | null | undefined,
  levels?: { min_level?: number | null; max_level?: number | null } | null,
  playerLevel?: number | null,
): PadelDivision {
  const n = (name ?? '').trim().toLowerCase();
  if (n.includes('novato')) return 'Novatos';
  // "Suma 9" y "+9" compiten en 6ta (varonil). El `\b` de antes del `\+` no
  // podía cumplirse nunca —`+` no es carácter de palabra, así que no hay
  // límite de palabra delante— y el caso especial nunca se disparaba.
  if (/\bsuma\s*9\b/.test(n) || /\+\s*9\b/.test(n)) return '6ta';
  const m = n.match(/\b(1ra|2da|3ra|4ta|5ta|6ta)\b/);
  if (m) return m[1] as PadelDivision;
  const ord = n.match(/\b(primera|segunda|tercera|cuarta|quinta|sexta)\b/);
  if (ord) {
    const map: Record<string, PadelDivision> = {
      primera: '1ra', segunda: '2da', tercera: '3ra',
      cuarta: '4ta', quinta: '5ta', sexta: '6ta',
    };
    return map[ord[1]];
  }
  // El nombre no dice nada: primero el rango del torneo, luego el nivel de la
  // pareja. Se mira el techo del rango porque es la fuerza máxima admitida y por
  // eso define en qué mesa se juega.
  const top = levels?.max_level ?? levels?.min_level ?? playerLevel ?? null;
  if (top == null) return 'Novatos';
  // Escala de padel 1.0–7.0.
  if (top >= 6) return '1ra';
  if (top >= 5.5) return '2da';
  if (top >= 5) return '3ra';
  if (top >= 4.5) return '4ta';
  if (top >= 4) return '5ta';
  if (top >= 3.5) return '6ta';
  return 'Novatos';
}

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
 * La categoría REAL de una pareja: el nombre que le dio el torneo al inscribirse
 * ("Suma 9", "4ta Masculino", "Novatos Mixto"). `Team.division` es un bucket
 * derivado de ese nombre y sirve para ORDENAR y rankear; esto es lo que la gente
 * reconoce, y no siempre coincide: `divisionFromCategoryName` manda "Suma 9" a
 * 6ta, así que una pareja de Suma 9 no es "6ta" aunque compitan ahí.
 *
 * Por eso los filtros no pueden ofrecer una lista fija de divisiones: la
 * categoría es texto libre y una lista fija no puede ofrecer "Suma 9" aunque
 * exista de verdad en el circuito.
 */
export function teamCategoryLabel(t: Team): string {
  return t.category_name?.trim() || `División ${t.division}`;
}

/**
 * Clave estable para filtrar por URL (?categoria=). El nombre real si existe;
 * si no, un prefijo que no puede chocar con un nombre para que "sin categoría"
 * y "6ta" nunca se confundan al filtrar.
 */
export function teamCategoryKey(t: Team): string {
  const name = t.category_name?.trim().toLowerCase();
  return name || `division:${t.division}`;
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
