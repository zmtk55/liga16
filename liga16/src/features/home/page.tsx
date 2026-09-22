import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { CalendarDays, Trophy, Users } from "lucide-react";
import { db } from "@/lib/data";
import type { Match, NewsItem, Sponsor, Team, Tournament } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/shared/stat-card";
import { formatDateRange, matchStatusLabel, tierLabel, tournamentStatusLabel } from "@/lib/format";

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
  return m.sets.map((s) => `${s.a}-${s.b}`).join("  ");
}

export default function Home() {
  const [stats, setStats] = useState<{
    tournaments: Tournament[];
    teams: Team[];
    matches: Match[];
    news: NewsItem[];
    sponsors: Sponsor[];
  } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      db.listTournaments(),
      db.listTeams(),
      db.listRecentMatches(),
      db.listNews(),
      db.listSponsors(),
    ]).then(([tournaments, teams, matches, news, sponsors]) => {
      if (active) setStats({ tournaments, teams, matches, news, sponsors });
    });
    return () => {
      active = false;
    };
  }, []);

  const activeTournament = useMemo(
    () =>
      stats?.tournaments.find(
        (t) => t.status === "in_progress" || t.status === "registration_open",
      ) ?? stats?.tournaments[0],
    [stats],
  );

  if (!stats) {
    return (
      <section className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </section>
    );
  }

  const liveMatches = stats.matches.filter((m) => m.status === "live");

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Liga16</h1>
        <p className="text-muted-foreground">
          Circuito nacional de pádel — temporada 2026-27
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Torneos"
          value={String(stats.tournaments.length)}
          trend={`${stats.tournaments.filter((t) => t.status === "registration_open").length} con inscripciones abiertas`}
        />
        <StatCard
          title="Equipos"
          value={String(stats.teams.length)}
          trend="Liga16 Nacional"
        />
        <StatCard
          title="Partidos"
          value={String(stats.matches.length)}
          trend={liveMatches.length > 0 ? `${liveMatches.length} en vivo` : "Sin partidos en vivo"}
        />
        <StatCard title="Noticias" value={String(stats.news.length)} trend="Últimas novedades del circuito" />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              Torneo actual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeTournament ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{activeTournament.name}</p>
                  <Badge>{tournamentStatusLabel[activeTournament.status]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDateRange(activeTournament.start_date, activeTournament.end_date)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {activeTournament.city} · {activeTournament.club_name}
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/torneos/${activeTournament.slug}`}>Ver torneo</Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay torneos activos por ahora.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              Partidos
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/calendario">Ver calendario</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.matches.slice(0, 4).map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-1 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {m.side_a.pair_name} vs {m.side_b.pair_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.tournament_name} · {m.round}
                    {m.court_name ? ` · ${m.court_name}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {setsSummary(m)}
                  </span>
                  <Badge variant={statusVariantMatch[m.status]}>
                    {matchStatusLabel[m.status]}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Noticias
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/noticias">Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.news.slice(0, 3).map((n) => (
              <div key={n.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{n.tag}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {n.published_at}
                  </span>
                </div>
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.excerpt}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sponsors</CardTitle>
            <CardDescription>Aliados del circuito</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.sponsors.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-md border p-2.5 text-sm"
              >
                <span className="font-medium">{s.name}</span>
                <Badge variant="outline">{tierLabel[s.tier]}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </section>
  );
}