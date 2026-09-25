import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock,
  Flame,
  MapPin,
} from "lucide-react";
import { db } from "@/lib/data";
import type { Match, NewsItem, RankingEntry, Sponsor, Team, Tournament } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { tierLabel, formatLabel, formatMatchDateTime } from "@/lib/format";

const HERO_IMAGE = "/images/hero-padel.jpg";

type HomeData = {
  tournaments: Tournament[];
  teams: Team[];
  matches: Match[];
  news: NewsItem[];
  sponsors: Sponsor[];
  rankings: RankingEntry[];
};

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function SectionHeading({
  eyebrow,
  title,
  to,
  action,
}: {
  eyebrow: string;
  title: string;
  to: string;
  action: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
          {eyebrow}
        </p>
        <h2 className="font-display text-3xl uppercase leading-none tracking-tight sm:text-4xl">
          {title}
        </h2>
      </div>
      <Button asChild variant="ghost" size="sm" className="shrink-0 rounded-none px-1">
        <Link to={to}>
          {action} <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}

function PairMark({ team }: { team: Team }) {
  if (team.crest_url) {
    return (
      <img
        src={team.crest_url}
        alt=""
        className="h-full w-full object-contain"
      />
    );
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#141414] text-white">
      <span className="absolute -right-5 -top-12 font-display text-[11rem] leading-none text-white/[0.07]">
        16
      </span>
      <span className="relative font-display text-6xl uppercase leading-none text-primary sm:text-7xl">
        {initialsOf(team.name.replace("/", " "))}
      </span>
      <span className="absolute bottom-3 left-4 text-[9px] font-bold uppercase tracking-[0.28em] text-white/45">
        Liga16
      </span>
    </div>
  );
}

export default function Home() {
  const [stats, setStats] = useState<HomeData | null>(null);

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

  const topPlayers = useMemo(() => stats?.rankings.slice(0, 3) ?? [], [stats]);
  const featuredTeam = useMemo(() => {
    if (!stats) return null;
    return [...stats.teams].sort(
      (a, b) => b.titles - a.titles || b.won - a.won || a.position - b.position,
    )[0] ?? null;
  }, [stats]);

  if (!stats) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[620px] w-full rounded-b-[2rem]" />
        <div className="grid gap-5 lg:grid-cols-5">
          <Skeleton className="h-[420px] rounded-2xl lg:col-span-3" />
          <Skeleton className="h-[420px] rounded-2xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  const openTournaments = stats.tournaments.filter(
    (t) => t.status === "registration_open" || t.status === "in_progress",
  );
  const featured = openTournaments[0] ?? stats.tournaments[0];
  const liveCount = stats.matches.filter((m) => m.status === "live").length;
  const featuredMatch =
    stats.matches.find((m) => m.status === "live") ??
    stats.matches.find((m) => m.status === "scheduled") ??
    stats.matches[0];
  const activityMatches = stats.matches
    .filter((m) => m.id !== featuredMatch?.id)
    .slice(0, 2);
  const featuredIsOpen = featured?.status === "registration_open";

  return (
    <div className="space-y-16 md:space-y-20">
      {/* HERO — una sola composición, sin dashboard */}
      <section className="relative -mx-4 -mt-8 min-h-[620px] overflow-hidden bg-[#111] text-white md:-mx-6 md:rounded-b-[2rem]">
        <img
          src={featured?.cover_url || HERO_IMAGE}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[62%_center] opacity-75 grayscale contrast-125"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />
        <div className="absolute inset-0 bg-primary/20 mix-blend-color" />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-14 -right-8 select-none font-display text-[13rem] leading-none text-white/[0.08] sm:text-[18rem] md:-right-4 md:text-[25rem]"
        >
          16
        </span>

        <div className="relative mx-auto flex min-h-[620px] max-w-7xl flex-col justify-between px-4 pb-7 pt-8 md:px-8 md:pb-8 md:pt-10">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/70 sm:text-xs">
              <Flame className="h-3.5 w-3.5 text-primary" />
              {liveCount > 0
                ? `${liveCount} ${liveCount === 1 ? "partido en vivo" : "partidos en vivo"}`
                : "Circuito de pádel"}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">
              Ciudad de México
            </p>
          </div>

          <div className="max-w-3xl pb-7 pt-20 sm:pb-10 sm:pt-28">
            <h1 className="font-display text-[4.25rem] uppercase leading-[0.82] tracking-[-0.035em] sm:text-[7rem] md:text-[9rem]">
              Pádel
              <br />
              <span className="text-primary">en juego.</span>
            </h1>

            {featured && (
              <div className="mt-7 border-l-2 border-primary pl-4 sm:mt-9 sm:pl-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
                  Próximo torneo
                </p>
                <p className="mt-1 max-w-xl text-lg font-semibold leading-tight sm:text-2xl">
                  {featured.name}
                </p>
              </div>
            )}

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                asChild
                size="lg"
                className="h-12 w-full rounded-none px-6 font-bold uppercase tracking-wide sm:w-auto"
              >
                <Link to={featured ? `/torneos/${featured.slug}` : "/torneos"}>
                  {featuredIsOpen ? "Ver inscripción" : "Ver torneo"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Link
                to="/torneos"
                className="inline-flex h-12 items-center justify-center border-b border-white/25 text-sm font-semibold uppercase tracking-wide text-white/75 transition-colors hover:border-white hover:text-white sm:justify-start"
              >
                Todos los torneos
              </Link>
            </div>
          </div>

          <dl className="grid grid-cols-3 border-y border-white/15 bg-black/15 backdrop-blur-sm">
            {[
              { label: "Parejas", value: stats.teams.length },
              { label: "Torneos", value: stats.tournaments.length },
              {
                label: "Sede",
                value: featured?.city ?? stats.tournaments[0]?.city ?? "CDMX",
              },
            ].map((item, index) => (
              <div
                key={item.label}
                className={`px-3 py-3 sm:px-5 sm:py-4 ${
                  index > 0 ? "border-l border-white/15" : ""
                }`}
              >
                <dd className="truncate font-display text-xl uppercase sm:text-3xl">
                  {item.value}
                </dd>
                <dt className="mt-1 text-[8px] font-bold uppercase tracking-[0.22em] text-white/45 sm:text-[10px]">
                  {item.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* PRÓXIMO TORNEO — póster */}
      {featured && (
        <section>
          <SectionHeading
            eyebrow="En agenda"
            title="Próximo torneo"
            to="/torneos"
            action="Ver todos"
          />
          <Link
            to={`/torneos/${featured.slug}`}
            className="group grid min-h-[390px] overflow-hidden rounded-2xl bg-[#141414] text-white md:grid-cols-[0.9fr_1.1fr]"
          >
            <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10">
              <div>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center bg-primary font-display text-xl">
                    16
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">
                    Liga16
                    <br />
                    Torneo oficial
                  </span>
                </div>
                <h3 className="mt-9 max-w-xl font-display text-4xl uppercase leading-[0.92] tracking-tight sm:text-5xl lg:text-6xl">
                  {featured.name}
                </h3>
              </div>

              <div className="mt-10">
                <div className="mb-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/65">
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {formatMatchDateTime(featured.start_date)}
                  </span>
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    {featured.club_name ?? featured.city}
                  </span>
                </div>
                <span className="inline-flex items-center gap-2 border-b border-primary pb-1 text-sm font-bold uppercase tracking-wide">
                  {featuredIsOpen ? "Inscripciones abiertas" : "Ver convocatoria"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </div>

            {featured.cover_url ? (
              <div className="relative min-h-72 overflow-hidden border-t border-white/10 md:border-l md:border-t-0">
                <img
                  src={featured.cover_url}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
              </div>
            ) : (
              <div className="relative min-h-72 overflow-hidden bg-primary md:border-l md:border-white/10">
                <span className="absolute -bottom-16 -right-3 font-display text-[19rem] leading-none text-black/[0.13]">
                  16
                </span>
                <span className="absolute left-8 top-8 text-[10px] font-bold uppercase tracking-[0.3em] text-black/55">
                  Ciudad de México
                </span>
                <div className="absolute inset-y-0 left-[34%] w-px rotate-[18deg] bg-black/20" />
                <div className="absolute inset-y-0 left-[54%] w-px rotate-[18deg] bg-black/20" />
                <div className="absolute inset-y-0 left-[74%] w-px rotate-[18deg] bg-black/20" />
                <p className="absolute bottom-7 left-7 right-7 font-display text-3xl uppercase leading-none text-black/75 sm:text-4xl">
                  {formatLabel[featured.format] ?? featured.format}
                  <br />
                  <span className="text-black/45">Temporada 26/27</span>
                </p>
              </div>
            )}
          </Link>
        </section>
      )}

      {/* PAREJA + TOP 3 — dos piezas, no más tarjetas */}
      <section className="grid gap-8 lg:grid-cols-5 lg:gap-5">
        {featuredTeam && (
          <div className="lg:col-span-3">
            <SectionHeading
              eyebrow="Pareja destacada"
              title="En dupla"
              to={`/equipos/${featuredTeam.slug}`}
              action="Ver pareja"
            />
            <Link
              to={`/equipos/${featuredTeam.slug}`}
              className="group grid min-h-[390px] overflow-hidden rounded-2xl bg-primary text-primary-foreground sm:grid-cols-[0.85fr_1.15fr]"
            >
              <div className="min-h-64 border-b border-black/15 sm:border-b-0 sm:border-r">
                <PairMark team={featuredTeam} />
              </div>
              <div className="flex flex-col justify-between p-6 sm:p-8">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-black/50">
                    {featuredTeam.division} · Ciudad de México
                  </p>
                  <h3 className="mt-4 font-display text-4xl uppercase leading-[0.94] sm:text-5xl">
                    {featuredTeam.name}
                  </h3>
                </div>
                <div className="mt-10">
                  <div className="grid grid-cols-2 gap-4 border-y border-black/20 py-4">
                    <div>
                      <p className="font-display text-4xl">{featuredTeam.won}</p>
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/55">
                        Victorias
                      </p>
                    </div>
                    <div>
                      <p className="font-display text-4xl">{featuredTeam.titles}</p>
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-black/55">
                        Títulos
                      </p>
                    </div>
                  </div>
                  <span className="mt-5 inline-flex items-center text-sm font-bold uppercase tracking-wide">
                    Ver perfil
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
            </Link>
          </div>
        )}

        <div className="lg:col-span-2">
          <SectionHeading
            eyebrow="Clasificación"
            title="Top 3"
            to="/ranking"
            action="Ver todo"
          />
          <div className="grid min-h-[390px] grid-cols-2 gap-2 overflow-hidden rounded-2xl bg-muted p-2">
            {topPlayers.map((player, index) => (
              <Link
                key={player.player_id}
                to={`/jugadores/${player.player_id}`}
                className={`group flex flex-col justify-between overflow-hidden rounded-xl p-4 transition-transform hover:-translate-y-0.5 sm:p-5 ${
                  index === 0
                    ? "col-span-2 min-h-44 bg-[#141414] text-white"
                    : "min-h-36 bg-card text-foreground"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`font-display text-5xl leading-none ${
                      index === 0 ? "text-primary" : "text-primary/35"
                    }`}
                  >
                    {String(player.position).padStart(2, "0")}
                  </span>
                  <ChevronRight className="h-4 w-4 opacity-35 transition-transform group-hover:translate-x-1" />
                </div>
                <div className="mt-6">
                  <p
                    className={`font-semibold leading-tight ${
                      index === 0 ? "text-xl sm:text-2xl" : "text-base"
                    }`}
                  >
                    {player.player_name}
                  </p>
                  <p
                    className={`mt-1 text-[10px] font-bold uppercase tracking-[0.15em] ${
                      index === 0 ? "text-white/45" : "text-muted-foreground"
                    }`}
                  >
                    {player.city} · {player.won} victorias
                  </p>
                </div>
              </Link>
            ))}
            {topPlayers.length === 0 && (
              <p className="col-span-2 self-center p-8 text-center text-sm text-muted-foreground">
                La clasificación estará disponible muy pronto.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* CANCHA — un partido protagonista, no una tabla de partidos */}
      {featuredMatch && (
        <section>
          <SectionHeading
            eyebrow={featuredMatch.status === "live" ? "En vivo" : "En la cancha"}
            title="Ahora en juego"
            to="/calendario"
            action="Ver agenda"
          />
          <div className="grid overflow-hidden rounded-2xl bg-[#141414] text-white lg:grid-cols-[1.45fr_0.55fr]">
            <div className="p-6 sm:p-8 lg:p-10">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
                  {featuredMatch.tournament_name} · {featuredMatch.round}
                </p>
                {featuredMatch.status === "live" && (
                  <Badge className="animate-pulse rounded-none bg-primary text-[10px] uppercase tracking-widest">
                    En vivo
                  </Badge>
                )}
              </div>
              <div className="mt-9 grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-8">
                <p className="text-lg font-semibold leading-tight sm:text-2xl">
                  {featuredMatch.side_a.pair_name}
                </p>
                <span className="font-display text-xl text-primary sm:text-3xl">VS</span>
                <p className="text-right text-lg font-semibold leading-tight sm:text-2xl">
                  {featuredMatch.side_b.pair_name}
                </p>
              </div>
              <p className="mt-8 font-mono text-sm tabular-nums text-white/55">
                {featuredMatch.sets.length > 0
                  ? featuredMatch.sets.map((set) => `${set.a}–${set.b}`).join("   /   ")
                  : "Por comenzar"}
              </p>
            </div>

            <div className="border-t border-white/10 lg:border-l lg:border-t-0">
              {activityMatches.map((match) => (
                <div
                  key={match.id}
                  className="flex min-h-28 flex-col justify-center border-b border-white/10 p-5 last:border-b-0 sm:p-6"
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/35">
                    {match.tournament_name}
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-snug">
                    {match.side_a.pair_name} vs {match.side_b.pair_name}
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-white/45">
                    <Clock className="h-3 w-3" />
                    {match.scheduled_at
                      ? formatMatchDateTime(match.scheduled_at)
                      : "Por definir"}
                  </p>
                </div>
              ))}
              {activityMatches.length === 0 && (
                <div className="flex min-h-28 items-center p-6 text-sm text-white/45">
                  La agenda del circuito aparecerá aquí.
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* NOTICIAS — imágenes cuando existan, marca editorial cuando no */}
      {stats.news.length > 0 && (
        <section>
          <SectionHeading
            eyebrow="Del circuito"
            title="Últimas noticias"
            to="/noticias"
            action="Ver todas"
          />
          <div className="grid gap-5 md:grid-cols-3">
            {stats.news.slice(0, 3).map((item) => (
              <article key={item.id} className="group border-t-2 border-foreground pt-3">
                <div className="relative mb-4 aspect-[16/9] overflow-hidden rounded-xl bg-muted">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="relative h-full w-full overflow-hidden bg-neutral-900 text-white">
                      <span className="absolute -bottom-8 -right-1 font-display text-[9rem] leading-none text-primary/35">
                        16
                      </span>
                      <span className="absolute left-4 top-4 text-[9px] font-bold uppercase tracking-[0.24em] text-white/45">
                        Liga16
                      </span>
                    </div>
                  )}
                </div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary">
                    {item.tag}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {new Date(item.published_at).getFullYear()}
                  </span>
                </div>
                <h3 className="text-lg font-semibold leading-tight">{item.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {item.excerpt}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Patrocinadores como créditos, no como dashboard */}
      {stats.sponsors.length > 0 && (
        <section className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
            Con el apoyo de
          </p>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {stats.sponsors.map((sponsor) => (
              <div key={sponsor.id} className="flex items-center gap-2">
                {sponsor.logo_url ? (
                  <img
                    src={sponsor.logo_url}
                    alt={sponsor.name}
                    className="h-7 w-auto max-w-28 object-contain"
                  />
                ) : (
                  <span className="text-sm font-bold tracking-tight">{sponsor.name}</span>
                )}
                <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
                  {tierLabel[sponsor.tier]}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
