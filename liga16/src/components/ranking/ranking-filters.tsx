import { Mars, Search, UsersRound, Venus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { divisionOptions, sexOptions } from "@/lib/format";

const SEX_ICON: Record<string, React.ReactNode> = {
  M: <Mars className="h-3.5 w-3.5" />,
  F: <Venus className="h-3.5 w-3.5" />,
  X: <UsersRound className="h-3.5 w-3.5" />,
};

/**
 * Navegación del ranking: buscador + divisiones + rama, en una sola fila.
 *
 * Se usa ToggleGroup (y no dos <Select>) porque el filtro se elige a ojo y se
 * cambia varias veces: un desplegable esconde el resto de opciones y obliga a
 * dos clics por filtro. Con botones se ve todo y se llega en uno.
 */
export function RankingFilters({
  search,
  onSearch,
  division,
  onDivision,
  sex,
  onSex,
  placeholder = "Buscar pareja…",
  className,
}: {
  search: string;
  onSearch: (v: string) => void;
  division: string;
  onDivision: (v: string) => void;
  sex: string;
  onSex: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="pl-9"
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          División
        </p>
        {/* En móvil la fila se desliza en vez de partirse en tres líneas */}
        <ToggleGroup
          type="single"
          value={division}
          onValueChange={(v) => v && onDivision(v)}
          variant="outline"
          size="sm"
          className="h-auto w-full justify-start overflow-x-auto rounded-lg p-0.5"
        >
          {[{ value: "all", label: "Todas" }, ...divisionOptions.filter((d) => d.value !== "all")].map((d) => (
            <ToggleGroupItem key={d.value} value={d.value} className="shrink-0">
              {d.label.replace(" División", "").replace("División ", "")}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Rama
        </p>
        <ToggleGroup
          type="single"
          value={sex}
          onValueChange={(v) => v && onSex(v)}
          variant="outline"
          size="sm"
          className="h-auto w-full justify-start rounded-lg p-0.5"
        >
          <ToggleGroupItem value="all" className="shrink-0">Todas</ToggleGroupItem>
          {sexOptions.filter((s) => s.value !== "all").map((s) => (
            <ToggleGroupItem key={s.value} value={s.value} className="shrink-0 gap-1.5">
              {SEX_ICON[s.value]}
              {s.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
}