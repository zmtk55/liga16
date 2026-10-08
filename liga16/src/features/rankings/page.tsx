import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { db } from "@/lib/data";
import type { Match, Team } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MatchCard, PairAvatars, CardShell, CardIdentity, CardStat, CardFooterStrip } from "@/components/cards/card-kit";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sexLabel, sexOptions, winRate } from "@/lib/format";
import { formatMatchDateTime } from "@/lib/format";
import { buzz } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/page-hero";
import { DIVISION_ORDER } from "@/lib/categories";
import { Users, Trophy, Target, ChevronLeft, ChevronRight, Clock, LayoutGrid, BarChart3, List, GitCompare } from "lucide-react";

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
    });
    return () => {
      active = false;
    };
  }, [team]);

  const jugados = matches?.filter((m) => m.status === "finished") ?? [];
  const porJugar = matches?.filter((m) => m.status === "scheduled" || m.status === "live") ?? [];
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
                className="pointer-events-none absolute -right-2 -top-7 select-none font-headline text-7xl leading-none text-white/[0.07]"
              >
                {String(team.position || 0).padStart(2, "0")}
              </span>
              <DialogHeader className="space-y-1.5">
                <DialogTitle className="text-xl font-bold leading-tight">
                  {team.name}
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge className="bg-white text-black hover:bg-white/90">{team.division}</Badge>
                  <Badge variant="outline" className="border-white/25 text-white/90">
                    {sexLabel(team.sex)}
                  </Badge>
                  {team.position > 0 && (
                    <span className="text-xs uppercase tracking-widest text-white/50">
                      #{team.position} de la categoría
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
                  {jugados.length > 0 ? `Resultados · ${idx + 1} de ${jugados.length}` : "Resultados"}
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
                <p className="rounded-xl border border-dashed p-5 text-center text-xs text-muted-foreground">
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
                          "h-2 rounded-full transition-all duration-200",
                          i === idx ? "w-5" : "w-2 opacity-70",
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
                  Por jugar ({porJugar.length})
                </h4>
                <div className="mt-2 flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2">
                  <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">
                      vs {(porJugar[0].side_a.pair_name === team.name ? porJugar[0].side_b : porJugar[0].side_a).pair_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {porJugar[0].scheduled_at ? formatMatchDateTime(porJugar[0].scheduled_at) : "Por agendar"}
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
  // Las pills de división del header (variante "filter", ADR-0009) escriben
  // aquí: el filtro vive en la URL, así que se comparte y sobrevive al ir y
  // venir. Antes vivía en useState y se perdía al cambiar de sección.
  const [params, setParams] = useSearchParams();
  const division = params.get("division") ?? "all";
  const sex = params.get("sex") ?? "all";
  const query = params.get("q") ?? "";
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const setSex = (v: string) => setParam("sex", v);
  const [detail, setDetail] = useState<Team | null>(null);
  const [view, setView] = useState<"table" | "cards" | "chart">("table");
  const [compare, setCompare] = useState<[Team | null, Team | null]>([null, null]);
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    let active = true;
    db.listTeams().then((data) => {
      if (active) setTeams(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!teams) return [] as Team[];
    let list = [...teams];
    if (division !== "all") list = list.filter((t) => t.division === division);
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
        if (a.position !== b.position) return a.position - b.position;
        return b.points - a.points;
      })
      .map((t) => ({ ...t }));
  }, [teams, division, sex, query]);

  return (
    <div className="animate-fade-in space-y-8">
      <PageHero
        eyebrow="Clasificación oficial"
        title="Ranking"
        subtitle="Parejas ordenadas por puntos dentro de su división y género. Gana partidos y sube."
        ghost="16"
        stats={[
          { k: "Parejas", v: teams?.length ?? "…", icon: <Users className="h-4 w-4" /> },
          { k: "División", v: division === "all" ? "Todas" : division, icon: <Trophy className="h-4 w-4" /> },
          { k: "Género", v: sex === "all" ? "Todas" : sexLabel(sex), icon: <Target className="h-4 w-4" /> },
        ]}
      />

      {/* El buscador y las pills de división viven en el header (variante
          "filter", ADR-0009): una sola búsqueda y un solo filtro por sección.
          Aquí queda solo la rama, que el header no lleva. */}
      <div className="relative z-10 -mt-4">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Rama
        </span>
        <ToggleGroup
          type="single"
          value={sex}
          onValueChange={(v) => v && setSex(v)}
          variant="outline"
          size="sm"
          className="w-fit justify-start"
        >
          <ToggleGroupItem value="all">Todas</ToggleGroupItem>
          {sexOptions.filter((s) => s.value !== "all").map((s) => (
            <ToggleGroupItem key={s.value} value={s.value}>{s.label}</ToggleGroupItem>
          ))}
          </ToggleGroup>
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

      {teams === null ? (
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
                    {t.points.toLocaleString("es-MX")}
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
                    <CardStat value={t.points.toLocaleString("es-MX")} label="Puntos" />
                    <CardStat value={`${t.won}–${Math.max(t.lost, 0)}`} label="Record" />
                    <CardStat value={`${winRate(t.played, t.won)}%`} label="Efectiv." />
                  </>
                }
                chip={<Badge variant="outline">{t.division}</Badge>}
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
                  <TableHead className="text-right">Puntos</TableHead>
                  <TableHead className="text-right">Record</TableHead>
                  <TableHead className="text-right">División / Género</TableHead>
                  <TableHead className="hidden items-center gap-2 lg:table-cell">
                    <Users className="h-4 w-4" /> Jugadores
                  </TableHead>
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
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">Toca para ver sus partidos</div>
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
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Users className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {t.player1?.name ?? "—"} / {t.player2?.name ?? "—"}
                        </span>
                      </div>
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
                  <SelectTrigger aria-label={`Pareja ${i + 1}`}>
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
              {[
                ["Posición", (t: Team) => String(t.position || "—")],
                ["Puntos", (t: Team) => t.points.toLocaleString("es-MX")],
                ["Record", (t: Team) => `${t.won}–${Math.max(t.lost, 0)}`],
                ["Efectividad", (t: Team) => `${winRate(t.played, t.won)}%`],
                ["División", (t: Team) => t.division],
                ["Jugadores", (t: Team) => `${t.player1?.name ?? "—"} / ${t.player2?.name ?? "—"}`],
              ].map(([label, fn]) => (
                <div key={label as string} className="contents">
                  <div className="py-1 text-xs text-muted-foreground">{label}</div>
                  {[0, 1].map((i) => (
                    <div key={i} className="py-1 text-sm font-semibold tabular-nums">
                      {(fn as (t: Team) => string)(compare[i]!)}
                    </div>
                  ))}
                </div>
              ))}
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