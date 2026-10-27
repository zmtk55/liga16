import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { db } from "@/lib/data";
import { useMatchUpdated } from "@/lib/refresh";
import type { Match, Team } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MatchCard, PairAvatars, CardShell, CardIdentity, CardStat, CardFooterStrip } from "@/components/cards/card-kit";
import { matchStatusKey } from "@/lib/match-state";
import { sexLabel, winRate } from "@/lib/format";
import { formatMatchDateTime } from "@/lib/format";
import { buzz } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/page-hero";
import { FilterMenu } from "@/components/ui/filter-menu";
import {
  DIVISION_ORDER,
  categoryFacet,
  teamCategoryKey,
} from "@/lib/categories";
import { tournamentOptions, tournamentTeams } from "@/lib/tournament-ranking";
import { orderText } from "@/lib/qualification-sim";
import { Users, Trophy, ChevronLeft, ChevronRight, Clock, LayoutGrid, BarChart3, List, GitCompare } from "lucide-react";

/**
 * Popup de pareja: cabecera póster + stats + UN partido a la vez con flechas.
 * Cero scroll interno: cada partido se lee completo y se navega con taps.
 */
function TeamDetailDialog({ team, onClose }: { team: Team | null; onClose: () => void }) {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [idx, setIdx] = useState(0);
  // Reinicio por evento: al cambiar de pareja el estado vuelve a 0 sin setState en el efecto.

  useEffect(() => {
    if (!team) return;
    let active = true;
    db.listRecentMatches().then((ms) => {
      if (!active) return;
      setMatches(
        ms
          .filter((m) => m.side_a.pair_name === team.name || m.side_b.pair_name === team.name)
          .sort((a, b) => String(a.scheduled_at ?? "").localeCompare(String(b.scheduled_at ?? ""))),
      );
    })
      .catch(() => {
        if (active) setMatches([]);
      });
    return () => {
      active = false;
    };
  }, [team]);

  const jugados = matches?.filter((m) => matchStatusKey(m) === "finished") ?? [];
  const porJugar = matches?.filter((m) => matchStatusKey(m) === "scheduled" || matchStatusKey(m) === "live") ?? [];
  const current = jugados[Math.min(idx, Math.max(jugados.length - 1, 0))] ?? null;
  const won = current ? (current.side_a.pair_name === team?.name ? current.winner === "a" : current.winner === "b") : false;

  return (
    <Dialog open={!!team} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-sm overflow-hidden p-0 sm:max-w-md" showCloseButton>
        {team && (
          <div className="flex flex-col">
            {/* ── Cabecera estilo póster ── */}
            <div className="relative overflow-hidden bg-surface-inverse px-5 pb-4 pt-5 text-white">
              <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-primary" />
              <span
                aria-hidden
                className="pointer-events-none absolute -right-2 -top-7 select-none font-headline text-6xl leading-none text-white/[0.07]"
              >
                {String(team.position || 0).padStart(2, "0")}
              </span>
              <DialogHeader className="space-y-1.5">
                <DialogTitle className="text-lg font-bold leading-tight">
                  {team.name}
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="border-white/25 bg-white/10 text-white/90">
                    {team.division}
                  </Badge>
                  <Badge variant="outline" className="border-white/25 bg-white/10 text-white/90">
                    {sexLabel(team.sex)}
                  </Badge>
                  {team.position > 0 && (
                    <span className="text-2xs uppercase tracking-widest text-white/50">
                      #{team.position}
                    </span>
                  )}
                </div>
              </DialogHeader>

              <div className="mt-3 grid grid-cols-3 divide-x divide-white/10 rounded-xl border border-white/10 bg-white/[0.04]">
                {[
                  { k: "Puntos", v: team.points.toLocaleString("es-MX") },
                  { k: "Récord", v: `${team.won}–${team.lost}` },
                  { k: "Efect.", v: `${winRate(team.played, team.won)}%` },
                ].map((s) => (
                  <div key={s.k} className="px-2 py-1.5 text-center">
                    <p className="text-lg font-extrabold leading-none tabular-nums">{s.v}</p>
                    <p className="text-xs uppercase tracking-widest text-white/50">{s.k}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Un partido a la vez: sin scroll, con flechas ── */}
            <div className="px-5 py-4">
              <div className="mb-2 flex items-center justify-between gap-2">
<h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                   Partidos · {idx + 1} de {jugados.length}
                 </h4>
                {jugados.length > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Partido anterior"
                      disabled={idx === 0}
                      onClick={() => {
                        buzz("tap");
                        setIdx((i) => Math.max(0, i - 1));
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Partido siguiente"
                      disabled={idx >= jugados.length - 1}
                      onClick={() => {
                        buzz("tap");
                        setIdx((i) => Math.min(jugados.length - 1, i + 1));
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {matches === null ? (
                <Skeleton className="h-28 w-full" />
              ) : jugados.length === 0 ? (
                 <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                   Aún no juegan partidos.
                 </p>
              ) : current ? (
                <MatchCard
                  key={current.id}
                  match={current}
                  className="animate-fade-in"
                  footer={
                    <Badge
                      className={cn(
                        won
                          ? "bg-success text-success-foreground hover:bg-success"
                          : "bg-destructive/15 text-destructive hover:bg-destructive/15",
                      )}
                    >
                      {won ? "Victoria" : "Derrota"}
                    </Badge>
                  }
                />
              ) : null}

              {/* Puntos de navegación: verde = ganado, rojo = perdido */}
              {jugados.length > 1 && (
                <div className="mt-3 flex justify-center gap-1.5">
                  {jugados.map((m, i) => {
                    const w = m.side_a.pair_name === team.name ? m.winner === "a" : m.winner === "b";
                    return (
                       <button
                         key={m.id}
                         type="button"
                         aria-label={`Ver partido ${i + 1}`}
                         onClick={() => {
                           buzz("tap");
                           setIdx(i);
                         }}
                         className={cn(
                           "h-1.5 rounded-full transition-all duration-200",
                           i === idx ? "w-4" : "w-1.5 opacity-70",
                           w ? "bg-success" : "bg-destructive/60",
                         )}
                       />
                    );
                  })}
                </div>
              )}
            </div>

{/* ── Próximo partido, sin lista larga ── */}
            {porJugar.length > 0 && (
              <div className="border-t px-5 py-3">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Próximo ({porJugar.length})
                </h4>
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">
                      vs {(porJugar[0].side_a.pair_name === team.name ? porJugar[0].side_b : porJugar[0].side_a).pair_name}
                    </p>
                    <p className="text-2xs text-muted-foreground">
                      {porJugar[0].scheduled_at ? formatMatchDateTime(porJugar[0].scheduled_at) : "Sin horario"}
                    </p>
                  </div>
                  {porJugar.length > 1 && (
                    <Badge variant="outline" className="shrink-0">
                      +{porJugar.length - 1} más
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function RankingsPage() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  // Los filtros viven en la URL, así que se comparten y sobreviven al ir y
  // venir. Antes el de división lo escribía el header con una lista fija; ahora
  // la barra de la página los arma con los datos reales.
  const [params, setParams] = useSearchParams();
  const categoria = params.get("categoria") ?? "all";
  const sex = params.get("sex") ?? "all";
  const query = params.get("q") ?? "";
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const setSex = (v: string) => setParam("sex", v);
  const torneo = params.get("torneo") ?? "all";
  const [allMatches, setAllMatches] = useState<Match[] | null>(null);
  // Los partidos solo se piden cuando se elige un torneo: el ranking global no los necesita.
  useEffect(() => {
    if (torneo === "all") return;
    let active = true;
    db.listRecentMatches().then((m) => active && setAllMatches(m)).catch(() => active && setAllMatches([]));
    return () => {
      active = false;
    };
  }, [torneo]);
  const [detail, setDetail] = useState<Team | null>(null);
  const [view, setView] = useState<"table" | "cards" | "chart">("table");
  const [compare, setCompare] = useState<[Team | null, Team | null]>([null, null]);
  const [compareOpen, setCompareOpen] = useState(false);

  // El ranking se deriva de los partidos: si se guarda un resultado, la tabla
  // se recalcula sola sin que haya que recargar la página a mano.
  useMatchUpdated(() => {
    db.listTeams()
      .then((data) => setTeams(data))
      .catch(() => setTeams([]));
  });

  useEffect(() => {
    let active = true;
    // Sin `catch`, cualquier fallo de red o de RLS dejaba la página en
    // esqueletos para siempre, sin error ni reintento.
    db.listTeams()
      .then((data) => {
        if (active) setTeams(data);
      })
      .catch(() => {
        if (active) setTeams([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const torneos = useMemo(() => tournamentOptions(teams ?? []), [teams]);
  const torneoSel = torneos.find((t) => t.id === torneo) ?? null;
  const torneoEntry = torneoSel
    ? (teams ?? []).flatMap((t) => t.entries ?? []).find((e) => e.tournament_id === torneoSel.id)
    : undefined;
  const torneoOrder = torneoEntry?.scoring?.rank_order?.length ? torneoEntry.scoring.rank_order : undefined;
  const base = useMemo(() => {
    if (!teams) return null;
    if (!torneoSel) return teams;
    return allMatches ? tournamentTeams(teams, allMatches, torneoSel.id) : null;
  }, [teams, torneoSel, allMatches]);

  const filtered = useMemo(() => {
    if (!base) return [] as Team[];
    let list = [...base];
    if (categoria !== "all") list = list.filter((t) => teamCategoryKey(t) === categoria);
    if (sex !== "all") list = list.filter((t) => t.sex === sex);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          [t.player1?.name, t.player2?.name].some((n) => n && n.toLowerCase().includes(q)),
      );
    }
    return list
      .sort((a, b) => {
        // Primero por división, luego por posición, luego por puntos
        const da = DIVISION_ORDER.indexOf(a.division);
        const db_ = DIVISION_ORDER.indexOf(b.division);
        if (da !== db_) return da - db_;
        // Quien no ha jugado va AL FINAL de su división. `position` es 0 para
        // las parejas sin partidos, y 0 < 1 las ponía ARRIBA de las líderes: la
        // tabla empezaba por filas con «—» y 0 puntos mientras el gráfico y las
        // cards de abajo las trataban como no clasificadas.
        const pa = a.position === 0 ? Number.MAX_SAFE_INTEGER : a.position;
        const pb = b.position === 0 ? Number.MAX_SAFE_INTEGER : b.position;
        if (pa !== pb) return pa - pb;
        return b.points - a.points;
      })
      .map((t) => ({ ...t }));
  }, [base, categoria, sex, query]);

  /** Categorías y ramas que existen de verdad, no el catálogo de la BD. */
  const categorias = useMemo(() => categoryFacet(teams ?? []), [teams]);
  const ramas = useMemo(() => {
    const n = new Map<string, number>();
    for (const t of teams ?? []) n.set(t.sex, (n.get(t.sex) ?? 0) + 1);
    return [...n.entries()]
      .map(([key, count]) => ({ key, label: sexLabel(key), n: count }))
      .sort((a, b) => b.n - a.n);
  }, [teams]);
  return (
    <div className="animate-fade-in space-y-8">
      <PageHero
        title="Ranking"
        subtitle="Parejas ordenadas dentro de su división y género: primero partidos ganados, luego dominio (el enfrentamiento directo) y luego % de puntos; después diferencia de sets y partidos jugados. Es el ranking general del circuito; cada torneo puede usar otro orden en su clasificación."
        ghost="16"
      />

      {/* El buscador vive en el header (ADR-0009). Los filtros van aquí porque
          se arman con los equipos cargados: las categorías que existen de
          verdad —"Suma 9", "Mixtos"— y solo esas. */}
      <div className="relative z-10 -mt-4 flex flex-wrap items-center gap-2">
        <FilterMenu
          label="Torneo"
          value={torneoSel ? torneoSel.id : "all"}
          onChange={(v) => {
            setAllMatches(null);
            setParam("torneo", v);
          }}
          options={torneos.map((t) => ({ key: t.id, label: t.name, count: t.n }))}
          allLabel="Global (orden general)"
          showCount
        />
        <FilterMenu
          label="Categoría"
          value={categoria}
          onChange={(v) => setParam("categoria", v)}
          options={categorias.length > 1 ? categorias : []}
          showCount
        />
        <FilterMenu
          label="Rama"
          value={sex}
          onChange={setSex}
          options={ramas.length > 1 ? ramas : []}
          showCount
        />
      </div>

      {/* Selector de vista: tabla · cards · gráfico, y comparar 2 parejas */}
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as typeof view)}
          variant="outline"
          size="sm"
          className="w-fit justify-start"
        >
          <ToggleGroupItem value="table"><List className="h-4 w-4" /> Tabla</ToggleGroupItem>
          <ToggleGroupItem value="cards"><LayoutGrid className="h-4 w-4" /> Cards</ToggleGroupItem>
          <ToggleGroupItem value="chart"><BarChart3 className="h-4 w-4" /> Gráfico</ToggleGroupItem>
        </ToggleGroup>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCompareOpen(true)}
          disabled={!compare[0] && !compare[1]}
        >
          <GitCompare className="h-4 w-4" /> Comparar {compare[0] && compare[1] ? "✓" : ""}
        </Button>
      </div>

      <p className="-mt-4 text-xs text-muted-foreground">
        {torneoSel
          ? `Clasificación de ${torneoSel.name} · orden: ${orderText(torneoOrder)}. Solo fase de grupos; las bajas no ocupan posición.`
          : "Ranking global: orden general (partidos ganados, dominio, puntos), sin reglas propias de ningún torneo. Elige un torneo para ver su clasificación con su orden."}
      </p>
      {teams === null || (torneoSel && base === null) ? (
        <Skeleton className="h-96 w-full" />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-lg font-medium">No hay equipos en esta división</p>
            <p className="mt-1">Prueba cambiando la división o el género.</p>
          </CardContent>
        </Card>
      ) : view === "chart" ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            {filtered.map((t) => {
              const max = Math.max(...filtered.map((x) => x.points), 1);
              const pct = Math.max((t.points / max) * 100, 4);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { buzz("tap"); setDetail(t); }}
                  className="group flex w-full items-center gap-3 rounded-lg px-2 py-1 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="w-6 shrink-0 text-sm font-bold tabular-nums text-muted-foreground">
                    {t.position > 0 ? t.position : "—"}
                  </span>
                  <span className="w-36 shrink-0 truncate text-sm font-medium">{t.name}</span>
                  <div className="relative h-6 min-w-0 flex-1 overflow-hidden rounded-md bg-muted">
                    <div
                      className="h-full rounded-md bg-primary/80 transition-all group-hover:bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums">
                    {t.points.toLocaleString("es-MX")}%
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      ) : view === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <CardShell key={t.id} accent>
              <CardContent className="p-4">
                <CardIdentity
                  lead={<PairAvatars names={[t.player1?.name, t.player2?.name]} size="sm" />}
                  titleLines={[t.name].filter(Boolean)}
                  meta={`${t.division} · ${sexLabel(t.sex)}`}
                  end={
                    <span className="text-2xl font-extrabold tabular-nums text-muted-foreground">
                      {t.position > 0 ? t.position : "—"}
                    </span>
                  }
                />
                <div className="mt-3 flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setCompare((c) => [c[0] ? c[0] : t, c[1]]);
                      setCompareOpen(true);
                    }}
                  >
                    <GitCompare className="h-3 w-3" /> Comparar
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { buzz("tap"); setDetail(t); }}>
                    Partidos
                  </Button>
                </div>
              </CardContent>
              <CardFooterStrip
                stats={
                  <>
                    <CardStat value={t.points.toLocaleString("es-MX")} label="% Puntos" />
                    <CardStat value={`${t.won}–${Math.max(t.lost, 0)}`} label="Record" />
                    <CardStat value={`${winRate(t.played, t.won)}%`} label="Efect." />
                  </>
                }
              />
            </CardShell>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">#</TableHead>
                  <TableHead className="flex items-center gap-2">
                    <Trophy className="h-4 w-4" /> Pareja
                  </TableHead>
                  <TableHead className="text-right" title="Puntos ganados sobre el total de puntos jugados (fórmula del Excel Liga16)">% Puntos</TableHead>
                  <TableHead className="text-right">Record</TableHead>
                  <TableHead className="text-right">División / Género</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow
                    key={t.id}
                    onClick={() => {
                      buzz("tap");
                      setDetail(t);
                    }}
                    className="cursor-pointer transition-colors hover:bg-muted/40"
                  >
                    <TableCell className="text-xl font-extrabold tabular-nums text-muted-foreground">
                      {t.position > 0 ? t.position : "—"}
                      {t.tied && (
                        <Badge
                          variant="outline"
                          className="ml-1.5 align-middle text-2xs"
                          title="Empatada en posición: mismo % de puntos, sets, PG y PJ"
                        >
                          Empate
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{t.name}</div>
                      {/* Los nombres de los jugadores ya viven en `t.name` ("Fuentes /
                          Rojas"), por eso la columna "Jugadores" se quitó: repetía
                          exactamente lo mismo que la columna "Pareja". */}
                      <div className="text-xs text-muted-foreground">
                        {t.player1?.name || t.player2?.name
                          ? `${t.player1?.name ?? "—"} / ${t.player2?.name ?? "—"}`
                          : "Toca para ver sus partidos"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {t.points.toLocaleString("es-MX")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.won}–{Math.max(t.lost, 0)}
                      <div className="text-xs text-muted-foreground">
                        {winRate(t.played, t.won)}% de efectividad
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{t.division}</Badge>
                      <Badge variant="secondary" className="ml-1">
                        {sexLabel(t.sex)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <TeamDetailDialog team={detail} onClose={() => setDetail(null)} />

      {/* Comparar 2 parejas lado a lado */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5" /> Comparar parejas
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <div className="grid grid-cols-2 gap-2">
              {[0, 1].map((i) => (
                <Select
                  key={i}
                  value={compare[i]?.id ?? "__none__"}
                  onValueChange={(v) =>
                    setCompare((c) => {
                      const next: [Team | null, Team | null] = [c[0], c[1]];
                      next[i] = filtered.find((t) => t.id === v) ?? null;
                      return next;
                    })
                  }
                >
                  <SelectTrigger aria-label={`Pareja ${i + 1}`} className="rounded-md border border-border bg-card text-foreground focus:border-[#d97706] focus:ring-0 focus:outline-none">
                    <SelectValue placeholder={`Pareja ${i + 1}`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {filtered.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}
            </div>
          </div>
          {compare[0] && compare[1] && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div />
              {[0, 1].map((i) => (
                <div key={i} className="font-semibold">{compare[i]?.name}</div>
              ))}
              {(() => {
                const records: [string, (t: Team) => string][] = [
                  ["Posición", (t: Team) => String(t.position || "—")],
                  ["Puntos", (t: Team) => t.points.toLocaleString("es-MX")],
                  ["Record", (t: Team) => `${t.won}–${Math.max(t.lost, 0)}`],
                  ["Efectividad", (t: Team) => `${winRate(t.played, t.won)}%`],
                  ["División", (t: Team) => t.division],
                  ["Jugadores", (t: Team) => `${t.player1?.name ?? "—"} / ${t.player2?.name ?? "—"}`],
                ];
                return records.map(([label, fn]) => (
                  <div key={label} className="contents">
                    <div className="py-1 text-xs text-muted-foreground">{label}</div>
                    {[0, 1].map((i) => (
                      <div key={i} className="py-1 text-sm font-semibold tabular-nums">
                        {fn(compare[i]!)}
                      </div>
                    ))}
                  </div>
                ));
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompareOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
