// El control de la sección, por TIPO y no por excepción (ADR-0009).
//
// Lo usan el SiteHeader público y el shell del admin: es la misma pieza en
// ambos, que es el punto. Si el admin dibujara su propio buscador volvería
// la duplicación que la regla vino a quitar —dos buscadores en la misma
// pantalla, uno arriba y otro en la página—.
//
// El filtro vive en la URL (?q=, ?division=): sobrevive al ir y venir y un
// enlace ya filtrado se puede compartir.
import { useLocation, useSearchParams } from "react-router";
import { Search as SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { divisionOptions } from "@/lib/format";
import { Settings } from "lucide-react";
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
export function SectionControl({
  className,
  only,
}: {
  className?: string;
  /** Limita a una parte: "search" o "pills". Sin esto, el tipo decide. */
  only?: "search" | "pills";
}) {
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
  if (type === "browse") return null;
  // "filter" lleva ALSO buscador: el Ranking se busca por nombre y además se
  // mueve por división. Si solo pintara las pills perdía la búsqueda.
  const placeholder = SEARCH_PLACEHOLDER[sectionRoot] ?? "Buscar…";
  const buscador =
    only !== "pills" ? (
      <div className={cn("relative", className)}>
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setParam("q", e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-9 pl-9"
        />
      </div>
    ) : null;
  if (type === "search") return buscador;
  if (only === "search") return buscador;
  const divisiones = divisionOptions.filter((d) => d.value !== "all");

  // Tipo "filter" (NavbarGroupFilter del catálogo): las pills de división se
  // eligen a ojo y el resto de filtros caben en "Más filtros". Se usa
  // GroupFilterBar del catálogo en vez de reimplementar las pills aquí.
  const pills = (
    <GroupFilterBar
      divisions={divisiones}
      value={division}
      onChange={(v) => setParam("division", v)}
      clearValue="all"
    />
  );

  const masFiltros = (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 shrink-0 gap-1.5 rounded-full">
          <Settings className="h-3.5 w-3.5" />
          Más filtros
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">División</p>
        {pills}
      </PopoverContent>
    </Popover>
  );

  return buscador ? (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {buscador}
      {masFiltros}
    </div>
  ) : (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {pills}
    </div>
  );
}
