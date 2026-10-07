import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ClipboardList,
  Radio,
  ShieldCheck,
  Users,
} from "lucide-react";
import { db } from "@/lib/data";
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
import Wheel from "@/features/admin/wheel";

interface DashboardData {
  tournaments: Tournament[];
  players: PlayerProfile[];
  teams: Team[];
  matches: Match[];
}

/**
 * Panel del organizador.
 *
 * Un panel no es un tablero de Entity CRUD: responde preguntas. Esta pantalla
 * está ordenada por lo que un organizador tiene que hacer hoy, cómo van sus
 * torneos y quién está calificando. Todo lo que se muestra sale de datos que ya
 * existen; nada se guarda para que esto exista.
 */
export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
    return () => {
      active = false;
    };
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
  /* Cuánto del calendario ya está capturado: la pregunta que el
     dial responde de un vistazo. */
  const finishedMatches = useMemo(
    () => (data?.matches ?? []).filter((m) => m.status === "finished").length,
    [data],
  );
  const totalMatches = data?.matches.length ?? 0;
  const progress = totalMatches ? Math.round((finishedMatches / totalMatches) * 100) : 0;

  /** Solo lo que hay que hacer. Si no hay nada, se dice que no hay nada. */
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

  /**
   * Quién lidera cada división.
   *
   * No es un top 3 global: la posición y los puntos de una pareja solo existen
   * dentro de su división, así que el 1 de 3ra no se compara con el 1 de 1ra.
   * Cada división trae a quien la encabeza.
   */
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

  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabecera como el resto del admin, no hero de landing: el bloque oscuro con
          el numeral fantasma "16" pesaba más que las tareas del día. Las tres cifras
          que traía el hero viven ahora en la franja de AdminStatStrip, que es la
          convención del admin (cada sección orienta con cifras antes de la tabla). */}
      <AdminPageHeader
        title="Panel"
        description="Lo que tienes que hacer hoy y cómo van tus torneos."
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

      {/* 1. Hoy. Lo único que un organizador abre el admin para hacer. */}
      <section aria-labelledby="hoy" className="space-y-3">
        <h2 id="hoy" className="text-sm font-semibold">
          Hoy
        </h2>
        {tasks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex items-center gap-3 py-5">
              <ShieldCheck className="h-5 w-5 text-emerald-700" />
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

      {/* 2. Torneos: los que están vivos, con su estado y por dónde entrar. */}
      <section aria-labelledby="torneos" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="torneos" className="text-sm font-semibold">
            Torneos
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

      {/* `grid-cols-1` no es decorativo: sin él la columna implícita es `auto`, que
          se dimensiona a max-content y no baja del ancho que pide su contenido más
          ancho. Los “Líderes por división” piden ~405px (pareja truncada + badge de
          estado) en una columna de 358px, la columna se salía de la pantalla y con
          ella `/admin` entero a 390. `repeat(1, minmax(0,1fr))` deja que la columna
          mida lo que mida el contenedor y `min-w-0`/`truncate` de las filas hagan
          su trabajo. Mismo motivo en los otros dos grids de la página. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {/* Clasificación: quién está arriba, en su propia división. */}
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

        {/* Actividad: lo último que pasó. */}
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

        {/* Progreso: qué tanto del calendario ya trae resultado.
            El dial es la respuesta de un vistazo; el pie la dice en números. */}
        <section aria-labelledby="progreso" className="space-y-3">
          <h2 id="progreso" className="text-sm font-semibold">
            Calendario capturado
          </h2>
          <Card>
            <CardContent className="flex flex-col items-center py-4">
              <Wheel value={progress} label="Partidos capturados" />
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {finishedMatches} de {totalMatches} partidos con resultado
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
