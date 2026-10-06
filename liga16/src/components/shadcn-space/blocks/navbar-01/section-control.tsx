// El control de la sección, por TIPO y no por excepción (ADR-0009).
//
// Lo usan el SiteHeader público y el shell del admin: es la misma pieza en
// ambos, que es el punto. Si el admin dibujara su propio buscador volvería
// la duplicación que la regla vino a quitar —dos buscadores en la misma
// pantalla, uno arriba y otro en la página—.
//
// El filtro vive en la URL (?q=, ?division=): sobrevive al ir y venir y un
// enlace ya filtrado se puede compartir.
//
// UNA pieza, no dos. Antes el header la llamaba dos veces —`only="search"` y
// `only="pills"`— y cada llamada decidía por su cuenta qué dibujar. El
// resultado: /ranking pintaba el input Y las ocho pills sueltas en la fila, la
// barra crecía a 84px de alto y a 1024px de ancho la página se salía de lado.
// El dropdown "Más filtros" que existía para evitar justo eso no se veía nunca,
// porque solo se abría en la rama que el header no usaba. Ahora el tipo de la
// sección decide una sola vez qué lleva el control, y el filtro de división
// vive en el popover, que ocupa lo que ocupa una etiqueta.
import { useLocation, useSearchParams } from "react-router";
import { Search as SearchIcon, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { divisionOptions } from "@/lib/format";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { GroupFilterBar } from "./group-filter-bar";
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
  "/admin/resultados": "Buscar partido…",
  "/admin/ranking": "Buscar pareja…",
  "/admin/noticias": "Buscar noticia…",
};

export function SectionControl({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const type = navbarTypeFor(pathname);
  const sectionRoot = sectionRootFor(pathname);
  const query = params.get("q") ?? "";
  const division = params.get("division") ?? "all";

  /** Escribe en la URL: el filtro sobrevive la navegación y se puede compartir. */
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  }

  // "browse" no busca ni filtra: nada que dibujar.
  if (type === "browse") return null;

  // "filter" lleva también buscador: el Ranking se busca por nombre y además se
  // mueve por división. Si solo pintara el filtro perdía la búsqueda.
  const placeholder = SEARCH_PLACEHOLDER[sectionRoot] ?? "Buscar…";
  const buscador = (
    <div className="relative min-w-0 flex-1 sm:max-w-52">
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

  if (type === "search") return buscador;

  // Tipo "filter": buscador + división. La división va en un popover y no como
  // ocho pills en la fila: ocho pills no caben en una barra y la obligaban a
  // crecer hasta salirse de la pantalla. El popover dice cuál está activa sin
  // ocupar más que una etiqueta.
  const divisiones = divisionOptions.filter((d) => d.value !== "all");
  const divisionActiva =
    division !== "all"
      ? (divisionOptions.find((d) => d.value === division)?.label ?? division).replace(
          " División",
          "",
        )
      : null;

  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-2", className)}>
      {buscador}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-9 shrink-0 gap-1.5 rounded-full font-medium",
              divisionActiva && "border-primary/40 bg-primary/10 text-primary",
            )}
            aria-label={divisionActiva ? `División: ${divisionActiva}` : "Filtrar por división"}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {/* En móvil el botón solo muestra el icono: con la etiqueta se
                comía el ancho del buscador, que es lo que más necesita el
                espacio. La división activa sigue viéndose por el color del
                botón, y el popover dice cuál es. */}
            <span className="hidden sm:inline">
              {divisionActiva ?? "División"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">División</p>
          <GroupFilterBar
            divisions={divisiones}
            value={division}
            onChange={(v) => setParam("division", v)}
            clearValue="all"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
