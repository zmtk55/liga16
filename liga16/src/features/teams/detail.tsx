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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Target, Activity, ExternalLink, CalendarDays, CheckCircle2, XCircle } from "lucide-react";
import { MatchCard, MatchSets } from "@/components/cards/card-kit";
import { formatDate, initials, sexLabel, winRate } from "@/lib/format";
import { matchStatusKey } from "@/lib/match-state";
import { teamCategoryLabel } from "@/lib/categories";

function performanceWord(winRatePct: number): string {
  if (winRatePct >= 70) return "en gran forma";
  if (winRatePct >= 50) return "en buen momento";
  if (winRatePct >= 30) return "necesita mejorar";
  return "necesita trabajar";
}
function clampDiff(value: number): number {
  return Math.max(0, Math.min(Math.abs(value), 999)) * Math.sign(value);
}
function clampAvg(value: number | null): number {
  return value === null ? 0 : Math.max(0, Math.min(value, 99));
}

export default function TeamDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [team, setTeam] = useState<Team | null | undefined>(undefined);
  const [matches, setMatches] = useState<Match[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [rolExpanded, setRolExpanded] = useState(false);
  const [compareName, setCompareName] = useState<string>("");

  useEffect(() => {
    if (!slug) return;
    let active = true;
    Promise.all([db.listTeams(), db.listRecentMatches()])
      .then(([list, allMatches]) => {
        if (!active) return;
        const t = list.find((x) => x.slug === slug) ?? null;
        setTeam(t);
        // Solo rivales de la MISMA categoría (división + género), sin el propio equipo
        setAllTeams(
          list.filter((x) => x.slug !== slug && x.division === t?.division && x.sex === t?.sex),
        );
        setCompareName("");
        // Partidos donde participa la pareja (por nombre del lado A o B)
        setMatches(
          allMatches.filter(
            (m) => m.side_a.pair_name === t?.name || m.side_b.pair_name === t?.name,
          ),
        );
      })
      // Sin `catch` la página se quedaba en esqueletos para siempre si la
      // petición fallaba. Se marca "ya no está cargando" con lista vacía para
      // que el usuario vea el estado real en vez de una pantalla colgada.
      .catch(() => {
        if (active) {
          setTeam(null);
          setAllTeams([]);
          setMatches([]);
        }
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const form = useMemo(() => {
    const finished = [...matches]
      .filter((m) => matchStatusKey(m) === "finished" && m.winner)
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
  /**
 * Partidos por jugarse, por FECHA y no solo por estado.
 *
 * `status === "scheduled"` no significa "futuro": un partido olvidado sigue en
 * ese estado para siempre y salía arriba de "Próximos rivales" con fecha de hace
 * semanas y el rótulo "Próximamente" (porque el cálculo de días daba negativo y
 * no caía en ninguna rama). "Por jugar" también lo contaba.
 */
  const pendientes = useMemo(() => {
    const at = (m: Match) => {
      const t = new Date(m.scheduled_at ?? "").getTime();
      return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
    };
    // "Por jugar" = lo que aún NO se ha capturado, según `matchStatusKey` (la
    // única fuente de verdad). Antes se filtraba por `status` crudo y además
    // por fecha futura: un partido agendado para un día que ya pasó se
    // borraba de la lista y la sección quedaba siempre vacía.
    return rol
      .filter((m) => {
        const key = matchStatusKey(m);
        return key === "scheduled" || key === "live" || key === "disputed";
      })
      // A futuro primero; los que ya pasaron (o no tienen fecha) al final.
      .sort((a, b) => at(a) - at(b));
  }, [rol]);

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

  // Estadísticas adicionales del rendimiento (hooks antes de los early-returns)
  const setsWinAvg = useMemo(() => {
    let total = 0, contests = 0;
    for (const f of form) {
      const isA = f.match.side_a.pair_name === team?.name;
      for (const s of f.match.sets) {
        total += (isA ? s.a : s.b);
        contests++;
      }
    }
    return contests > 0 ? Math.round(total / contests) : null;
  }, [form, team]);
  // Rival directo: el que más partidos ha disputado contra este equipo
  const rivalDir = useMemo(() => {
    if (form.length === 0) return null;
    const counts = new Map<string, number>();
    for (const f of form) {
      counts.set(f.rival, (counts.get(f.rival) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [name, n] of counts) {
      if (n > bestCount) {
        bestCount = n;
        best = name;
      }
    }
    return best;
  }, [form]);
  const rivalDirWon = rivalDir ? form.filter((f) => f.rival === rivalDir && f.won).length : null;

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
      <section className="relative overflow-hidden bg-surface-inverse text-white">
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
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
                  <p className="text-sm tracking-widest text-white/60 uppercase">{teamCategoryLabel(team)} · Liga16</p>
                  <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">{team.name}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="default" className="bg-white text-black hover:bg-white/90">#{team.position || "—"} de la categoría</Badge>
                    <Badge variant="outline" className="border-white/20 text-white">{team.division} · {sexLabel(team.sex)}</Badge>
                    {streak && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs backdrop-blur">
                        <span className={`h-2 w-2 animate-pulse rounded-full ${streak.won ? "bg-success" : "bg-destructive"}`} />
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
                  <p className="text-xs text-white/50">{teamCategoryLabel(team)}</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3 backdrop-blur border border-white/10">
                  <p className="text-xs text-white/50">% Puntos</p>
                  <p className="text-2xl font-black tabular-nums">{team.points.toLocaleString("es-MX")}%</p>
                  <p className="text-xs flex items-center gap-1">
                    {winRatePct >= 50 ? <TrendingUp className="h-3 w-3 text-success" /> : winRatePct < 50 && team.played > 0 ? <TrendingDown className="h-3 w-3 text-destructive" /> : <Minus className="h-3 w-3" />}
                    {winRatePct}% victorias{team.played > 0 ? ` · ${performanceWord(winRatePct)}` : ""}
                  </p>
                </div>
                <div className="rounded-xl bg-white/5 p-3 backdrop-blur border border-white/10">
                  <p className="text-xs text-white/50">Récord</p>
                  <p className="text-lg font-black tabular-nums">{team.won} – {team.lost} <span className="text-xs font-normal text-white/60">/ {team.played} PJ</span></p>
                  <p className="text-xs text-white/50">{winRatePct}% de efectividad</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3 backdrop-blur border border-white/10">
                  <p className="text-xs text-white/50">Sets</p>
                  <p className="text-2xl font-black tabular-nums">{setStats.sf}–{setStats.sa}</p>
                  <p className="text-xs text-white/50">Diferencia {setStats.diff >= 0 ? "+" : ""}{clampDiff(setStats.diff)}</p>
                </div>
              </div>

              {/* Forma reciente */}
              {formGlyphs.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-white/50">Últimos resultados:</span>
                  {formGlyphs.map((g, i) => (
                    <span
                      key={i}
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${
                        g === "G" ? "bg-success text-success-foreground" : "bg-white/10 text-white/60"
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
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 transition-colors hover:border-white/20 hover:bg-white/10"
                >
                  {p?.player_id ? (
                    <Link to={`/jugadores/${p.player_id}`} className="shrink-0" aria-label={`Ver dashboard de ${p.name}`}>
                      <Avatar className="h-12 w-12 border-2 border-white/20">
                        <AvatarImage src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(p.name ?? "")}`} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm">{initials(p.name)}</AvatarFallback>
                      </Avatar>
                    </Link>
                  ) : (
                    <Avatar className="h-12 w-12 border-2 border-white/20 shrink-0">
                      <AvatarImage src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(p?.name ?? "Jugador")}`} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">{p ? initials(p.name) : "?"}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold leading-snug">{p?.name ?? "Pendiente"}</p>
                    <p className="text-xs text-white/50">{p ? `Nivel ${p.level?.toFixed(1) ?? "—"}` : "Nivel —"} · {i === 0 ? "Jugador 1" : "Jugador 2"}</p>
                  </div>
                  {p && p.player_id && (
                    <Button asChild variant="outline" size="icon" className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white shrink-0 h-8 w-8" aria-label={`Abrir dashboard de ${p.name}`}>
                      <Link to={`/jugadores/${p.player_id}`}><ExternalLink className="h-3.5 w-3.5" /></Link>
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
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.k}</p>
                  <p className="mt-1 text-xl font-black tabular-nums">{s.v}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ====== NUEVA: Próximos rivales + Últimos resultados ====== */}
      <section className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Próximos rivales */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Próximos rivales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendientes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin partidos pendientes.</p>
              ) : (
                pendientes.slice(0, 3).map((m) => {
                  const isA = m.side_a.pair_name === team?.name;
                  const rival = (isA ? m.side_b.pair_name : m.side_a.pair_name) ?? "?";
                  // Una fecha inválida se muestra como "Sin fecha", no como un `Invalid Date`
                  // impreso en la página (era `new Date("")`).
                  const scheduled = m.scheduled_at ? new Date(m.scheduled_at) : null;
                  const scheduledOk = scheduled != null && !Number.isNaN(scheduled.getTime());
                  const now = new Date();
                  const daysUntil = scheduledOk ? Math.floor((scheduled!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
                  let dateLabel = "Sin fecha";
                  if (daysUntil === null) dateLabel = "Sin fecha";
                  else if (daysUntil < 0) dateLabel = "A definir";
                  else if (daysUntil === 0) dateLabel = "Hoy";
                  else if (daysUntil === 1) dateLabel = "Mañana";
                  else dateLabel = `En ${daysUntil} días`;
                  return (
                    <div key={m.id} className="flex items-center justify-between rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-sm">{rival}</p>
                        <p className="text-xs text-muted-foreground">{dateLabel} · {m.round}</p>
                      </div>
                      {scheduledOk && (
                        <Badge variant="outline" className="shrink-0 ml-2">{scheduled!.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}</Badge>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Últimos resultados */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Últimos resultados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {form.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin resultados todavía.</p>
              ) : (
                form.slice(0, 3).map((f) => {
                  // La fecha con el formato de la app ("10 oct 2026"), no el
                  // crudo de toLocaleDateString ("10/10/2026").
                  const when = f.match.scheduled_at
                    ? formatDate(f.match.scheduled_at)
                    : "Sin fecha";
                  // De qué lado juega este equipo: para sacar SU marcador y no
                  // el del rival.
                  const isA = f.match.side_a.pair_name === team?.name;
                  return (
                    <div key={f.match.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-sm">{f.rival}</p>
                        <p className="text-xs text-muted-foreground">{when}</p>
                      </div>
                      {/* El marcador va con el resultado: un check sin
                          games no dice cómo se ganó. */}
                      <MatchSets match={f.match} side={isA ? "a" : "b"} size="sm" />
                      <div className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-full ${f.won ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                        {f.won ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ====== NUEVA: Comparador destacado ====== */}
      <section className="mx-auto max-w-7xl px-4 md:px-6">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Comparar con otro equipo</CardTitle>
            <Select value={compareName} onValueChange={setCompareName}>
              <SelectTrigger className="h-8 w-44 max-w-[240px] text-xs truncate"><SelectValue placeholder="Elegir equipo…" /></SelectTrigger>
              <SelectContent>
                {allTeams.map((t) => (
                  <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {compareTeam ? (
              <CompareBlock
                a={{
                  name: team.name,
                  seed: team.player1?.name ?? team.name,
                  stats: [
                    { k: "Win%", v: `${winRatePct}%` },
                    { k: "PJ", v: String(team.played) },
                    { k: "Puntos", v: team.points.toLocaleString("es-MX") },
                  ],
                }}
                b={{
                  name: compareTeam.name,
                  seed: compareTeam.player1?.name ?? compareTeam.name,
                  stats: [
                    { k: "Win%", v: `${winRate(compareTeam.played, compareTeam.won)}%` },
                    { k: "PJ", v: String(compareTeam.played) },
                    { k: "Puntos", v: compareTeam.points.toLocaleString("es-MX") },
                  ],
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {allTeams.length === 0
                  ? "No hay otros equipos en tu categoría todavía."
                  : "Elige un equipo de tu categoría para comparar."}
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ====== Cuerpo ====== */}
      <section className="mx-auto max-w-7xl space-y-6 px-4 md:px-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Rol completo: todos los partidos, jugados y por jugar */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Rol completo</CardTitle>
              <Badge variant="outline">{rol.length} partidos · {pendientes.length} por jugar</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {rol.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin partidos en el rol. Aparecerán cuando se genere el calendario de un torneo.</p>
              ) : (
                <>
                  {(rolExpanded ? rol : rol.slice(-3)).map((m) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      className={m.status === "live" ? "border-primary/40" : ""}
                    />
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setRolExpanded((v) => !v)}
                  >
                    {rolExpanded ? "Ver menos" : `Ver todo (${rol.length} partidos)`}
                  </Button>
                </>
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

                {/* Diferencial de sets: cuántos sets ganó de más la pareja.
                    El % de arriba puede decir 60% y el diferencial −2: gana
                    muchos pero pierde más sets de los que gana. */}
                <div className="flex items-center justify-between border-t pt-3 text-xs">
                  <span className="text-muted-foreground">Diferencial de sets</span>
                  <span className={`font-bold tabular-nums ${setStats.diff > 0 ? "text-success" : setStats.diff < 0 ? "text-destructive" : ""}`}>
                    {setStats.diff > 0 ? "+" : ""}{clampDiff(setStats.diff)}
                  </span>
                </div>

                {/* Promedio de juegos ganados por set: si ganan 6-2 o 6-0.
                    Dice si el Dominio es de fondo o de deceptive. */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Juegos ganados por set</span>
                  <span className="font-bold tabular-nums">
                    {setsWinAvg === null ? "—" : `${clampAvg(setsWinAvg)} de media`}
                  </span>
                </div>

                {/* Rendimiento y posición en la división: el objetivo de cada fecha. */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">% Puntos / posición en la división</span>
                  <span className="font-bold tabular-nums">
                    {team.points ?? 0}% · #{team.position || "—"}
                  </span>
                </div>

                {/* Rival directo: contra quién gana la pareja. */}
                {rivalDir && rivalDirWon !== null && (
                  <div className="flex items-center justify-between border-t pt-3 text-xs">
                    <span className="min-w-0 truncate pr-2 text-muted-foreground">
                      vs {rivalDir}
                    </span>
                    <span className="shrink-0 font-bold tabular-nums">
                      {rivalDirWon}G — {form.filter((f) => f.rival === rivalDir).length - rivalDirWon}P
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

      </section>
    </div>
  );
}

// Comparativa compacta: dos tarjetas enfrentadas (VS) con avatar, nombre y
// las tres cifras clave. Reemplaza a la tabla larga, que ocupaba más espacio
// del que aportaba.
function CompareBlock({
  a,
  b,
}: {
  a: { name: string; seed: string; stats: { k: string; v: string }[] };
  b: { name: string; seed: string; stats: { k: string; v: string }[] };
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
      <div className="rounded-xl border bg-muted/30 p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0 border border-border">
            <AvatarImage src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(a.seed)}`} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials(a.name)}</AvatarFallback>
          </Avatar>
          <p className="min-w-0 truncate text-sm font-bold">{a.name}</p>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-center">
          {a.stats.map((s) => (
            <div key={s.k} className="min-w-0">
              <dt className="truncate text-caption uppercase text-muted-foreground">{s.k}</dt>
              <dd className="mt-0.5 text-sm font-black tabular-nums">{s.v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <span className="rounded-full border bg-card px-2.5 py-1 text-caption uppercase text-muted-foreground">
        vs
      </span>

      <div className="rounded-xl border bg-muted/30 p-3 sm:p-4">
        <div className="flex items-center gap-3 sm:flex-row-reverse sm:text-right">
          <Avatar className="h-10 w-10 shrink-0 border border-border">
            <AvatarImage src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(b.seed)}`} />
            <AvatarFallback className="bg-muted text-muted-foreground text-xs">{initials(b.name)}</AvatarFallback>
          </Avatar>
          <p className="min-w-0 truncate text-sm font-bold">{b.name}</p>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-center">
          {b.stats.map((s) => (
            <div key={s.k} className="min-w-0">
              <dt className="truncate text-caption uppercase text-muted-foreground">{s.k}</dt>
              <dd className="mt-0.5 text-sm font-black tabular-nums">{s.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
