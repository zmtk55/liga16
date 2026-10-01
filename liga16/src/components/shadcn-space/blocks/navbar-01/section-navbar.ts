// Qué variante de navbar usa cada sección del sitio.
//
// El tipo lo decide lo que la sección HACE, no lo que se le antoja a cada una:
//
//   browse — no se busca ni se filtra nada       → NavbarIcons
//   search — su trabajo es encontrar por nombre  → NavbarSearch
//   filter — moverse dentro de algo ya agrupado → NavbarGroupFilter
//
// Existe para que "cada sección con su layout" sea una decisión verificable y no
// una excepción que se acumula: la primera versión del ADR-0009 asignaba una
// variante distinta a cada sección (y en Home decía "V1 o V2", sin decidir),
// con lo que ocho secciones parecían ocho sitios.
//
// Máximo tres variantes en producto. Un cuarto tipo se escribe aquí y en el
// ADR-0009 primero, con su motivo.

export type NavbarType = "browse" | "search" | "filter";

export const SECTION_NAVBAR: Record<string, NavbarType> = {
  // A — navegar
  "/": "browse",
  "/noticias": "browse",
  "/calendario": "browse",
  "/padel": "browse",
  // B — buscar por nombre
  "/torneos": "search",
  "/jugadores": "search",
  "/equipos": "search",
  // C — moverse dentro de un conjunto ya agrupado
  "/ranking": "filter",
};

/**
 * El tipo de navbar de una ruta. Las vistas de detalle heredan el tipo de su
 * sección madre; lo que no esté declarado cae en "browse" en vez de romper.
 */
export function navbarTypeFor(pathname: string): NavbarType {
  const base = "/" + (pathname.split("/")[1] ?? "");
  return SECTION_NAVBAR[pathname] ?? SECTION_NAVBAR[base] ?? "browse";
}
