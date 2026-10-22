import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Radio,
  ShieldCheck,
  Target,
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
  Sector,
  XAxis,
  YAxis,
} from "recharts";
import { db } from "@/lib/data";
import { useMatchUpdated } from "@/lib/refresh";
import { matchBucket, matchStatusKey } from "@/lib/match-state";
import type { Match, PlayerProfile, Team, Tournament } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { AdminEmptyState } from "@/components/admin/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { TournamentStatusBadge, MatchStatusBadge } from "@/components/admin/status-badge";
import { PopNumber } from "@/components/ui/transitions";
import { formatCity, formatDateRange } from "@/lib/format";
import { groupByDivision } from "@/lib/categories";
import { cn } from "@/lib/utils";

interface DashboardData {
  tournaments: Tournament[];
  players: PlayerProfile[];
  teams: Team[];
  matches: Match[];
}

/**
 * Paleta de las gráficas: los tokens --chart-1..6 de index.css. En la
 * página no hay ningún hex — el color de cada serie sale del token, y por
 * eso las gráficas se ven igual en claro y en oscuro.
 */
const PALETTE = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
];

const activityConfig = {
  partidos: { label: "Partidos", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const statusConfig = {
  "En vivo": { label: "En vivo", color: "hsl(var(--chart-live))" },
  "Por capturar": { label: "Por capturar", color: "hsl(var(--chart-pending))" },
  "En curso": { label: "En curso", color: "hsl(var(--chart-playing))" },
  Finalizados: { label: "Finalizados", color: "hsl(var(--chart-done))" },
} satisfies ChartConfig;

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

/**
 * Cifra del circuito: icono, número y etiqueta en una línea. Antes eran
 * cuatro cajas altas con un número perdido en el centro; el dato es
 * pequeño y no necesita una caja.
 */
function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <Card className="group transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <CardContent className="flex items-center gap-3 p-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 ease-out group-hover:scale-110",
            accent ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          {/* La cifra entra dígito a dígito cuando cambia (transitions-dev). */}
          <p className="text-stat leading-none">
            <PopNumber value={value} className={cn(accent && "text-primary")} />
          </p>
          {/* La etiqueta envuelve en vez de truncarse: "PARTIDOS JUGADOS"
              cortada dejaba una cifra sin significado. */}
          <p className="mt-0.5 text-caption uppercase leading-tight text-muted-foreground">{label}</p>
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

  // Una gráfica vacía parece rota. Si no hubo partidos en la semana, se dice
  // con palabras.
  if (data.every((d) => d.partidos === 0)) {
    return (
      <AdminEmptyState
        className="py-8"
        icon={<Activity className="h-5 w-5 text-muted-foreground" />}
        title="Sin actividad esta semana"
        description="No se jugó ningún partido en los últimos 7 días."
      />
    );
  }

  return (
    <ChartContainer config={activityConfig} className="h-[180px] w-full aspect-auto">
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="fillActividad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-partidos)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-partidos)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={26}
          allowDecimals={false}
          tick={{ fontSize: 11 }}
        />
        <ChartTooltip
          cursor={{ stroke: "hsl(var(--border))" }}
          content={<ChartTooltipContent indicator="line" />}
        />
        <Area
          dataKey="partidos"
          type="monotone"
          fill="url(#fillActividad)"
          stroke="var(--color-partidos)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}

function DivisionPie({ teams }: { teams: Team[] }) {
  const data = useMemo(() => {
    const groups = groupByDivision(teams.filter((t) => t.played > 0));
    return groups.map((g, i) => ({
      name: g.label,
      value: g.teams.length,
      fill: PALETTE[i % PALETTE.length],
    }));
  }, [teams]);
  // La porción sobre la que está el puntero se separa: es el micro-efecto
  // que dice "este número es este" sin tener que leer la leyenda.
  const [active, setActive] = useState<number | null>(null);
  // La config del shadcn: una entrada por división, con su color del token.
  const config = useMemo(
    () =>
      Object.fromEntries(
        data.map((d) => [d.name, { label: d.name, color: d.fill }]),
      ) as ChartConfig,
    [data],
  );

  if (data.length === 0) return null;

  return (
    <>
      <ChartContainer config={config} className="h-[180px] w-full aspect-auto">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="name" />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={44}
            outerRadius={70}
            paddingAngle={2}
            strokeWidth={0}
            activeIndex={active ?? undefined}
            activeShape={(props: {
              cx?: number;
              cy?: number;
              innerRadius?: number;
              outerRadius?: number;
              startAngle?: number;
              endAngle?: number;
              fill?: string;
            }) => {
              const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
              return (
                <Sector
                  cx={cx}
                  cy={cy}
                  innerRadius={innerRadius}
                  outerRadius={(outerRadius ?? 0) + 6}
                  startAngle={startAngle}
                  endAngle={endAngle}
                  fill={fill}
                />
              );
            }}
            onMouseEnter={(_, index) => setActive(index)}
            onMouseLeave={() => setActive(null)}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      {/* Leyenda: sin ella la dona dice cuántas parejas hay por división, pero
          no en cuál. */}
      <ul className="mt-3 space-y-1.5">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: d.fill }}
            />
            <span className="truncate text-muted-foreground">{d.name}</span>
            <span className="ml-auto shrink-0 font-medium tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function MatchesByStatus({ matches }: { matches: Match[] }) {
  const data = useMemo(() => {
    const counts = { live: 0, pending: 0, playing: 0, finished: 0 };
    // Las cuatro barras cuentan con la misma regla que la card y que la
    // pantalla de Resultados: si el partido tiene marcador, está finished.
    // Con el campo crudo, "Programados" decía 54 en una liga con 27
    // partidos ya jugados.
    matches.forEach((m) => {
      const k = matchBucket(m);
      if (k === "live") counts.live++;
      else if (k === "pending") counts.pending++;
      else if (k === "playing") counts.playing++;
      else if (k === "finished") counts.finished++;
    });
    return [
      { name: "En vivo", value: counts.live, fill: "hsl(var(--chart-live))" },
      { name: "Por capturar", value: counts.pending, fill: "hsl(var(--chart-pending))" },
      { name: "En curso", value: counts.playing, fill: "hsl(var(--chart-playing))" },
      { name: "Finalizados", value: counts.finished, fill: "hsl(var(--chart-done))" },
    ];
  }, [matches]);

  return (
    <ChartContainer config={statusConfig} className="h-[180px] w-full aspect-auto">
      {/* Barras horizontales: los cuatro nombres caben enteros en el eje y no
          hay que adivinar de qué barra es cada número. */}
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tickLine={false} axisLine={false} tickMargin={6} allowDecimals={false} tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          width={94}
          tick={{ fontSize: 11 }}
        />
        <ChartTooltip
          cursor={{ fill: "hsl(var(--muted))" }}
          content={<ChartTooltipContent nameKey="name" hideLabel />}
        />
        <Bar dataKey="value" radius={[4, 4, 4, 4]} barSize={18}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
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
    () => (data?.matches ?? []).filter((m) => matchBucket(m) === "pending"),
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
    () => (data?.matches ?? []).filter((m) => matchStatusKey(m) === "finished").length,
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
          <Spinner />
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
      />

      {/* Lo que pide atención va primero y en fila: una lista que se lee de un
          vistazo, no cuatro cajas con un número perdido en el centro. */}
      <section aria-labelledby="hoy" className="space-y-3">
        <h2 id="hoy" className="text-sm font-semibold">
          Tareas de hoy
        </h2>
        {tasks.length === 0 ? (
          <Card className="border-dashed">
            <AdminEmptyState
              className="py-6"
              icon={<ShieldCheck className="h-5 w-5 text-success" />}
              title="Nada pendiente"
              description="No hay perfiles por verificar ni partidos por capturar."
            />
          </Card>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => (
              <Link
                key={t.key}
                to={t.to}
                className="group flex items-center gap-4 rounded-xl border bg-card px-4 py-3 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                  <t.icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-sm">{t.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.hint}</p>
                </div>
                <p className="shrink-0 text-stat leading-none text-primary">
                  <PopNumber value={t.count} />
                </p>
                <Badge
                  variant="secondary"
                  className="hidden shrink-0 gap-1 transition-transform duration-200 group-hover:translate-x-0.5 sm:inline-flex"
                >
                  {t.cta}
                  <ArrowRight className="h-3 w-3" />
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Jugadores" value={totalPlayers} icon={Users} accent />
        <StatCard label="Equipos" value={totalTeams} icon={Target} />
        <StatCard label="Torneos" value={totalTournaments} icon={Trophy} />
        <StatCard label="Partidos jugados" value={finishedMatches} icon={BarChart3} />
      </div>

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
            <AdminEmptyState
              className="py-6"
              icon={<Trophy className="h-5 w-5 text-muted-foreground" />}
              title="Sin torneos en juego"
              description="No hay torneos en juego ahora mismo."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {running.map((t) => (
              <Card
                key={t.id}
                className="overflow-hidden transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateRange(t.start_date, t.end_date)} · {t.club_name ?? formatCity(t.city)}
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
              <AdminEmptyState
                className="py-6"
                icon={<Target className="h-5 w-5 text-muted-foreground" />}
                title="Todavía no hay líderes"
                description="Todavía no hay parejas con partidos jugados."
              />
            </Card>
          ) : (
            <div className="space-y-2">
              {lideres.map(({ label, leader }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors duration-200 hover:bg-muted/40"
                >
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
                  <div
                    key={m.id}
                    className="flex items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-muted/40"
                  >
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
              <AdminEmptyState
                className="py-6"
                icon={<Users className="h-5 w-5 text-muted-foreground" />}
                title="Sin inscripciones abiertas"
                description="No hay torneos con inscripciones abiertas."
              />
            </Card>
          ) : (
            <div className="space-y-2">
              {openSignups.map((t) => (
                <Card
                  key={t.id}
                  className="transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
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
