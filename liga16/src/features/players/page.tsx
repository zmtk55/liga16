import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { db } from "@/lib/data";
import type { PlayerProfile, RankingEntry, PlayerCard } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/cards/card-image";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
  Trophy,
  TrendingUp,
  X,
  Users,
  Target,
  Medal,
} from "lucide-react";

type View = "grid" | "compact" | "table";

const handLabel: Record<PlayerProfile["dominant_hand"], string> = {
  right: "Diestro",
  left: "Zurdo",
  both: "Ambidiestro",
};

const positionLabel: Record<PlayerProfile["preferred_position"], string> = {
  drive: "Drive",
  reves: "Revés",
  both: "Ambos",
};

/** Categoría cerrada a partir del nivel (4.7 → 4ta). Igual que en detalle de equipo. */
function categoriaDeNivel(lvl: number | null | undefined): string {
  const l = lvl ?? 0;
  if (l >= 6) return "1ra";
  if (l >= 5.5) return "2da";
  if (l >= 5) return "3ra";
  if (l >= 4.5) return "4ta";
  if (l >= 4) return "5ta";
  if (l >= 3.5) return "6ta";
  return "Novatos";
}

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
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  // Filtros y vista
  const [view, setView] = useState<View>("grid");
  const [sex, setSex] = useState("all");
  const [cat, setCat] = useState("all");
  const [sortBy, setSortBy] = useState("puntos");
  const [onlyRanked, setOnlyRanked] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([db.listPlayers(), db.listRankings()]).then(async ([list, rks]) => {
      if (!active) return;
      setPlayers(list);
      setRankings(rks);
      const byId: Record<string, PlayerCard> = {};
      await Promise.all(list.map(async (p) => {
        const c = await db.getPlayerCard(p.id);
        if (c) byId[p.id] = c;
      }));
      if (active) setCards(byId);
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
      if (cat !== "all" && categoriaDeNivel(levelOf(p)) !== cat) return false;
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
  }, [players, query, sex, cat, sortBy, onlyRanked, rankById]);

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const rk = rankById.get(p.id);
            const card = cards?.[p.id];
            const winPct = card && card.played ? Math.round((card.won / card.played) * 100) : 0;
            return (
              <Link key={p.id} to={`/jugadores/${p.id}`} className="group">
                <Card className="h-full transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
                    <PlayerAvatar
                      name={p.display_name}
                      photoUrl={p.photo_url}
                      className="h-12 w-12"
                    />
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-base leading-tight">{p.display_name}</CardTitle>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        {p.city || "—"} · {categoriaDeNivel(levelOf(p))}
                      </p>
                    </div>
                    {rk && (
                      <Badge variant={rk.position <= 3 ? "default" : "secondary"} className="shrink-0">#{rk.position}</Badge>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-muted p-2">
                        <p className="text-[11px] text-muted-foreground">Nivel</p>
                        <p className="font-bold">{levelOf(p).toFixed(1)}</p>
                      </div>
                      <div className="rounded-lg bg-primary/10 p-2">
                        <p className="text-[11px] text-muted-foreground">Puntos</p>
                        <p className="font-bold">{rk ? rk.points.toLocaleString("es-MX") : "—"}</p>
                      </div>
                      <div className="rounded-lg bg-amber-500/10 p-2">
                        <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-0.5"><Trophy className="h-3 w-3" /> Títulos</p>
                        <p className="font-bold">{card?.titles ?? 0}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {card ? `${card.won}/${card.played} ganados` : "Sin datos"}</span>
                        <span>{winPct}%</span>
                      </div>
                      <Progress value={winPct} className="h-1.5" />
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="text-xs">{handLabel[p.dominant_hand]}</Badge>
                      <Badge variant="outline" className="text-xs">{positionLabel[p.preferred_position]}</Badge>
                      {card?.partner && <Badge variant="secondary" className="text-xs">con {card.partner.split(" ")[0]}</Badge>}
                    </div>
                    {rk && <p className="text-xs text-muted-foreground">{rk.played} PJ · {rk.won} PG · Δ {rk.delta > 0 ? `+${rk.delta}` : rk.delta}</p>}
                  </CardContent>
                </Card>
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
                  <span className="shrink-0 font-display text-sm tabular-nums text-primary">#{rk.position}</span>
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
                      <TableCell className="hidden sm:table-cell">{categoriaDeNivel(levelOf(p))}</TableCell>
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
