import { useEffect, useMemo, useState, Suspense, lazy } from "react";
import { Link, useParams } from "react-router";
import { db } from "@/lib/data";
import type { Match, Team } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trophy, TrendingUp, TrendingDown, Minus, Target, Activity, ExternalLink, CalendarDays } from "lucide-react";
import { formatMatchDateTime, initials, sexLabel, winRate } from "@/lib/format";

const TeamCompareChart = lazy(() => import("./compare-chart").then((m) => ({ default: m.TeamCompareChart })));

/** Categoría cerrada a partir del nivel (4.7 → 4ta). Sin decimales en UI. */
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

export default function TeamDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [team, setTeam] = useState<Team | null | undefined>(undefined);
  const [matches, setMatches] = useState<Match[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [compareName, setCompareName] = useState<string>("");

  useEffect(() => {
    if (!slug) return;
    let active = true;
    Promise.all([db.listTeams(), db.listRecentMatches()])
      .then(([list, allMatches]) => {
        if (!active) return;
        const t = list.find((x) => x.slug === slug) ?? null;
        setTeam(t);
        setAllTeams(list.filter((x) => x.slug !== slug));
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
      .sort((a, b) => String(b.scheduled_at).localeCompare(String(a.scheduled_at)));
    return finished.map((m) => {
      const isA = m.side_a.pair_name === team?.name;
      const won = (isA && m.winner === "a") || (!isA && m.winner === "b");
      return { won, rival: (isA ? m.side_b.pair_name : m.side_a.pair_name) ?? "?", match: m };
    });
  }, [matches, team]);

  // Todos los partidos del rol: jugados + pendientes (agenda), ordenados por fecha
  const rol = useMemo(() => {
    return [...matches].sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)));
  }, [matches]);
  const pendientes = rol.filter((m) => m.status === "scheduled" || m.status === "live");

  // Stats de sets reales desde los partidos capturados
  const setStats = useMemo(() => {
    let sf = 0, sa = 0;
    for (const f of form) {
      const isA = f.match.side_a.pair_name === team?.name;
      for (const s of f.match.sets) {
        const mine = isA ? s.a : s.b;
        const theirs = isA ? s.b : s.a;
        if (mine > theirs) sf++;
        else sa++;
      }
    }
    return { sf, sa, diff: sf - sa };
  }, [form, team]);

  const compareTeam = allTeams.find((t) => t.name === compareName) ?? null;

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
                  <p className="text-sm tracking-widest text-white/60 uppercase">{team.city} · Categoría {team.division}</p>
                  <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">{team.name}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="default" className="bg-white text-black hover:bg-white/90">#{team.position || "—"} de la categoría</Badge>
                    <Badge variant="outline" className="border-white/20 text-white">{team.division} · {sexLabel(team.sex)}</Badge>
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
                  <p className="text-xs text-white/50">Categoría {team.division}</p>
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
                  <p className="text-xs text-white/50">{setStats.sf}–{setStats.sa} sets ({setStats.diff >= 0 ? "+" : ""}{setStats.diff})</p>
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

            {/* Tarjetas de la pareja — con link directo al dashboard de cada jugador */}
            <div className="relative flex flex-col gap-3 lg:justify-end">
              {[team.player1, team.player2].map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-zinc-800/80 to-zinc-900 p-4 shadow-xl backdrop-blur transition-transform hover:-translate-y-0.5"
                >
                  {p?.player_id ? (
                    <Link to={`/jugadores/${p.player_id}`} className="shrink-0" aria-label={`Ver dashboard de ${p.name}`}>
                      <Avatar className="h-14 w-14 border-2 border-white/20 transition-transform hover:scale-105">
                        <AvatarImage src={`https://api.dicebear.com/9.x/initials/svg?seed=${p.name}`} />
                        <AvatarFallback className="bg-primary text-white">{initials(p.name)}</AvatarFallback>
                      </Avatar>
                    </Link>
                  ) : (
                    <Avatar className="h-14 w-14 border-2 border-white/20 shrink-0">
                      <AvatarImage src={`https://api.dicebear.com/9.x/initials/svg?seed=${p?.name ?? "Jugador"}`} />
                      <AvatarFallback className="bg-primary text-white">{p ? initials(p.name) : "?"}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-black">{p?.name ?? "Pendiente"}</p>
                    <p className="text-xs text-white/50">Categoría {p ? categoriaDeNivel(p.level) : "—"} · {i === 0 ? "Jugador 1" : "Jugador 2"}</p>
                  </div>
                  {p && p.player_id && (
                    <Button asChild variant="outline" size="icon" className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white shrink-0" aria-label={`Abrir dashboard de ${p.name}`}>
                      <Link to={`/jugadores/${p.player_id}`}><ExternalLink className="h-4 w-4" /></Link>
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
                { k: "Sets G/P", v: `${setStats.sf}/${setStats.sa}` },
                { k: "Dif. sets", v: `${setStats.diff >= 0 ? "+" : ""}${setStats.diff}` },
                { k: "Por jugar", v: pendientes.length },
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
          {/* Rol completo: todos los partidos, jugados y por jugar */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Rol completo</CardTitle>
              <Badge variant="outline">{rol.length} partidos · {pendientes.length} por jugar</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {rol.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin partidos en el rol. Aparecerán cuando se genere el calendario de un torneo.
                </p>
              ) : (
                rol.map((m, i) => {
                  const isA = m.side_a.pair_name === team.name;
                  const rival = (isA ? m.side_b.pair_name : m.side_a.pair_name) ?? "?";
                  const isFinished = m.status === "finished" && m.winner;
                  const won = isFinished && ((isA && m.winner === "a") || (!isA && m.winner === "b"));
                  const scoreline = m.sets.map((s) => `${isA ? s.a : s.b}-${isA ? s.b : s.a}`).join(", ");
                  return (
                    <div key={i} className={`flex items-center gap-3 rounded-xl border p-3 transition-all hover:shadow-sm ${m.status === "live" ? "border-primary/40 bg-primary/5" : "hover:border-primary/20"}`}>
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                        m.status === "live" ? "bg-primary text-white animate-pulse" :
                        isFinished ? (won ? "bg-emerald-500 text-white" : "bg-zinc-900 text-white") :
                        "bg-muted text-muted-foreground"}`}>
                        {m.status === "live" ? "●" : isFinished ? (won ? "G" : "P") : i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-bold">vs {rival}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.round ? `${m.round} · ` : ""}{m.tournament_name ?? "Liga16"}{m.scheduled_at ? ` · ${formatMatchDateTime(m.scheduled_at)}` : ""}
                        </p>
                      </div>
                      {isFinished && scoreline && <Badge variant={won ? "default" : "outline"} className="font-mono shrink-0">{scoreline}</Badge>}
                      {!isFinished && m.status !== "live" && <Badge variant="outline" className="shrink-0">Por jugar</Badge>}
                      {m.status === "live" && <Badge className="shrink-0 animate-pulse">En juego</Badge>}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

            {/* Rendimiento con gráfica comparativa */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Rendimiento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs"><span className="text-muted-foreground">Victorias / partidos jugados</span><span className="font-bold tabular-nums">{winRatePct}%</span></div>
                  <Progress value={winRatePct} className="h-2 transition-all duration-700 ease-out" />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs"><span className="text-muted-foreground">Sets ganados / totales</span><span className="font-bold tabular-nums">{winRate(setStats.sf + setStats.sa, setStats.sf)}%</span></div>
                  <Progress value={winRate(setStats.sf + setStats.sa, setStats.sf)} className="h-2 transition-all duration-700 ease-out" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Comparar con otro equipo</CardTitle>
                <Select value={compareName} onValueChange={setCompareName}>
                  <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Elegir equipo…" /></SelectTrigger>
                  <SelectContent>
                    {allTeams.slice(0, 50).map((t) => (
                      <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                {compareTeam ? (
                  <>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs mb-3">
                      {[
                        { k: "Win%", a: winRatePct, b: winRate(compareTeam.played, compareTeam.won) },
                        { k: "PJ", a: team.played, b: compareTeam.played },
                        { k: "Sets G", a: setStats.sf, b: compareTeam.sets_for },
                        { k: "Puntos", a: team.points, b: compareTeam.points },
                      ].map((row) => (
                        <div key={row.k} className="rounded-lg border p-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{row.k}</p>
                          <p className="mt-1 font-black tabular-nums">{row.a} <span className="text-muted-foreground font-normal">vs</span> {row.b}</p>
                        </div>
                      ))}
                    </div>
                    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
                      <TeamCompareChart a={{ name: team.name, won: team.won, lost: team.lost, setsFor: setStats.sf, setsAgainst: setStats.sa, points: team.points }} b={{ name: compareTeam.name, won: compareTeam.won, lost: compareTeam.lost, setsFor: compareTeam.sets_for, setsAgainst: compareTeam.sets_against, points: compareTeam.points }} />
                    </Suspense>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Elige un equipo para ver la comparativa con barras animadas.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

      </section>
    </div>
  );
}
