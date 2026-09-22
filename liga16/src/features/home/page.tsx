import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  CalendarDays,
  Search,
  Trophy,
  Users,
  Sparkles,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Clock,
  Zap,
} from "lucide-react";
import { db } from "@/lib/data";
import type { Match, NewsItem, Sponsor, Team, Tournament, RankingEntry } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentCard } from "@/components/cards/resource-card";
import {
  matchStatusLabel,
  tierLabel,
} from "@/lib/format";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer } from "recharts";

const statusVariantMatch: Record<
  Match["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  live: "destructive",
  scheduled: "secondary",
  finished: "outline",
  walkover: "outline",
  disputed: "destructive",
  cancelled: "outline",
};

function setsSummary(m: Match) {
  if (m.sets.length === 0) return "—";
  return m.sets.map((s) => `${s.a}-${s.b}`).join(" · ");
}

// ─── Animated counter ───
function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const duration = 800;
    const step = Math.max(1, Math.ceil(value / (duration / 16)));
    const timer = setInterval(() => {
      start = Math.min(start + step, value);
      setDisplay(start);
      if (start >= value) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <span className={className}>{display.toLocaleString()}</span>;
}

// ─── KPI Card with trend ───
function KpiCard({
  title,
  value,
  trend,
  icon,
  iconBg,
  iconColor,
  delay,
}: {
  title: string;
  value: number;
  trend?: { value: number; positive: boolean };
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  delay: number;
}) {
  return (
    <Card
      className="animate-slide-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-bold tracking-tight">
            <AnimatedNumber value={value} />
          </p>
          {trend && (
            <Badge
              variant={trend.positive ? "default" : "destructive"}
              className="text-xs font-medium"
            >
              {trend.positive ? (
                <TrendingUp className="mr-1 h-3 w-3" />
              ) : (
                <TrendingDown className="mr-1 h-3 w-3" />
              )}
              {Math.abs(trend.value)}%
            </Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">vs mes anterior</p>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [stats, setStats] = useState<{
    tournaments: Tournament[];
    teams: Team[];
    matches: Match[];
    news: NewsItem[];
    sponsors: Sponsor[];
    rankings: RankingEntry[];
  } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      db.listTournaments(),
      db.listTeams(),
      db.listRecentMatches(),
      db.listNews(),
      db.listSponsors(),
      db.listRankings(),
    ]).then(([tournaments, teams, matches, news, sponsors, rankings]) => {
      if (active) setStats({ tournaments, teams, matches, news, sponsors, rankings });
    });
    return () => {
      active = false;
    };
  }, []);

  const topPlayers = useMemo(() => stats?.rankings.slice(0, 5) ?? [], [stats]);

  // Chart data: monthly tournament counts (mock based on actual tournaments)
  const chartData = useMemo(() => {
    if (!stats) return [];
    const months = ["Jun", "Jul", "Ago", "Sept", "Oct", "Nov", "Dec"];
    const counts = [2, 1, 3, 4, 5, 3, 2];
    return months.map((month, i) => ({ month, count: counts[i] }));
  }, [stats]);

  // Activity items for the activity feed card
  const recentActivities = useMemo(() => {
    if (!stats) return [];
    const activities = [
      ...stats.matches.slice(0, 3).map((m) => ({
        type: "match" as const,
        icon: <CalendarDays className="h-3.5 w-3.5" />,
        title: `${m.side_a.pair_name} vs ${m.side_b.pair_name}`,
        subtitle: `${m.tournament_name} · ${m.round}`,
        time: m.status === "live" ? "En vivo" : m.scheduled_at,
        color: m.status === "live" ? "bg-red-500" : "bg-primary",
      })),
      ...stats.news.slice(0, 2).map((n) => ({
        type: "news" as const,
        icon: <Sparkles className="h-3.5 w-3.5" />,
        title: n.title,
        subtitle: n.tag,
        time: n.published_at,
        color: "bg-emerald-500",
      })),
    ];
    return activities;
  }, [stats]);

  if (!stats) {
    return (
      <div className="space-y-10">
        <div className="space-y-4">
          <Skeleton className="h-16 w-80" />
          <Skeleton className="h-5 w-96" />
          <Skeleton className="h-14 w-full max-w-md" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const liveMatches = stats.matches.filter((m) => m.status === "live");
  const openTournaments = stats.tournaments.filter(
    (t) => t.status === "registration_open" || t.status === "in_progress",
  );

  return (
    <div className="space-y-8">
      {/* ── Search bar ── */}
      <section className="animate-slide-up">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar jugadores, torneos, equipos, noticias..."
            className="h-14 pl-12 text-base bg-card shadow-sm border-border/50 focus-visible:ring-2 focus-visible:ring-primary/30"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <kbd className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">⌘</kbd>
              <kbd className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground ml-0.5">K</kbd>
            </Badge>
          </div>
        </div>
      </section>

      {/* ── KPI Cards ── */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Torneos Activos"
          value={openTournaments.length}
          trend={{ value: 18, positive: true }}
          icon={<Trophy className="h-4 w-4" />}
          iconBg="bg-primary/10"
          iconColor="text-primary"
          delay={0}
        />
        <KpiCard
          title="Equipos Inscritos"
          value={stats.teams.length}
          trend={{ value: 5, positive: true }}
          icon={<Users className="h-4 w-4" />}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-600"
          delay={100}
        />
        <KpiCard
          title="Partidos Hoy"
          value={stats.matches.filter((m) => m.status === "live" || m.status === "scheduled").length}
          trend={{ value: 12, positive: true }}
          icon={<Activity className="h-4 w-4" />}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-600"
          delay={200}
        />
        <KpiCard
          title="Jugadores Top"
          value={stats.rankings.length}
          trend={{ value: 8, positive: false }}
          icon={<BarChart3 className="h-4 w-4" />}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-600"
          delay={300}
        />
      </section>

      {/* ── Row 1: Chart + Activity Feed ── */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* Chart */}
        <Card className="lg:col-span-2 animate-slide-up" style={{ animationDelay: "100ms" }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Torneos por Mes</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Junio — Diciembre 2026</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/torneos">Ver todos<ChevronRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ChartContainer
            className="h-64"
            config={{
              count: { label: "Torneos", color: "primary" },
            }}
          >
            <BarChart data={chartData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="hsl(var(--primary))" fillOpacity={i === 3 ? 1 : 0.35} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card className="animate-slide-up" style={{ animationDelay: "200ms" }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Actividad Reciente</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/calendario">Ver todo</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivities.map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${a.color} text-white`}>
                  {a.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.subtitle}</p>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                  {a.type === "match" && a.time === "En vivo" ? (
                    <Badge variant="destructive" className="text-xs animate-pulse">EN VIVO</Badge>
                  ) : (
                    <Clock className="h-3 w-3 inline" />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* ── Row 2: Open tournaments + Quick stats ── */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* Manage card (Fusion orange accent) */}
        <Card className="relative overflow-hidden border-none bg-primary text-primary-foreground animate-scale-in" style={{ animationDelay: "100ms" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Gestionar Torneos</CardTitle>
            <p className="text-sm opacity-75 mt-1">
              {openTournaments.length} torneos con inscripciones abiertas
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <span className="text-5xl font-bold">{openTournaments.length}</span>
              <span className="text-sm opacity-75 mb-1">activos este mes</span>
            </div>
            <Button asChild size="sm" variant="secondary" className="mt-4">
              <Link to="/torneos">Crear torneo</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Tournament cards */}
        {openTournaments.slice(0, 2).map((t) => (
          <TournamentCard key={t.id} tournament={t} className="animate-slide-up" />
        ))}
      </section>

      {/* ── Top players ── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Top jugadores</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/ranking">Ver ranking completo</Link>
          </Button>
        </div>
        <div className="grid gap-3">
          {topPlayers.map((p) => (
            <div
              key={p.player_id}
              className="flex items-center gap-4 rounded-lg border p-3 hover:bg-accent/30 transition-colors animate-slide-up"
              style={{ animationDelay: `${p.position * 50}ms` }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {p.position}
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{p.player_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Nivel {p.level} · {p.points.toLocaleString()} pts
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{p.won} victorias</span>
                <Badge
                  variant={p.delta > 0 ? "default" : p.delta < 0 ? "destructive" : "outline"}
                  className="text-xs"
                >
                  {p.delta > 0 ? `▲ ${p.delta}` : p.delta < 0 ? `▼ ${Math.abs(p.delta)}` : "—"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Sponsors ── */}
      <section>
        <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Patrocinadores
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {stats.sponsors.map((s) => (
            <Card key={s.id} className="min-w-[180px] flex-1 max-w-[220px]">
              <CardContent className="flex flex-col items-center justify-center gap-1 py-5 text-center">
                <p className="text-sm font-semibold">{s.name}</p>
                <Badge variant="outline" className="text-xs">
                  {tierLabel[s.tier]}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="rounded-2xl bg-primary px-6 py-12 text-center text-primary-foreground animate-slide-up">
        <div className="relative z-10 mx-auto max-w-3xl">
          <Zap className="mx-auto mb-3 h-8 w-8 opacity-50" />
          <h2 className="text-2xl font-bold md:text-3xl">¿Listo para competir?</h2>
          <p className="mt-2 opacity-80">
            Crea tu perfil, forma parte de un equipo y participa en torneos del padel.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg" variant="secondary">
              <Link to="/jugadores">Crear mi perfil</Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10">
              <Link to="/torneos">Explorar torneos</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
