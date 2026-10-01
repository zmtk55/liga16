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
import { ChevronDown, Search as SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { divisionOptions } from "@/lib/format";
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
  variant = "bar",
}: {
  className?: string;
  /** Limita a una parte: "search" o "pills". Sin esto, el tipo decide. */
  only?: "search" | "pills";
  /** "bar" es la barra de escritorio (dropdown); "menu" es el menú móvil (pills). */
  variant?: "bar" | "menu";
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

  const pills = [
    { value: "all", label: "Todas" },
    ...divisionOptions.filter((d) => d.value !== "all"),
  ];
  const actual = pills.find((d) => d.value === division) ?? pills[0];
  const corto = actual.label.replace(" División", "").replace("División ", "");

  // En la barra NO caben siete pills: con el logo y los links la fila se
  // amontona a 1024–1280. Un dropdown con la selección actual ocupa lo que
  // ocupa y deja ver cuántas divisiones hay sin apretarlas. Las pills sueltas
  // viven en el cuerpo de la página, donde sí hay espacio.
  if (variant === "bar") {
    const dropdown = (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("h-9 shrink-0 gap-1.5 rounded-full", className)}
            aria-label={`División: ${corto}`}
          >
            {corto}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {pills.map((d) => (
            <DropdownMenuItem
              key={d.value}
              onSelect={() => setParam("division", d.value)}
              className={cn(d.value === division && "font-semibold text-primary")}
            >
              {d.label.replace(" División", "").replace("División ", "")}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
    return buscador ? <div className="flex items-center gap-2">{buscador}{dropdown}</div> : dropdown;
  }

  const sueltas = (
    <nav aria-label="Filtrar por división" className={cn("flex flex-wrap items-center gap-1", className)}>
      {pills.map((d) => (
        <button
          key={d.value}
          type="button"
          onClick={() => setParam("division", d.value)}
          aria-pressed={division === d.value}
          className={cn(
            "min-h-9 rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            division === d.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {d.label.replace(" División", "").replace("División ", "")}
        </button>
      ))}
    </nav>
  );
  return buscador ? <div className="space-y-2">{buscador}{sueltas}</div> : sueltas;
}


