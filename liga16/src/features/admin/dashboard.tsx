import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Radio,
  ShieldCheck,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { db } from "@/lib/data";
import { useMatchUpdated } from "@/lib/refresh";
import type { Match, PlayerProfile, Team, Tournament } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPageHeader, AdminStat, AdminStatStrip } from "@/components/admin/page-header";
import { CardShell, CardIdentity, CardStat, CardFooterStrip } from "@/components/cards/card-kit";
import { Badge } from "@/components/ui/badge";
import { TournamentStatusBadge, MatchStatusBadge } from "@/components/admin/status-badge";
import { formatDateRange } from "@/lib/format";
import { groupByDivision } from "@/lib/categories";

interface DashboardData {
  tournaments: Tournament[];
  players: PlayerProfile[];
  teams: Team[];
  matches: Match[];
}

const CHART_COLORS = ["#e11d48", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4"];

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20 w-full" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendUp,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
  accent?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold tabular-nums ${accent ? "text-primary" : ""}`}>{value}</p>
            {trend && (
              <p className={`flex items-center gap-1 text-xs ${trendUp ? "text-emerald-600" : "text-muted-foreground"}`}>
                {trendUp && <TrendingUp className="h-3 w-3" />}
                {trend}
              </p>
            )}
          </div>
          <div className={`rounded-lg p-2 ${accent ? "bg-primary/10" : "bg-muted"}`}>
            <Icon className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityChart({ matches }: { matches: Match[] }) {
  const data = useMemo(() => {
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });
    return last7.map((date) => ({
      day: new Date(date).toLocaleDateString("es-MX", { weekday: "short" }),
      partidos: matches.filter((m) => m.scheduled_at?.startsWith(date)).length,
    }));
  }, [matches]);

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorPartidos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#e11d48" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} className="text-muted-foreground" />
        <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
        />
        <Area type="monotone" dataKey="partidos" stroke="#e11d48" strokeWidth={2} fill="url(#colorPartidos)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function DivisionPie({ teams }: { teams: Team[] }) {
  const data = useMemo(() => {
    const groups = groupByDivision(teams.filter((t) => t.played > 0));
    return groups.map((g) => ({
      name: g.label,
      value: g.teams.length,
    }));
  }, [teams]);

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function MatchesByStatus({ matches }: { matches: Match[] }) {
  const data = useMemo(() => {
    const counts = { live: 0, scheduled: 0, finished: 0 };
    matches.forEach((m) => {
      if (m.status === "live") counts.live++;
      else if (m.status === "scheduled") counts.scheduled++;
      else if (m.status === "finished") counts.finished++;
    });
    return [
      { name: "En vivo", value: counts.live, fill: "#e11d48" },
      { name: "Programados", value: counts.scheduled, fill: "#f59e0b" },
      { name: "Finalizados", value: counts.finished, fill: "#10b981" },
    ];
  }, [matches]);

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" />
        <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = () => {
    let active = true;
    Promise.all([
      db.listTournaments(),
      db.listPlayers(),
      db.listTeams(),
      db.listRecentMatches(),
    ])
      .then(([tournaments, players, teams, matches]) => {
        if (active) setData({ tournaments, players, teams, matches });
      })
      .catch((e: Error) => {
        if (active) setError(e.message || "No se pudo cargar el panel");
      });
    return () => { active = false; };
  };

  // Al capturar resultados, las métricas del dashboard se actualizan sin recargar.
  useMatchUpdated(() => {
    loadDashboard();
  });

  useEffect(() => {
    return loadDashboard();
  }, []);

  const pendingPlayers = useMemo(
    () => (data?.players ?? []).filter((p) => (p.status ?? "verificado") === "pendiente"),
    [data],
  );
  const liveMatches = useMemo(
    () => (data?.matches ?? []).filter((m) => m.status === "live"),
    [data],
  );
  const pendingMatches = useMemo(
    () => (data?.matches ?? []).filter((m) => m.status === "scheduled"),
    [data],
  );
  const running = useMemo(
    () => (data?.tournaments ?? []).filter((t) => t.status === "in_progress"),
    [data],
  );
  const openSignups = useMemo(
    () => (data?.tournaments ?? []).filter((t) => t.status === "registration_open"),
    [data],
  );
  const totalPlayers = data?.players.length ?? 0;
  const totalTeams = data?.teams.length ?? 0;
  const totalTournaments = data?.tournaments.length ?? 0;
  const finishedMatches = useMemo(
    () => (data?.matches ?? []).filter((m) => m.status === "finished").length,
    [data],
  );

  const tasks = [
    ...(pendingPlayers.length
      ? [{
          key: "verificar",
          count: pendingPlayers.length,
          label: pendingPlayers.length === 1 ? "perfil por verificar" : "perfiles por verificar",
          hint: "Nadie puede inscribirse a un torneo hasta que lo apruebes.",
          to: "/admin/jugadores",
          cta: "Ver la cola",
          icon: ShieldCheck,
        }]
      : []),
    ...(liveMatches.length
      ? [{
          key: "vivo",
          count: liveMatches.length,
          label: liveMatches.length === 1 ? "partido en vivo" : "partidos en vivo",
          hint: "Captura el resultado para que mueva el ranking y el bracket.",
          to: "/admin/resultados",
          cta: "Capturar",
          icon: Radio,
        }]
      : []),
    ...(pendingMatches.length
      ? [{
          key: "pendientes",
          count: pendingMatches.length,
          label: pendingMatches.length === 1 ? "partido por capturar" : "partidos por capturar",
          hint: "Resultados que faltan para cerrar el torneo.",
          to: "/admin/resultados",
          cta: "Abrir resultados",
          icon: ClipboardList,
        }]
      : []),
    ...(openSignups.length
      ? [{
          key: "inscripciones",
          count: openSignups.length,
          label: openSignups.length === 1 ? "torneo con inscripciones abiertas" : "torneos con inscripciones abiertas",
          hint: "Revisa quién se está inscribiendo.",
          to: "/admin/torneos",
          cta: "Ver torneos",
          icon: Users,
        }]
      : []),
  ];

  const lideres = useMemo(() => {
    const teams = data?.teams ?? [];
    if (teams.length === 0) return [];
    const conParejas = teams.filter((t) => t.played > 0);
    return groupByDivision(conParejas.length > 0 ? conParejas : teams)
      .map((g) => ({ ...g, leader: g.teams[0] }))
      .filter((g) => g.leader);
  }, [data]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
        <h1 className="text-lg font-semibold">No se pudo cargar el panel</h1>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button className="mt-4" variant="outline" size="sm" onClick={() => window.location.reload()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (!data) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Panel de control"
        description="Resumen general del circuito: actividad, torneos y tareas pendientes."
      >
        <AdminStatStrip>
          <AdminStat
            value={pendingPlayers.length}
            label="Por verificar"
            tone={pendingPlayers.length > 0 ? "text-primary" : undefined}
          />
          <AdminStat
            value={pendingMatches.length}
            label="Por capturar"
            tone={pendingMatches.length > 0 ? "text-primary" : undefined}
          />
          <AdminStat value={running.length} label="En juego" />
        </AdminStatStrip>
      </AdminPageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Jugadores" value={totalPlayers} icon={Users} accent />
        <StatCard label="Equipos" value={totalTeams} icon={Target} />
        <StatCard label="Torneos" value={totalTournaments} icon={Trophy} />
        <StatCard label="Partidos jugados" value={finishedMatches} icon={BarChart3} />
      </div>

      <section aria-labelledby="hoy" className="space-y-3">
        <h2 id="hoy" className="text-sm font-semibold">
          Tareas de hoy
        </h2>
        {tasks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex items-center gap-3 py-5">
              <ShieldCheck className="h-5 w-5 text-success" />
              <p className="text-sm text-muted-foreground">
                Nada pendiente. No hay perfiles por verificar ni partidos por capturar.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {tasks.map((t) => (
              <Link
                key={t.key}
                to={t.to}
                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CardShell accent>
                  <CardIdentity
                    lead={<t.icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />}
                    title={t.label}
                    meta={t.hint}
                  />
                  <CardFooterStrip
                    className="mt-3"
                    stats={[
                      <CardStat
                        key="n"
                        value={t.count}
                        label={t.count === 1 ? "pendiente" : "pendientes"}
                        tone="text-primary"
                      />,
                    ]}
                    chip={<Badge variant="secondary">{t.cta} →</Badge>}
                  />
                </CardShell>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4 text-primary" />
              Actividad semanal
            </h3>
            <ActivityChart matches={data.matches} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="h-4 w-4 text-primary" />
              Partidos por estado
            </h3>
            <MatchesByStatus matches={data.matches} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Target className="h-4 w-4 text-primary" />
              Equipos por división
            </h3>
            <DivisionPie teams={data.teams} />
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="torneos" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="torneos" className="text-sm font-semibold">
            Torneos en curso
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/torneos">Ver todos</Link>
          </Button>
        </div>
        {running.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-5 text-sm text-muted-foreground">
              No hay torneos en juego ahora mismo.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {running.map((t) => (
              <Card key={t.id} className="overflow-hidden">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateRange(t.start_date, t.end_date)} · {t.club_name ?? t.city}
                      </p>
                    </div>
                    <TournamentStatusBadge status={t.status} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/admin/torneos/${t.slug}?tab=bracket`}>Ver bracket</Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link to={`/admin/torneos/${t.slug}?tab=jornada`}>Jornada</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <section aria-labelledby="clasificacion" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="clasificacion" className="text-sm font-semibold">
              Líderes por división
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/ranking">Ver ranking</Link>
            </Button>
          </div>
          {lideres.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-5 text-sm text-muted-foreground">
                Todavía no hay parejas con partidos jugados.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {lideres.map(({ label, leader }) => (
                <div key={label} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary font-display text-lg text-primary-foreground">
                    1
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{leader.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {label} · {leader.won} de {leader.played}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-sm tabular-nums">{leader.points}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="actividad" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="actividad" className="text-sm font-semibold">
              Actividad reciente
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/resultados">Ver resultados</Link>
            </Button>
          </div>
          <Card>
            <CardContent className="divide-y p-0">
              {data.matches.length === 0 ? (
                <p className="px-4 py-5 text-sm text-muted-foreground">
                  Sin partidos registrados todavía.
                </p>
              ) : (
                data.matches.slice(0, 5).map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {m.side_a.pair_name} vs {m.side_b.pair_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.tournament_name} · {m.round}
                      </p>
                    </div>
                    <MatchStatusBadge status={m.status} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="inscripciones" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="inscripciones" className="text-sm font-semibold">
              Inscripciones abiertas
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/torneos">Ver torneos</Link>
            </Button>
          </div>
          {openSignups.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-5 text-sm text-muted-foreground">
                No hay torneos con inscripciones abiertas.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {openSignups.map((t) => (
                <Card key={t.id}>
                  <CardContent className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        <CalendarDays className="mr-1 inline h-3 w-3" />
                        Cierra {new Date(t.registration_deadline).toLocaleDateString("es-MX")}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="shrink-0">
                      <Link to={`/admin/torneos/${t.slug}`}>
                        Ver <ArrowUpRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
