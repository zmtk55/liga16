import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { db } from "@/lib/data";
import type { Match, Team } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Swords, Trophy, TrendingUp, TrendingDown, Minus, Target, Activity, Users } from "lucide-react";
import { formatMatchDateTime, initials, sexLabel, winRate } from "@/lib/format";

export default function TeamDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [team, setTeam] = useState<Team | null | undefined>(undefined);
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    Promise.all([db.listTeams(), db.listRecentMatches()])
      .then(([list, allMatches]) => {
        if (!active) return;
        const t = list.find((x) => x.slug === slug) ?? null;
        setTeam(t);
        // Partidos donde participa la pareja (por nombre del lado A o B)
        setMatches(
          allMatches.filter(
            (m) => m.side_a.pair_name === t?.name || m.side_b.pair_name === t?.name,
          ),
        );
      })
      .finally(() => {});
    return () => {
      active = false;
    };
  }, [slug]);

  const form = useMemo(() => {
    const finished = [...matches]
      .filter((m) => m.status === "finished" && m.winner)
      .sort((a, b) => String(b.scheduled_at).localeCompare(String(a.scheduled_at)))
      .slice(0, 5);
    return finished.map((m) => {
      const isA = m.side_a.pair_name === team?.name;
      const won = (isA && m.winner === "a") || (!isA && m.winner === "b");
      return { won, rival: (isA ? m.side_b.pair_name : m.side_a.pair_name) ?? "?", match: m };
    });
  }, [matches, team]);

  if (team === undefined) {
    return (
      <div className="space-y-6 animate-pulse">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[280px] w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
      </div>
    );
  }
  if (!team) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm"><Link to="/equipos"><ArrowLeft className="h-4 w-4" /> Equipos</Link></Button>
        <p className="text-muted-foreground">Equipo no encontrado.</p>
      </div>
    );
  }

  const winRatePct = winRate(team.played, team.won);
  const formGlyphs = form.map((f) => (f.won ? "G" : "P"));
  const streak = (() => {
    if (formGlyphs.length === 0) return null;
    const first = formGlyphs[0];
    let count = 0;
    for (const g of formGlyphs) {
      if (g !== first) break;
      count++;
    }
    return { won: first === "G", count };
  })();

  return (
    <div className="space-y-6 -mx-4 -mt-8 md:-mx-6">
      {/* ====== HERO tipo póster, coherente con el detalle de jugador ====== */}
      <section className="relative overflow-hidden bg-[#0f0f0f] text-white">
        <div className="absolute inset-0 bg-gradient-to-r from-black via-zinc-900 to-transparent" />
        <div className="absolute right-6 top-6 select-none text-[120px] font-black leading-none text-white/5 md:text-[200px] md:right-12">
          {String(team.position || 0).padStart(2, "0")}
        </div>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 30% 50%, hsl(var(--primary)/0.25), transparent 60%)" }} />

        <div className="relative mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
          <Button asChild variant="ghost" size="sm" className="mb-4 text-white/70 hover:text-white hover:bg-white/10">
            <Link to="/equipos"><ArrowLeft className="h-4 w-4" /> Equipos</Link>
          </Button>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-center">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div>
                  <p className="text-sm tracking-widest text-white/60 uppercase">{team.city} · División {team.division}</p>
                  <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                    <span className="bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">{team.name}</span>
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge className="bg-white text-black hover:bg-white">#{team.position || "—"} de la división</Badge>
                    <Badge variant="outline" className="border-white/20 text-white">{sexLabel(team.sex)}</Badge>
                    {streak && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs backdrop-blur">
                        <span className={`h-2 w-2 animate-pulse rounded-full ${streak.won ? "bg-emerald-400" : "bg-red-400"}`} />
                        {streak.count} {streak.won ? "victorias" : "derrotas"} seguidas
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-auto hidden items-center gap-2 md:flex">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black font-black">16</div>
                  <span className="text-xs leading-none text-white/60">Liga16<br /><span className="font-bold text-white">Circuito</span></span>
                </div>
              </div>

              {/* Scoreboard del equipo */}
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div className="rounded-xl bg-white/5 p-3 backdrop-blur border border-white/10">
                  <p className="text-xs text-white/50">Posición</p>
                  <p className="text-2xl font-black tabular-nums">#{team.position || "—"}</p>
                  <p className="text-xs text-white/50">División {team.division}</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3 backdrop-blur border border-white/10">
                  <p className="text-xs text-white/50">Puntos</p>
                  <p className="text-2xl font-black tabular-nums">{team.points.toLocaleString("es-MX")}</p>
                  <p className="text-xs flex items-center gap-1">
                    {winRatePct >= 50 ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : winRatePct < 50 && team.played > 0 ? <TrendingDown className="h-3 w-3 text-red-400" /> : <Minus className="h-3 w-3" />}
                    {winRatePct}% victorias
                  </p>
                </div>
                <div className="rounded-xl bg-white/5 p-3 backdrop-blur border border-white/10">
                  <p className="text-xs text-white/50">Récord</p>
                  <p className="text-lg font-black tabular-nums">{team.won} – {team.lost} <span className="text-xs font-normal text-white/60">/ {team.played} PJ</span></p>
                  <p className="text-xs text-white/50">{team.sets_for}–{team.sets_against} sets</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3 backdrop-blur border border-white/10">
                  <p className="text-xs text-white/50">Títulos</p>
                  <p className="text-2xl font-black flex items-center gap-1"><Trophy className="h-5 w-5 text-amber-400" /> {team.titles}</p>
                  <p className="text-xs text-white/50">Circuito</p>
                </div>
              </div>

              {/* Forma reciente */}
              {formGlyphs.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-white/50">Últimos resultados:</span>
                  {formGlyphs.map((g, i) => (
                    <span
                      key={i}
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black ${
                        g === "G" ? "bg-emerald-500 text-white" : "bg-white/10 text-white/60"
                      }`}
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Tarjetas de la pareja */}
            <div className="relative flex flex-col gap-3 lg:justify-end">
              {[team.player1, team.player2].map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-zinc-800/80 to-zinc-900 p-4 shadow-xl backdrop-blur transition-transform hover:-translate-y-0.5"
                >
                  <Avatar className="h-14 w-14 border-2 border-white/20">
                    <AvatarImage src={`https://api.dicebear.com/9.x/initials/svg?seed=${p?.name ?? "Jugador"}`} />
                    <AvatarFallback className="bg-primary text-white">{p ? initials(p.name) : "?"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-black">{p?.name ?? "Pendiente"}</p>
                    <p className="text-xs text-white/50">Nivel {p?.level ? p.level.toFixed(1) : "—"} · {i === 0 ? "Jugador 1" : "Jugador 2"}</p>
                  </div>
                  {p && p.player_id && (
                    <Button asChild variant="outline" size="sm" className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                      <Link to={`/jugadores/${p.player_id}`}>Ver perfil</Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ====== Franja de métricas ====== */}
      <section className="mx-auto max-w-7xl px-4 md:px-6">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="grid grid-cols-3 divide-x divide-border text-center md:grid-cols-6">
              {[
                { k: "PJ", v: team.played },
                { k: "PG", v: team.won },
                { k: "PP", v: team.lost },
                { k: "Win%", v: `${winRatePct}%` },
                { k: "Sets F/C", v: `${team.sets_for}/${team.sets_against}` },
                { k: "Títulos", v: team.titles },
              ].map((s) => (
                <div key={s.k} className="p-4 transition-colors hover:bg-muted/50">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{s.k}</p>
                  <p className="mt-1 text-xl font-black tabular-nums">{s.v}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ====== Cuerpo ====== */}
      <section className="mx-auto max-w-7xl space-y-6 px-4 md:px-6">
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Últimos partidos del equipo, con marcadores reales */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Swords className="h-4 w-4 text-primary" /> Últimos partidos</CardTitle>
              <Badge variant="outline">{matches.length} totales</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {form.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin partidos registrados todavía. Los resultados aparecerán aquí cuando se capturen en el sistema.
                </p>
              ) : (
                form.map((f, i) => {
                  const scoreline = f.match.sets.map((s) => `${s.a}-${s.b}`).join(", ");
                  return (
                    <div key={i} className="flex items-center gap-3 rounded-xl border p-3 transition-all hover:shadow-sm hover:border-primary/20">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${f.won ? "bg-emerald-500 text-white" : "bg-zinc-900 text-white"}`}>
                        {f.won ? "G" : "P"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-bold">vs {f.rival}</p>
                        <p className="text-xs text-muted-foreground">
                          {f.match.round ? `${f.match.round} · ` : ""}{f.match.tournament_name ?? "Liga16"}{f.match.scheduled_at ? ` · ${formatMatchDateTime(f.match.scheduled_at)}` : ""}
                        </p>
                      </div>
                      {scoreline && <Badge variant={f.won ? "default" : "outline"} className="font-mono">{scoreline}</Badge>}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Panel de rendimiento */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Efectividad</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs"><span className="text-muted-foreground">Victorias / partidos jugados</span><span className="font-bold tabular-nums">{winRatePct}%</span></div>
                  <Progress value={winRatePct} className="h-2" />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs"><span className="text-muted-foreground">Sets ganados / totales</span><span className="font-bold tabular-nums">{winRate(team.sets_for + team.sets_against, team.sets_for)}%</span></div>
                  <Progress value={winRate(team.sets_for + team.sets_against, team.sets_for)} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Ficha de la pareja</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 text-sm">
                <p><span className="text-muted-foreground">División:</span> {team.division}</p>
                <p><span className="text-muted-foreground">Rama:</span> {sexLabel(team.sex)}</p>
                <p><span className="text-muted-foreground">Ciudad:</span> {team.city}</p>
                <p><span className="text-muted-foreground">Club:</span> {team.club_id ? "Registrado" : "Libre"}</p>
                <p className="col-span-2"><span className="text-muted-foreground">Nivel combinado:</span> {((team.player1?.level ?? 0) + (team.player2?.level ?? 0)).toFixed(1)}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Compañeros de la pareja — la pieza que el jugador no tiene */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> La pareja</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {[team.player1, team.player2].map((p, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={`https://api.dicebear.com/9.x/initials/svg?seed=${p?.name ?? "Jugador"}`} />
                  <AvatarFallback>{p ? initials(p.name) : "?"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{p?.name ?? "Pendiente"}</p>
                  <p className="text-xs text-muted-foreground">Nivel {p?.level ? p.level.toFixed(1) : "—"}</p>
                </div>
                {p && p.player_id && (
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/jugadores/${p.player_id}`}>Perfil →</Link>
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
