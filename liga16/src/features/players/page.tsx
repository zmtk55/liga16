import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { db } from "@/lib/data";
import { buildDirectoryStats, type DirStats } from "@/lib/data/record-stats";
import type { PlayerProfile } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlayerCard, PlayerCompactRow } from "@/components/players/player-card";
import { PlayerAvatar } from "@/components/cards/card-image";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHero } from "@/components/page-hero";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { sexLabel, winRate } from "@/lib/format";
import { categoryFacetOfValues } from "@/lib/categories";
import { FilterNav } from "@/components/ui/filter-nav";
import {
  LayoutGrid,
  Rows3,
  Table2,
  X,
  Users,
  Target,
  Medal,
} from "lucide-react";

type View = "grid" | "compact" | "table";

const sortOptions = [
  { value: "victorias", label: "Más victorias" },
  { value: "partidos", label: "Más partidos" },
  { value: "nivel", label: "Mayor nivel" },
  { value: "nombre", label: "Nombre (A–Z)" },
];

function levelOf(p: PlayerProfile): number {
  return p.official_level ?? p.declared_level ?? 0;
}

export default function PlayersPage() {
  // El buscador del header (variante "search", ADR-0009) escribe aquí. La
  // URL manda sobre el useState, o el header escribiría a un sitio y la
  // página leería de otro.
  const [searchParams, setSearchParams] = useSearchParams();
  const [players, setPlayers] = useState<PlayerProfile[] | null>(null);
  const [stats, setStats] = useState<Record<string, DirStats> | null>(null);
  const [divisions, setDivisions] = useState<Record<string, string>>({});
  const query = searchParams.get("q") ?? "";
  const setQuery = (v: string) => {
    const next = new URLSearchParams(searchParams);
    if (!v) next.delete("q");
    else next.set("q", v);
    setSearchParams(next, { replace: true });
  };

  // Filtros y vista
  const [view, setView] = useState<View>("grid");
  const [sex, setSex] = useState("all");
  const [cat, setCat] = useState("all");
  const [sortBy, setSortBy] = useState("victorias");
  const [onlyPlayed, setOnlyPlayed] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([db.listPlayers(), db.listPlayerDivisions()]).then(([list, divs]) => {
      if (!active) return;
      setPlayers(list);
      setDivisions(divs); // categorías REALES: división de la pareja de cada jugador
      // Récord derivado de los partidos reales. Es la ÚNICA fuente de
      // desempeño del jugador: `player_cards` está sin poblar y el ranking por
      // jugador se elimino (ver la nota en `lib/data/provider.ts`).
      buildDirectoryStats(list)
        .then((st) => { if (active) setStats(st); })
        .catch(() => undefined);
    });
    return () => { active = false; };
  }, []);

  /**
   * El filtro de categoría se arma con los datos: las categorías que los
   * torneos registraron de verdad para estos jugadores. Antes era una lista
   * escrita a mano —1ra…Novatos— que ofrecía divisiones que nadie tiene y no
   * ofrecía "Suma 9" ni "Mixtos", que son las que sí hay.
   */
  const catFacets = useMemo(
    () => categoryFacetOfValues((players ?? []).map((p) => divisions[p.id])),
    [players, divisions],
  );
  const sexFacets = useMemo(() => {
    const n = new Map<string, number>();
    for (const p of players ?? []) n.set(p.sex, (n.get(p.sex) ?? 0) + 1);
    return [...n.entries()]
      .map(([key, count]) => ({ key, label: sexLabel(key), n: count }))
      .sort((a, b) => b.n - a.n);
  }, [players]);

  const filtered = useMemo(() => {
    if (!players) return [];
    const q = query.trim().toLowerCase();
    // El récord derivado manda en TODO: antes esta misma página leía `played`/`won`
    // de `player_cards` en la vista tabla y del récord en la vista tarjetas, así
    // que mostraba "0 PJ" y "12-8" para el mismo jugador según dónde miraras.
    const st = (p: PlayerProfile) => stats?.[p.id];
    let list = players.filter((p) => {
      if (q && !p.display_name.toLowerCase().includes(q) && !p.username.toLowerCase().includes(q)) return false;
      if (sex !== "all" && p.sex !== sex) return false;
      if (cat !== "all" && (divisions[p.id] ?? "").toLowerCase() !== cat) return false;
      if (onlyPlayed && !((st(p)?.played ?? 0) > 0)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "nivel":
          return levelOf(b) - levelOf(a);
        case "partidos":
          return (st(b)?.played ?? 0) - (st(a)?.played ?? 0);
        case "nombre":
          return a.display_name.localeCompare(b.display_name, "es");
        default:
          return (st(b)?.won ?? 0) - (st(a)?.won ?? 0);
      }
    });
    return list;
  }, [players, query, sex, cat, sortBy, onlyPlayed, stats, divisions]);

  const hasFilters =
    query.trim() !== "" || sex !== "all" || cat !== "all" || sortBy !== "victorias" || onlyPlayed;

  function clearFilters() {
    setQuery("");
    setSex("all");
    setCat("all");
    setSortBy("victorias");
    setOnlyPlayed(false);
  }

  /** % de victorias sobre el récord derivado. 0 si nunca ha jugado. */
  const winPctOf = (p: PlayerProfile): number => {
    const s = stats?.[p.id];
    return winRate(s?.played ?? 0, s?.won ?? 0);
  };

  return (
    <div className="animate-fade-in space-y-8">
      <PageHero
        title="Jugadores"
        subtitle="El directorio del circuito: nivel, puntos y rumbo al muro de campeones."
        ghost="16"
      />

      {/* El buscador vive en el header (variante "search", ADR-0009). Aquí solo
          lo propio de la sección —la vista—, que no aplica a las demás. */}
      <div className="relative z-10 -mt-4 space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 sm:ml-auto">
            <span className="hidden text-xs uppercase tracking-widest text-muted-foreground md:inline">Vista</span>
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(v) => { if (v) setView(v as View); }}
              variant="outline"
              className="rounded-lg border"
            >
              <ToggleGroupItem value="grid" aria-label="Vista tarjetas" className="px-2.5">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="compact" aria-label="Vista compacta" className="px-2.5">
                <Rows3 className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Vista tabla" className="px-2.5">
                <Table2 className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <FilterNav
            label="Categoría"
            value={cat}
            onChange={setCat}
            options={catFacets.length > 1 ? catFacets : []}
            allLabel="Todas"
            showCount
            className="max-w-2xl"
          />
          <FilterNav
            label="Género"
            value={sex}
            onChange={setSex}
            options={sexFacets.length > 1 ? sexFacets : []}
            showCount
          />

          <div className="flex flex-wrap items-center gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="flex h-9 items-center gap-2 rounded-lg border px-3 text-sm">
              <Switch checked={onlyPlayed} onCheckedChange={setOnlyPlayed} aria-label="Solo con partidos" />
              Solo con partidos
            </label>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X className="h-3.5 w-3.5" /> Limpiar
              </Button>
            )}
          </div>
        </div>
      </div>

      {players === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-lg font-medium">No se encontraron jugadores</p>
            <p className="mt-1">Prueba ajustando los filtros o <Button variant="ghost" size="sm" onClick={clearFilters}>limpiarlos</Button></p>
          </CardContent>
        </Card>
      ) : view === "grid" ? (
        /* ── VISTA TARJETAS ── */
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const st = stats?.[p.id];
            return (
              <PlayerCard
                key={p.id}
                player={p}
                played={st?.played}
                won={st?.won}
                division={divisions[p.id]}
              />
            );
          })}
        </div>
      ) : view === "compact" ? (
        /* ── VISTA COMPACTA ── */
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => {
            const st = stats?.[p.id];
            return (
              <PlayerCompactRow
                key={p.id}
                player={p}
                played={st?.played}
                won={st?.won}
                division={divisions[p.id]}
              />
            );
          })}
        </div>
      ) : (
        /* ── VISTA TABLA ── */
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">#</TableHead>
                  <TableHead>Jugador</TableHead>
                  <TableHead className="hidden md:table-cell">Ciudad</TableHead>
                  <TableHead className="hidden sm:table-cell">Género</TableHead>
                  <TableHead className="hidden sm:table-cell">Cat.</TableHead>
                  <TableHead className="text-right">Nivel</TableHead>
                  <TableHead className="hidden text-right md:table-cell">PJ</TableHead>
                  <TableHead className="hidden text-right md:table-cell">PG</TableHead>
                  <TableHead className="text-right">Efect.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p, i) => {
                  const st = stats?.[p.id];
                  return (
                    <TableRow key={p.id} className="cursor-pointer">
                      <TableCell className="font-medium tabular-nums text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      <TableCell>
                        <Link to={`/jugadores/${p.id}`} className="flex items-center gap-2.5">
                          <PlayerAvatar name={p.display_name} photoUrl={p.photo_url} className="h-8 w-8" />
                          <div className="min-w-0">
                            <div className="font-medium">{p.display_name}</div>
                            <div className="truncate text-xs text-muted-foreground">@{p.username}</div>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{p.city || "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline">
                          {sexLabel(p.sex)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{divisions[p.id] ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{levelOf(p).toFixed(1)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">{st?.played ?? 0}</TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">{st?.won ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{winPctOf(p)}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
