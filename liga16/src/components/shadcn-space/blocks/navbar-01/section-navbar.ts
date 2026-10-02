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
 * El admin sigue la MISMA regla, no una aparte: si el panel se inventara sus
 * propias excepciones volvería el problema que esto vino a arreglar —cada
 * pantalla con su layout— y además duplicaría el buscador, porque cada una ya
 * tenía el suyo dentro de la página.
 *
 *   browse — el Panel, la Sede, la Bandeja y el Estado: nada que buscar
 *   search — las pantallas con lista y buscador
 *   filter — el Ranking del admin, que además se mueve por división
 */
export const SECTION_NAVBAR_ADMIN: Record<string, NavbarType> = {
  "/admin": "browse",
  "/admin/estado": "browse",
  "/admin/inbox": "browse",
  "/admin/padel": "browse",
  // Noticias es browse a propósito: son cinco o seis y se leen de un vistazo.
  // Un buscador ahí sería un control sin propósito, y peor: uno que no filtra.
  "/admin/noticias": "browse",
  "/admin/torneos": "search",
  "/admin/jugadores": "search",
  "/admin/equipos": "search",
  "/admin/participantes": "search",
  "/admin/resultados": "search",
  "/admin/ranking": "filter",
};

/**
 * El tipo de navbar de una ruta. Las vistas de detalle heredan el tipo de su
 * sección madre; lo que no esté declarado cae en "browse" en vez de romper.
 */
export function navbarTypeFor(pathname: string): NavbarType {
  const root = sectionRootFor(pathname);
  // `startsWith` y no `===`: la raíz de "/admin/jugadores" es esa ruta entera,
  // no "/admin", y con `===` caía al mapa público y salía "browse".
  const map = root.startsWith("/admin") ? SECTION_NAVBAR_ADMIN : SECTION_NAVBAR;

  // En el panel el control del shell es de las páginas de LISTADO. El detalle
  // de un torneo y el asistente llevan sus propios filtros dentro de la
  // pantalla, así que heredarlos les pondría un segundo buscador. En el admin
  // una ruta de un solo segmento tras "/admin/" es el listado; a partir de dos
  // ("/admin/torneos/nuevo", "/admin/torneos/abc") ya es detalle o formulario.
  const enDetalleAdmin =
    pathname.startsWith("/admin/") && pathname.replace(/^\/admin\//, "").split("/").filter(Boolean).length > 1;
  if (enDetalleAdmin) return SECTION_NAVBAR_ADMIN[pathname] ?? "browse";

  return SECTION_NAVBAR[pathname] ?? map[pathname] ?? map[root] ?? "browse";
}

/**
 * La raíz de una sección: "/torneos", "/ranking", o "/admin/jugadores" en el
 * panel. El admin vive un nivel más abajo que el sitio público, así que tomar
 * solo el primer segmento daba "/admin" para todas sus pantallas y ninguna
 * encontraba su configuración.
 */
export function sectionRootFor(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "admin") return "/" + parts.slice(0, 2).join("/");
  return "/" + (parts[0] ?? "");
}
