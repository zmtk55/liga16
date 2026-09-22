import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  CalendarDays,
  Search,
  Trophy,
  Users,
  ArrowRight,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { db } from "@/lib/data";
import type {
  Match,
  NewsItem,
  Sponsor,
  Team,
  Tournament,
  RankingEntry,
} from "@/types";
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

  const topPlayers = useMemo(
    () => stats?.rankings.slice(0, 5) ?? [],
    [stats],
  );

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
            <Skeleton key={i} className="h-24 w-full" />
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
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background px-6 py-14 md:px-10 md:py-20">
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Temporada 2026-27
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
            Liga16
          </h1>
          <p className="mt-4 text-lg text-muted-foreground md:text-xl">
            Torneos, ranking y vida de padel en un solo lugar.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link to="/jugadores">
                Crear mi perfil gratis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/ranking">
                Ver ranking
                <ChevronRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="relative mx-auto mt-8 max-w-lg">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar jugadores y torneos..."
              className="h-11 pl-9"
            />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Trophy className="h-4 w-4" /> Torneos
            </div>
            <p className="mt-2 text-3xl font-bold">{stats.tournaments.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.tournaments.filter((t) => t.status === "registration_open").length} con inscripciones abiertas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" /> Equipos
            </div>
            <p className="mt-2 text-3xl font-bold">{stats.teams.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Liga del padel Reforma</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" /> Partidos
            </div>
            <p className="mt-2 text-3xl font-bold">{stats.matches.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {liveMatches.length > 0 ? `${liveMatches.length} en vivo` : "Sin partidos en vivo"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4" /> Noticias
            </div>
            <p className="mt-2 text-3xl font-bold">{stats.news.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Últimas novedades</p>
          </CardContent>
        </Card>
      </section>

      {/* Sponsors strip */}
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

      {/* Top players */}
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
              className="flex items-center gap-4 rounded-lg border p-3 hover:bg-accent/30 transition-colors"
            >
              <span className="w-6 text-center text-sm font-bold text-muted-foreground">
                {p.position}
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{p.player_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Nivel {p.level} · {p.points.toLocaleString()} pts
                </p>
              </div>
              <Badge
                variant={p.delta > 0 ? "default" : p.delta < 0 ? "destructive" : "outline"}
                className="text-xs"
              >
                {p.delta > 0 ? `▲ ${p.delta}` : p.delta < 0 ? `▼ ${Math.abs(p.delta)}` : "—"}
              </Badge>
            </div>
          ))}
        </div>
      </section>

      {/* Open tournaments */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Torneos abiertos</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/torneos">Ver todos</Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {openTournaments.map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      </section>

      {/* Matches + News */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              Partidos recientes
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
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
      </section>

      {/* CTA banner */}
      <section className="rounded-2xl bg-primary px-6 py-12 text-center text-primary-foreground">
        <h2 className="text-2xl font-bold md:text-3xl">
          ¿Listo para competir?
        </h2>
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
      </section>
    </div>
  );
}