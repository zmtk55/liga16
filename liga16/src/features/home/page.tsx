import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowRight,
  CalendarDays,
  Search,
  Trophy,
  ChevronRight,
  Clock,
  Sparkles,
  Flame,
} from "lucide-react";
import { db } from "@/lib/data";
import type { Match, NewsItem, Sponsor, Team, Tournament, RankingEntry } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { tierLabel, formatLabel, formatMatchDateTime } from "@/lib/format";

function initialsOf(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function Home() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
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

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    navigate(q ? `/jugadores?q=${encodeURIComponent(q)}` : "/jugadores");
  }

  if (!stats) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-[420px] w-full rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const openTournaments = stats.tournaments.filter(
    (t) => t.status === "registration_open" || t.status === "in_progress",
  );
  const featured = openTournaments[0] ?? stats.tournaments[0];
  const liveCount = stats.matches.filter((m) => m.status === "live").length;

  return (
    <div className="space-y-14">
      {/* ── HERO PÓSTER ── */}
      <section className="relative -mx-4 -mt-8 overflow-hidden bg-[#141414] text-white md:-mx-6 md:rounded-b-[2rem]">
        {/* 16 fantasma: el dorsal de la liga */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-14 select-none font-display text-[16rem] leading-none text-white/[0.04] md:-right-10 md:text-[24rem]"
        >
          16
        </span>
        {/* línea de orbe: la franja del circuito */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-primary" />

        <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-8 md:px-6 md:pb-14 md:pt-10">
          <Button asChild variant="ghost" size="sm" className="sr-only">
            <Link to="/">Ir al inicio</Link>
          </Button>
          <form onSubmit={onSearch} className="relative mb-8 max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              placeholder="Busca tu nombre en el ranking…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 border-white/15 bg-white/5 pl-11 text-base text-white placeholder:text-white/40 focus-visible:ring-primary/50"
            />
          </form>

          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            <Flame className="h-3.5 w-3.5" />
            {liveCount > 0 ? `${liveCount} partidos en juego ahora` : "Circuito de pádel por divisiones"}
          </p>
          <h1 className="max-w-3xl font-display text-5xl uppercase leading-[0.95] tracking-tight md:text-7xl">
            Tu nombre
            <br />
            <span className="text-primary">en el muro</span>{" "}
            de campeones
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/70 md:text-base">
            Liga16 rankea a las parejas del circuito semana a semana. Inscríbete al próximo torneo,
            gana partidos y sube de división.
          </p>

          {/* Scoreboard: las cifras reales del circuito */}
          <dl className="mt-8 grid max-w-xl grid-cols-3 divide-x divide-white/10 rounded-xl border border-white/10 bg-white/[0.03]">
            {[
              { k: "Jugadores rankeados", v: stats.rankings.length },
              { k: "Parejas inscritas", v: stats.teams.length },
              { k: "Torneos jugados", v: stats.tournaments.length },
            ].map((s) => (
              <div key={s.k} className="px-4 py-3 text-center md:px-6 md:text-left">
                <dd className="font-display text-3xl tabular-nums md:text-4xl">{s.v}</dd>
                <dt className="mt-0.5 text-[10px] uppercase tracking-widest text-white/50 md:text-xs">
                  {s.k}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── PRÓXIMO TORNEO: convocatoria ── */}
      {featured && (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-2xl uppercase tracking-tight md:text-3xl">
              {featured.status === "registration_open" ? "Convocatoria abierta" : "Próximo en el circuito"}
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/torneos">
                Todos los torneos <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <Link
            to={`/torneos/${featured.slug}`}
            className="group relative block overflow-hidden rounded-2xl bg-[#141414] text-white transition-shadow hover:shadow-xl"
          >
            <div aria-hidden className="absolute inset-y-0 left-0 w-1 bg-primary transition-all group-hover:w-1.5" />
            <div className="relative grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
              <div className="min-w-0">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
                  {featured.club_name ?? "Club Pádel Reforma"} · {featured.city}
                </p>
                <h3 className="font-display text-3xl uppercase leading-none md:text-5xl">
                  {featured.name}
                </h3>
                <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/70">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {formatMatchDateTime(featured.start_date)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Trophy className="h-4 w-4 text-primary" />
                    {formatLabel[featured.format] ?? featured.format}
                  </span>
                  <span className="font-mono tabular-nums">
                    {(featured.price_cents / 100).toLocaleString("es-MX", {
                      style: "currency",
                      currency: featured.currency,
                    })}{" "}
                    por pareja
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-3 md:flex-col md:items-end">
                {featured.status === "registration_open" ? (
                  <Badge variant="default" className="bg-emerald-600 animate-pulse">
                    Inscripciones abiertas
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-white/20 text-white/80">
                    Próximamente
                  </Badge>
                )}
                <span className="inline-flex items-center gap-2 text-sm font-bold text-white transition-colors group-hover:text-primary">
                  Ver torneo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* ── AGENDA + ACTIVIDAD ── */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-primary" /> Siguientes partidos
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/calendario">
                Ver agenda <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(() => {
              const next = stats.matches
                .filter((m) => m.status === "live" || m.status === "scheduled")
                .slice(0, 5);
              const list = next.length ? next : stats.matches.slice(0, 4);
              if (list.length === 0) {
                return (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No hay partidos agendados. Los próximos torneos definen el calendario.
                  </p>
                );
              }
              return list.map((m) => {
                const aNames = m.side_a.pair_name.split("/").map((s) => s.trim());
                const bNames = m.side_b.pair_name.split("/").map((s) => s.trim());
                const isLive = m.status === "live";
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/30 hover:bg-muted/50"
                  >
                    <div className="flex -space-x-2">
                      {aNames.slice(0, 2).map((n, i) => (
                        <Avatar key={i} className="h-8 w-8 border-2 border-background">
                          <AvatarFallback className="text-xs">{initialsOf(n)}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">vs</span>
                    <div className="flex -space-x-2">
                      {bNames.slice(0, 2).map((n, i) => (
                        <Avatar key={i} className="h-8 w-8 border-2 border-background">
                          <AvatarFallback className="text-xs">{initialsOf(n)}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {m.side_a.pair_name} vs {m.side_b.pair_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.tournament_name} · {m.round}
                        {m.court_name ? ` · ${m.court_name}` : ""}
                      </p>
                    </div>
                    {isLive ? (
                      <Badge variant="destructive" className="animate-pulse">
                        EN VIVO
                      </Badge>
                    ) : (
                      <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
                        <Clock className="h-3 w-3" />
                        {m.scheduled_at ? formatMatchDateTime(m.scheduled_at) : "Por definir"}
                      </span>
                    )}
                  </div>
                );
              });
            })()}
          </CardContent>
        </Card>

        {/* Top jugadores */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-primary" /> Top del circuito
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/ranking">Ranking</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {topPlayers.map((p) => (
              <div
                key={p.player_id}
                className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center font-display text-lg ${
                    p.position === 1
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {p.position}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.player_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.points.toLocaleString("es-MX")} pts · {p.won} victorias
                  </p>
                </div>
                {p.delta !== 0 && (
                  <span
                    className={`shrink-0 font-mono text-xs tabular-nums ${
                      p.delta > 0 ? "text-emerald-600" : "text-red-500"
                    }`}
                  >
                    {p.delta > 0 ? "▲" : "▼"}
                    {Math.abs(p.delta)}
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* ── NOTICIAS + PATROCINADORES ── */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" /> Noticias del circuito
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/noticias">Ver todo</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.news.slice(0, 3).map((n) => (
              <div
                key={n.id}
                className="flex gap-3 rounded-lg border p-2.5 transition-colors hover:bg-muted/40"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight">{n.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{n.excerpt}</p>
                </div>
                <Badge variant="outline" className="h-fit text-xs">
                  {n.tag}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Patrocinadores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.sponsors.slice(0, 4).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border bg-card p-2.5"
              >
                <span className="text-sm font-semibold">{s.name}</span>
                <Badge variant="outline" className="text-xs">
                  {tierLabel[s.tier]}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
