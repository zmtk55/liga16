import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  ClipboardList,
  Radio,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { db } from "@/lib/data";
import type { Match, PlayerProfile, Team, Tournament } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TournamentStatusBadge, MatchStatusBadge } from "@/components/admin/status-badge";
import { formatDateRange } from "@/lib/format";

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

  /** Top 3 de la clasificación general, con quién está dentro del corte. */
  const podio = useMemo(() => {
    const teams = data?.teams ?? [];
    if (teams.length === 0) return null;
    const conParejas = teams.filter((t) => t.played > 0);
    const base = conParejas.length > 0 ? conParejas : teams;
    return [...base].sort((a, b) => a.position - b.position || b.points - a.points).slice(0, 3);
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
      <AdminPageHeader
        title="Panel"
        description="Lo que tienes que hacer hoy y cómo van tus torneos."
        action={
          <Button asChild size="sm">
            <Link to="/admin/torneos/nuevo">
              <Trophy className="h-4 w-4" /> Nuevo torneo
            </Link>
          </Button>
        }
      />

      {/* 1. Hoy. Lo único que un organizador abre el admin para hacer. */}
      <section aria-labelledby="hoy" className="space-y-3">
        <h2 id="hoy" className="text-sm font-semibold">
          Hoy
        </h2>
        {tasks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex items-center gap-3 py-5">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <p className="text-sm text-muted-foreground">
                Nada pendiente. No hay perfiles por verificar ni partidos por capturar.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {tasks.map((t) => (
              <Link
                key={t.key}
                to={t.to}
                className="group flex flex-col rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-2">
                  <t.icon className="h-5 w-5 text-primary" aria-hidden />
                  <ArrowRight
                    className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden
                  />
                </div>
                <p className="mt-3 flex items-baseline gap-1.5">
                  <span className="font-display text-3xl leading-none tabular-nums">{t.count}</span>
                  <span className="text-sm font-medium">{t.label}</span>
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">{t.hint}</p>
                <p className="mt-3 text-xs font-semibold text-primary">{t.cta} →</p>
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
          <div className="grid gap-3 lg:grid-cols-2">
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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Clasificación: quién está arriba. */}
        <section aria-labelledby="clasificacion" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="clasificacion" className="text-sm font-semibold">
              Clasificación
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/ranking">Ver ranking</Link>
            </Button>
          </div>
          {!podio || podio.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-5 text-sm text-muted-foreground">
                Todavía no hay parejas con partidos jugados.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="divide-y p-0">
                {podio.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-display text-lg ${
                        i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.division} · {t.won} de {t.played}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-sm tabular-nums">{t.points}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
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
      </div>
    </div>
  );
}
