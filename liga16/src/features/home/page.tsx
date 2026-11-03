import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, ChevronRight } from "lucide-react";
import { db } from "@/lib/data";
import type {
  Match,
  NewsItem,
  Sponsor,
  Team,
  Tournament,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDate,
  formatDateRange,
  formatMatchDateTime,
  formatCity,
} from "@/lib/format";
import {
  DIVISION_ORDER,
  teamCategoryKey,
  teamCategoryLabel,
} from "@/lib/categories";
import { GroupFilterBar } from "@/components/shadcn-space/blocks/navbar-01/group-filter-bar";
import SponsorMarquee from "@/components/blocks/sponsor-marquee";

const HERO_IMAGE = "/images/hero-padel.jpg";

type HomeData = {
  tournaments: Tournament[];
  teams: Team[];
  matches: Match[];
  news: NewsItem[];
  sponsors: Sponsor[];
};

function initialsOf(name: string) {
  return name
    .split(/\s*\/\s*|\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Encabezado de sección: una línea, peso semibold, enlace discreto.
    Nada de display uppercase — el único momento de marca es el hero. */
function SectionHeading({
  title,
  to,
  action,
}: {
  title: string;
  to: string;
  action: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <Link
        to={to}
        className="inline-flex min-h-8 shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        {action} <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

/** Foto del equipo (crest); si no tiene, iniciales sobrias sin decoración. */
function TeamCrest({
  team,
  sizeClass,
  textClass,
}: {
  team: Team;
  sizeClass: string;
  textClass: string;
}) {
  if (team.crest_url) {
    return (
      <img
        src={team.crest_url}
        alt=""
        className={`${sizeClass} shrink-0 rounded-lg border bg-background object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${sizeClass} ${textClass} flex shrink-0 items-center justify-center rounded-lg border bg-primary/10 font-bold uppercase text-primary-strong`}
    >
      {initialsOf(team.name)}
    </span>
  );
}

export default function Home() {
  const [stats, setStats] = useState<HomeData | null>(null);
  // Estado del formulario de alarmas: la confirmación es local, no hay
  // backend de suscripciones todavía.
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      db.listTournaments(),
      db.listTeams(),
      db.listRecentMatches(),
      db.listNews(),
      db.listSponsors(),
    ]).then(([tournaments, teams, matches, news, sponsors]) => {
      if (active)
        setStats({ tournaments, teams, matches, news, sponsors });
      })
      // Sin `catch` la home se quedaba en esqueletos para siempre si una de las
      // cinco peticiones fallaba (o si una sola —por ejemplo noticias— daba
      // error por RLS): el `Promise.all` se rechazaba y no se seteaba nada.
      .catch(() => {
        if (active)
          setStats({
            tournaments: [],
            teams: [],
            matches: [],
            news: [],
            sponsors: [],
          });
      });
    return () => {
      active = false;
    };
  }, []);

  // Parejas: top 2 de CADA CATEGORÍA REAL del circuito.
  //
  // Se agrupa por `teamCategoryKey` —el nombre que el torneo le puso a la
  // inscripción, con respaldo en la división—, igual que hace /equipos. La
  // lista de filtros se arma desde los datos, sin lista blanca.
  const teamGroups = useMemo(() => {
    if (!stats) return [];
    const byKey = new Map<string, Team[]>();
    for (const team of stats.teams) {
      const key = teamCategoryKey(team);
      const list = byKey.get(key);
      if (list) list.push(team);
      else byKey.set(key, [team]);
    }
    const divisionRank = (t: Team) => {
      const i = DIVISION_ORDER.indexOf(t.division);
      return i < 0 ? DIVISION_ORDER.length : i;
    };
    return [...byKey.entries()]
      .map(([key, teams]) => {
        const sorted = [...teams].sort(
          (a, b) =>
            (a.position || Number.MAX_SAFE_INTEGER) -
              (b.position || Number.MAX_SAFE_INTEGER) ||
            b.points - a.points ||
            b.won - a.won,
        );
        return { key, label: teamCategoryLabel(teams[0]), teams: sorted.slice(0, 2) };
      })
      .sort(
        (a, b) =>
          divisionRank(a.teams[0]) - divisionRank(b.teams[0]) ||
          a.label.localeCompare(b.label, "es"),
      );
  }, [stats]);

  const [cat, setCat] = useState("");
  const shownGroups = useMemo(
    () => (cat ? teamGroups.filter((g) => g.key === cat) : teamGroups),
    [teamGroups, cat],
  );

  if (!stats) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[340px] w-full rounded-b-[2rem] md:rounded-3xl" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-[220px] rounded-3xl md:col-span-2" />
          <Skeleton className="h-[220px] rounded-3xl" />
        </div>
      </div>
    );
  }

  /**
   * "Próximo torneo" tiene que ser el más PRÓXIMO, no el primero de la lista:
   * un torneo cuenta si todavía no termina, y dentro de los abiertos gana el
   * más cercano en el calendario.
   *
   * `today` es la fecha LOCAL del visitante (no UTC): en MST el corte de
   * "empieza hoy / cierran mañana" debe cambiar a medianoche local.
   */
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const daysUntil = (iso: string) =>
    Math.max(
      0,
      Math.round(
        (Date.parse(`${iso.slice(0, 10)}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / 86400000,
      ),
    );

  const notFinishedYet = stats.tournaments.filter((t) => (t.end_date ?? t.start_date) >= today);
  const openTournaments = notFinishedYet
    .filter((t) => t.status === "registration_open" || t.status === "in_progress")
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const featured = openTournaments[0] ?? notFinishedYet[0] ?? null;

  const liveCount = stats.matches.filter((m) => m.status === "live").length;
  // Un partido "scheduled" con fecha pasada está olvidado: no cuenta.
  const isUpcoming = (m: (typeof stats.matches)[number]) =>
    m.status === "live" || (m.status === "scheduled" && (m.scheduled_at ?? "").slice(0, 10) >= today);
  const featuredMatch =
    stats.matches.find((m) => m.status === "live") ??
    stats.matches.filter(isUpcoming).sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))[0] ??
    null;
  const featuredIsOpen =
    featured?.status === "registration_open" &&
    (featured.registration_deadline ?? featured.end_date) >= today;
  // Torneo con inscripción abierta distinto del que anuncia el hero: es la
  // única acción urgente de la página, por eso es la que lleva el naranja.
  const regOpen =
    openTournaments.find(
      (t) =>
        t.status === "registration_open" &&
        (t.registration_deadline ?? t.end_date) >= today,
    ) ?? null;
  const showRegCard = regOpen !== null && regOpen.id !== featured?.id;

  // Sede REAL: ciudad del torneo destacado (única fuente, sin inventar)
  const sedeLabel = formatCity(featured?.city || stats.tournaments[0]?.city) || "Liga16";

  // El hero dice el estado del torneo en UNA línea y ofrece UNA acción.
  // Antes el countdown caía en "0 días" cuando el torneo ya había empezado:
  // la cuenta solo aplica a algo que está en el futuro.
  let heroStatus: string | null = null;
  let ctaLabel = "Ver torneos";
  let ctaHref = "/torneos";
  if (featured) {
    ctaHref = `/torneos/${featured.slug}`;
    if (featured.status === "in_progress") {
      heroStatus = `En curso · hasta el ${formatDate(featured.end_date ?? featured.start_date)}`;
      ctaLabel = "Ver torneo";
    } else if (featuredIsOpen) {
      const d = daysUntil(featured.registration_deadline ?? featured.end_date);
      heroStatus = `Inscripciones abiertas · ${d === 0 ? "cierran hoy" : d === 1 ? "cierran mañana" : `cierran en ${d} días`}`;
      ctaLabel = "Inscribirme";
    } else {
      const d = daysUntil(featured.start_date);
      heroStatus = d === 0 ? "Empieza hoy" : d === 1 ? "Empieza mañana" : `Empieza en ${d} días`;
      ctaLabel = "Ver torneo";
    }
  }

  return (
    <div className="space-y-10 md:space-y-14">
      {/* HERO — foto de cancha + estado del torneo + una sola acción.
          Compacto a propósito: la pantalla es una experiencia con scroll,
          no un póster. El nombre del torneo ya no compite con la marca:
          la marca vive en la navbar. */}
      <section className="relative -mx-4 -mt-8 overflow-hidden rounded-b-[2rem] bg-surface-inverse text-white md:mx-0 md:mt-0 md:rounded-3xl">
        <img
          src={HERO_IMAGE}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />

        <div className="relative flex min-h-[340px] flex-col justify-end px-5 pb-6 pt-16 md:min-h-[380px] md:px-8 md:pb-8">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
            {liveCount > 0 ? (
              <>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                {liveCount === 1 ? "1 partido en vivo" : `${liveCount} partidos en vivo`}
              </>
            ) : (
              `Circuito de pádel · ${sedeLabel}`
            )}
          </p>
          <h1 className="mt-3 max-w-2xl font-poster text-4xl font-extrabold uppercase leading-[0.92] tracking-[-0.01em] text-white sm:text-5xl md:text-6xl">
            {featured?.name ?? "Liga16"}
          </h1>
          {heroStatus && <p className="mt-2 text-sm text-white/70">{heroStatus}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button asChild size="lg" className="rounded-xl bg-white font-semibold text-neutral-900 hover:bg-white/90">
              <Link to={ctaHref}>
                {ctaLabel} <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            {featured && (
              <Link
                to="/torneos"
                className="text-sm font-medium text-white/60 transition-colors hover:text-white"
              >
                Todos los torneos
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* BENTO — una idea por tarjeta: el partido que importa, quién va
          arriba, y la suscripción. Sin tarjeta de "próximo torneo": eso ya
          lo dice el hero. */}
      <section aria-label="Estado del circuito" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {featuredMatch && (
          <div className="flex flex-col rounded-3xl border bg-card p-5 md:col-span-2 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {featuredMatch.tournament_name} · {featuredMatch.round}
              </p>
              {featuredMatch.status === "live" ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary-strong">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                  En vivo
                </span>
              ) : (
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {featuredMatch.scheduled_at
                    ? formatMatchDateTime(featuredMatch.scheduled_at)
                    : "Por definir"}
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col justify-center py-2">
            <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
              <p className="text-base font-semibold leading-tight sm:text-lg">
                {featuredMatch.side_a.pair_name}
              </p>
              <span className="font-headline text-lg text-muted-foreground">VS</span>
              <p className="text-right text-base font-semibold leading-tight sm:text-lg">
                {featuredMatch.side_b.pair_name}
              </p>
            </div>
            {featuredMatch.sets.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {featuredMatch.sets.map((set, index) => (
                  <li
                    key={index}
                    className="rounded-lg bg-muted px-3 py-1.5 font-headline text-xl tabular-nums leading-none"
                  >
                    {set.a}–{set.b}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Por comenzar</p>
            )}
            </div>
            <div className="pt-5">
              <Link
                to="/calendario"
                className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                Ver agenda <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {regOpen && regOpen.id !== featured?.id && (
          <div className="flex flex-col rounded-3xl border bg-card p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Inscripciones abiertas
            </p>
            <h3 className="mt-2 text-base font-semibold leading-tight">{regOpen.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDateRange(regOpen.start_date, regOpen.end_date)}
            </p>
            <p className="mt-4">
              <span className="font-headline text-4xl tabular-nums leading-none">
                {daysUntil(regOpen.registration_deadline ?? regOpen.end_date)}
              </span>{" "}
              <span className="text-sm text-muted-foreground">
                {daysUntil(regOpen.registration_deadline ?? regOpen.end_date) === 1
                  ? "día para inscribirte"
                  : "días para inscribirte"}
              </span>
            </p>
            <div className="mt-auto pt-4">
              <Button asChild className="w-full rounded-xl font-semibold">
                <Link to={`/torneos/${regOpen.slug}`}>Inscribirme</Link>
              </Button>
            </div>
          </div>
        )}

        {/* Suscripción — una línea, sin párrafo de relleno. */}
        <div className={`rounded-3xl border bg-card p-5 md:p-6 ${showRegCard ? "md:col-span-3 md:flex md:items-center md:justify-between md:gap-6" : ""}`}>
          <h3 className="shrink-0 text-sm font-semibold">Regalos y noticias del circuito</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubscribed(true);
            }}
            className={`mt-4 flex gap-2 md:max-w-md ${showRegCard ? "md:mt-0 md:w-full" : ""}`}
          >
            <input
              type="email"
              required
              placeholder="tu@email.com"
              className="min-w-0 flex-1 rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            />
            <Button type="submit" className="rounded-xl font-semibold">
              Enviar
            </Button>
          </form>
          {subscribed && (
            <p className="mt-3 text-xs font-semibold text-primary">
              ✓ Listo, te avisamos.
            </p>
          )}
        </div>
      </section>

      {/* PAREJAS — top 2 por categoría real del circuito */}
      <section>
        <SectionHeading title="Parejas" to="/equipos" action="Ver todas" />
        <GroupFilterBar
          className="mb-4"
          divisions={teamGroups.map((g) => ({ value: g.key, label: g.label }))}
          value={cat}
          onChange={setCat}
        />
        <div className="space-y-3">
          {shownGroups.map((group) => (
            <div
              key={group.key}
              className="overflow-hidden rounded-2xl border bg-card"
            >
              <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
                <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {group.label}
                </p>
                <Link
                  to="/ranking"
                  // El relleno vertical amplía el área de toque (mínimo 24px
                  // de WCAG 2.2); el margen negativo compensa la fila.
                  className="-my-1.5 inline-flex min-h-8 shrink-0 items-center gap-0.5 px-1 text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Tabla <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="divide-y">
                {group.teams.map((team) => (
                  <Link
                    key={team.id}
                    to={`/equipos/${team.slug}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
                  >
                    <TeamCrest team={team} sizeClass="h-9 w-9" textClass="text-2xs" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {team.name}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-headline text-lg leading-none">
                        {team.position > 0 ? `#${team.position}` : "—"}
                      </span>
                      <span className="mt-0.5 block text-2xs text-muted-foreground">
                        {team.points}% · {team.played} PJ
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {shownGroups.length === 0 && (
            <div className="rounded-2xl border bg-card p-8">
              <p className="text-sm text-muted-foreground">
                {cat
                  ? "No hay parejas inscritas en esta categoría."
                  : "Las parejas inscritas aparecerán aquí, organizadas por categoría."}
              </p>
              {cat && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3"
import { Link } from "react-router";
import { ArrowRight, ChevronRight } from "lucide-react";
import { db } from "@/lib/data";
import type {
  Match,
  NewsItem,
  Sponsor,
  Team,
  Tournament,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDate,
  formatDateRange,
  formatMatchDateTime,
  formatCity,
} from "@/lib/format";
import {
  DIVISION_ORDER,
  teamCategoryKey,
  teamCategoryLabel,
} from "@/lib/categories";
import { GroupFilterBar } from "@/components/shadcn-space/blocks/navbar-01/group-filter-bar";
import SponsorMarquee from "@/components/blocks/sponsor-marquee";

const HERO_IMAGE = "/images/hero-padel.jpg";

type HomeData = {
  tournaments: Tournament[];
  teams: Team[];
  matches: Match[];
  news: NewsItem[];
  sponsors: Sponsor[];
};

function initialsOf(name: string) {
  return name
    .split(/\s*\/\s*|\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Encabezado de sección: una línea, peso semibold, enlace discreto.
    Nada de display uppercase — el único momento de marca es el hero. */
function SectionHeading({
  title,
  to,
  action,
}: {
  title: string;
  to: string;
  action: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <Link
        to={to}
        className="inline-flex min-h-8 shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        {action} <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

/** Foto del equipo (crest); si no tiene, iniciales sobrias sin decoración. */
function TeamCrest({
  team,
  sizeClass,
  textClass,
}: {
  team: Team;
  sizeClass: string;
  textClass: string;
}) {
  if (team.crest_url) {
    return (
      <img
        src={team.crest_url}
        alt=""
        className={`${sizeClass} shrink-0 rounded-lg border bg-background object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${sizeClass} ${textClass} flex shrink-0 items-center justify-center rounded-lg border bg-primary/10 font-bold uppercase text-primary-strong`}
    >
      {initialsOf(team.name)}
    </span>
  );
}

export default function Home() {
  const [stats, setStats] = useState<HomeData | null>(null);
  // Estado del formulario de alarmas: la confirmación es local, no hay
  // backend de suscripciones todavía.
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      db.listTournaments(),
      db.listTeams(),
      db.listRecentMatches(),
      db.listNews(),
      db.listSponsors(),
    ]).then(([tournaments, teams, matches, news, sponsors]) => {
      if (active)
        setStats({ tournaments, teams, matches, news, sponsors });
      })
      // Sin `catch` la home se quedaba en esqueletos para siempre si una de las
      // cinco peticiones fallaba (o si una sola —por ejemplo noticias— daba
      // error por RLS): el `Promise.all` se rechazaba y no se seteaba nada.
      .catch(() => {
        if (active)
          setStats({
            tournaments: [],
            teams: [],
            matches: [],
            news: [],
            sponsors: [],
          });
      });
    return () => {
      active = false;
    };
  }, []);

  // Parejas: top 2 de CADA CATEGORÍA REAL del circuito.
  //
  // Se agrupa por `teamCategoryKey` —el nombre que el torneo le puso a la
  // inscripción, con respaldo en la división—, igual que hace /equipos. La
  // lista de filtros se arma desde los datos, sin lista blanca.
  const teamGroups = useMemo(() => {
    if (!stats) return [];
    const byKey = new Map<string, Team[]>();
    for (const team of stats.teams) {
      const key = teamCategoryKey(team);
      const list = byKey.get(key);
      if (list) list.push(team);
      else byKey.set(key, [team]);
    }
    const divisionRank = (t: Team) => {
      const i = DIVISION_ORDER.indexOf(t.division);
      return i < 0 ? DIVISION_ORDER.length : i;
    };
    return [...byKey.entries()]
      .map(([key, teams]) => {
        const sorted = [...teams].sort(
          (a, b) =>
            (a.position || Number.MAX_SAFE_INTEGER) -
              (b.position || Number.MAX_SAFE_INTEGER) ||
            b.points - a.points ||
            b.won - a.won,
        );
        return { key, label: teamCategoryLabel(teams[0]), teams: sorted.slice(0, 2) };
      })
      .sort(
        (a, b) =>
          divisionRank(a.teams[0]) - divisionRank(b.teams[0]) ||
          a.label.localeCompare(b.label, "es"),
      );
  }, [stats]);

  const [cat, setCat] = useState("");
  const shownGroups = useMemo(
    () => (cat ? teamGroups.filter((g) => g.key === cat) : teamGroups),
    [teamGroups, cat],
  );

  if (!stats) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[340px] w-full rounded-b-[2rem] md:rounded-3xl" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-[220px] rounded-3xl md:col-span-2" />
          <Skeleton className="h-[220px] rounded-3xl" />
        </div>
      </div>
    );
  }

  /**
   * "Próximo torneo" tiene que ser el más PRÓXIMO, no el primero de la lista:
   * un torneo cuenta si todavía no termina, y dentro de los abiertos gana el
   * más cercano en el calendario.
   *
   * `today` es la fecha LOCAL del visitante (no UTC): en MST el corte de
   * "empieza hoy / cierran mañana" debe cambiar a medianoche local.
   */
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const daysUntil = (iso: string) =>
    Math.max(
      0,
      Math.round(
        (Date.parse(`${iso.slice(0, 10)}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / 86400000,
      ),
    );

  const notFinishedYet = stats.tournaments.filter((t) => (t.end_date ?? t.start_date) >= today);
  const openTournaments = notFinishedYet
    .filter((t) => t.status === "registration_open" || t.status === "in_progress")
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const featured = openTournaments[0] ?? notFinishedYet[0] ?? null;

  const liveCount = stats.matches.filter((m) => m.status === "live").length;
  // Un partido "scheduled" con fecha pasada está olvidado: no cuenta.
  const isUpcoming = (m: (typeof stats.matches)[number]) =>
    m.status === "live" || (m.status === "scheduled" && (m.scheduled_at ?? "").slice(0, 10) >= today);
  const featuredMatch =
    stats.matches.find((m) => m.status === "live") ??
    stats.matches.filter(isUpcoming).sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))[0] ??
    null;
  const featuredIsOpen =
    featured?.status === "registration_open" &&
    (featured.registration_deadline ?? featured.end_date) >= today;
  // Torneo con inscripción abierta distinto del que anuncia el hero: es la
  // única acción urgente de la página, por eso es la que lleva el naranja.
  const regOpen =
    openTournaments.find(
      (t) =>
        t.status === "registration_open" &&
        (t.registration_deadline ?? t.end_date) >= today,
    ) ?? null;
  const showRegCard = regOpen !== null && regOpen.id !== featured?.id;

  // Sede REAL: ciudad del torneo destacado (única fuente, sin inventar)
  const sedeLabel = formatCity(featured?.city || stats.tournaments[0]?.city) || "Liga16";

  // El hero dice el estado del torneo en UNA línea y ofrece UNA acción.
  // Antes el countdown caía en "0 días" cuando el torneo ya había empezado:
  // la cuenta solo aplica a algo que está en el futuro.
  let heroStatus: string | null = null;
  let ctaLabel = "Ver torneos";
  let ctaHref = "/torneos";
  if (featured) {
    ctaHref = `/torneos/${featured.slug}`;
    if (featured.status === "in_progress") {
      heroStatus = `En curso · hasta el ${formatDate(featured.end_date ?? featured.start_date)}`;
      ctaLabel = "Ver torneo";
    } else if (featuredIsOpen) {
      const d = daysUntil(featured.registration_deadline ?? featured.end_date);
      heroStatus = `Inscripciones abiertas · ${d === 0 ? "cierran hoy" : d === 1 ? "cierran mañana" : `cierran en ${d} días`}`;
      ctaLabel = "Inscribirme";
    } else {
      const d = daysUntil(featured.start_date);
      heroStatus = d === 0 ? "Empieza hoy" : d === 1 ? "Empieza mañana" : `Empieza en ${d} días`;
      ctaLabel = "Ver torneo";
    }
  }

  return (
    <div className="space-y-10 md:space-y-14">
      {/* HERO — foto de cancha + estado del torneo + una sola acción.
          Compacto a propósito: la pantalla es una experiencia con scroll,
          no un póster. El nombre del torneo ya no compite con la marca:
          la marca vive en la navbar. */}
      <section className="relative -mx-4 -mt-8 overflow-hidden rounded-b-[2rem] bg-surface-inverse text-white md:mx-0 md:mt-0 md:rounded-3xl">
        <img
          src={HERO_IMAGE}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />

        <div className="relative flex min-h-[340px] flex-col justify-end px-5 pb-6 pt-16 md:min-h-[380px] md:px-8 md:pb-8">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
            {liveCount > 0 ? (
              <>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                {liveCount === 1 ? "1 partido en vivo" : `${liveCount} partidos en vivo`}
              </>
            ) : (
              `Circuito de pádel · ${sedeLabel}`
            )}
          </p>
          <h1 className="mt-3 max-w-2xl font-poster text-4xl font-extrabold uppercase leading-[0.92] tracking-[-0.01em] text-white sm:text-5xl md:text-6xl">
            {featured?.name ?? "Liga16"}
          </h1>
          {heroStatus && <p className="mt-2 text-sm text-white/70">{heroStatus}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button asChild size="lg" className="rounded-xl bg-white font-semibold text-neutral-900 hover:bg-white/90">
              <Link to={ctaHref}>
                {ctaLabel} <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            {featured && (
              <Link
                to="/torneos"
                className="text-sm font-medium text-white/60 transition-colors hover:text-white"
              >
                Todos los torneos
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* BENTO — una idea por tarjeta: el partido que importa, quién va
          arriba, y la suscripción. Sin tarjeta de "próximo torneo": eso ya
          lo dice el hero. */}
      <section aria-label="Estado del circuito" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {featuredMatch && (
          <div className="flex flex-col rounded-3xl border bg-card p-5 md:col-span-2 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {featuredMatch.tournament_name} · {featuredMatch.round}
              </p>
              {featuredMatch.status === "live" ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary-strong">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                  En vivo
                </span>
              ) : (
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {featuredMatch.scheduled_at
                    ? formatMatchDateTime(featuredMatch.scheduled_at)
                    : "Por definir"}
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col justify-center py-2">
            <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
              <p className="text-base font-semibold leading-tight sm:text-lg">
                {featuredMatch.side_a.pair_name}
              </p>
              <span className="font-headline text-lg text-muted-foreground">VS</span>
              <p className="text-right text-base font-semibold leading-tight sm:text-lg">
                {featuredMatch.side_b.pair_name}
              </p>
            </div>
            {featuredMatch.sets.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {featuredMatch.sets.map((set, index) => (
                  <li
                    key={index}
                    className="rounded-lg bg-muted px-3 py-1.5 font-headline text-xl tabular-nums leading-none"
                  >
                    {set.a}–{set.b}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Por comenzar</p>
            )}
            </div>
            <div className="pt-5">
              <Link
                to="/calendario"
                className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                Ver agenda <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {regOpen && regOpen.id !== featured?.id && (
          <div className="flex flex-col rounded-3xl border bg-card p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Inscripciones abiertas
            </p>
            <h3 className="mt-2 text-base font-semibold leading-tight">{regOpen.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDateRange(regOpen.start_date, regOpen.end_date)}
            </p>
            <p className="mt-4">
              <span className="font-headline text-4xl tabular-nums leading-none">
                {daysUntil(regOpen.registration_deadline ?? regOpen.end_date)}
              </span>{" "}
              <span className="text-sm text-muted-foreground">
                {daysUntil(regOpen.registration_deadline ?? regOpen.end_date) === 1
                  ? "día para inscribirte"
                  : "días para inscribirte"}
              </span>
            </p>
            <div className="mt-auto pt-4">
              <Button asChild className="w-full rounded-xl font-semibold">
                <Link to={`/torneos/${regOpen.slug}`}>Inscribirme</Link>
              </Button>
            </div>
          </div>
        )}

        {/* Suscripción — una línea, sin párrafo de relleno. */}
        <div className={`rounded-3xl border bg-card p-5 md:p-6 ${showRegCard ? "md:col-span-3 md:flex md:items-center md:justify-between md:gap-6" : ""}`}>
          <h3 className="shrink-0 text-sm font-semibold">Regalos y noticias del circuito</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubscribed(true);
            }}
            className={`mt-4 flex gap-2 md:max-w-md ${showRegCard ? "md:mt-0 md:w-full" : ""}`}
          >
            <input
              type="email"
              required
              placeholder="tu@email.com"
              className="min-w-0 flex-1 rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            />
            <Button type="submit" className="rounded-xl font-semibold">
              Enviar
            </Button>
          </form>
          {subscribed && (
            <p className="mt-3 text-xs font-semibold text-primary">
              ✓ Listo, te avisamos.
            </p>
          )}
        </div>
      </section>

      {/* PAREJAS — top 2 por categoría real del circuito */}
      <section>
        <SectionHeading title="Parejas" to="/equipos" action="Ver todas" />
        <GroupFilterBar
          className="mb-4"
          divisions={teamGroups.map((g) => ({ value: g.key, label: g.label }))}
          value={cat}
          onChange={setCat}
        />
        <div className="space-y-3">
          {shownGroups.map((group) => (
            <div
              key={group.key}
              className="overflow-hidden rounded-2xl border bg-card"
            >
              <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
                <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {group.label}
                </p>
                <Link
                  to="/ranking"
                  // El relleno vertical amplía el área de toque (mínimo 24px
                  // de WCAG 2.2); el margen negativo compensa la fila.
                  className="-my-1.5 inline-flex min-h-8 shrink-0 items-center gap-0.5 px-1 text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Tabla <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="divide-y">
                {group.teams.map((team) => (
                  <Link
                    key={team.id}
                    to={`/equipos/${team.slug}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
                  >
                    <TeamCrest team={team} sizeClass="h-9 w-9" textClass="text-2xs" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {team.name}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-headline text-lg leading-none">
                        {team.position > 0 ? `#${team.position}` : "—"}
                      </span>
                      <span className="mt-0.5 block text-2xs text-muted-foreground">
                        {team.points}% · {team.played} PJ
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {shownGroups.length === 0 && (
            <div className="rounded-2xl border bg-card p-8">
              <p className="text-sm text-muted-foreground">
                {cat
                  ? "No hay parejas inscritas en esta categoría."
                  : "Las parejas inscritas aparecerán aquí, organizadas por categoría."}
              </p>
              {cat && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() => setCat("")}
                >
                  Ver todas
                </Button>
              )}
            </div>
import { Link } from "react-router";
import { ArrowRight, ChevronRight } from "lucide-react";
import { db } from "@/lib/data";
import type {
  Match,
  NewsItem,
  Sponsor,
  Team,
  Tournament,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDate,
  formatDateRange,
  formatMatchDateTime,
  formatCity,
} from "@/lib/format";
import {
  DIVISION_ORDER,
  teamCategoryKey,
  teamCategoryLabel,
} from "@/lib/categories";
import { GroupFilterBar } from "@/components/shadcn-space/blocks/navbar-01/group-filter-bar";
import SponsorMarquee from "@/components/blocks/sponsor-marquee";

const HERO_IMAGE = "/images/hero-padel.jpg";

type HomeData = {
  tournaments: Tournament[];
  teams: Team[];
  matches: Match[];
  news: NewsItem[];
  sponsors: Sponsor[];
};

function initialsOf(name: string) {
  return name
    .split(/\s*\/\s*|\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Encabezado de sección: una línea, peso semibold, enlace discreto.
    Nada de display uppercase — el único momento de marca es el hero. */
function SectionHeading({
  title,
  to,
  action,
}: {
  title: string;
  to: string;
  action: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <Link
        to={to}
        className="inline-flex min-h-8 shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        {action} <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

/** Foto del equipo (crest); si no tiene, iniciales sobrias sin decoración. */
function TeamCrest({
  team,
  sizeClass,
  textClass,
}: {
  team: Team;
  sizeClass: string;
  textClass: string;
}) {
  if (team.crest_url) {
    return (
      <img
        src={team.crest_url}
        alt=""
        className={`${sizeClass} shrink-0 rounded-lg border bg-background object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${sizeClass} ${textClass} flex shrink-0 items-center justify-center rounded-lg border bg-primary/10 font-bold uppercase text-primary-strong`}
    >
      {initialsOf(team.name)}
    </span>
  );
}

export default function Home() {
  const [stats, setStats] = useState<HomeData | null>(null);
  // Estado del formulario de alarmas: la confirmación es local, no hay
  // backend de suscripciones todavía.
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      db.listTournaments(),
      db.listTeams(),
      db.listRecentMatches(),
      db.listNews(),
      db.listSponsors(),
    ]).then(([tournaments, teams, matches, news, sponsors]) => {
      if (active)
        setStats({ tournaments, teams, matches, news, sponsors });
      })
      // Sin `catch` la home se quedaba en esqueletos para siempre si una de las
      // cinco peticiones fallaba (o si una sola —por ejemplo noticias— daba
      // error por RLS): el `Promise.all` se rechazaba y no se seteaba nada.
      .catch(() => {
        if (active)
          setStats({
            tournaments: [],
            teams: [],
            matches: [],
            news: [],
            sponsors: [],
          });
      });
    return () => {
      active = false;
    };
  }, []);

  // Parejas: top 2 de CADA CATEGORÍA REAL del circuito.
  //
  // Se agrupa por `teamCategoryKey` —el nombre que el torneo le puso a la
  // inscripción, con respaldo en la división—, igual que hace /equipos. La
  // lista de filtros se arma desde los datos, sin lista blanca.
  const teamGroups = useMemo(() => {
    if (!stats) return [];
    const byKey = new Map<string, Team[]>();
    for (const team of stats.teams) {
      const key = teamCategoryKey(team);
      const list = byKey.get(key);
      if (list) list.push(team);
      else byKey.set(key, [team]);
    }
    const divisionRank = (t: Team) => {
      const i = DIVISION_ORDER.indexOf(t.division);
      return i < 0 ? DIVISION_ORDER.length : i;
    };
    return [...byKey.entries()]
      .map(([key, teams]) => {
        const sorted = [...teams].sort(
          (a, b) =>
            (a.position || Number.MAX_SAFE_INTEGER) -
              (b.position || Number.MAX_SAFE_INTEGER) ||
            b.points - a.points ||
            b.won - a.won,
        );
        return { key, label: teamCategoryLabel(teams[0]), teams: sorted.slice(0, 2) };
      })
      .sort(
        (a, b) =>
          divisionRank(a.teams[0]) - divisionRank(b.teams[0]) ||
          a.label.localeCompare(b.label, "es"),
      );
  }, [stats]);

  const [cat, setCat] = useState("");
  const shownGroups = useMemo(
    () => (cat ? teamGroups.filter((g) => g.key === cat) : teamGroups),
    [teamGroups, cat],
  );

  if (!stats) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[340px] w-full rounded-b-[2rem] md:rounded-3xl" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-[220px] rounded-3xl md:col-span-2" />
          <Skeleton className="h-[220px] rounded-3xl" />
        </div>
      </div>
    );
  }

  /**
   * "Próximo torneo" tiene que ser el más PRÓXIMO, no el primero de la lista:
   * un torneo cuenta si todavía no termina, y dentro de los abiertos gana el
   * más cercano en el calendario.
   *
   * `today` es la fecha LOCAL del visitante (no UTC): en MST el corte de
   * "empieza hoy / cierran mañana" debe cambiar a medianoche local.
   */
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const daysUntil = (iso: string) =>
    Math.max(
      0,
      Math.round(
        (Date.parse(`${iso.slice(0, 10)}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / 86400000,
      ),
    );

  const notFinishedYet = stats.tournaments.filter((t) => (t.end_date ?? t.start_date) >= today);
  const openTournaments = notFinishedYet
    .filter((t) => t.status === "registration_open" || t.status === "in_progress")
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const featured = openTournaments[0] ?? notFinishedYet[0] ?? null;

  const liveCount = stats.matches.filter((m) => m.status === "live").length;
  // Un partido "scheduled" con fecha pasada está olvidado: no cuenta.
  const isUpcoming = (m: (typeof stats.matches)[number]) =>
    m.status === "live" || (m.status === "scheduled" && (m.scheduled_at ?? "").slice(0, 10) >= today);
  const featuredMatch =
    stats.matches.find((m) => m.status === "live") ??
    stats.matches.filter(isUpcoming).sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))[0] ??
    null;
  const featuredIsOpen =
    featured?.status === "registration_open" &&
    (featured.registration_deadline ?? featured.end_date) >= today;
  // Torneo con inscripción abierta distinto del que anuncia el hero: es la
  // única acción urgente de la página, por eso es la que lleva el naranja.
  const regOpen =
    openTournaments.find(
      (t) =>
        t.status === "registration_open" &&
        (t.registration_deadline ?? t.end_date) >= today,
    ) ?? null;
  const showRegCard = regOpen !== null && regOpen.id !== featured?.id;

  // Sede REAL: ciudad del torneo destacado (única fuente, sin inventar)
  const sedeLabel = formatCity(featured?.city || stats.tournaments[0]?.city) || "Liga16";

  // El hero dice el estado del torneo en UNA línea y ofrece UNA acción.
  // Antes el countdown caía en "0 días" cuando el torneo ya había empezado:
  // la cuenta solo aplica a algo que está en el futuro.
  let heroStatus: string | null = null;
  let ctaLabel = "Ver torneos";
  let ctaHref = "/torneos";
  if (featured) {
    ctaHref = `/torneos/${featured.slug}`;
    if (featured.status === "in_progress") {
      heroStatus = `En curso · hasta el ${formatDate(featured.end_date ?? featured.start_date)}`;
      ctaLabel = "Ver torneo";
    } else if (featuredIsOpen) {
      const d = daysUntil(featured.registration_deadline ?? featured.end_date);
      heroStatus = `Inscripciones abiertas · ${d === 0 ? "cierran hoy" : d === 1 ? "cierran mañana" : `cierran en ${d} días`}`;
      ctaLabel = "Inscribirme";
    } else {
      const d = daysUntil(featured.start_date);
      heroStatus = d === 0 ? "Empieza hoy" : d === 1 ? "Empieza mañana" : `Empieza en ${d} días`;
      ctaLabel = "Ver torneo";
    }
  }

  return (
    <div className="space-y-10 md:space-y-14">
      {/* HERO — foto de cancha + estado del torneo + una sola acción.
          Compacto a propósito: la pantalla es una experiencia con scroll,
          no un póster. El nombre del torneo ya no compite con la marca:
          la marca vive en la navbar. */}
      <section className="relative -mx-4 -mt-8 overflow-hidden rounded-b-[2rem] bg-surface-inverse text-white md:mx-0 md:mt-0 md:rounded-3xl">
        <img
          src={HERO_IMAGE}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />

        <div className="relative flex min-h-[340px] flex-col justify-end px-5 pb-6 pt-16 md:min-h-[380px] md:px-8 md:pb-8">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
            {liveCount > 0 ? (
              <>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                {liveCount === 1 ? "1 partido en vivo" : `${liveCount} partidos en vivo`}
              </>
            ) : (
              `Circuito de pádel · ${sedeLabel}`
            )}
          </p>
          <h1 className="mt-3 max-w-2xl font-poster text-4xl font-extrabold uppercase leading-[0.92] tracking-[-0.01em] text-white sm:text-5xl md:text-6xl">
            {featured?.name ?? "Liga16"}
          </h1>
          {heroStatus && <p className="mt-2 text-sm text-white/70">{heroStatus}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button asChild size="lg" className="rounded-xl bg-white font-semibold text-neutral-900 hover:bg-white/90">
              <Link to={ctaHref}>
                {ctaLabel} <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            {featured && (
              <Link
                to="/torneos"
                className="text-sm font-medium text-white/60 transition-colors hover:text-white"
              >
                Todos los torneos
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* BENTO — una idea por tarjeta: el partido que importa, quién va
          arriba, y la suscripción. Sin tarjeta de "próximo torneo": eso ya
          lo dice el hero. */}
      <section aria-label="Estado del circuito" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {featuredMatch && (
          <div className="flex flex-col rounded-3xl border bg-card p-5 md:col-span-2 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {featuredMatch.tournament_name} · {featuredMatch.round}
              </p>
              {featuredMatch.status === "live" ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary-strong">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                  En vivo
                </span>
              ) : (
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {featuredMatch.scheduled_at
                    ? formatMatchDateTime(featuredMatch.scheduled_at)
                    : "Por definir"}
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col justify-center py-2">
            <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
              <p className="text-base font-semibold leading-tight sm:text-lg">
                {featuredMatch.side_a.pair_name}
              </p>
              <span className="font-headline text-lg text-muted-foreground">VS</span>
              <p className="text-right text-base font-semibold leading-tight sm:text-lg">
                {featuredMatch.side_b.pair_name}
              </p>
            </div>
            {featuredMatch.sets.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {featuredMatch.sets.map((set, index) => (
                  <li
                    key={index}
                    className="rounded-lg bg-muted px-3 py-1.5 font-headline text-xl tabular-nums leading-none"
                  >
                    {set.a}–{set.b}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Por comenzar</p>
            )}
            </div>
            <div className="pt-5">
              <Link
                to="/calendario"
                className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                Ver agenda <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {regOpen && regOpen.id !== featured?.id && (
          <div className="flex flex-col rounded-3xl border bg-card p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Inscripciones abiertas
            </p>
            <h3 className="mt-2 text-base font-semibold leading-tight">{regOpen.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDateRange(regOpen.start_date, regOpen.end_date)}
            </p>
            <p className="mt-4">
              <span className="font-headline text-4xl tabular-nums leading-none">
                {daysUntil(regOpen.registration_deadline ?? regOpen.end_date)}
              </span>{" "}
              <span className="text-sm text-muted-foreground">
                {daysUntil(regOpen.registration_deadline ?? regOpen.end_date) === 1
                  ? "día para inscribirte"
                  : "días para inscribirte"}
              </span>
            </p>
            <div className="mt-auto pt-4">
              <Button asChild className="w-full rounded-xl font-semibold">
                <Link to={`/torneos/${regOpen.slug}`}>Inscribirme</Link>
              </Button>
            </div>
          </div>
        )}

        {/* Suscripción — una línea, sin párrafo de relleno. */}
        <div className={`rounded-3xl border bg-card p-5 md:p-6 ${showRegCard ? "md:col-span-3 md:flex md:items-center md:justify-between md:gap-6" : ""}`}>
          <h3 className="shrink-0 text-sm font-semibold">Regalos y noticias del circuito</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubscribed(true);
            }}
            className={`mt-4 flex gap-2 md:max-w-md ${showRegCard ? "md:mt-0 md:w-full" : ""}`}
          >
            <input
              type="email"
              required
              placeholder="tu@email.com"
              className="min-w-0 flex-1 rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            />
            <Button type="submit" className="rounded-xl font-semibold">
              Enviar
            </Button>
          </form>
          {subscribed && (
            <p className="mt-3 text-xs font-semibold text-primary">
              ✓ Listo, te avisamos.
            </p>
          )}
        </div>
      </section>

      {/* PAREJAS — top 2 por categoría real del circuito */}
      <section>
        <SectionHeading title="Parejas" to="/equipos" action="Ver todas" />
        <GroupFilterBar
          className="mb-4"
          divisions={teamGroups.map((g) => ({ value: g.key, label: g.label }))}
          value={cat}
          onChange={setCat}
        />
        <div className="space-y-3">
          {shownGroups.map((group) => (
            <div
              key={group.key}
              className="overflow-hidden rounded-2xl border bg-card"
            >
              <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
                <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {group.label}
                </p>
                <Link
                  to="/ranking"
                  // El relleno vertical amplía el área de toque (mínimo 24px
                  // de WCAG 2.2); el margen negativo compensa la fila.
                  className="-my-1.5 inline-flex min-h-8 shrink-0 items-center gap-0.5 px-1 text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Tabla <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="divide-y">
                {group.teams.map((team) => (
                  <Link
                    key={team.id}
                    to={`/equipos/${team.slug}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
                  >
                    <TeamCrest team={team} sizeClass="h-9 w-9" textClass="text-2xs" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {team.name}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-headline text-lg leading-none">
                        {team.position > 0 ? `#${team.position}` : "—"}
                      </span>
                      <span className="mt-0.5 block text-2xs text-muted-foreground">
                        {team.points}% · {team.played} PJ
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {shownGroups.length === 0 && (
            <div className="rounded-2xl border bg-card p-8">
              <p className="text-sm text-muted-foreground">
                {cat
                  ? "No hay parejas inscritas en esta categoría."
                  : "Las parejas inscritas aparecerán aquí, organizadas por categoría."}
              </p>
              {cat && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() => setCat("")}
                >
                  Ver todas
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* NOTICIAS */}
      {stats.news.length > 0 && (
        <section>
          <SectionHeading title="Noticias" to="/noticias" action="Ver todas" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
            {stats.news.slice(0, 3).map((item) => (
              <article key={item.id} className="group">
                <div className="relative mb-3 aspect-[16/9] overflow-hidden rounded-2xl bg-muted">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="relative h-full w-full overflow-hidden bg-neutral-900 text-white">
                      <span className="absolute -bottom-8 -right-1 font-headline text-[7rem] leading-none text-primary/35">
                        16
                      </span>
                      <span className="absolute left-4 top-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
                        Liga16
                      </span>
                    </div>
                  )}
                </div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                    {item.tag}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(item.published_at)}
                  </span>
                </div>
                <h3 className="text-base font-semibold leading-snug">
                  {item.title}
                </h3>
                <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {item.excerpt}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Banner rotativo de patrocinadores — se administra en /admin/sponsors */}
      <SponsorMarquee sponsors={stats?.sponsors ?? []} />
    </div>
  );
}
