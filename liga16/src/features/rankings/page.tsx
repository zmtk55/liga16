import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/data";
import type { Match, Team } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MatchScoreboard } from "@/components/match-scoreboard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { divisionOptions, sexLabel, sexOptions, winRate } from "@/lib/format";
import { formatMatchDateTime } from "@/lib/format";
import { buzz } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/page-hero";
import { Users, Trophy, Target, ChevronLeft, ChevronRight, Clock } from "lucide-react";

/**
 * Popup de pareja: cabecera póster + stats + UN partido a la vez con flechas.
 * Cero scroll interno: cada partido se lee completo y se navega con taps.
 */
function TeamDetailDialog({ team, onClose }: { team: Team | null; onClose: () => void }) {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!team) return;
    let active = true;
    setMatches(null);
    setIdx(0);
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
            <div className="relative overflow-hidden bg-[#141414] px-5 pb-4 pt-5 text-white">
              <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-primary" />
              <span
                aria-hidden
                className="pointer-events-none absolute -right-2 -top-7 select-none font-display text-7xl leading-none text-white/[0.07]"
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
                    <span className="text-[10px] uppercase tracking-widest text-white/50">
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
                    <p className="text-[9px] uppercase tracking-widest text-white/50">{s.k}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Un partido a la vez: sin scroll, con flechas ── */}
            <div className="px-5 py-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
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
                <div className="animate-fade-in rounded-2xl border bg-card p-4" key={current.id}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <Badge
                      className={cn(
                        won ? "bg-emerald-600 text-white hover:bg-emerald-600" : "bg-rose-500/15 text-rose-600 hover:bg-rose-500/15 dark:text-rose-400",
                      )}
                    >
                      {won ? "Victoria" : "Derrota"}
                    </Badge>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {current.round ? `${current.round} · ` : ""}
                      {current.tournament_name ?? "Liga16"}
                    </span>
                  </div>
                  <MatchScoreboard
                    sideA={current.side_a.pair_name}
                    sideB={current.side_b.pair_name}
                    sets={current.sets}
                    winner={current.winner}
                    status={current.status}
                    size="md"
                    className="w-full"
                  />
                  <p className="mt-3 text-center text-[11px] text-muted-foreground">
                    {current.scheduled_at ? formatMatchDateTime(current.scheduled_at) : ""}
                  </p>
                </div>
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
                          w ? "bg-emerald-500" : "bg-rose-400",
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
                <h4 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Por jugar ({porJugar.length})
                </h4>
                <div className="mt-2 flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2">
                  <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">
                      vs {(porJugar[0].side_a.pair_name === team.name ? porJugar[0].side_b : porJugar[0].side_a).pair_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
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
  const [division, setDivision] = useState("all");
  const [sex, setSex] = useState("all");
  const [detail, setDetail] = useState<Team | null>(null);

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
    return list
      .sort((a, b) => {
        // Primero por división, luego por posición, luego por puntos
        const divOrder = ["1ra", "2da", "3ra", "4ta", "5ta", "6ta", "Novatos"];
        const da = divOrder.indexOf(a.division);
        const db_ = divOrder.indexOf(b.division);
        if (da !== db_) return da - db_;
        if (a.position !== b.position) return a.position - b.position;
        return b.points - a.points;
      })
      .map((t) => ({ ...t }));
  }, [teams, division, sex]);

  return (
    <div className="animate-fade-in space-y-8">
      <PageHero
        eyebrow="Clasificación oficial"
        title="Ranking"
        subtitle="Parejas ordenadas por puntos dentro de su división y rama. Gana partidos y sube."
        ghost="16"
        stats={[
          { k: "Parejas", v: teams?.length ?? "…", icon: <Users className="h-4 w-4" /> },
          { k: "División", v: division === "all" ? "Todas" : division, icon: <Trophy className="h-4 w-4" /> },
          { k: "Rama", v: sex === "all" ? "Todas" : sexLabel(sex), icon: <Target className="h-4 w-4" /> },
        ]}
      />

      <div className="relative z-10 -mt-4 flex flex-wrap gap-2">
        <Select value={division} onValueChange={setDivision}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="División" />
          </SelectTrigger>
          <SelectContent>
            {divisionOptions.map((d) => (
              <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sex} onValueChange={setSex}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Rama" />
          </SelectTrigger>
          <SelectContent>
            {sexOptions.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {teams === null ? (
        <Skeleton className="h-96 w-full" />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-lg font-medium">No hay equipos en esta división</p>
            <p className="mt-1">Prueba cambiando la división o la rama.</p>
          </CardContent>
        </Card>
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
                  <TableHead className="text-right">División / Rama</TableHead>
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
    </div>
  );
}