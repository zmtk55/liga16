import { useEffect, useState, Suspense, lazy, useMemo } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, CalendarDays, Users, Zap, Activity, Target, Crown, Shirt, TrendingUp, TrendingDown, Minus, Sparkles, ShieldAlert, Pencil, HelpCircle, Swords, BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/data";
import type { Match, PlayerCard, PlayerProfile, RankingEntry, Team } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, initials, SEX_BRANCHES, sexLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import ImageUpload from "@/components/ui/image-upload";
import { MatchCard, PairAvatar } from "@/components/cards/card-kit";
import { toast } from "sonner";
import { analyzePlayerLocal, analyzePlayerWithJev, JEV_REMOTE_ENABLED, type JevAnalysis } from "@/lib/jev";
import { recordWinRate, type PlayerRecord } from "@/lib/records";
import { qualificationFor, type QualificationView } from "@/lib/qualification";

const LevelTrendChart = lazy(() => import("./level-trend-chart").then((m) => ({ default: m.LevelTrendChart })));
const PlayerStatsCharts = lazy(() => import("./stats-charts").then((m) => ({ default: m.PlayerStatsCharts })));

const handLabel: Record<PlayerProfile["dominant_hand"], string> = { right: "Diestro", left: "Zurdo", both: "Ambidiestro" };
const positionLabel: Record<PlayerProfile["preferred_position"], string> = { drive: "Drive", reves: "Revés", both: "Ambos" };
function cardWon(c: PlayerCard | null | undefined) { return (c as unknown as { record?: { won: number; played: number }; won?: number })?.record?.won ?? (c as unknown as { won?: number })?.won ?? 0; }
function cardPlayed(c: PlayerCard | null | undefined) { return (c as unknown as { record?: { won: number; played: number }; played?: number })?.record?.played ?? (c as unknown as { played?: number })?.played ?? 0; }
function cardPartner(c: PlayerCard | null | undefined) { return (c as unknown as { frequent_partner?: string; partner?: string })?.frequent_partner ?? (c as unknown as { partner?: string })?.partner ?? null; }

// Tooltip component for player metrics
function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {children}
      {open && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 rounded-lg bg-surface-inverse px-3 py-2 text-xs text-surface-inverse-foreground shadow-lg animate-fade-in">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-inverse" />
        </div>
      )}
    </div>
  );
}

// Animated bar component
function AnimatedBar({ value, max = 100, color = "primary", className = "" }: { value: number; max?: number; color?: string; className?: string }) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setAnimated(value), 100);
    return () => clearTimeout(timer);
  }, [value]);
  return (
    <div className={`h-2 rounded-full bg-muted overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full transition-[width] duration-700 ease-out ${color === "primary" ? "bg-primary" : color === "success" ? "bg-success" : color === "warning" ? "bg-warning" : color === "destructive" ? "bg-destructive" : "bg-primary"}`}
        style={{ width: `${Math.min(100, (animated / max) * 100)}%` }}
      />
    </div>
  );
}

/** Tarjeta de comparativa: jugador vs rival con métricas visuales. */
function CompareCard({ name, level, winPct, won, played, highlight }: {
  name: string;
  level: number;
  winPct: number;
  won: number;
  played: number;
  highlight?: boolean;
}) {
  const levelStr = level.toFixed(1);
  const tier = (label: string, a: number, b: number, max: number) => {
    const pctA = Math.max(8, Math.min(100, (a / Math.max(1, max)) * 100));
    const pctB = Math.max(8, Math.min(100, (b / Math.max(1, max)) * 100));
    const aWins = a >= b;
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className={cn("font-bold tabular-nums", aWins ? "text-success" : "text-white/70")}>{a}</span>
          <span className="text-white/40">{label}</span>
          <span className={cn("font-bold tabular-nums", !aWins ? "text-destructive" : "text-white/70")}>{b}</span>
        </div>
        <div className="flex gap-1">
          <span className="flex-1 overflow-hidden rounded-full bg-white/10">
            <span className={cn("block h-1.5 rounded-full", aWins ? "bg-success" : "bg-white/40")} style={{ width: `${pctA}%` }} />
          </span>
          <span className="flex-1 overflow-hidden rounded-full bg-white/10">
            <span className={cn("block h-1.5 rounded-full", !aWins ? "bg-destructive" : "bg-white/40")} style={{ width: `${pctB}%` }} />
          </span>
        </div>
      </div>
    );
  };
  const rival = { level: 4.0, jev: 50, winPct: 60, won: 5, played: 8 };
  return (
    <div className={cn("rounded-2xl border p-4 md:p-5", highlight ? "border-primary/40 bg-primary/[0.06]" : "border-white/10 bg-white/[0.04]")}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-headline text-lg font-bold text-white truncate">{name}</p>
          <p className="text-xs text-white/50">{played} partidos · {won} ganados</p>
        </div>
        <Badge className={cn("shrink-0", highlight ? "bg-primary/20 text-primary" : "bg-white/10 text-white/70")}>N {levelStr}</Badge>
      </div>
      <div className="mt-4 space-y-3">
        {tier("Nivel", level, rival.level, 8)}
        {tier("Win %", winPct, rival.winPct, 100)}
        {tier("Victorias", won, rival.won, 20)}
      </div>
    </div>
  );
}

