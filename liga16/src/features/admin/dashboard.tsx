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
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { AdminPageHeader } from "@/components/admin/page-header";
import { MatchStatusBadge } from "@/components/admin/status-badge";
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
  partidos: { label: "Partidos", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

/**
 * Dos mundos tonales (DESIGN.md): superficies claras y póster oscuro. Cada
 * tarjeta lleva UNA cifra grande; todo lo demás es contexto de esa cifra.
 */
/** Cifra grande de tarjeta: display face, tabular, tamaño fluido. */
const METRIC =
  "font-display font-bold leading-[0.95] tracking-[-0.03em] tabular-nums text-[length:clamp(2.75rem,4.5vw,4.25rem)]";
const METRIC_MD =
  "font-display font-bold leading-[0.95] tracking-[-0.03em] tabular-nums text-[length:clamp(2rem,3vw,2.75rem)]";
const CARD = "relative overflow-hidden rounded-3xl p-6";
const LIGHT = "liga16-surface liga16-surface--light";
const DARK = "liga16-surface liga16-surface--poster";
const LIFT =
  "transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Un solo pill de contexto bajo la cifra. */
function MetricPill({ children, tone = "muted", dark }: { children: React.ReactNode; tone?: "muted" | "primary"; dark?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption",
        tone === "primary"
          ? dark
            ? "bg-primary/20 text-primary"
            : "bg-primary/10 text-primary-strong"
          : dark
            ? "bg-white/10 text-white/70"
            : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

/** Tarjeta de cifra: etiqueta arriba, número enorme, un pill de contexto. */
function MetricCard({
  label,
  value,
  icon: Icon,
  to,
  dark,
  children,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  to: string;
  dark?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link to={to} className={cn(CARD, dark ? DARK : LIGHT, LIFT, "group flex flex-col justify-between gap-8")}>
      <div className="flex items-center justify-between gap-3">
        <span className={cn("text-caption uppercase", dark ? "text-white/60" : "text-muted-foreground")}>{label}</span>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-105",
            dark ? "bg-white/10 text-white" : "bg-primary/10 text-primary-strong",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <div className="space-y-3">
        <p className={METRIC}>
          <PopNumber value={value} />
        </p>
        {children}
      </div>
    </Link>
  );
}

/** Encabezado de tarjeta: título + enlace de salida, igual en todas. */
function CardHead({ title, to, cta, dark }: { title: string; to?: string; cta?: string; dark?: boolean }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2.5 text-base font-semibold">
        <span aria-hidden className="h-2.5 w-2.5 rounded-[4px] bg-primary" />
        {title}
      </h2>
      {to && cta && (
        <Link
          to={to}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
            dark ? "bg-white/10 text-white/80 hover:bg-white/20" : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          {cta}
          <ArrowUpRight className="h-3 w-3" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function SoftEmpty({ icon: Icon, title, description, dark }: { icon: React.ElementType; title: string; description: string; dark?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-2xl border border-dashed px-4 py-8 text-center",
        dark ? "border-white/15" : "border-border",
      )}
    >
      <Icon className={cn("mb-1 h-5 w-5", dark ? "text-white/50" : "text-muted-foreground")} aria-hidden />
      <p className="text-sm font-semibold">{title}</p>
      <p className={cn("max-w-xs text-xs", dark ? "text-white/60" : "text-muted-foreground")}>{description}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-full max-w-md" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Skeleton className="h-[330px] rounded-3xl lg:col-span-8" />
        <Skeleton className="h-[330px] rounded-3xl lg:col-span-4" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-3xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Skeleton className="h-72 rounded-3xl lg:col-span-5" />
        <Skeleton className="h-72 rounded-3xl lg:col-span-4" />
        <Skeleton className="h-72 rounded-3xl lg:col-span-3" />
      </div>
    </div>
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
      <div className="flex h-[200px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 text-center">
        <Activity className="h-5 w-5 text-white/50" aria-hidden />
        <p className="text-sm font-semibold">Sin actividad esta semana</p>
        <p className="max-w-xs text-xs text-white/60">No se jugó ningún partido en los últimos 7 días.</p>
      </div>
    );
  }

  return (
    <ChartContainer config={activityConfig} className="h-[200px] w-full aspect-auto [&_.recharts-cartesian-axis-tick_text]:!fill-white/50 [&_.recharts-cartesian-grid_line]:!stroke-white/10">
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
          cursor={{ stroke: "hsl(0 0% 100% / 0.2)" }}
          content={<ChartTooltipContent indicator="line" />}
        />
        <Area
          dataKey="partidos"
          type="monotone"
          fill="url(#fillActividad)"
          stroke="var(--color-partidos)"
          strokeWidth={2.5}
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
      <ul className="mt-4 space-y-2">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2 text-sm">
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

/**
 * Partidos por estado: una barra segmentada y su leyenda. Reemplaza la gráfica
 * de barras; cuenta con la misma regla que Resultados (matchBucket).
 */
function MatchesByStatus({ matches }: { matches: Match[] }) {
  const data = useMemo(() => {
    const counts = { live: 0, pending: 0, playing: 0, finished: 0 };
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
  const total = data.reduce((n, d) => n + d.value, 0);

  if (total === 0) {
    return <SoftEmpty icon={BarChart3} title="Sin partidos" description="Cuando haya partidos, aquí verás en qué estado van." />;
  }

  return (
    <div className="space-y-5">
      <div className="flex h-4 w-full gap-1 overflow-hidden rounded-full" role="img" aria-label="Partidos por estado">
        {data
          .filter((d) => d.value > 0)
          .map((d) => (
            <span
              key={d.name}
              className="h-full rounded-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(d.value / total) * 100}%`, backgroundColor: d.fill }}
            />
          ))}
      </div>
      <ul className="grid grid-cols-2 gap-3">
        {data.map((d) => (
          <li key={d.name} className="rounded-2xl bg-muted/60 px-3.5 py-3">
            <p className="flex items-center gap-2 text-caption uppercase text-muted-foreground">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: d.fill }} />
              {d.name}
            </p>
            <p className="mt-1 font-display text-3xl font-bold leading-none tabular-nums">{d.value}</p>
          </li>
        ))}
      </ul>
    </div>
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
        if (active) {
          setError(null);
          setData({ tournaments, players, teams, matches });
        }
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
  const teamsWithMatches = useMemo(() => (data?.teams ?? []).filter((t) => t.played > 0).length, [data]);
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
          to: "/admin/jugadores",
          icon: ShieldCheck,
        }]
      : []),
    ...(liveMatches.length
      ? [{
          key: "vivo",
          count: liveMatches.length,
          label: liveMatches.length === 1 ? "partido en vivo" : "partidos en vivo",
          to: "/admin/resultados",
          icon: Radio,
        }]
      : []),
    ...(pendingMatches.length
      ? [{
          key: "pendientes",
          count: pendingMatches.length,
          label: pendingMatches.length === 1 ? "partido por capturar" : "partidos por capturar",
          to: "/admin/resultados",
          icon: ClipboardList,
        }]
      : []),
    ...(openSignups.length
      ? [{
          key: "inscripciones",
          count: openSignups.length,
          label: openSignups.length === 1 ? "torneo con inscripciones abiertas" : "torneos con inscripciones abiertas",
          to: "/admin/torneos",
          icon: Users,
        }]
      : []),
  ];
  const totalTasks = tasks.reduce((n, t) => n + t.count, 0);

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
      <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-8">
        <h1 className="text-lg font-semibold">No se pudo cargar el panel</h1>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button
          className="mt-4"
          variant="outline"
          size="sm"
          onClick={() => {
            setError(null);
            loadDashboard();
          }}
        >
          <Spinner />
          Reintentar
        </Button>
      </div>
    );
  }

  if (!data) return <DashboardSkeleton />;

  const tile = "flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3 transition-colors duration-200 hover:bg-muted";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Panel de control"
        description="Resumen general del circuito: actividad, torneos y tareas pendientes."
      />

      {/* Fila 1: la semana en una gráfica oscura y, al lado, lo que pide atención hoy. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section aria-labelledby="actividad-semanal" className={cn(CARD, DARK, "lg:col-span-8")}>
          <div className="liga16-stripe" aria-hidden />
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 id="actividad-semanal" className="flex items-center gap-2.5 text-base font-semibold">
                <span aria-hidden className="h-2.5 w-2.5 rounded-[4px] bg-primary" />
                Actividad semanal
              </h2>
              <p className="mt-1 text-xs text-white/60">Partidos programados en los últimos 7 días</p>
            </div>
            <div className="text-right">
              <p className={cn(METRIC_MD, "text-primary")}>
                <PopNumber value={data.matches.filter((m) => {
                  const d = new Date();
                  d.setDate(d.getDate() - 6);
                  return m.scheduled_at && m.scheduled_at.slice(0, 10) >= d.toISOString().slice(0, 10);
                }).length} />
              </p>
              <p className="mt-1 text-caption uppercase text-white/60">esta semana</p>
            </div>
          </div>
          <ActivityChart matches={data.matches} />
        </section>

        <section aria-labelledby="hoy" className={cn(CARD, "flex flex-col bg-primary text-primary-foreground lg:col-span-4")}>
          <div className="flex items-center justify-between gap-3">
            <h2 id="hoy" className="text-caption uppercase">Tareas de hoy</h2>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/15">
              <ShieldCheck className="h-4 w-4" aria-hidden />
            </span>
          </div>
          {tasks.length === 0 ? (
            <div className="mt-6 flex flex-1 flex-col justify-end gap-2">
              <p className={METRIC_MD}>Todo al día</p>
              <p className="text-sm opacity-80">No hay perfiles por verificar ni partidos por capturar.</p>
            </div>
          ) : (
            <>
              <div className="mt-6">
                <p className={METRIC}>
                  <PopNumber value={totalTasks} />
                </p>
                <p className="mt-1 text-sm font-medium opacity-80">
                  {totalTasks === 1 ? "pendiente por atender" : "pendientes por atender"}
                </p>
              </div>
              <ul className="mt-6 space-y-2">
                {tasks.map((t) => (
                  <li key={t.key}>
                    <Link
                      to={t.to}
                      className="group flex items-center gap-3 rounded-full bg-black/15 py-2 pl-2 pr-4 text-sm font-medium transition-colors duration-200 hover:bg-black/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground/90 text-primary">
                        <t.icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        <span className="tabular-nums font-bold">{t.count}</span> {t.label}
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {/* Fila 2: cuatro cifras, una por tarjeta. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Jugadores" value={totalPlayers} icon={Users} to="/admin/jugadores">
          {pendingPlayers.length > 0 ? (
            <MetricPill tone="primary">{pendingPlayers.length} por verificar</MetricPill>
          ) : (
            <MetricPill>Todos verificados</MetricPill>
          )}
        </MetricCard>
        <MetricCard label="Equipos" value={totalTeams} icon={Target} to="/admin/equipos">
          <MetricPill>{teamsWithMatches} con partidos</MetricPill>
        </MetricCard>
        <MetricCard label="Torneos" value={totalTournaments} icon={Trophy} to="/admin/torneos">
          <MetricPill tone={running.length > 0 ? "primary" : "muted"}>
            {running.length > 0 ? `${running.length} en curso` : "Ninguno en curso"}
          </MetricPill>
        </MetricCard>
        <MetricCard label="Partidos jugados" value={finishedMatches} icon={BarChart3} to="/admin/resultados" dark>
          <MetricPill dark tone={liveMatches.length > 0 ? "primary" : "muted"}>
            {liveMatches.length > 0 ? `${liveMatches.length} en vivo` : "Ninguno en vivo"}
          </MetricPill>
        </MetricCard>
      </div>

      {/* Fila 3: torneos en juego, estado de los partidos, reparto por división. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section aria-labelledby="torneos" className={cn(CARD, DARK, "lg:col-span-5")}>
          <CardHead title="Torneos en curso" to="/admin/torneos" cta="Ver todos" dark />
          <span id="torneos" className="sr-only">Torneos en curso</span>
          {running.length === 0 ? (
            <SoftEmpty dark icon={Trophy} title="Sin torneos en juego" description="No hay torneos en juego ahora mismo." />
          ) : (
            <ul className="space-y-3">
              {running.map((t) => (
                <li key={t.id} className="space-y-3 rounded-2xl bg-white/[0.06] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{t.name}</p>
                      <p className="mt-0.5 text-xs text-white/60">
                        {formatDateRange(t.start_date, t.end_date)} · {t.club_name ?? formatCity(t.city)}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/20 px-2.5 py-1 text-caption text-primary">
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
                      En juego
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/admin/torneos/${t.slug}?tab=bracket`}
                      className="rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-white/20"
                    >
                      Ver bracket
                    </Link>
                    <Link
                      to={`/admin/torneos/${t.slug}?tab=jornada`}
                      className="rounded-full px-3.5 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      Jornada
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="estado-partidos" className={cn(CARD, LIGHT, "lg:col-span-4")}>
          <CardHead title="Partidos por estado" to="/admin/resultados" cta="Resultados" />
          <span id="estado-partidos" className="sr-only">Partidos por estado</span>
          <MatchesByStatus matches={data.matches} />
        </section>

        <section aria-labelledby="divisiones" className={cn(CARD, LIGHT, "lg:col-span-3")}>
          <CardHead title="Por división" />
          <span id="divisiones" className="sr-only">Equipos por división</span>
          {teamsWithMatches === 0 ? (
            <SoftEmpty icon={Target} title="Sin divisiones aún" description="Aparecen cuando haya parejas con partidos jugados." />
          ) : (
            <DivisionPie teams={data.teams} />
          )}
        </section>
      </div>

      {/* Fila 4: líderes, últimos partidos, inscripciones. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section aria-labelledby="clasificacion" className={cn(CARD, LIGHT, "lg:col-span-4")}>
          <CardHead title="Líderes por división" to="/admin/ranking" cta="Ranking" />
          <span id="clasificacion" className="sr-only">Líderes por división</span>
          {lideres.length === 0 ? (
            <SoftEmpty icon={Target} title="Todavía no hay líderes" description="Todavía no hay parejas con partidos jugados." />
          ) : (
            <ul className="space-y-2">
              {lideres.map(({ label, leader }) => (
                <li key={label} className={tile}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-display text-lg font-bold text-primary-foreground">
                    1
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{leader.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {label} · {leader.won} de {leader.played}
                    </p>
                  </div>
                  <span className="shrink-0 font-display text-2xl font-bold leading-none tabular-nums">{leader.points}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="actividad" className={cn(CARD, LIGHT, "lg:col-span-4")}>
          <CardHead title="Actividad reciente" to="/admin/resultados" cta="Resultados" />
          <span id="actividad" className="sr-only">Actividad reciente</span>
          {data.matches.length === 0 ? (
            <SoftEmpty icon={Activity} title="Sin partidos todavía" description="Los partidos registrados aparecerán aquí." />
          ) : (
            <ul className="space-y-2">
              {data.matches.slice(0, 5).map((m) => (
                <li key={m.id} className={tile}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {m.side_a.pair_name} vs {m.side_b.pair_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.tournament_name} · {m.round}
                    </p>
                  </div>
                  <MatchStatusBadge status={m.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="inscripciones" className={cn(CARD, DARK, "lg:col-span-4")}>
          <CardHead title="Inscripciones abiertas" to="/admin/torneos" cta="Torneos" dark />
          <span id="inscripciones" className="sr-only">Inscripciones abiertas</span>
          {openSignups.length === 0 ? (
            <SoftEmpty dark icon={Users} title="Sin inscripciones abiertas" description="No hay torneos con inscripciones abiertas." />
          ) : (
            <ul className="space-y-3">
              {openSignups.map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/admin/torneos/${t.slug}`}
                    className="group flex items-center gap-3 rounded-2xl bg-white/[0.06] p-4 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{t.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-white/60">
                        <CalendarDays className="h-3 w-3" aria-hidden />
                        Cierra {new Date(t.registration_deadline).toLocaleDateString("es-MX")}
                      </p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-white/60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
