import { useEffect, useState, Suspense, lazy, useMemo } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, CalendarDays, MapPin, Users, Zap, Activity, Target, Crown, Shirt, TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import { db } from "@/lib/data";
import type { PlayerCard, PlayerProfile, RankingEntry, Team } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { analyzePlayerLocal, type JevAnalysis } from "@/lib/jev";

const LevelTrendChart = lazy(() => import("./level-trend-chart").then((m) => ({ default: m.LevelTrendChart })));

const handLabel: Record<PlayerProfile["dominant_hand"], string> = { right: "Diestro", left: "Zurdo", both: "Ambidiestro" };
const positionLabel: Record<PlayerProfile["preferred_position"], string> = { drive: "Drive", reves: "Revés", both: "Ambos" };

function initials(name: string) { return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(); }
function cardWon(c: PlayerCard | null | undefined) { return (c as unknown as { record?: { won: number; played: number }; won?: number })?.record?.won ?? (c as unknown as { won?: number })?.won ?? 0; }
function cardPlayed(c: PlayerCard | null | undefined) { return (c as unknown as { record?: { won: number; played: number }; played?: number })?.record?.played ?? (c as unknown as { played?: number })?.played ?? 0; }
function cardPartner(c: PlayerCard | null | undefined) { return (c as unknown as { frequent_partner?: string; partner?: string })?.frequent_partner ?? (c as unknown as { partner?: string })?.partner ?? null; }

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [card, setCard] = useState<PlayerCard | null>(null);
  const [events, setEvents] = useState<import("@/types").RankingEvent[]>([]);
  const [ranking, setRanking] = useState<RankingEntry | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [allPlayers, setAllPlayers] = useState<PlayerProfile[]>([]);
  const [compareId, setCompareId] = useState<string>("");
  const [compareData, setCompareData] = useState<{ p: PlayerProfile; c: PlayerCard | null; r: RankingEntry | null; jev: JevAnalysis } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([db.getPlayer(id), db.getPlayerCard(id), db.getPlayerRankingEvents(id), db.listRankings(), db.listTeams(), db.listPlayers()])
      .then(([p, c, e, rks, teams, pls]) => {
        if (!active || !p) return;
        setPlayer(p); setCard(c); setEvents(e);
        const rk = rks.find((r) => r.player_id === p.id) ?? null;
        setRanking(rk);
        const t = teams.find((tm) => tm.player1?.player_id === p.id || tm.player2?.player_id === p.id) ?? null;
        setTeam(t);
        setAllPlayers(pls.filter((x) => x.id !== p.id));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!compareId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset compare when no selection
      setCompareData(null);
      return;
    }
    Promise.all([db.getPlayer(compareId), db.getPlayerCard(compareId), db.listRankings()]).then(([p, c, rks]) => {
      if (!p) return;
      const rk = rks.find((r) => r.player_id === p.id) ?? null;
      const jev = analyzePlayerLocal(p, c, rk);
      setCompareData({ p, c, r: rk, jev });
    });
  }, [compareId]);

  const jev: JevAnalysis | null = useMemo(() => player ? analyzePlayerLocal(player, card, ranking) : null, [player, card, ranking]);
  const winPct = card ? Math.round((cardWon(card) / Math.max(1, cardPlayed(card))) * 100) : 0;

  if (loading) {
    return (
      <section className="space-y-6 animate-pulse">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[380px] w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
      </section>
    );
  }
  if (!player || !jev) {
    return (
      <section className="space-y-4">
        <Button asChild variant="ghost" size="sm"><Link to="/jugadores"><ArrowLeft className="h-4 w-4" /> Jugadores</Link></Button>
        <p className="text-muted-foreground">Jugador no encontrado.</p>
      </section>
    );
  }

  const trendData = card?.trend.map((v, i) => ({ i, v })) ?? [];
  const won = cardWon(card);
  const played = cardPlayed(card);
  const partner = cardPartner(card);

  return (
    <div className="space-y-6 -mx-4 -mt-8 md:-mx-6">
      <section className="relative overflow-hidden bg-[#0f0f0f] text-white">
        <div className="absolute inset-0 bg-gradient-to-r from-black via-zinc-900 to-transparent" />
        <div className="absolute right-6 top-6 select-none text-[140px] font-black leading-none text-white/5 md:text-[220px] md:right-12">
          {ranking ? String(ranking.position).padStart(2, "0") : initials(player.display_name)}
        </div>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 30% 50%, hsl(var(--primary)/0.25), transparent 60%)" }} />

        <div className="relative mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
          <Button asChild variant="ghost" size="sm" className="mb-4 text-white/70 hover:text-white hover:bg-white/10">
            <Link to="/jugadores"><ArrowLeft className="h-4 w-4" /> Jugadores</Link>
          </Button>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-center">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div>
                  <p className="text-sm tracking-widest text-white/60 uppercase">{player.city} · {player.state}</p>
                  <h1 className="text-4xl font-black tracking-tight md:text-5xl">
                    <span className="block text-lg font-normal tracking-wide text-white/70">{player.display_name.split(" ")[0]}</span>
                    <span className="bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">{player.display_name.split(" ").slice(1).join(" ") || player.display_name}</span>
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge className="bg-white text-black hover:bg-white">#{ranking?.position ?? "—"} Liga16</Badge>
                    <Badge variant="outline" className="border-white/20 text-white">#{player.sex} · {positionLabel[player.preferred_position]} · {handLabel[player.dominant_hand]}</Badge>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs backdrop-blur">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> {jev.racha.label}
                    </span>
                  </div>
                </div>
                <div className="ml-auto hidden items-center gap-2 md:flex">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black font-black">16</div>
                  <span className="text-xs leading-none text-white/60">Liga16<br /><span className="font-bold text-white">Circuito</span></span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div className="rounded-xl bg-white/5 p-3 backdrop-blur border border-white/10">
                  <p className="text-xs text-white/50">Nivel oficial</p>
                  <p className="text-2xl font-black tabular-nums">{(player.official_level ?? player.declared_level).toFixed(1)}</p>
                  <p className="text-xs text-white/50">declarado {player.declared_level.toFixed(1)}</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3 backdrop-blur border border-white/10">
                  <p className="text-xs text-white/50">Puntos</p>
                  <p className="text-2xl font-black tabular-nums">{ranking?.points.toLocaleString("es-MX") ?? "—"}</p>
                  <p className="text-xs flex items-center gap-1">{ranking?.delta === 0 ? <Minus className="h-3 w-3" /> : ranking && ranking.delta > 0 ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : <TrendingDown className="h-3 w-3 text-red-400" />} Δ {ranking?.delta ?? 0}</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3 backdrop-blur border border-white/10">
                  <p className="text-xs text-white/50">Récord</p>
                  <p className="text-lg font-black tabular-nums">{won} – {played - won} <span className="text-xs font-normal text-white/60">/ {played} PJ</span></p>
                  <p className="text-xs text-white/50">{winPct}% victorias</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3 backdrop-blur border border-white/10">
                  <p className="text-xs text-white/50">Títulos</p>
                  <p className="text-2xl font-black flex items-center gap-1"><Crown className="h-5 w-5 text-amber-400" /> {card?.titles ?? 0}</p>
                  <p className="text-xs text-white/50">Circuito</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white/10 px-3 py-1 border border-white/10">@{player.username}</span>
                <span className="rounded-full bg-white/10 px-3 py-1 border border-white/10 flex items-center gap-1"><MapPin className="h-3 w-3" /> {player.country}</span>
                <span className="rounded-full bg-white/10 px-3 py-1 border border-white/10">{player.bio ?? "Padel desde 2024"}</span>
              </div>
            </div>

            <div className="relative flex justify-center lg:justify-end">
              <div className="relative">
                <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/20 via-transparent to-transparent blur-2xl" />
                {player.photo_url ? (
                  <img src={player.photo_url} alt={player.display_name} className="h-[340px] w-[300px] object-cover object-top rounded-[1.5rem] border border-white/10 shadow-2xl md:h-[420px] md:w-[340px]" />
                ) : (
                  <div className="flex h-[340px] w-[300px] items-center justify-center rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-zinc-800 to-zinc-900 shadow-2xl md:h-[420px] md:w-[340px]">
                    <span className="text-6xl font-black text-white/90">{initials(player.display_name)}</span>
                  </div>
                )}
                <div className="absolute -bottom-3 -left-3 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-black shadow-xl">
                  <Avatar className="h-8 w-8"><AvatarImage src={`https://api.dicebear.com/9.x/initials/svg?seed=${player.display_name}`} /><AvatarFallback>{initials(player.display_name)}</AvatarFallback></Avatar>
                  <div className="leading-tight">
                    <p className="text-xs font-bold">{team?.name ?? "Sin equipo"}</p>
                    <p className="text-[11px] text-muted-foreground">{team?.division ?? "Libre"} {team ? `· #${team.position}` : ""}</p>
                  </div>
                </div>
                <div className="absolute -top-3 -right-3 rounded-2xl bg-primary px-4 py-2 text-center text-white shadow-xl">
                  <p className="text-[10px] uppercase tracking-widest opacity-80">Dorsal Liga</p>
                  <p className="text-xl font-black">#{ranking?.position ?? "—"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 md:px-6">
        <Card className="overflow-hidden border-zinc-800 bg-zinc-950 text-white">
          <CardContent className="p-0">
            <div className="grid grid-cols-3 divide-x divide-white/10 text-center md:grid-cols-6">
              {[
                { k: "PJ", v: played },
                { k: "PG", v: won },
                { k: "Win%", v: `${winPct}%` },
                { k: "Nivel", v: (player.official_level ?? player.declared_level).toFixed(1) },
                { k: "Puntos", v: ranking?.points.toLocaleString("es-MX") ?? "—" },
                { k: "Títulos", v: card?.titles ?? 0 },
              ].map((s) => (
                <div key={s.k} className="p-4 transition-colors hover:bg-white/5">
                  <p className="text-[11px] uppercase tracking-widest text-white/50">{s.k}</p>
                  <p className="mt-1 text-xl font-black tabular-nums">{s.v}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-7xl space-y-6 px-4 md:px-6">
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground"><Sparkles className="h-4 w-4 text-primary" /> Insights JEV — System One</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="group relative overflow-hidden border-primary/20 transition-all hover:shadow-md hover:-translate-y-0.5">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-amber-400" />
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Zap className="h-4 w-4 text-primary" /> Forma competitiva <Badge variant={jev.forma.score >= 4 ? "default" : jev.forma.score <= 2 ? "destructive" : "secondary"}>{jev.forma.score}/5</Badge></CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-lg font-bold">{jev.forma.label}</p>
                <Progress value={(jev.forma.score / 5) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground">Confianza {(jev.forma.confidence * 100).toFixed(0)}% · {jev.ritmo}</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div key={n} className="flex-1">
                      <div className="h-1.5 rounded-full bg-muted" style={{ opacity: (jev.forma.distribution[n as 1 | 2 | 3 | 4 | 5] ?? 0) * 2 }} />
                      <p className="mt-1 text-center text-[10px] text-muted-foreground">{n}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="group transition-all hover:shadow-md hover:-translate-y-0.5">
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Target className="h-4 w-4 text-primary" /> Estilo <Badge variant="outline">{jev.estilo.choice}</Badge></CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm font-medium capitalize">{jev.estilo.choice} · padel {player.preferred_position}</p>
                {Object.entries(jev.estilo.probabilities).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-xs">
                    <span className="w-20 capitalize text-muted-foreground">{k}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary transition-all duration-700" style={{ width: `${(v as number) * 100}%` }} /></div>
                    <span className="w-10 text-right tabular-nums">{((v as number) * 100).toFixed(0)}%</span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Confianza {(jev.estilo.confidence * 100).toFixed(0)}%</p>
              </CardContent>
            </Card>

            <Card className="group transition-all hover:shadow-md hover:-translate-y-0.5">
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Activity className="h-4 w-4 text-primary" /> Racha <Badge variant={jev.racha.label === "en racha" ? "default" : jev.racha.label === "bache" ? "destructive" : "secondary"}>{jev.racha.label}</Badge></CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-2xl font-black tabular-nums">{(jev.racha.probYes * 100).toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground">Prob. en racha positiva (Noul)</p>
                  <Progress value={jev.racha.probYes * 100} className="mt-2 h-2" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-muted p-2"><p className="text-muted-foreground">Consistencia</p><p className="font-bold">{jev.consistencia.score}/100</p></div>
                  <div className="rounded-lg bg-muted p-2"><p className="text-muted-foreground">Ritmo</p><p className="font-bold capitalize">{jev.ritmo}</p></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-base">Últimos juegos</CardTitle><Badge variant="outline">{card?.recent_results.length ?? 0} registrados</Badge></CardHeader>
            <CardContent className="space-y-2">
              {card?.recent_results.length ? card.recent_results.map((r, i) => {
                const win = r.startsWith("G");
                return (
                  <div key={i} className="group flex items-center gap-3 rounded-xl border p-3 transition-all hover:shadow-sm hover:border-primary/20" style={{ animationDelay: `${i * 80}ms` }}>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${win ? "bg-emerald-500 text-white" : "bg-zinc-900 text-white"}`}>{win ? "G" : "P"}</span>
                    <div className="flex-1">
                      <p className="font-mono text-sm font-bold tracking-wide">{r.replace("G ", "").replace("P ", "")}</p>
                      <p className="text-xs text-muted-foreground">Jornada {i + 1} · Liga16 · {win ? "Victoria" : "Derrota"}</p>
                    </div>
                    <Badge variant={win ? "default" : "outline"} className="transition-transform group-hover:scale-105">{win ? "+25" : "0"} pts</Badge>
                  </div>
                );
              }) : <p className="text-sm text-muted-foreground">Sin historial reciente.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Shirt className="h-4 w-4" /> Liga y compañero actual</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Equipo actual</p>
                  <p className="font-bold flex items-center gap-2"><Users className="h-4 w-4" /> {team?.name ?? "Sin equipo"}</p>
                  <p className="text-xs text-muted-foreground">{team?.city ?? player.city} · {team?.division ?? "Libre"}</p>
                  <p className="mt-2 text-xs"><span className="text-muted-foreground">División:</span> {team?.division ?? "—"} · {team?.sex ?? ""}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Compañero frecuente</p>
                  <p className="font-bold">{partner ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">Pareja habitual · nivel {(player.official_level ?? player.declared_level).toFixed(1)}</p>
                  <div className="mt-2 flex gap-1">
                    <Badge variant="secondary">Drive/Revés</Badge>
                    <Badge variant="outline">{handLabel[player.dominant_hand]}</Badge>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-muted p-3">
                <p className="text-xs font-semibold uppercase tracking-wide">Detalles padel</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <p><span className="text-muted-foreground">Mano:</span> {handLabel[player.dominant_hand]}</p>
                  <p><span className="text-muted-foreground">Posición:</span> {positionLabel[player.preferred_position]}</p>
                  <p><span className="text-muted-foreground">País:</span> {player.country}</p>
                  <p><span className="text-muted-foreground">Usuario:</span> @{player.username}</p>
                </div>
                {player.bio && <p className="mt-2 text-sm text-muted-foreground">{player.bio}</p>}
              </div>

              {trendData.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium">Tendencia de nivel</p>
                  <Suspense fallback={<Skeleton className="h-40 w-full" />}><LevelTrendChart data={trendData} /></Suspense>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Comparar jugadores</CardTitle>
            <p className="text-xs text-muted-foreground">Elige otro jugador y compara estadísticas deportivas lado a lado (sin finanzas). JEV recalcula forma y estilo.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-sm">
              <Select value={compareId} onValueChange={setCompareId}>
                <SelectTrigger><SelectValue placeholder="Selecciona rival para comparar" /></SelectTrigger>
                <SelectContent>
                  {allPlayers.slice(0, 30).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.display_name} · {p.city} · N {(p.official_level ?? p.declared_level).toFixed(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {compareData ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 text-left">Métrica</th>
                      <th className="py-2 text-center font-black">{player.display_name.split(" ")[0]}</th>
                      <th className="py-2 text-center font-black">{compareData.p.display_name.split(" ")[0]}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr><td className="py-2">Nivel</td><td className="py-2 text-center tabular-nums font-bold">{(player.official_level ?? player.declared_level).toFixed(1)}</td><td className="py-2 text-center tabular-nums">{(compareData.p.official_level ?? compareData.p.declared_level).toFixed(1)}</td></tr>
                    <tr><td className="py-2">Puntos ranking</td><td className="py-2 text-center tabular-nums">{ranking?.points ?? 0}</td><td className="py-2 text-center tabular-nums">{compareData.r?.points ?? 0}</td></tr>
                    <tr><td className="py-2">PJ / PG</td><td className="py-2 text-center">{played} / {won}</td><td className="py-2 text-center">{cardPlayed(compareData.c)} / {cardWon(compareData.c)}</td></tr>
                    <tr><td className="py-2">Win %</td><td className="py-2 text-center">{winPct}%</td><td className="py-2 text-center">{Math.round((cardWon(compareData.c) / Math.max(1, cardPlayed(compareData.c))) * 100)}%</td></tr>
                    <tr><td className="py-2">Títulos</td><td className="py-2 text-center">{card?.titles ?? 0}</td><td className="py-2 text-center">{compareData.c?.titles ?? 0}</td></tr>
                    <tr><td className="py-2">Forma JEV</td><td className="py-2 text-center">{jev.forma.score}/5 — {jev.forma.label}</td><td className="py-2 text-center">{compareData.jev.forma.score}/5 — {compareData.jev.forma.label}</td></tr>
                    <tr><td className="py-2">Estilo JEV</td><td className="py-2 text-center capitalize">{jev.estilo.choice}</td><td className="py-2 text-center capitalize">{compareData.jev.estilo.choice}</td></tr>
                    <tr><td className="py-2">Racha</td><td className="py-2 text-center">{(jev.racha.probYes * 100).toFixed(0)}% {jev.racha.label}</td><td className="py-2 text-center">{(compareData.jev.racha.probYes * 100).toFixed(0)}% {compareData.jev.racha.label}</td></tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Selecciona un rival para ver la comparativa deportiva.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Eventos de ranking</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {events.length === 0 ? <p className="text-muted-foreground">Sin eventos.</p> : events.map((ev) => (
              <div key={ev.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 transition-colors hover:bg-muted/50">
                <div className="space-y-0.5"><p className="font-medium">{ev.reason}</p><p className="text-xs text-muted-foreground">{formatDate(ev.created_at)}</p></div>
                <Badge variant="secondary" className="tabular-nums">+{ev.points} pts</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}