/** Tile de estadística: número grande, rótulo chico arriba, contexto abajo. *//** Tile de estadística: número grande, rótulo chico arriba, contexto abajo. */
function StatTile({
  label,
  value,
  caption,
  accent = false,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  caption: string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="animate-fade-in min-w-0 rounded-xl border border-white/10 bg-white/[0.05] p-3 transition-colors hover:border-white/20 hover:bg-white/[0.08] md:p-4">
      <p className="text-2xs font-bold uppercase tracking-[0.18em] text-white/65">
        {label}
      </p>
      <p
        className={`mt-1.5 flex items-center gap-1.5 font-headline text-2xl leading-none tabular-nums md:text-3xl ${
          accent ? "text-primary" : "text-white"
        }`}
      >
        {icon}
        {value}
      </p>
      <p className="mt-1.5 truncate text-xs text-white/65">{caption}</p>
    </div>
  );
}

/**
 * Cuenta hasta el valor final. Las animaciones CSS no cubren JS, así que si la
 * persona pidió menos movimiento saltamos directo al número.
 */
function useCountUp(target: number, ms = 650) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let frame = 0;
    // Las animaciones CSS no cubren JS, así que si la persona pidió menos
    // movimiento saltamos directo al número final. Todo el setState vive en un
    // callback de frame, nunca en el cuerpo del efecto.
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const instant = reduceMotion || !Number.isFinite(target) || target === 0;
    if (instant) {
      frame = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(frame);
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      // ease-out quart: arranca rápido y frena suave
      setValue(target * (1 - Math.pow(1 - t, 4)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}

/** Números grandes que suben al cargar. */
function CountUp({
  value,
  suffix = "",
  decimals = 0,
  className,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const shown = useCountUp(value);
  return (
    <span className={className}>
      {shown.toLocaleString("es-MX", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/**
 * Sets ganados por partido, de lo más antiguo a lo más reciente.
 * El color es el resultado, así que la barra también dice si ganó.
 */
function TrendBars({
  values,
  form,
}: {
  values: number[];
  form: Array<"G" | "P">;
}) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const offset = values.length - form.length;
  return (
    <div
      className="flex h-20 items-end gap-1"
      role="img"
      aria-label={`Sets ganados en los últimos ${values.length} partidos`}
    >
      {values.map((v, i) => {
        const won = form[offset + i] !== "P";
        return (
          <div key={i} className="group relative flex h-full flex-1 items-end">
            <div
              className={`w-full rounded-t-[3px] origin-bottom transition-transform duration-700 ease-out motion-reduce:transition-none ${
                won ? "bg-primary" : "bg-muted-foreground/30"
              } group-hover:opacity-80`}
              style={{
                height: `${Math.max((v / max) * 100, 6)}%`,
                // escalonado: cada barra entra un poco después que la anterior
                transitionDelay: `${i * 45}ms`,
                animation: "fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
              }}
            />
            <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-xs tabular-nums text-background group-hover:block">
              {v}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [card, setCard] = useState<PlayerCard | null>(null);
  const [record, setRecord] = useState<PlayerRecord | null>(null);
  const [qualification, setQualification] = useState<QualificationView | null>(null);
  const [events, setEvents] = useState<import("@/types").RankingEvent[]>([]);
  const [ranking, setRanking] = useState<RankingEntry | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [myMatches, setMyMatches] = useState<Match[]>([]);
  const [compareId, setCompareId] = useState<string>("");
  const [rivals, setRivals] = useState<PlayerProfile[]>([]);
  const [pairInfo, setPairInfo] = useState<{ tournament: string | null; tournamentSlug: string | null; category: string | null } | null>(null);
  const [compareData, setCompareData] = useState<{ p: PlayerProfile; c: PlayerCard | null; r: RankingEntry | null; jev: JevAnalysis } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user, isConfigured } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "organizer";

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([db.getPlayer(id), db.getPlayerCard(id), db.getPlayerRecord(id), db.getPlayerRankingEvents(id), db.listRankings(), db.listTeams(), db.listPlayers(), db.listRecentMatches(), db.listTournaments(), db.listAllPairs()])
      .then(([p, c, rec, e, rks, teams, pls, allMatches, tournaments, allPairs]) => {
        if (!active || !p) return;
        setPlayer(p); setCard(c); setRecord(rec); setEvents(e);
        const rk = rks.find((r) => r.player_id === p.id) ?? null;
        setRanking(rk);
        // Equipo por ID real o, si el pair viejo no lo liga, por nombre en el roster
        const norm = (s: string) => s.trim().toLowerCase();
        const t =
          teams.find((tm) => tm.player1?.player_id === p.id || tm.player2?.player_id === p.id) ??
          teams.find((tm) => [tm.player1?.name, tm.player2?.name].some((n) => n && norm(n) === norm(p.display_name))) ?? null;
        setTeam(t);
        // Pareja actual = la inscripción más reciente del jugador; de ahí
        // salen el torneo y la categoría que se muestran en el cover.
        const myPairs = (allPairs ?? [])
          .filter((ap) => ap.player1_id === p.id || ap.player2_id === p.id || norm(ap.name) === norm(p.display_name) || norm(ap.name).includes(norm(p.display_name)))
          .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
        const latest = myPairs[0] ?? null;
        setPairInfo(
          latest
            ? {
                tournament: latest.tournament_name,
                tournamentSlug: tournaments.find((tr) => tr.name === latest.tournament_name)?.slug ?? null,
                category: latest.category_name,
              }
            : null,
        );

        // Camino a semifinales: tabla de la MISMA división y rama, con el cupo
        // que definió el organizador. Los puntos por victoria se deducen del
        // propio récord de la pareja, no se escriben a mano.
        if (t) {
          const cut = teams.filter(
            (tm) => tm.division === t.division && tm.sex === t.sex && tm.position > 0,
          );
          const active = tournaments.find(
            (tr) => tr.status === "registration_open" || tr.status === "in_progress",
          );
          setQualification(
            qualificationFor(
              cut.map((tm) => ({
                pairId: tm.id,
                name: tm.name,
                position: tm.position,
                points: tm.points,
                played: tm.played,
              })),
              { pairId: t.id, played: t.played, setsWon: t.sets_for },
              {
                slots: active?.semifinal_slots ?? 4,
                pointsPerWin: t.won > 0 ? Math.round(t.points / t.won) : 3,
              },
            ),
          );
        } else {
          setQualification(null);
        }
        // Partidos reales del jugador (por pair_id o por nombre en el marcador)
        const nameIn = (side: { pair_name: string } | null) =>
          (side?.pair_name ?? "").split("/").some((n) => n && norm(n) === norm(p.display_name));
        const mine = allMatches
          .filter((m) =>
            m.side_a.pair_id && teams.some((tm) => tm.id === m.side_a.pair_id && (tm.player1?.player_id === p.id || tm.player2?.player_id === p.id)) ||
            m.side_b.pair_id && teams.some((tm) => tm.id === m.side_b.pair_id && (tm.player1?.player_id === p.id || tm.player2?.player_id === p.id)) ||
            (!m.side_a.pair_id || !m.side_b.pair_id) && (nameIn(m.side_a) || nameIn(m.side_b)),
          )
          .sort((a, b) => String(b.scheduled_at).localeCompare(String(a.scheduled_at)));
        setMyMatches(mine);
        // Rivales = jugadores del MISMO torneo (no todos). Para comparar
        // deportivamente hace falta que jueguen en el mismo circuito.
        const myTournamentId = tournaments.find((tr) => tr.name === latest?.tournament_name)?.id ?? null;
        const rivals = (allPairs ?? []).filter(
          (ap) => ap.tournament_id === myTournamentId && (ap.player1_id === p.id || ap.player2_id === p.id),
        );
        const rivalIds = new Set(rivals.flatMap((ap) => [ap.player1_id, ap.player2_id].filter(Boolean) as string[]));
        rivalIds.delete(p.id);
        setRivals(pls.filter((x) => x.id !== p.id && rivalIds.has(x.id)));
      })
      .catch(() => { /* id inexistente: la UI ya muestra "Jugador no encontrado" */ })
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
    }).catch(() => { /* id inválido: se queda sin comparador */ });
  }, [compareId]);

  // JEV: el análisis local es puro y se calcula al renderizar; si hay API key,
  // el resultado remoto lo reemplaza cuando llega. La clave evita que un
  // resultado viejo sobreviva a un cambio de jugador.
  const localJev = useMemo(
    () =>
      player
        ? analyzePlayerLocal(
            player,
            card,
            ranking,
            record
              ? {
                  played: record.played,
                  won: record.won,
                  form: record.form,
                  setsPorPartida: record.trend,
                  opponents: record.recentMatches.map((m) => ({
                    won: m.won,
                    opponentLevel: m.opponentLevel,
                  })),
                }
              : null,
          )
        : null,
    [player, card, ranking, record],
  );
  const jevKey = `${player?.id ?? ""}|${card ? 1 : 0}|${ranking?.points ?? 0}|${record?.played ?? 0}`;
  const [remoteJev, setRemoteJev] = useState<{ key: string; value: JevAnalysis } | null>(null);
  const jev = remoteJev?.key === jevKey ? remoteJev.value : localJev;

  useEffect(() => {
    if (!JEV_REMOTE_ENABLED || !player) return;
    let alive = true;
    void analyzePlayerWithJev(player, card, ranking)
      .then((remote) => {
        if (alive && remote) setRemoteJev({ key: jevKey, value: remote });
      })
      // Si la IA falla, se queda el local: la tarjeta nunca queda vacía.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [player, card, ranking, jevKey]);
  const winPct = card ? Math.round((cardWon(card) / Math.max(1, cardPlayed(card))) * 100) : 0;

  if (loading) {
    return (
      <section className="space-y-6 animate-pulse">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[380px] w-full rounded-2xl" />
        <div className="grid gap-4 [&>*]:min-w-0 md:grid-cols-3"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
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

  // Solo el dueño del perfil o un admin pueden ver stats individuales
  const canView = !isConfigured || isAdmin || user?.player_id === player.id;
  if (!canView) {
    return (
      <section className="space-y-4">
        <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="h-4 w-4" /> Inicio</Link></Button>
        <Card className="max-w-md">
          <CardContent className="pt-6 space-y-4 text-center">
            <ShieldAlert className="h-12 w-12 mx-auto text-destructive" />
            <div>
              <h2 className="text-xl font-bold">Acceso privado</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Solo puedes ver tu propio perfil. Las estadísticas de otros jugadores están reservadas para administradores.
              </p>
            </div>
            <Button asChild><Link to={user?.player_id ? `/jugadores/${user.player_id}` : "/login"}>Ir a mi perfil</Link></Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  // El historial derivado manda para la tendencia: player_cards nunca se actualiza.
  const trendData = (record?.trend?.length ? record.trend : card?.trend ?? []).map((v, i) => ({ i, v }));
  const won = cardWon(card);
  const played = cardPlayed(card);
  const partner = cardPartner(card);
  // El historial derivado manda: la pareja actual es la de su última etapa.
  const currentPartner = record?.partners[0]?.partnerName ?? partner;
  const partnerCount = record?.partners.length ?? 0;
  // Racha = victorias consecutivas al final de la forma, no de toda la temporada.
  const streak = (() => {
    const form = record?.form ?? [];
    let n = 0;
    for (let i = form.length - 1; i >= 0 && form[i] === "G"; i--) n++;
    return n;
  })();
  const canEditPhoto = !isConfigured || isAdmin || user?.player_id === player.id;

  return (
    <div className="space-y-6 -mx-4 -mt-8 md:-mx-6">
      <section className="relative overflow-hidden bg-surface-inverse text-white">
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
          <Button asChild variant="ghost" size="sm" className="mb-4 text-white/70 hover:text-white hover:bg-white/10">
            <Link to="/jugadores"><ArrowLeft className="h-4 w-4" /> Jugadores</Link>
          </Button>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-center">
            <div className="space-y-4">
              <div>
                <p className="text-sm tracking-widest text-white/70 uppercase">{player.city} · {player.state}</p>
                <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">
                  {player.display_name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="default" className="bg-white text-black hover:bg-white/90">#{ranking?.position ?? "—"} Liga16</Badge>
                  <Badge variant="outline" className="border-white/20 text-white">{sexLabel(player.sex)} · {positionLabel[player.preferred_position]} · {handLabel[player.dominant_hand]}</Badge>
                  <Badge variant="outline" className="border-white/20 text-white">Nv {(player.official_level ?? player.declared_level).toFixed(1)}</Badge>
                </div>
              </div>

              {(() => {
                const mate = team
                  ? (team.player1?.player_id === player.id ? team.player2?.name : team.player1?.name) ?? currentPartner
                  : currentPartner;
                const [m1, m2] = (team?.name ?? "").split(" / ");
                return (
                  <div className="flex flex-col gap-3 rounded-xl border border-white/15 bg-white/10 p-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <PairAvatar p1={m1 || player.display_name} p2={m2} className="h-10 w-10 border-white/20 bg-white/10 text-sm [&>span]:bg-white/10 [&>span]:text-white" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">Pareja actual</p>
                        <p className="truncate text-sm font-semibold text-white">
                          {team?.name ?? (mate ? `con ${mate}` : "Sin equipo")}
                        </p>
                        <p className="truncate text-xs text-white/70">
                          {[pairInfo?.tournament, pairInfo?.category ?? team?.division].filter(Boolean).join(" · ") || "Sin torneo activo"}
                        </p>
                      </div>
                    </div>
                    {pairInfo?.tournamentSlug ? (
                      <Button asChild size="sm" variant="secondary" className="w-full shrink-0 sm:w-auto">
                        <Link to={`/torneos/${pairInfo.tournamentSlug}`}>Ver torneo</Link>
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="secondary" className="w-full shrink-0 sm:w-auto">
                        <Link to="/torneos">Ver torneos</Link>
                      </Button>
                    )}
                  </div>
                );
              })()}

              {/* Cuatro datos de un vistazo: la tira de abajo repetía tres de estos */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:gap-3">
                <StatTile
                  label="Puntos Liga16"
                  value={<CountUp value={ranking?.points ?? 0} />}
                  accent
                  icon={
                    ranking && ranking.delta !== 0 ? (
                      ranking.delta > 0
                        ? <TrendingUp className="h-4 w-4 text-success" />
                        : <TrendingDown className="h-4 w-4 text-destructive" />
                    ) : (
                      <Minus className="h-4 w-4 text-white/40" />
                    )
                  }
                  caption={
                    ranking
                      ? ranking.delta === 0
                        ? "sin cambio"
                        : `${ranking.delta > 0 ? "+" : ""}${ranking.delta} esta jornada`
                      : "sin clasificar"
                  }
                />
                <StatTile label="Títulos" value={String(card?.titles ?? 0)} caption="en el circuito" icon={<Crown className="h-4 w-4 text-warning" />} />
                <StatTile label="% victorias" value={`${winPct}%`} caption={`${won} de ${played} PJ`} />
                <StatTile label="Nivel" value={(player.official_level ?? player.declared_level).toFixed(1)} caption={player.official_level != null ? "oficial" : "declarado"} />
              </div>

              {/* Racha: el dato que hace que querer jugar el siguiente partido */}
              {played > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">
                      Racha actual
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {streak > 0 ? (
                        <span className="text-primary">{streak} victoria{streak === 1 ? "" : "s"} seguida{streak === 1 ? "" : "s"}</span>
                      ) : (
                        <span className="text-white/60">sin racha activa</span>
                      )}
                    </p>
                  </div>
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
                    role="progressbar"
                    aria-valuenow={winPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Porcentaje de victorias"
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
                      style={{ width: `${winPct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-white/70">
                    {won} victorias de {played} partidos disputados
                    {partnerCount > 1 ? ` · ${partnerCount} parejas en su historial` : ""}
                  </p>
                </div>
              )}

              {canEditPhoto && (
                <div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/20 bg-white/10 font-semibold text-white hover:bg-white/20 hover:text-white"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="h-4 w-4" /> Editar perfil
                  </Button>
                </div>
              )}
            </div>

<div className="relative">
                <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/20 via-transparent to-transparent blur-2xl" />
                {player.photo_url ? (
                  <img src={player.photo_url} alt={player.display_name} className="h-[340px] w-[300px] object-cover object-top rounded-2xl border border-white/10 shadow-2xl md:h-[420px] md:w-[340px]" />
                ) : (
                  <div className="flex h-[340px] w-[300px] items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 shadow-2xl md:h-[420px] md:w-[340px]">
                    <span className="text-6xl font-black text-white/90">{initials(player.display_name)}</span>
                  </div>
                )}
                {canEditPhoto && (
                  <ImageUpload
                    id="player-photo"
                    value={player.photo_url}
                    round
                    overlay
                    label="Foto de perfil"
                    onChange={(dataUrl) => {
                      if (dataUrl === null) return;
                      setPlayer({ ...player, photo_url: dataUrl });
                      db.updatePlayer(player.id, { photo_url: dataUrl })
                        .then(() => toast.success("Foto de perfil actualizada"))
                        .catch((e: Error) => toast.error(e.message ?? "No se pudo guardar la foto"));
                    }}
                  />
                )}
              </div>
          </div>
        </div>
      </section>

      {editOpen && (
        <ProfileEditDialog
          player={player}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={(p) => setPlayer(p)}
        />
      )}

      {/* ====== Estadísticas: gráficas del historial derivado ====== */}
      <section className="mx-auto max-w-7xl px-4 md:px-6">
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Estadísticas
            </CardTitle>
            {record && record.played > 0 && (
              <Badge variant="outline">{record.played} partidos en el historial</Badge>
            )}
          </CardHeader>
          <CardContent>
            {!record || record.played === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin partidos capturados todavía — las gráficas aparecen con tu primer partido.
              </p>
            ) : (
              <Suspense fallback={<Skeleton className="h-56 w-full" />}>
                <PlayerStatsCharts record={record} />
              </Suspense>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-7xl space-y-6 px-4 md:px-6">
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" /> Cómo llega el jugador
            <Tooltip content="Resumen automático de su forma, estilo, consistencia y contra quién juega.">
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-primary cursor-help" />
            </Tooltip>
          </h3>
          <div className="grid gap-4 [&>*]:min-w-0 md:grid-cols-3">
            {/* FORMA COMPETITIVA */}
            <Card className="group relative overflow-hidden border-primary/20 transition-all hover:shadow-md hover:-translate-y-0.5">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-warning" />
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Zap className="h-4 w-4 text-primary" />
                  Forma competitiva
                  <Tooltip content="Nivel 1 a 5 según su récord completo, sus últimos partidos y si viene subiendo o bajando.">
                    <Badge variant={jev.forma.score >= 4 ? "default" : jev.forma.score <= 2 ? "destructive" : "secondary"}>{jev.forma.score}/5</Badge>
                  </Tooltip>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-lg font-bold">{jev.forma.label}</p>
                  <AnimatedBar value={jev.forma.score} max={5} color="primary" className="mt-1" />
                  <p className="mt-1 text-xs text-muted-foreground">Confianza {(jev.forma.confidence * 100).toFixed(0)}% · Ritmo: {jev.ritmo}</p>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Tooltip key={n} content={`Nivel ${n}: ${["Le cuesta marcar diferencias","Juega de más a menos","Juega parejo","Viene en buen momento","Está jugando su mejor pádel"][n-1]}. Cuánto pesa ese nivel en el análisis.`}>
                      <div className="flex-1">
                        <AnimatedBar value={(jev.forma.distribution[n as 1|2|3|4|5] ?? 0) * 100} max={100} color="primary" className="h-1.5" />
                        <p className="mt-1 text-center text-xs text-muted-foreground">{n}</p>
                      </div>
                    </Tooltip>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ESTILO */}
            <Card className="group transition-all hover:shadow-md hover:-translate-y-0.5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Target className="h-4 w-4 text-primary" />
                  Estilo
                  <Tooltip content="Deduce su estilo de juego a partir de la posición que prefiere y la mano que usa.">
                    <Badge variant="outline">{jev.estilo.choice}</Badge>
                  </Tooltip>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm font-medium capitalize">{jev.estilo.choice}</p>
                {Object.entries(jev.estilo.probabilities).map(([k, v]) => (
                  <Tooltip key={k} content={`Probabilidad ${((v as number)*100).toFixed(0)}% de estilo ${k}.`}>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-20 capitalize text-muted-foreground">{k}</span>
                      <AnimatedBar value={(v as number) * 100} max={100} color="primary" className="flex-1 h-2" />
                      <span className="w-10 text-right tabular-nums">{((v as number) * 100).toFixed(0)}%</span>
                    </div>
                  </Tooltip>
                ))}
                <p className="text-xs text-muted-foreground">Confianza del modelo: {(jev.estilo.confidence * 100).toFixed(0)}%</p>
              </CardContent>
            </Card>

            {/* RACHA + CONSISTENCIA + RITMO */}
            <Card className="group transition-all hover:shadow-md hover:-translate-y-0.5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Activity className="h-4 w-4 text-primary" />
                  Racha
                  <Tooltip content="Si viene ganando o perdiendo AHORA: los partidos recientes pesan más que los viejos. Un partido de hace 3 cuenta la mitad.">
                    {jev.momentum?.reliable ? (
                      <Badge variant={jev.momentum.label === "Viene ganando" ? "default" : jev.momentum.label === "Viene perdiendo" ? "destructive" : "secondary"}>
                        {jev.momentum.label}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{jev.racha.label}</Badge>
                    )}
                  </Tooltip>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black tabular-nums">
                      {jev.momentum?.reliable
                        ? `${jev.momentum.score > 0 ? "+" : ""}${jev.momentum.score}`
                        : "—"}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {jev.momentum?.reliable
                        ? jev.momentum.racha > 0
                          ? `viene ganando · ${jev.momentum.racha} seguidas`
                          : `últimos ${jev.momentum.muestra} partidos`
                        : "faltan partidos"}
                    </span>
                  </div>
                  <AnimatedBar
                    value={jev.momentum?.reliable ? Math.abs(jev.momentum.score) : 0}
                    max={100}
                    color={jev.momentum?.label === "Viene ganando" ? "success" : jev.momentum?.label === "Viene perdiendo" ? "destructive" : "warning"}
                    className="mt-2 h-2.5"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <Tooltip content="Qué tan parejo rinde: si gana muchos sets con poca diferencia entre un partido y otro. 100 sería idéntico siempre.">
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-muted-foreground">Consistencia</p>
                      <p className="text-2xl font-black">{jev.consistencia.score}/100</p>
                      <p className="text-xs text-muted-foreground">{jev.consistencia.label}</p>
                    </div>
                  </Tooltip>
                  <Tooltip content="Si su nivel viene subiendo, estable o bajando respecto a como venía jugando.">
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-muted-foreground">Ritmo</p>
                      <p className="text-2xl font-black capitalize">{jev.ritmo}</p>
                    </div>
                  </Tooltip>
                  <Tooltip content="Forma = score 1-5 (ver tarjeta Forma). Resumen rápido.">
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-muted-foreground">Forma</p>
                      <p className="text-2xl font-black">{jev.forma.score}/5</p>
                      <p className="text-xs text-muted-foreground">{jev.forma.label}</p>
                    </div>
                  </Tooltip>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle className="text-base">Últimos partidos</CardTitle><Badge variant="outline">{myMatches.length} en el sistema</Badge></CardHeader>
            <CardContent className="space-y-2">
              {myMatches.length ? (
                myMatches.slice(0, 10).map((m) => (
                  <MatchCard key={m.id} match={m} />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Sin partidos todavía — aparecen cuando tu equipo tenga partidos en un torneo.</p>
              )}
            </CardContent>
          </Card>

          {jev?.rival && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <Swords className="h-4 w-4" /> Contra quién juega
                  </span>
                  {jev.rival.reliable && (
                    <span className="font-display text-2xl tabular-nums text-primary">
                      {jev.rival.score}
                    </span>
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {jev.rival.reliable
                    ? `Ganar a un 5 no es lo mismo que ganar a un 3. Ponderado por ${jev.rival.sample} rivales conocidos.`
                    : "Faltan rivales con nivel registrado para poder ponderar."}
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-bold">{jev.rival.label}</p>
                <AnimatedBar value={jev.rival.score} max={100} color="primary" className="mt-1.5" />
              </CardContent>
            </Card>
          )}

          {qualification && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <Target className="h-4 w-4" /> Camino a semifinales
                  </span>
                  {qualification.reliable && (
                    <span className="font-display text-2xl tabular-nums text-primary">
                      {qualification.semifinalProbability}%
                    </span>
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {qualification.reliable
                    ? "Estimación según tu posición actual en la tabla"
                    : "Falta muestra: se necesitan al menos 3 partidos y 4 parejas"}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/60 p-3">
                    <p className="font-display text-2xl tabular-nums">{qualification.position}º</p>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Posición</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-3">
                    <p className="font-display text-2xl tabular-nums">{qualification.pointsNeeded}</p>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Puntos</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-3">
                    <p className="font-display text-2xl tabular-nums">{qualification.setsNeeded ?? "—"}</p>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Sets</p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  {qualification.inCut
                    ? "Estás dentro del corte. Falta mantener el lugar."
                    : `Necesitas ${qualification.matchesNeeded} partido${qualification.matchesNeeded === 1 ? "" : "s"} para alcanzar el corte, a ${qualification.setsPerMatch} sets por partido.`}
                </p>

                {qualification.mustBeat.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      A quién tienes que ganarle
                    </p>
                    <ul className="divide-y rounded-lg border">
                      {qualification.mustBeat.map((m) => (
                        <li key={m.pairId} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span className="truncate font-medium">{m.name}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            +{m.lead} pts
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" /> Récord personal
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Todo lo que ha jugado, sin importar con quién. Si cambia de pareja, esto no se reinicia.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {!record ? (
                <p className="py-4 text-sm text-muted-foreground">
                  Todavía no hay partidos terminados para construir su récord.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: "Partidos", value: record.played },
                      { label: "Ganados", value: record.won },
                      { label: "Efectividad", value: `${recordWinRate(record)}%` },
                      { label: "Sets a favor", value: record.setsFor },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg bg-muted/60 p-3">
                        <p className="font-headline text-2xl tabular-nums">{s.value}</p>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                          {s.label}
                        </p>
                      </div>
                    ))}
                  </div>

                  {record.trend.length > 1 && (
                    <div>
                      <div className="mb-1 flex items-baseline justify-between gap-3">
                        <p className="text-xs font-medium text-muted-foreground">
                          Sets ganados por partido
                        </p>
                        <p className="text-xs text-muted-foreground">
                          últimos {record.trend.length}
                        </p>
                      </div>
                      <TrendBars values={record.trend} form={record.form} />
                    </div>
                  )}

                  {record.recentMatches.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Últimos partidos
                      </p>
                      <div className="overflow-hidden rounded-lg border">
                        {record.recentMatches.map((m) => (
                          <div
                            key={m.matchId}
                            className="flex items-center justify-between gap-3 border-b px-3 py-2.5 last:border-b-0"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                vs {m.opponentName}
                              </p>
                              {m.opponentLevel !== null && (
                                <p className="text-xs text-muted-foreground">
                                  rival {m.opponentLevel.toFixed(1)}
                                </p>
                              )}
                            </div>
                            <span
                              className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${
                                m.won ? "text-success" : "text-destructive"
                              }`}
                            >
                              {m.won ? "V" : "D"} {m.score}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {record.partners.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Historial de parejas
                      </p>
                      <ul className="divide-y rounded-lg border">
                        {record.partners.map((spell) => (
                          <li key={spell.pairId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {spell.partnerName === "—" ? spell.pairName : `con ${spell.partnerName}`}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {spell.pairName}
                                {spell.lastPlayedAt
                                  ? ` · último ${formatDate(spell.lastPlayedAt)}`
                                  : ""}
                              </p>
                            </div>
                            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                              {spell.won}/{spell.played}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Shirt className="h-4 w-4" /> Detalles</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl bg-muted p-3">
                <p className="text-xs font-semibold uppercase tracking-wide">Detalles pádel</p>
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
                  <p className="mb-1 text-xs font-medium">Juegos por partido · últimos 10</p>
                  <Suspense fallback={<Skeleton className="h-40 w-full" />}><LevelTrendChart data={trendData} /></Suspense>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

{isAdmin && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Comparar jugadores</CardTitle>
            <p className="text-xs text-muted-foreground">Solo rivales del mismo torneo. Elige a quién encarar.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-sm">
              <Select value={compareId} onValueChange={setCompareId}>
                <SelectTrigger><SelectValue placeholder="Selecciona rival del mismo torneo" /></SelectTrigger>
                <SelectContent>
                  {rivals.length === 0 ? (
                    <SelectItem value="__none__" disabled>Sin rivales en este torneo</SelectItem>
                  ) : (
                    rivals.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.display_name} · N {(p.official_level ?? p.declared_level).toFixed(1)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {compareData ? (
              <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                <CompareCard
                  name={player.display_name}
                  level={player.official_level ?? player.declared_level}
                  winPct={winPct}
                  won={won}
                  played={played}
                  highlight
                />
                <CompareCard
                  name={compareData.p.display_name}
                  level={compareData.p.official_level ?? compareData.p.declared_level}
                  winPct={compareData.c ? Math.round((cardWon(compareData.c) / Math.max(1, cardPlayed(compareData.c))) * 100) : 0}
                  won={cardWon(compareData.c)}
                  played={cardPlayed(compareData.c)}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Selecciona un rival del mismo torneo para ver la comparativa deportiva.</p>
            )}
          </CardContent>
        </Card>
      )}

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

/**
 * Diálogo para que el dueño del perfil (o un admin) edite sus datos personales
 * y de pádel. El nivel oficial no es editable: lo asigna la organización.
 */
function ProfileEditDialog({
  player,
  open,
  onOpenChange,
  onSaved,
}: {
  player: PlayerProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (p: PlayerProfile) => void;
}) {
  const [form, setForm] = useState({
    display_name: player.display_name,
    username: player.username,
    city: player.city ?? "",
    state: player.state ?? "",
    country: player.country ?? "",
    sex: player.sex,
    declared_level: String(player.declared_level ?? 4),
    dominant_hand: player.dominant_hand,
    preferred_position: player.preferred_position,
    bio: player.bio ?? "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const name = form.display_name.trim();
      const username = form.username.trim().toLowerCase();
      if (!name) throw new Error("El nombre no puede estar vacío");
      if (!/^[a-z0-9_-]{3,24}$/.test(username)) {
        throw new Error("El usuario debe tener 3-24 caracteres (letras, números, - o _)");
      }
      const updates = {
        display_name: name,
        username,
        city: form.city.trim(),
        state: form.state.trim(),
        country: form.country.trim(),
        sex: form.sex,
        declared_level: Number(form.declared_level) || 0,
        dominant_hand: form.dominant_hand,
        preferred_position: form.preferred_position,
        bio: form.bio.trim() || null,
      };
      const updated = await db.updatePlayer(player.id, updates);
      onSaved(updated as PlayerProfile);
      toast.success("Perfil actualizado");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message ?? "No se pudo guardar el perfil");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" /> Editar perfil
          </DialogTitle>
          <DialogDescription>
            Estos datos se muestran en tu dashboard público.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pp-name">Nombre</Label>
              <Input id="pp-name" value={form.display_name} onChange={(e) => set("display_name", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pp-username">Usuario</Label>
              <Input id="pp-username" value={form.username} onChange={(e) => set("username", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pp-city">Ciudad</Label>
              <Input id="pp-city" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pp-state">Estado</Label>
              <Input id="pp-state" value={form.state} onChange={(e) => set("state", e.target.value)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="pp-country">País</Label>
            <Input id="pp-country" value={form.country} onChange={(e) => set("country", e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Rama</Label>
              <Select value={form.sex} onValueChange={(v) => set("sex", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEX_BRANCHES.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pp-level">Nivel (1–7)</Label>
              <Input
                id="pp-level"
                type="number"
                min={1}
                max={7}
                step={0.1}
                value={form.declared_level}
                onChange={(e) => set("declared_level", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Mano</Label>
              <Select value={form.dominant_hand} onValueChange={(v) => set("dominant_hand", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="right">Diestro</SelectItem>
                  <SelectItem value="left">Zurdo</SelectItem>
                  <SelectItem value="both">Ambidiestro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Posición</Label>
            <Select value={form.preferred_position} onValueChange={(v) => set("preferred_position", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="drive">Drive</SelectItem>
                <SelectItem value="reves">Revés</SelectItem>
                <SelectItem value="both">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="pp-bio">Bio</Label>
            <Textarea
              id="pp-bio"
              rows={3}
              maxLength={280}
              placeholder="Cuéntale al circuito quién eres…"
              value={form.bio}
              onChange={(e) => set("bio", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}