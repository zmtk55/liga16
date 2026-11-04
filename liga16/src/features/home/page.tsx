import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
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
  formatMatchDateTime,
  formatMatchTime,
} from "@/lib/format";
import { cn } from "@/lib/utils";
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

/** Curva de salida del sistema: la misma que fade-in-up en index.css. */
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/**
 * Entrada al hacer scroll: sube 16px y aparece, una sola vez. Con
 * prefers-reduced-motion el contenido se muestra quieto, sin animación.
 */
function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Titular del hero: entra palabra por palabra, cada una subiendo dentro de
    su propia máscara (overflow-hidden). Con reduced-motion, texto plano. */
function initialsOf(name: string) {
  return name
    .split(/\s*\/\s*|\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Foto del equipo (crest); si no tiene, iniciales sobrias sin decoración. */
function TeamCrest({ team }: { team: Team }) {
  if (team.crest_url) {
    return (
      <img
        src={team.crest_url}
        alt=""
        className="h-9 w-9 shrink-0 rounded-lg border bg-background object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-primary/10 text-2xs font-bold uppercase text-primary-strong"
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
  const reduceMotion = useReducedMotion();

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

  const [day, setDay] = useState("");

  const [tourIdx, setTourIdx] = useState(0);
  const [cat, setCat] = useState("");
  const shownGroups = useMemo(
    () => (cat ? teamGroups.filter((g) => g.key === cat) : teamGroups),
    [teamGroups, cat],
  );

  if (!stats) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[380px] w-full rounded-b-[2rem] md:rounded-3xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-28 w-full" />
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
  // Torneos activos del hero: los que están EN CURSO; si no hay, el próximo
  // abierto o en calendario, como antes.
  const inProgress = openTournaments.filter((tr) => tr.status === "in_progress");
  const heroTournaments = inProgress.length > 0 ? inProgress : (openTournaments[0] ?? notFinishedYet[0]) ? [openTournaments[0] ?? notFinishedYet[0]!] : [];
  const featured = heroTournaments[Math.min(tourIdx, heroTournaments.length - 1)] ?? null;
  // Días con partidos DEL torneo activo; el día seleccionado filtra la pizarra.
  const matchDays = featured
    ? [...new Set(stats.matches.filter((m) => m.tournament_id === featured.id && m.scheduled_at).map((m) => (m.scheduled_at ?? "").slice(0, 10)))].sort()
    : [];

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
  const showReg = regOpen !== null && regOpen.id !== featured?.id;

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

  const regDays = regOpen ? daysUntil(regOpen.registration_deadline ?? regOpen.end_date) : 0;

  const selectedDay =
    day && matchDays.includes(day)
      ? day
      : matchDays.includes(today)
        ? today
        : (matchDays.find((d) => d >= today) ?? matchDays[matchDays.length - 1] ?? "");
  const dayMatches = stats.matches
    .filter((m) => !featured || m.tournament_id === featured.id)
    .filter((m) => (m.scheduled_at ?? "").slice(0, 10) === selectedDay)
    .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)));

  return (
    <div className="-mx-4 -mt-8 md:-mx-6">
      {/* PANTALLA 1 — la foto ES la pantalla (ref Tennis Zone): chip del
          torneo sobre la foto, píldoras de días y pizarra glass del día. */}
      <section className="relative min-h-[88svh] overflow-hidden bg-surface-inverse text-surface-inverse-foreground md:min-h-[80vh]">
        <motion.img
          src={HERO_IMAGE}
          alt=""
          initial={{ scale: 1.04 }}
          animate={reduceMotion ? { scale: 1.04 } : { scale: 1.14 }}
          transition={{ duration: 28, repeat: Infinity, repeatType: "mirror", ease: "linear" }}
          className="absolute inset-0 h-full w-full object-cover object-center opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/30" />

        <div className="relative flex min-h-[88svh] flex-col justify-end gap-8 px-4 pb-40 pt-24 md:min-h-[80vh] md:px-8 md:pb-28 md:pt-32">
          {/* Zona superior sobre la foto: nombre del torneo, estado y CTA —
              la pantalla ya no queda vacía arriba (ref Tennis Zone). */}
          {featured && (
            <div>
              {heroTournaments.length > 1 && (
                <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
                  {heroTournaments.map((tr, i) => (
                    <button
                      key={tr.id}
                      type="button"
                      onClick={() => setTourIdx(i)}
                      aria-pressed={i === Math.min(tourIdx, heroTournaments.length - 1)}
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-md transition-colors",
                        i === Math.min(tourIdx, heroTournaments.length - 1)
                          ? "border-white bg-white text-neutral-900"
                          : "border-white/20 bg-white/10 text-white/80 hover:bg-white/20",
                      )}
                    >
                      {tr.name}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                {featured.status === "in_progress" ? "Torneo en curso" : "Próximo torneo"}
              </p>
              <h1 className="mt-2 max-w-md font-poster text-5xl font-bold uppercase leading-[0.9] tracking-tight text-white md:text-7xl">
                {featured.name}
              </h1>
              {heroStatus && (
                <p className="mt-2 text-sm font-medium text-white/70">{heroStatus}</p>
              )}
              <Button asChild size="lg" className="group mt-4 h-11 rounded-full bg-white px-5 text-sm font-semibold text-neutral-900 hover:bg-white/90">
                <Link to={ctaHref}>
                  {ctaLabel}
                  <span className="ml-2 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-white transition-transform duration-300 group-hover:translate-x-0.5">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </Button>
            </div>
          )}

          <div>

          {/* Píldoras de días: filtran los partidos de la pizarra. */}
          {matchDays.length > 0 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 md:mx-0 md:px-0">
              {matchDays.map((d) => {
                const date = new Date(`${d}T00:00:00`);
                const wd = new Intl.DateTimeFormat("es-MX", { weekday: "short" }).format(date).replace(".", "");
                const active = d === selectedDay;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDay(d)}
                    aria-pressed={active}
                    className={cn(
                      "flex w-14 shrink-0 flex-col items-center rounded-full border px-2 py-2 backdrop-blur-md transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-white/20 bg-white/10 text-white/85 hover:bg-white/20",
                    )}
                  >
                    <span className="text-xs capitalize leading-tight opacity-80">{wd}</span>
                    <span className="text-base font-bold tabular-nums leading-tight">{date.getDate()}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Pizarra glass: los partidos del día seleccionado. */}
          <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-md md:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white/90">
                {selectedDay
                  ? new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${selectedDay}T00:00:00`))
                  : "Partidos"}
              </p>
              <Link to="/calendario" className="group inline-flex shrink-0 items-center gap-1 text-xs font-medium text-white/60 transition-colors hover:text-white">
                Ver agenda
                <ChevronRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="mt-1 divide-y divide-white/10">
              {dayMatches.length === 0 && (
                <p className="py-3 text-sm text-white/60">Sin partidos programados todavía.</p>
              )}
              {dayMatches.slice(0, 2).map((m) => (
                <Link key={m.id} to="/calendario" className="flex items-center gap-3 py-2.5 transition-colors hover:bg-white/5">
                  {m.status === "live" ? (
                    <span className="flex w-14 shrink-0 items-center gap-1.5 text-xs font-bold text-primary">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                      En vivo
                    </span>
                  ) : (
                    <span className="w-14 shrink-0 text-xs font-semibold tabular-nums text-white/70">
                      {m.scheduled_at ? formatMatchTime(m.scheduled_at) : "—"}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {m.side_a.pair_name} vs {m.side_b.pair_name}
                  </span>
                  {m.sets.length > 0 && (
                    <span className="shrink-0 text-sm font-bold tabular-nums text-white/90">
                      {m.sets.map((s) => `${s.a}-${s.b}`).join("  ")}
                    </span>
                  )}
                </Link>
              ))}
              {dayMatches.length > 2 && (
                <Link to="/calendario" className="block py-2 text-xs font-semibold text-white/70 transition-colors hover:text-white">
                  +{dayMatches.length - 2} más · Ver agenda
                </Link>
              )}
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* SHEET — la hoja clara se monta sobre la foto (ref Tennis Zone):
          carrusel de tarjetas con foto, parejas y noticias. */}
      <div className="relative z-10 -mt-12 space-y-10 rounded-t-[2rem] bg-background px-4 pt-8 md:space-y-12 md:px-6">
        {/* Carrusel de tarjetas con foto: torneo, inscripción, próximo partido. */}
        <section aria-label="Lo que viene">
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
            {featured && (
              <Link
                to={ctaHref}
                className="group w-[240px] shrink-0 snap-start overflow-hidden rounded-3xl border bg-background shadow-sm md:w-[280px]"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  <img src={featured.cover_url ?? HERO_IMAGE} alt="" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
                  <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                    {featured.status === "in_progress" ? "Torneo en curso" : "Próximo torneo"}
                  </span>
                </div>
                <div className="p-4">
                  <p className="font-semibold leading-snug">{featured.name}</p>
                  {heroStatus && <p className="mt-0.5 text-xs text-muted-foreground">{heroStatus}</p>}
                  <p className="mt-2.5 flex items-center gap-1 text-sm font-semibold text-primary">
                    {ctaLabel}
                    <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </p>
                </div>
              </Link>
            )}
            {showReg && regOpen && (
              <Link
                to={`/torneos/${regOpen.slug}`}
                className="group w-[240px] shrink-0 snap-start overflow-hidden rounded-3xl border bg-background shadow-sm md:w-[280px]"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  <img src={regOpen.cover_url ?? HERO_IMAGE} alt="" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
                  <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                    Inscripción abierta
                  </span>
                </div>
                <div className="p-4">
                  <p className="font-semibold leading-snug">
                    {regDays === 1 ? "1 día para inscribirte" : `${regDays} días para inscribirte`}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{regOpen.name}</p>
                  <p className="mt-2.5 flex items-center gap-1 text-sm font-semibold text-primary">
                    Inscribirme
                    <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </p>
                </div>
              </Link>
            )}
            {featuredMatch && (
              <Link
                to="/calendario"
                className="group w-[240px] shrink-0 snap-start overflow-hidden rounded-3xl border bg-background shadow-sm md:w-[280px]"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  <img src={HERO_IMAGE} alt="" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
                  <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                    {featuredMatch.status === "live" ? "En vivo" : "Próximo partido"}
                  </span>
                </div>
                <div className="p-4">
                  <p className="truncate font-semibold leading-snug">
                    {featuredMatch.side_a.pair_name} vs {featuredMatch.side_b.pair_name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {[featuredMatch.scheduled_at ? formatMatchDateTime(featuredMatch.scheduled_at) : "Por definir", featuredMatch.tournament_name].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-2.5 flex items-center gap-1 text-sm font-semibold text-primary">
                    Ver agenda
                    <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </p>
                </div>
              </Link>
            )}
          </div>
        </section>

        {/* PAREJAS — filas densas de un solo nivel: posición, nombre, dato.
            El filtro es el encabezado; sin cajas ni etiquetas repetidas. */}
        <Reveal>
          <section className="border-t border-border/70 pt-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold tracking-tight">Parejas</h2>
              <Link
                to="/equipos"
                className="group inline-flex min-h-8 shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Ver todas
                <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </div>
            <GroupFilterBar
              className="mb-4"
              divisions={teamGroups.map((g) => ({ value: g.key, label: g.label }))}
              value={cat}
              onChange={setCat}
            />
            <div className="space-y-5">
              {shownGroups.map((group) => (
                <div key={group.key}>
                  <p className="mb-1.5 text-sm font-semibold text-muted-foreground">{group.label}</p>
                  <div className="divide-y divide-border/70 border-y border-border/70">
                    {group.teams.map((team) => (
                      <Link
                        key={team.id}
                        to={`/equipos/${team.slug}`}
                        className="group flex items-center gap-3 py-2.5 pr-1 transition-colors hover:bg-muted/40"
                      >
                        <span className="w-7 shrink-0 text-left text-sm font-bold tabular-nums text-muted-foreground">
                          {team.position > 0 ? `${team.position}º` : "—"}
                        </span>
                        <TeamCrest team={team} />
                        <span className="flex min-w-0 flex-1 items-baseline gap-2.5">
                          <span className="truncate text-sm font-semibold">{team.name}</span>
                          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                            {team.points}% · {team.played} PJ
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-foreground" />
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              {shownGroups.length === 0 && (
                <div className="border-y border-border/70 py-6">
                  <p className="text-sm text-muted-foreground">
                    {cat
                      ? "No hay parejas inscritas en esta categoría."
                      : "Las parejas inscritas aparecerán aquí, organizadas por categoría."}
                  </p>
                  {cat && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => setCat("")}
                    >
                      Ver todas
                    </Button>
                  )}
                </div>
              )}
            </div>
          </section>
        </Reveal>

        {/* NOTICIAS — carrusel horizontal de tarjetas con foto (ref Tennis Zone). */}
        {stats.news.length > 0 && (
          <section className="border-t border-border/70 pt-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold tracking-tight">Noticias</h2>
              <Link
                to="/noticias"
                className="group inline-flex min-h-8 shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Ver todas
                <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
              {stats.news.slice(0, 6).map((item) => (
                <Link key={item.id} to="/noticias" className="group w-[240px] shrink-0 snap-start md:w-[280px]">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="relative h-full w-full overflow-hidden bg-surface-inverse text-surface-inverse-foreground">
                        <span className="absolute -bottom-8 -right-1 font-headline text-[7rem] leading-none text-primary/35">
                          16
                        </span>
                        <span className="absolute left-4 top-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
                          Liga16
                        </span>
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                      {item.tag}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{formatDate(item.published_at)}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">{item.title}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* SUSCRIPCIÓN — una línea y el campo, sin caja. */}
        <Reveal>
          <section aria-label="Regalos y noticias del circuito" className="border-t border-border/70 pb-2 pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
              <h2 className="shrink-0 text-xl font-bold tracking-tight">
                Regalos y noticias
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSubscribed(true);
                }}
                className="flex w-full gap-2 sm:max-w-md"
              >
                <input
                  type="email"
                  required
                  placeholder="tu@email.com"
                  className="h-11 min-w-0 flex-1 rounded-full border bg-background px-4 text-sm outline-none transition-colors focus:border-primary"
                />
                <Button type="submit" className="h-11 rounded-full px-5 font-semibold" disabled={subscribed}>
                  {subscribed ? "Listo" : "Enviar"}
                </Button>
              </form>
            </div>
          </section>
        </Reveal>

        {/* Banner rotativo de patrocinadores — se administra en /admin/sponsors */}
        <SponsorMarquee sponsors={stats?.sponsors ?? []} />
      </div>
    </div>
  );
}
