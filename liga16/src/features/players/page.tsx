import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { db } from "@/lib/data";
import type { PlayerProfile, RankingEntry, PlayerCard } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { CardShell, CardIdentity, CardFooterStrip, CardStat } from "@/components/cards/card-kit";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { sexOptions, winRate } from "@/lib/format";
import {
  LayoutGrid,
  Rows3,
  Table2,
  Search,
  X,
  Users,
  Target,
  Medal,
} from "lucide-react";

type View = "grid" | "compact" | "table";

const catOptions = [
  { value: "all", label: "Todas las categorías" },
  ...["1ra", "2da", "3ra", "4ta", "5ta", "6ta", "Novatos"].map((c) => ({
    value: c,
    label: c,
  })),
];

const sortOptions = [
  { value: "puntos", label: "Más puntos" },
  { value: "nivel", label: "Mayor nivel" },
  { value: "victorias", label: "Más victorias" },
  { value: "nombre", label: "Nombre (A–Z)" },
];

function levelOf(p: PlayerProfile): number {
  return p.official_level ?? p.declared_level ?? 0;
}

export default function PlayersPage() {
  const [searchParams] = useSearchParams();
  const [players, setPlayers] = useState<PlayerProfile[] | null>(null);
  const [rankings, setRankings] = useState<RankingEntry[] | null>(null);
  const [cards, setCards] = useState<Record<string, PlayerCard> | null>(null);
  const [divisions, setDivisions] = useState<Record<string, string>>({});
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  // Filtros y vista
  const [view, setView] = useState<View>("grid");
  const [sex, setSex] = useState("all");
  const [cat, setCat] = useState("all");
  const [sortBy, setSortBy] = useState("puntos");
  const [onlyRanked, setOnlyRanked] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([db.listPlayers(), db.listRankings(), db.listPlayerDivisions()]).then(async ([list, rks, divs]) => {
      if (!active) return;
      setPlayers(list);
      setRankings(rks);
      const byId: Record<string, PlayerCard> = {};
      await Promise.all(list.map(async (p) => {
        const c = await db.getPlayerCard(p.id);
        if (c) byId[p.id] = c;
      }));
      if (active) {
        setCards(byId);
        setDivisions(divs); // categorías REALES: división de la pareja de cada jugador
      }
    });
    return () => { active = false; };
  }, []);

  const rankById = useMemo(() => {
    if (!rankings) return new Map<string, RankingEntry>();
    return new Map(rankings.map((r) => [r.player_id, r]));
  }, [rankings]);

  const filtered = useMemo(() => {
    if (!players) return [];
    const q = query.trim().toLowerCase();
    let list = players.filter((p) => {
      if (q && !p.display_name.toLowerCase().includes(q) && !p.username.toLowerCase().includes(q)) return false;
      if (sex !== "all" && p.sex !== sex) return false;
      if (cat !== "all" && divisions[p.id] !== cat) return false;
      if (onlyRanked && !rankById.has(p.id)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      const ra = rankById.get(a.id);
      const rb = rankById.get(b.id);
      switch (sortBy) {
        case "nivel":
          return levelOf(b) - levelOf(a);
        case "victorias":
          return (rb?.won ?? -1) - (ra?.won ?? -1);
        case "nombre":
          return a.display_name.localeCompare(b.display_name, "es");
        default:
          return (rb?.points ?? -1) - (ra?.points ?? -1);
      }
    });
    return list;
  }, [players, query, sex, cat, sortBy, onlyRanked, rankById, divisions]);

  const hasFilters =
    query.trim() !== "" || sex !== "all" || cat !== "all" || sortBy !== "puntos" || onlyRanked;

  function clearFilters() {
    setQuery("");
    setSex("all");
    setCat("all");
    setSortBy("puntos");
    setOnlyRanked(false);
  }

  const winPctOf = (p: PlayerProfile): number => {
    const rk = rankById.get(p.id);
    return winRate(rk?.played ?? 0, rk?.won ?? 0);
  };

  return (
    <div className="animate-fade-in space-y-8">
      <PageHero
        eyebrow="La comunidad"
        title="Jugadores"
        subtitle="El directorio del circuito: nivel, puntos y rumbo al muro de campeones."
        ghost="16"
        stats={[
          { k: "Jugadores", v: players?.length ?? "…", icon: <Users className="h-4 w-4" /> },
          { k: "Rankeados", v: rankings?.length ?? "…", icon: <Medal className="h-4 w-4" /> },
          { k: "En vista", v: players ? filtered.length : "…", icon: <Target className="h-4 w-4" /> },
        ]}
      />

      {/* Barra de filtros y vistas */}
      <div className="relative z-10 -mt-4 space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
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

        <div className="flex flex-wrap items-center gap-2">
          <Select value={sex} onValueChange={setSex}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Rama" />
            </SelectTrigger>
            <SelectContent>
              {sexOptions.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              {catOptions.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

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
            <Switch checked={onlyRanked} onCheckedChange={setOnlyRanked} aria-label="Solo rankeados" />
            Solo rankeados
          </label>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
              <X className="h-3.5 w-3.5" /> Limpiar
            </Button>
          )}
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
            const rk = rankById.get(p.id);
            const card = cards?.[p.id];
            return (
              <Link key={p.id} to={`/jugadores/${p.id}`} className="group block focus:outline-none">
                <CardShell accent className="h-full">
                  <CardContent className="p-4">
                    <CardIdentity
                      lead={<PlayerAvatar name={p.display_name} photoUrl={p.photo_url} className="h-11 w-11" />}
                      title={p.display_name}
                      meta={
                        [p.city || "", divisions[p.id]]
                          .filter(Boolean)
                          .join(" · ") || undefined
                      }
                      end={
                        rk && rk.position <= 3 ? (
                          <Badge className="shrink-0">#{rk.position}</Badge>
                        ) : rk ? (
                          <Badge variant="secondary" className="shrink-0">#{rk.position}</Badge>
                        ) : undefined
                      }
                    />
                  </CardContent>
                  <CardFooterStrip
                    stats={
                      <>
                        <CardStat value={levelOf(p).toFixed(1)} label="Nivel" />
                        <CardStat value={rk ? rk.points.toLocaleString("es-MX") : "—"} label="Puntos" />
                        <CardStat value={card && card.played > 0 ? `${card.won}–${card.played - card.won}` : "—"} label="Récord" />
                      </>
                    }
                  />
                </CardShell>
              </Link>
            );
          })}
        </div>
      ) : view === "compact" ? (
        /* ── VISTA COMPACTA ── */
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => {
            const rk = rankById.get(p.id);
            return (
              <Link
                key={p.id}
                to={`/jugadores/${p.id}`}
                className="group flex items-center gap-2.5 rounded-xl border bg-card p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
              >
                <PlayerAvatar name={p.display_name} photoUrl={p.photo_url} className="h-9 w-9 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold leading-tight">{p.display_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {rk ? `${rk.points.toLocaleString("es-MX")} pts · ${winPctOf(p)}%` : `${levelOf(p).toFixed(1)} lvl`}
                  </p>
                </div>
                {rk && rk.position <= 3 && (
                  <span className="shrink-0 text-sm tabular-nums font-bold text-primary">#{rk.position}</span>
                )}
              </Link>
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
                  <TableHead className="hidden sm:table-cell">Rama</TableHead>
                  <TableHead className="hidden sm:table-cell">Cat.</TableHead>
                  <TableHead className="text-right">Nivel</TableHead>
                  <TableHead className="text-right">Puntos</TableHead>
                  <TableHead className="hidden text-right md:table-cell">PJ</TableHead>
                  <TableHead className="hidden text-right md:table-cell">PG</TableHead>
                  <TableHead className="text-right">Efect.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const rk = rankById.get(p.id);
                  return (
                    <TableRow key={p.id} className="cursor-pointer">
                      <TableCell className="font-medium">
                        {rk ? rk.position : "—"}
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
                          {sexOptions.find((s) => s.value === p.sex)?.label ?? p.sex}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{divisions[p.id] ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{levelOf(p).toFixed(1)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {rk ? rk.points.toLocaleString("es-MX") : "—"}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">{rk?.played ?? 0}</TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">{rk?.won ?? 0}</TableCell>
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
