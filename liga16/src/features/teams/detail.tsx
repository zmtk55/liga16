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
import { ArrowLeft, ChevronDown, TrendingUp, TrendingDown, Minus, Target, Activity, ExternalLink, CalendarDays, X } from "lucide-react";
import ScenarioPanel from "@/components/scenarios/qualification-scenarios";
import type { StandingLike, MyLine, CutContext } from "@/lib/qualification";
import { MatchCard } from "@/components/cards/card-kit";
import { initials, sexLabel, winRate } from "@/lib/format";
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
        // Solo rivales de la MISMA categoría (división + género), sin el propio
        // equipo, ordenados por cercanía en la tabla para que el selector
        // ofrezca primero al rival directo. No se elige ninguno solo: la
        // comparación se abre cuando el usuario la pide.
        const rivals = list
          .filter((x) => x.slug !== slug && x.division === t?.division && x.sex === t?.sex)
          .sort(
            (a, b) =>
              Math.abs((a.position || 99) - (t?.position || 99)) -
              Math.abs((b.position || 99) - (t?.position || 99)),
          );
        setAllTeams(rivals);
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
  const setsPct = winRate(setStats.sf + setStats.sa, setStats.sf);
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
                  {/* Identidad en una sola línea: los tres pills competían entre sí. */}
                  <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-white/55">
                    <span className="font-semibold text-white">#{team.position || "—"} de la categoría</span>
                    <span aria-hidden>·</span>
                    <span>{team.division} · {sexLabel(team.sex)}</span>
                  </p>
                  {streak && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-white/55">
                      <span className="h-1.5 w-1.5 rounded-full bg-white/60" aria-hidden />
                      {streak.count} {streak.won ? "victorias" : "derrotas"} seguidas
                    </p>
                  )}
                </div>
                <div className="ml-auto hidden items-center gap-2 md:flex">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black font-black">16</div>
                  <span className="text-xs leading-none text-white/60">Liga16<br /><span className="font-bold text-white">Circuito</span></span>
                </div>
              </div>

              {/* Cifras del equipo: una franja con divisores, no cuatro tarjetas.
                  La posición ya está en el badge y en el numeral del fondo. */}
              <dl className="grid grid-cols-3 divide-x divide-white/10 border-y border-white/10">
                <div className="py-3 pe-3">
                  <dt className="text-caption uppercase tracking-[0.12em] text-white/50">% Puntos</dt>
                  <dd className="mt-1 text-2xl font-black leading-none tabular-nums">
                    {team.points.toLocaleString("es-MX")}%
                  </dd>
                  <p className="mt-1 flex items-center gap-1 text-xs text-white/50">
                    {winRatePct >= 50 ? (
                      <TrendingUp className="h-3 w-3" aria-hidden />
                    ) : winRatePct < 50 && team.played > 0 ? (
                      <TrendingDown className="h-3 w-3" aria-hidden />
                    ) : (
                      <Minus className="h-3 w-3" aria-hidden />
                    )}
                    {winRatePct}% victorias{team.played > 0 ? ` · ${performanceWord(winRatePct)}` : ""}
                  </p>
                </div>
                <div className="px-3 py-3">
                  <dt className="text-caption uppercase tracking-[0.12em] text-white/50">Récord</dt>
                  <dd className="mt-1 text-2xl font-black leading-none tabular-nums">
                    {team.won}–{team.lost}
                  </dd>
                  <p className="mt-1 text-xs text-white/50">{team.played} PJ · {winRatePct}% efectividad</p>
                </div>
                <div className="ps-3 py-3">
                  <dt className="text-caption uppercase tracking-[0.12em] text-white/50">Sets</dt>
                  <dd className="mt-1 text-2xl font-black leading-none tabular-nums">
                    {setStats.sf}–{setStats.sa}
                  </dd>
                  <p className="mt-1 text-xs text-white/50">
                    Diferencia {setStats.diff >= 0 ? "+" : ""}
                    {clampDiff(setStats.diff)}
                  </p>
                </div>
              </dl>

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

            {/* Pareja: dos filas compactas con enlace al dashboard del jugador. */}
            <div className="flex flex-col gap-2 lg:items-end">
              {[team.player1, team.player2].map((p, i) => (
                <div
                  key={i}
                  className="flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 transition-colors hover:border-white/20 hover:bg-white/10 lg:max-w-xs"
                >
                  <Avatar className="h-9 w-9 shrink-0 border border-white/20">
                    <AvatarImage src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(p?.name ?? "Jugador")}`} />
                    <AvatarFallback className="bg-white/15 text-xs text-white">{p ? initials(p.name) : "?"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-sm font-bold">{p?.name ?? "Pendiente"}</p>
                    <p className="mt-0.5 text-xs text-white/50">
                      {p ? `Nivel ${p.level?.toFixed(1) ?? "—"}` : "Nivel —"} · Jugador {i + 1}
                    </p>
                  </div>
                  {p?.player_id && (
                    <Link
                      to={`/jugadores/${p.player_id}`}
                      aria-label={`Abrir dashboard de ${p.name}`}
                      className="shrink-0 rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden />
                    </Link>
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

      {/* ====== ESCENARIOS DE CLASIFICACIÓN (reemplaza Próximos rivales) ====== */}
      {(() => {
        const full = [team, ...allTeams].filter(Boolean) as Team[];
        const standingsData: StandingLike[] = full.map((t) => ({
          pairId: t.id ?? t.name,
          name: t.name,
          position: t.position || 0,
          points: t.points || 0,
          played: t.played || 0,
        }));
        const meData: MyLine = {
          pairId: team?.id ?? team?.name ?? "",
          played: team?.played || 0,
          setsWon: setStats.sf,
        };
        const ctxData: CutContext = { slots: 4, pointsPerWin: 3 };
        const remainingMatches = pendientes.filter(
          (m) => m.side_a.pair_name === team?.name || m.side_b.pair_name === team?.name
        ).length;
        return (
          <ScenarioPanel
            standings={standingsData}
            me={meData}
            ctx={ctxData}
            remainingMatches={remainingMatches}
          />
        );
      })()}

      {/* ====== NUEVA: Comparador destacado ====== */}
      <section className="mx-auto max-w-7xl px-4 md:px-6">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Comparar con otro equipo</CardTitle>
            <div className="flex items-center gap-1">
              <Select value={compareName} onValueChange={setCompareName}>
                <SelectTrigger className="h-8 w-44 max-w-[240px] text-xs truncate"><SelectValue placeholder="Elegir equipo…" /></SelectTrigger>
                <SelectContent>
                  {allTeams.map((t) => (
                    <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {compareName && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setCompareName("")}
                  aria-label="Cerrar comparación"
                >
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className={compareTeam ? "" : "pb-4 pt-0"}>
            {compareTeam ? (
              <CompareBlock
                a={{
                  name: team.name,
                  seed: team.player1?.name ?? team.name,
                  points: team.points ?? 0,
                  played: team.played,
                  won: team.won,
                  lost: team.lost,
                  position: team.position,
                }}
                b={{
                  name: compareTeam.name,
                  seed: compareTeam.player1?.name ?? compareTeam.name,
                  points: compareTeam.points ?? 0,
                  played: compareTeam.played,
                  won: compareTeam.won,
                  lost: compareTeam.lost,
                  position: compareTeam.position,
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {allTeams.length === 0
                  ? "No hay otros equipos en tu categoría todavía."
                  : "Elige una pareja y verás seis métricas enfrentadas con barras."}
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
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 text-xs font-semibold"
                    onClick={() => setRolExpanded((v) => !v)}
                  >
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${rolExpanded ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                    {rolExpanded ? "Ver menos" : `Ver todo (${rol.length} partidos)`}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

            {/* Rendimiento: cada cifra con su lectura en palabras. */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Rendimiento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    label: "Efectividad",
                    value: winRatePct,
                    detail:
                      team.played > 0
                        ? `${team.won} de ${team.played} partidos ganados`
                        : "Todavía no jugó partidos",
                    note:
                      team.played === 0
                        ? "Sin partidos no hay efectividad que medir."
                        : winRatePct >= 60
                          ? "Gana la mayoría de sus partidos."
                          : winRatePct >= 40
                            ? "Gana y pierde en proporción parecida."
                            : "Pierde más de la mitad de sus partidos.",
                  },
                  {
                    label: "Sets",
                    value: setsPct,
                    detail: `${setStats.sf} sets ganados de ${setStats.sf + setStats.sa}`,
                    note:
                      setStats.sf + setStats.sa === 0
                        ? "Sin sets registrados."
                        : setsPct >= 60
                          ? "Domina la mayoría de los sets."
                          : setsPct >= 40
                            ? "Reparte sets: los gana y los pierde."
                            : "Pierde más sets de los que gana.",
                  },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-caption uppercase tracking-[0.1em] text-muted-foreground">
                        {m.label}
                      </span>
                      <span className="text-lg font-black leading-none tabular-nums">
                        {m.value}%
                      </span>
                    </div>
                    <Progress value={m.value} className="mt-1.5 h-1.5" />
                    <p className="mt-1 text-xs text-muted-foreground">{m.detail}</p>
                    <p className="text-xs text-foreground/70">{m.note}</p>
                  </div>
                ))}

                {/* Tres hechos, cada uno con lo que significa. */}
                <dl className="grid grid-cols-3 divide-x border-y py-2.5 text-center">
                  <div className="px-2">
                    <dt className="text-caption uppercase tracking-[0.08em] text-muted-foreground">
                      Dif. sets
                    </dt>
                    <dd
                      className={`mt-0.5 text-base font-black tabular-nums ${
                        setStats.diff < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {setStats.diff > 0 ? "+" : ""}
                      {clampDiff(setStats.diff)}
                    </dd>
                    <p className="mt-0.5 text-caption leading-tight text-muted-foreground">
                      ganados − perdidos
                    </p>
                  </div>
                  <div className="px-2">
                    <dt className="text-caption uppercase tracking-[0.08em] text-muted-foreground">
                      Juegos/set
                    </dt>
                    <dd className="mt-0.5 text-base font-black tabular-nums">
                      {setsWinAvg === null ? "—" : clampAvg(setsWinAvg)}
                    </dd>
                    <p className="mt-0.5 text-caption leading-tight text-muted-foreground">
                      6 gana el set
                    </p>
                  </div>
                  <div className="px-2">
                    <dt className="text-caption uppercase tracking-[0.08em] text-muted-foreground">
                      Posición
                    </dt>
                    <dd className="mt-0.5 text-base font-black tabular-nums">
                      #{team.position || "—"}
                    </dd>
                    <p className="mt-0.5 text-caption leading-tight text-muted-foreground">
                      {team.points ?? 0}% de puntos
                    </p>
                  </div>
                </dl>

                {/* Rival directo: contra quién gana la pareja. */}
                {rivalDir && rivalDirWon !== null && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="min-w-0 truncate pe-2 text-muted-foreground">
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

// Comparador métrica por métrica: dos cifras y una barra enfrentada por fila.
// Antes eran dos tarjetas con tres números sueltos: no decía quién estaba mejor
// ni cuánto, y en móvil las dos tarjetas no cabían. Las filas se leen igual a
// 343px que a 1200px.
type CmpSide = {
  name: string;
  seed: string;
  points: number;
  played: number;
  won: number;
  lost: number;
  position: number;
};

const pct = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

function CompareBlock({ a, b }: { a: CmpSide; b: CmpSide }) {
  const rows: Array<{
    label: string;
    a: number;
    b: number;
    fmt: (v: number) => string;
    /** Menos es mejor (posiciones, derrotas). */
    lowerBetter?: boolean;
    help: string;
  }> = [
    {
      label: "Puntos",
      a: a.points,
      b: b.points,
      fmt: (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1)),
      help: "% de puntos del torneo",
    },
    {
      label: "Efectividad",
      a: pct(a.won, a.played),
      b: pct(b.won, b.played),
      fmt: (v) => `${v}%`,
      help: "partidos ganados / jugados",
    },
    {
      label: "Jugados",
      a: a.played,
      b: b.played,
      fmt: String,
      help: "partidos en el rol",
    },
    { label: "Ganados", a: a.won, b: b.won, fmt: String, help: "victorias" },
    {
      label: "Perdidos",
      a: a.lost,
      b: b.lost,
      fmt: String,
      lowerBetter: true,
      help: "derrotas",
    },
    {
      label: "Posición",
      a: a.position,
      b: b.position,
      fmt: (v) => `#${v || "—"}`,
      lowerBetter: true,
      help: "lugar en la categoría",
    },
  ];

  const headerSide = (side: CmpSide, align: "start" | "end") => (
    <div
      className={`flex min-w-0 items-center gap-2 ${
        align === "end" ? "flex-row-reverse text-end" : ""
      }`}
    >
      <Avatar className="h-7 w-7 shrink-0 border border-border">
        <AvatarImage
          src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(side.seed)}`}
        />
        <AvatarFallback className="bg-muted text-caption text-muted-foreground">
          {initials(side.name)}
        </AvatarFallback>
      </Avatar>
      <p className="min-w-0 truncate text-xs font-semibold sm:text-sm">{side.name}</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 items-center gap-3">
        {headerSide(a, "start")}
        {headerSide(b, "end")}
      </div>

      <div className="divide-y">
        {rows.map((r) => {
          const total = r.a + r.b;
          const aShare = total > 0 ? (r.a / total) * 100 : 50;
          const aBetter = r.lowerBetter ? r.a < r.b : r.a > r.b;
          const bBetter = r.lowerBetter ? r.b < r.a : r.b > r.a;
          return (
            <div key={r.label} className="py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`w-14 shrink-0 text-sm tabular-nums ${
                    aBetter ? "font-black text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {r.fmt(r.a)}
                </span>

                <div className="min-w-0 flex-1 text-center">
                  <p className="text-caption uppercase tracking-[0.1em] text-muted-foreground">
                    {r.label}
                  </p>
                  <p className="mt-0.5 text-caption leading-tight text-muted-foreground/70">
                    {r.help}
                  </p>
                </div>

                <span
                  className={`w-14 shrink-0 text-end text-sm tabular-nums ${
                    bBetter ? "font-black text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {r.fmt(r.b)}
                </span>
              </div>

              {/* Barra enfrentada: se llena hacia el centro de cada lado. */}
              <div className="mt-1.5 flex items-center gap-1" aria-hidden>
                <div className="flex h-1.5 flex-1 justify-end overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                    style={{ width: `${aShare}%` }}
                  />
                </div>
                <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-muted-foreground/45 transition-[width] duration-500 ease-out"
                    style={{ width: `${100 - aShare}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
