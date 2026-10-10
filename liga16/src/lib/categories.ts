// Validación y formato de categorías de torneo (nombre libre + rama).
import { divisionOptions, SEX_BRANCHES, sexLabel } from "@/lib/format";
import type { PadelDivision, Sex, Team } from "@/types";

export interface CategoryValue {
  label: string; // nombre libre: "4ta Varonil", "Suma Nueve"…
  sex: Sex;
  /**
   * Id interno para que React no reutilice el nodo de otra fila al borrar una
   * del medio (con `key={índice}` los inputs saltan de valor al editar). No se
   * guarda: al crear el torneo solo se leen `label` y `sex`.
   */
  id?: string;
}

/** El orden de las divisiones: de la más fuerte a la más nueva. */
export const DIVISION_ORDER: PadelDivision[] = ["1ra", "2da", "3ra", "4ta", "5ta", "6ta", "Novatos"];

/**
 * NO hay expansor de divisiones a palabras.
 *
 * Existió `divisionLabel()` con un mapa que volvía "5ta" → "Quinta categoría",
 * alimentado por la idea de que la abreviatura hay que descifrarla. No: en el
 * circuito se dice "5ta" y la tarjeta mostraba "Quinta categoría" al lado de la
 * categoría real del torneo. Dos respuestas para el mismo dato.
 *
 * La división se muestra tal cual viene (`team.division`), y la categoría que
 * el torneo le puso al inscribirse manda sobre ella. Ver teamCategoryLabel.
 */

/**
 * En qué división compite una categoría.
 *
 * La BASE lo dice: `tournament_categories.category` es una columna
 * `padel_division` que el torneo guarda al crear la categoría. Eso es la fuente
 * de verdad y es lo que se usa primero. Antes esta función存在的 solo para
 * adivinar la división leyendo el NOMBRE con un regex, y adivinar salía mal:
 * "Suma 11", "Suma 7", "Open" o "Intermedio" no caían en ningún patrón y
 * terminaban en '4ta', dentro de una mesa donde no compiten.
 *
 * El nombre queda como respaldo para categorías viejas que no traigan la
 * columna, y detrás el nivel de los jugadores, que al menos es un dato real y no
 * una respuesta inventada. Si no hay nada, Novatos: es la única división donde
 * no se está mintiendo sobre la fuerza de nadie.
 */
export function divisionFromCategory(
  name: string | null | undefined,
  saved?: string | null,
  playerLevel?: number | null,
): PadelDivision {
  // 1. Lo que guardó el torneo. Si el valor no está en el enum, se ignora.
  if (saved && (DIVISION_ORDER as string[]).includes(saved)) return saved as PadelDivision;

  // 2. El nombre, para lo que ya existe y no tenga la columna.
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

  // 3. El nivel de los propios jugadores de la pareja.
  if (playerLevel != null) {
    if (playerLevel >= 6) return '1ra';
    if (playerLevel >= 5.5) return '2da';
    if (playerLevel >= 5) return '3ra';
    if (playerLevel >= 4.5) return '4ta';
    if (playerLevel >= 4) return '5ta';
    if (playerLevel >= 3.5) return '6ta';
  }
  return 'Novatos';
}

/**
 * Qué le pasa a la categoría de este índice, o `null` si está bien.
 *
 * La regla vive acá una sola vez: el componente la pinta en la fila y
 * `categoriasValidas` la aplica. Antes el componente tenía un `error` que
 * solo se limpiaba y nunca se activaba, y el wizard bloqueaba el paso con un
 * "añade al menos una categoría válida" que no decía cuál ni por qué.
 */
export function categoriaProblema(
  cats: CategoryValue[],
  index: number,
): string | null {
  const label = (cats[index]?.label ?? "").trim();
  if (!label) return "Ponle un nombre";
  const norm = label.toLowerCase();
  const otra = cats.findIndex(
    (c, i) => i !== index && c.label.trim().toLowerCase() === norm,
  );
  return otra >= 0 ? "Ya hay otra categoría con ese nombre" : null;
}

/** Valida: no vacías, no duplicadas (insensible a mayúsculas). */
export function categoriasValidas(cats: CategoryValue[]): boolean {
  return cats.length > 0 && cats.every((_, i) => categoriaProblema(cats, i) === null);
}

/**
 * Nombres que se sugieren al teclear: las divisiones sueltas y cada división
 * con su rama. Se derivan de `divisionOptions` y `SEX_BRANCHES`; estaban
 * escritos a mano en dos listas dentro del componente, por eso ofrecía "5ta"
 * pero no "4ta Varonil".
 */
export function categorySuggestions(): string[] {
  const divisiones = divisionOptions
    .filter((d) => d.value !== "all")
    .map((d) => d.label);
  const compuestas = divisiones.flatMap((d) =>
    SEX_BRANCHES.map((r) => `${d} ${r.label}`),
  );
  return [...divisiones, ...compuestas];
}

/** Label legible para mostrar una categoría en cualquier lista. */
export function categoriaLabel(c: { label: string; sex: Sex }): string {
  return `${c.label.trim()} · ${sexLabel(c.sex)}`;
}

/**
 * La categoría REAL de una pareja: el nombre que le dio el torneo al inscribirse
 * ("Suma 9", "4ta Varonil", "Novatos Mixto"). `Team.division` es un bucket
 * derivado de ese nombre y sirve para ORDENAR y rankear; esto es lo que la gente
 * reconoce, y no siempre coincide: `divisionFromCategory` manda "Suma 9" a 6ta,
 * así que una pareja de Suma 9 no es "6ta" aunque compitan ahí.
 *
 * Cuando no hay nombre, cae a la división tal cual —"5ta"— y no a "División 5ta":
 * el prefijo no agrega nada y hacía que el mismo dato apareciera de tres formas.
 * Las dos se distinguen igual al filtrar porque la clave lleva su propio prefijo
 * (ver teamCategoryKey).
 *
 * Por eso los filtros no pueden ofrecer una lista fija de divisiones: la
 * categoría es texto libre y una lista fija no puede ofrecer "Suma 9" aunque
 * exista de verdad en el circuito.
 */
export function teamCategoryLabel(t: Team): string {
  return t.category_name?.trim() || t.division;
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
        label: `${division} · ${sexLabel(sex)}`,
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
