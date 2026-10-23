// El control de la sección, por TIPO y no por excepción (ADR-0009).
//
// Lo usan el SiteHeader público y el shell del admin: es la misma pieza en
// ambos, que es el punto. Si el admin dibujara su propio buscador volvería
// la duplicación que la regla vino a quitar —dos buscadores en la misma
// pantalla, uno arriba y otro en la página—.
//
// El filtro de BÚSQUEDA vive en la URL (?q=): sobrevive al ir y venir y un
// enlace ya filtrado se puede compartir.
//
// UNA pieza, no dos. Antes el header la llamaba dos veces —`only="search"` y
// `only="pills"`— y cada llamada decidía por su cuenta qué dibujar. El
// resultado: /ranking pintaba el input Y las ocho pills sueltas en la fila, la
// barra crecía a 84px de alto y a 1024px de ancho la página se salía de lado.
//
// Aquí ya no hay filtro de categoría, solo el buscador. El popover "División"
// que quedaba en el header ofrecía una lista de divisiones escrita a mano —
// ofrecía 2da y 5ta aunque el circuito no las tenga, y no ofrecía "Suma 9" ni
// "Mixtos", que sí existen—. Armar el filtro con los datos es trabajo de la
// página, que es quien los carga: ver `FilterNav` y `categoryFacet`.
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { navbarTypeFor, sectionRootFor } from "./section-navbar";

/** Qué busca cada sección de tipo "search". */
const SEARCH_PLACEHOLDER: Record<string, string> = {
  "/torneos": "Buscar torneo…",
  "/jugadores": "Buscar jugador…",
  "/equipos": "Buscar pareja…",
  "/ranking": "Buscar pareja…",
  "/admin/torneos": "Buscar torneo…",
  "/admin/jugadores": "Buscar jugador…",
  "/admin/equipos": "Buscar pareja…",
  "/admin/participantes": "Buscar pareja o torneo…",
  "/admin/resultados": "Buscar equipo o jugador…",
  "/admin/ranking": "Buscar pareja…",
  "/admin/noticias": "Buscar noticia…",
};

export function SectionControl({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const type = navbarTypeFor(pathname);
  const sectionRoot = sectionRootFor(pathname);
  const query = params.get("q") ?? "";
  // En una ficha (equipo, torneo, jugador) el `?q=` no lo lee nadie: escribir
  // ahí no filtraba nada y el buscador parecía roto. Desde una ficha, buscar
  // lleva a la lista de la sección con el término ya aplicado.
  const onSectionRoot =
    pathname === sectionRoot || pathname === `${sectionRoot}/`;

  /** Escribe en la URL: el filtro sobrevive la navegación y se puede compartir. */
  function setParam(key: string, value: string) {
    if (key === "q" && !onSectionRoot) {
      navigate(value ? `${sectionRoot}?q=${encodeURIComponent(value)}` : sectionRoot, {
        replace: true,
      });
      return;
    }
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  }

  // "browse" no busca ni filtra: nada que dibujar.
  if (type === "browse") return null;

  const placeholder = SEARCH_PLACEHOLDER[sectionRoot] ?? "Buscar…";
  const buscador = (
    <div className={cn("relative min-w-0 flex-1 sm:max-w-52", className)}>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={query}
        onChange={(e) => setParam("q", e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 pl-9"
      />
    </div>
  );

  // "search" y "filter" pintan lo mismo: el buscador. El filtro de categoría
  // se fue a la página, que es quien tiene los datos para armarlo — antes vivía
  // aquí con una lista de divisiones escrita a mano y offered divisiones que el
  // circuito no tiene, mientras las categorías que sí existen ("Suma 9",
  // "Mixtos") no aparecían. Ver `FilterNav`.
  if (type === "search" || type === "filter") return buscador;

  return null;
}
