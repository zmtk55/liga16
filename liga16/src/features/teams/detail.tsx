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
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Target, Activity, ExternalLink, CalendarDays } from "lucide-react";
import { MatchCard } from "@/components/cards/card-kit";
import { initials, sexLabel, winRate } from "@/lib/format";
import { teamCategoryLabel } from "@/lib/categories";

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
                  <p className="text-xs text-white/50">Puntos</p>
                  <p className="text-2xl font-black tabular-nums">{team.points.toLocaleString("es-MX")}</p>
                  <p className="text-xs flex items-center gap-1">
                    {winRatePct >= 50 ? <TrendingUp className="h-3 w-3 text-success" /> : winRatePct < 50 && team.played > 0 ? <TrendingDown className="h-3 w-3 text-destructive" /> : <Minus className="h-3 w-3" />}
                    {winRatePct}% victorias
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
                  <p className="text-xs text-white/50">Diferencia {setStats.diff >= 0 ? "+" : ""}{setStats.diff}</p>
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
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4 shadow-xl backdrop-blur transition-transform hover:-translate-y-0.5"
                >
                  {p?.player_id ? (
                    <Link to={`/jugadores/${p.player_id}`} className="shrink-0" aria-label={`Ver dashboard de ${p.name}`}>
                      <Avatar className="h-14 w-14 border-2 border-white/20 transition-transform hover:scale-105">
                        <AvatarImage src={`https://api.dicebear.com/9.x/initials/svg?seed=${p.name}`} />
                        <AvatarFallback className="bg-primary text-primary-foreground">{initials(p.name)}</AvatarFallback>
                      </Avatar>
                    </Link>
                  ) : (
                    <Avatar className="h-14 w-14 border-2 border-white/20 shrink-0">
                      <AvatarImage src={`https://api.dicebear.com/9.x/initials/svg?seed=${p?.name ?? "Jugador"}`} />
                      <AvatarFallback className="bg-primary text-primary-foreground">{p ? initials(p.name) : "?"}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-black">{p?.name ?? "Pendiente"}</p>
                    <p className="text-xs text-white/50">{p ? `Nivel ${p.level?.toFixed(1) ?? "—"}` : "Nivel —"} · {i === 0 ? "Jugador 1" : "Jugador 2"}</p>
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
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.k}</p>
                  <p className="mt-1 text-xl font-black tabular-nums">{s.v}</p>
                </div>
              ))}
            </div>
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
                <p className="text-sm text-muted-foreground">
                  Sin partidos en el rol. Aparecerán cuando se genere el calendario de un torneo.
                </p>
              ) : (
                rol.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    className={m.status === "live" ? "border-primary/40" : ""}
                  />
                ))
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
                    {allTeams.map((t) => (
                      <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                {compareTeam ? (
                  <CompareBlock
                    nameA={team.name}
                    nameB={compareTeam.name}
                    rows={[
                      { k: "Win%", a: winRatePct, b: winRate(compareTeam.played, compareTeam.won), suffix: "%" },
                      { k: "PJ", a: team.played, b: compareTeam.played },
                      { k: "Sets G", a: setStats.sf, b: compareTeam.sets_for },
                      { k: "Puntos", a: team.points, b: compareTeam.points },
                    ]}
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
          </div>
        </div>

      </section>
    </div>
  );
}

// Comparativa cara a cara: valores a los lados del indicador, barra partida
// proporcional (el que va adelante va saturado) y animación al montar.
function CompareBlock({
  nameA,
  nameB,
  rows,
}: {
  nameA: string;
  nameB: string;
  rows: { k: string; a: number; b: number; suffix?: string }[];
}) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs font-semibold">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-primary" />
          <span className="truncate">{nameA}</span>
        </span>
        <span className="shrink-0 text-xs uppercase tracking-widest text-muted-foreground/70">vs</span>
        <span className="flex min-w-0 items-center justify-end gap-1.5">
          <span className="truncate">{nameB}</span>
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-muted-foreground/50" />
        </span>
      </div>

      {rows.map((r) => {
        const total = r.a + r.b;
        const pa = total > 0 ? (r.a / total) * 100 : 50;
        const leadA = r.a >= r.b;
        return (
          <div key={r.k}>
            <div className="grid grid-cols-[1fr_auto_1fr] items-baseline gap-3">
              <span className={`text-right text-sm font-black tabular-nums ${leadA ? "text-foreground" : "text-muted-foreground/60"}`}>
                {r.a}{r.suffix ?? ""}
              </span>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">{r.k}</span>
              <span className={`text-left text-sm font-black tabular-nums ${!leadA ? "text-foreground" : "text-muted-foreground/60"}`}>
                {r.b}{r.suffix ?? ""}
              </span>
            </div>
            <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-[width] duration-700 ease-out ${leadA ? "bg-primary" : "bg-primary/40"}`}
                style={{ width: on ? `${pa}%` : "0%" }}
              />
              <div
                className={`h-full transition-[width] duration-700 ease-out ${leadA ? "bg-muted-foreground/40" : "bg-muted-foreground"}`}
                style={{ width: on ? `${100 - pa}%` : "0%" }}
              />
            </div>
          </div>
        );
      })}
      <style>{`@media (prefers-reduced-motion: reduce) { [class*="transition-[width]"] { transition: none !important; } }`}</style>
    </div>
  );
}
