import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/data";
import type { Match, PlayerProfile } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { PageHero } from "@/components/page-hero";
import { FilterBar } from "@/components/ui/filter-bar";
import { Radio, Calendar, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { formatMatchTime } from "@/lib/format";
import { localDayKey, todayKey } from "@/lib/schedule";
import { MatchCard } from "@/components/cards/card-kit";
import { cn } from "@/lib/utils";

/** Estados que la agenda enseña: lo que está por jugarse, lo que se juega hoy y
 *  lo que se jugó hoy. "disputed", "walkover" y "cancelled" no son agenda. */
const SHOW_STATUSES = new Set(["live", "scheduled", "finished"]);

/** Cuánto puede pasar un partido marcado "en vivo" antes de dejar de serlo: un
 *  partido del mes pasado que nadie cerró no está en vivo, está olvidado. */
const LIVE_WINDOW_MS = 6 * 60 * 60 * 1000;

function isLiveNow(m: Match): boolean {
  if (m.status !== "live") return false;
  const at = new Date(m.scheduled_at ?? "").getTime();
  return Number.isFinite(at) && Date.now() - at < LIVE_WINDOW_MS;
}

function isPast(m: Match): boolean {
  const at = new Date(m.scheduled_at ?? "").getTime();
  return Number.isFinite(at) && at < Date.now();
}

function dayLabel(day: string): string {
  const today = todayKey();
  const d = new Date(`${day}T12:00:00`);
  const base = d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  if (day === today) return `Hoy · ${base}`;
  const yesterday = new Date(`${today}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`)
    return `Ayer · ${base}`;
  return base;
}

/**
 * Agenda pública: qué juega HOY y cuándo es el próximo partido, con navegación
 * por día y filtros. Antes era una lista de 8 sin día ni filtro: no respondía
 * ninguna de las dos preguntas.
 */
export default function CalendarPage() {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [myPairIds, setMyPairIds] = useState<Set<string> | null>(null);
  const [day, setDay] = useState<string>("");
  const [query, setQuery] = useState("");
  const [tournament, setTournament] = useState("all");
  const [category, setCategory] = useState("all");
  const [onlyMine, setOnlyMine] = useState(false);

  useEffect(() => {
    let active = true;
    db.listRecentMatches().then((data) => {
      if (!active) return;
      setMatches(data);
      // Arranca en hoy si hay algo; si no, en el primer día con partidos: abrir
      // en un día vacío y llamarlo "agenda" es lo que hacía inútil la pantalla.
      const today = todayKey();
      const days = [...new Set(
        data
          .filter((m) => !isPast(m) || isLiveNow(m))
          .map((m) => localDayKey(m.scheduled_at ?? ""))
          .filter(Boolean),
      )].sort();
      setDay(days.includes(today) ? today : (days[0] ?? today));
    });
    db.getMyProfile().then((p) => { if (active) setProfile(p); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  // "Mis partidos": el partido trae el id de la pareja, no del jugador, así que
  // hay que preguntar por las parejas de los torneos que aparecen en la agenda.
  useEffect(() => {
    if (!onlyMine || !profile || myPairIds) return;
    const tournaments = [...new Set((matches ?? []).map((m) => m.tournament_id).filter(Boolean))];
    Promise.all(tournaments.map((id) => db.getTournamentPairs(id as string)))
      .then((lists) => {
        const mine = new Set<string>();
        lists.flat().forEach((p) => {
          if (p.player1_id === profile.id || p.player2_id === profile.id) mine.add(p.id);
        });
        setMyPairIds(mine);
      })
      .catch(() => setMyPairIds(new Set()));
  }, [onlyMine, profile, myPairIds, matches]);

  const agenda = useMemo(() => {
    if (!matches) return [];
    return matches
      .filter((m) => SHOW_STATUSES.has(m.status))
      .filter((m) => isLiveNow(m) || !isPast(m))
      .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
  }, [matches]);

  /** Lo que ya se jugó, para que la pantalla no quede vacía cuando el circuito
   *  no tiene nada agendado: los últimos resultados, no todo el historial. */
  const recent = useMemo(() => {
    if (!matches) return [];
    return matches
      .filter((m) => SHOW_STATUSES.has(m.status))
      .filter((m) => isPast(m) && !isLiveNow(m))
      .sort((a, b) => (b.scheduled_at ?? "").localeCompare(a.scheduled_at ?? ""))
      .slice(0, 5);
  }, [matches]);

  const days = useMemo(() => [...new Set(agenda.map((m) => localDayKey(m.scheduled_at ?? "")).filter(Boolean))].sort(), [agenda]);
  const tournaments = useMemo(() => [...new Set(agenda.map((m) => m.tournament_name).filter(Boolean))].sort() as string[], [agenda]);
  const categories = useMemo(() => [...new Set(agenda.map((m) => m.category_name).filter(Boolean))].sort() as string[], [agenda]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agenda.filter((m) => {
      if (tournament !== "all" && m.tournament_name !== tournament) return false;
      if (category !== "all" && m.category_name !== category) return false;
      if (onlyMine && myPairIds && !(myPairIds.has(m.side_a.pair_id ?? "") || myPairIds.has(m.side_b.pair_id ?? ""))) return false;
      if (!q) return true;
      return [m.side_a.pair_name, m.side_b.pair_name, m.tournament_name, m.category_name, m.round, m.court_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [agenda, query, tournament, category, onlyMine, myPairIds]);

  const dayMatches = useMemo(
    () => filtered.filter((m) => localDayKey(m.scheduled_at ?? "") === day),
    [filtered, day],
  );
  const liveCount = agenda.filter(isLiveNow).length;
  const nextMatch = agenda.find((m) => !isPast(m) || isLiveNow(m));

  if (matches === null) {
    return (
      <section className="space-y-3">
        <Skeleton className="h-10 w-64" />
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
      </section>
    );
  }

  const dayIndex = days.indexOf(day);
  const canPrev = dayIndex > 0;
  const canNext = dayIndex >= 0 && dayIndex < days.length - 1;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        eyebrow="Agenda"
        title="Calendario"
        subtitle="Qué juega hoy y cuándo es el próximo partido del circuito."
        ghost="16"
        stats={[
          { k: "En juego", v: liveCount, icon: <Radio className="h-4 w-4" /> },
          { k: "Por jugar", v: agenda.filter((m) => !isPast(m)).length, icon: <Calendar className="h-4 w-4" /> },
          { k: "Días con juego", v: days.length, icon: <MapPin className="h-4 w-4" /> },
        ]}
      />

      {liveCount > 0 && (
        <div className="relative z-10 -mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="destructive" className="animate-pulse">
            <Radio className="mr-1 h-3 w-3" /> {liveCount} en vivo
          </Badge>
          {nextMatch && (
            <span className="text-sm text-muted-foreground">
              Ahora: {nextMatch.side_a.pair_name} contra {nextMatch.side_b.pair_name} ·{" "}
              {formatMatchTime(nextMatch.scheduled_at ?? "")}
            </span>
          )}
        </div>
      )}

      <FilterBar
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Buscar equipo, torneo o sede…"
        selects={[
          {
            key: "torneo",
            ariaLabel: "Filtrar por torneo",
            allLabel: "Todos los torneos",
            value: tournament,
            onChange: setTournament,
            options: tournaments.map((t) => ({ value: t, label: t })),
            className: "w-52",
          },
          {
            key: "categoria",
            ariaLabel: "Filtrar por categoría",
            allLabel: "Todas las categorías",
            value: category,
            onChange: setCategory,
            options: categories.map((c) => ({ value: c, label: c })),
            className: "w-48",
          },
        ]}
        resultCount={filtered.length}
        resultLabel="partidos"
        onClear={() => {
          setQuery("");
          setTournament("all");
          setCategory("all");
          setOnlyMine(false);
        }}
  
      >
        {profile && (
          <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            {/* shadcn lo hace de 20px de alto (h-5), por debajo del mínimo de
                24px de WCAG 2.2. Se agranda solo aquí; tocar el componente
                global cambiaría cada switch de la app. */}
            <Switch
              checked={onlyMine}
              onCheckedChange={setOnlyMine}
              aria-label="Ver solo mis partidos"
              className="h-6 w-10"
            />
            Mis partidos
          </label>
        )}
      </FilterBar>

      {/* Navegación por día: chips con conteo + anterior/siguiente. */}
      {days.length > 0 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            onClick={() => canPrev && setDay(days[dayIndex - 1])}
            disabled={!canPrev}
            aria-label="Día anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto">
            {days.map((d) => {
              const count = filtered.filter((m) => localDayKey(m.scheduled_at ?? "") === d).length;
              const active = d === day;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDay(d)}
                  aria-pressed={active}
                  className={cn(
                    "flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  {d === todayKey()
                    ? "Hoy"
                    : new Date(`${d}T12:00:00`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric" })}
                  <span className={cn("text-xs tabular-nums", active ? "opacity-80" : "text-muted-foreground")}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            onClick={() => canNext && setDay(days[dayIndex + 1])}
            disabled={!canNext}
            aria-label="Día siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="stagger-in space-y-3">
        {dayMatches.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-lg font-medium">
                {days.length === 0
                  ? "No hay partidos programados"
                  : `Sin partidos ${day === todayKey() ? "hoy" : dayLabel(day)}`}
              </p>
              <p className="mt-1 text-sm">
                {nextMatch
                  ? `El próximo es ${dayLabel(localDayKey(nextMatch.scheduled_at ?? ""))} a las ${formatMatchTime(nextMatch.scheduled_at ?? "")}.`
                  : "Revisa los torneos para ver las próximas fechas."}
              </p>
              {canNext && (
                <Button variant="outline" className="mt-4" onClick={() => setDay(days[dayIndex + 1])}>
                  Ver el día siguiente
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="border-b pb-1.5 text-sm font-semibold capitalize">{dayLabel(day)}</p>
            {dayMatches.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </>
        )}
      </div>

      {/* Lo último que se jugó: la agenda responde "¿qué juego hoy?", y esto es lo
          que responde "¿cómo quedó lo último?" sin mezclar ambas cosas. */}
      {recent.length > 0 && (
        <section className="space-y-3">
          <p className="border-b pb-1.5 text-sm font-semibold">Últimos resultados</p>
          {recent.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </section>
      )}
    </div>
  );
}
