import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Building2,
  ClipboardList,
  Newspaper,
  Plus,
  Trophy,
  Users,
} from "lucide-react";
import { db } from "@/lib/data";
import type { Match, Tournament } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TournamentStatusBadge, MatchStatusBadge } from "@/components/admin/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { formatDateRange, formatMatchDateTime } from "@/lib/format";

interface DashboardData {
  tournaments: Tournament[];
  players: number;
  clubs: number;
  news: number;
  matches: Match[];
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      db.listTournaments(),
      db.listPlayers(),
      db.listClubs(),
      db.listNews(),
      db.listRecentMatches(),
    ])
      .then(([tournaments, players, clubs, news, matches]) => {
        if (active) {
          setData({ tournaments, players: players.length, clubs: clubs.length, news: news.length, matches });
        }
      })
      .catch((e: Error) => {
        if (active) setError(e.message || "No se pudo cargar el panel");
      });
    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(() => {
    const tournaments = data?.tournaments ?? [];
    const byDate = (a: Tournament, b: Tournament) => a.start_date.localeCompare(b.start_date);
    // "Próximos" = lo que está pasando ahora + lo que viene. Un torneo viejo sin
    // cerrar no es "próximo" y no debe empujar hacia abajo los que sí importan.
    const active = tournaments
      .filter((t) => t.status === "in_progress" || t.status === "registration_open")
      .sort(byDate);
    const today = new Date().toISOString().slice(0, 10);
    const future = tournaments
      .filter(
        (t) =>
          !active.includes(t) &&
          t.status !== "cancelled" &&
          t.status !== "finished" &&
          t.start_date >= today,
      )
      .sort(byDate);
    return {
      open: tournaments.filter((t) => t.status === "registration_open").length,
      live: (data?.matches ?? []).filter((m) => m.status === "live").length,
      finished: tournaments.filter((t) => t.status === "finished").length,
      upcoming: [...active, ...future].slice(0, 5),
    };
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

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Panel"
        description="Torneos, directorio y contenido del circuito en un solo lugar."
        action={
          <Button asChild size="sm">
            <Link to="/admin/torneos/nuevo">
              <Plus className="h-4 w-4" /> Nuevo torneo
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Torneos"
          value={data?.tournaments.length ?? 0}
          hint={`${summary.open} con inscripción abierta`}
          icon={<Trophy className="h-4 w-4 text-muted-foreground" />}
          to="/admin/torneos"
          loading={!data}
        />
        <StatCard
          title="Jugadores"
          value={data?.players ?? 0}
          hint="En el directorio"
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          to="/admin/jugadores"
          loading={!data}
        />
        <StatCard
          title="Sedes"
          value={data?.clubs ?? 0}
          hint="Club y canchas"
          icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
          to="/admin/padel"
          loading={!data}
        />
        <StatCard
          title="Noticias"
          value={data?.news ?? 0}
          hint="Publicadas"
          icon={<Newspaper className="h-4 w-4 text-muted-foreground" />}
          to="/admin/noticias"
          loading={!data}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Próximos torneos</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/torneos">Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!data ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : summary.upcoming.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No hay torneos programados.</p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link to="/admin/torneos/nuevo">Crear el primero</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {summary.upcoming.map((t) => (
                  <Link
                    key={t.id}
                    to={`/admin/torneos/${t.slug}`}
                    className="-mx-2 flex items-center justify-between gap-4 rounded-md px-2 py-3 transition-colors hover:bg-muted/60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{t.name}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {formatDateRange(t.start_date, t.end_date)} · {t.club_name ?? t.city}
                      </span>
                    </span>
                    <TournamentStatusBadge status={t.status} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estado del circuito</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2.5">
                <span className="text-sm text-muted-foreground">Inscripciones abiertas</span>
                {data ? (
                  <span className="font-semibold tabular-nums">{summary.open}</span>
                ) : (
                  <Skeleton className="h-5 w-6" />
                )}
              </div>
              <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2.5">
                <span className="text-sm text-muted-foreground">Partidos en vivo</span>
                {data ? (
                  <span className="font-semibold tabular-nums">{summary.live}</span>
                ) : (
                  <Skeleton className="h-5 w-6" />
                )}
              </div>
              <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2.5">
                <span className="text-sm text-muted-foreground">Torneos finalizados</span>
                {data ? (
                  <span className="font-semibold tabular-nums">{summary.finished}</span>
                ) : (
                  <Skeleton className="h-5 w-6" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Partidos recientes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!data ? (
                <Skeleton className="h-20 w-full" />
              ) : data.matches.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">Todavía no hay partidos registrados.</p>
              ) : (
                data.matches.slice(0, 3).map((m) => (
                  <div key={m.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {m.side_a.pair_name} vs {m.side_b.pair_name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {m.scheduled_at ? formatMatchDateTime(m.scheduled_at) : "Por definir"}
                      </p>
                    </div>
                    <MatchStatusBadge status={m.status} />
                  </div>
                ))
              )}
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to="/admin/resultados">
                  <ClipboardList className="h-4 w-4" /> Gestionar resultados
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
