import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { Match } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHero } from "@/components/page-hero";
import { MapPin, Radio, Calendar, Trophy } from "lucide-react";
import { formatMatchDay, formatMatchMonth, formatMatchTime12 } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Pares "Nombre Apellido" desde "Nombre1 / Nombre2" (tolera "y", "&"). */
function pairNames(full: string): string[] {
  const parts = full
    .split(/\s*\/\s*|\s+y\s*|\s*&\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : [full.trim()];
}

/**
 * Card de partido estilo marcador deportivo: cada pareja alineada con SUS
 * sets en columnas compartidas (como ESPN). Nombres completos con wrap,
 * nunca truncados. Todo en lenguaje de cancha mexicano.
 */
function MatchRow({ m }: { m: Match }) {
  const isLive = m.status === "live";
  const hasScore = m.sets.length > 0;
  const aWon = m.winner === "a";
  const bWon = m.winner === "b";

  const sideRow = (side: "a" | "b") => {
    const names = pairNames(side === "a" ? m.side_a.pair_name : m.side_b.pair_name);
    const won = side === "a" ? aWon : bWon;
    return (
      <div className="flex min-w-0 items-center gap-2">
        {/* Punto de estado del lado: verde ganador, gris el otro */}
        <span
          aria-hidden
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            hasScore ? (won ? "bg-emerald-500" : "bg-muted-foreground/30") : "bg-primary/50",
          )}
        />
        <div className="min-w-0 flex-1">
          {names.map((n, i) => (
            <p
              key={i}
              className={cn(
                "truncate text-[13px] leading-snug",
                i === 0 && "font-semibold",
                hasScore
                  ? won
                    ? "text-foreground"
                    : "text-muted-foreground"
                  : "text-foreground",
              )}
            >
              {n}
            </p>
          ))}
        </div>
        {/* Los sets de ESTE lado, alineados con las columnas del otro lado */}
        <div className="flex shrink-0 items-center gap-1">
          {m.sets.map((s, i) => {
            const mine = side === "a" ? s.a : s.b;
            const theirs = side === "a" ? s.b : s.a;
            const tookSet = (mine ?? 0) > (theirs ?? 0);
            return (
              <span
                key={i}
                className={cn(
                  "flex h-6 w-7 items-center justify-center rounded-md font-mono text-xs font-bold tabular-nums",
                  tookSet
                    ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {mine ?? "-"}
              </span>
            );
          })}
          {!hasScore && (
            <span className="px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              —
            </span>
          )}
        </div>
      </div>
    );
  };

  // Hora separada en ["5:26", "pm"] para componer la jerarquía visual
  const timeParts = m.scheduled_at ? formatMatchTime12(m.scheduled_at).split(" ") : null;

  return (
    <Card
      className={cn(
        "transition-all duration-200 active:scale-[0.995]",
        isLive ? "border-red-500/40 bg-red-50/30 dark:bg-red-950/15" : "hover:border-primary/25",
      )}
    >
      <CardContent className="flex gap-3 p-3.5">
        {/* ── Riel izquierdo: CUÁNDO, el ancla visual más grande ── */}
        <div
          className={cn(
            "flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-2",
            isLive
              ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
              : "border-border/80 bg-muted/40",
          )}
        >
          {timeParts ? (
            <>
              <span className="font-display text-xl font-bold leading-none tabular-nums">{timeParts[0]}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">{timeParts[1] ?? ""}</span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                {formatMatchDay(m.scheduled_at!)} {formatMatchMonth(m.scheduled_at!)}
              </span>
            </>
          ) : (
            <>
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                Por agendar
              </span>
            </>
          )}
          {isLive && (
            <span className="mt-1 flex items-center gap-1 text-[9px] font-bold uppercase text-red-600 dark:text-red-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> En vivo
            </span>
          )}
        </div>

        {/* ── Derecha: quién juega + dónde ── */}
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <span className="truncate">{[m.round, m.category_name].filter(Boolean).join(" · ") || m.tournament_name || "Liga16"}</span>
          </div>

          {/* Los dos lados: mismos anchos, sets en columnas alineadas */}
          <div className="space-y-1">
            {sideRow("a")}
            <div aria-hidden className="ml-4 h-px bg-border/70" />
            {sideRow("b")}
          </div>

          {/* DÓNDE: pill prominente, siempre explícita */}
          <div className="mt-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                m.court_name
                  ? "bg-primary/10 text-primary"
                  : "border border-dashed text-muted-foreground",
              )}
            >
              <MapPin className="h-3 w-3" />
              {m.court_name ? `Cancha ${m.court_name}` : "Cancha por asignar"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CalendarPage() {
  const [matches, setMatches] = useState<Match[] | null>(null);

  useEffect(() => {
    let active = true;
    db.listRecentMatches().then((data) => { if (active) setMatches(data); });
    return () => { active = false; };
  }, []);

  if (matches === null) {
    return (
      <section className="space-y-3">
        <Skeleton className="h-10 w-64" />
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
      </section>
    );
  }

  const live = matches.filter((m) => m.status === "live");
  const upcoming = matches.filter((m) => m.status === "scheduled").slice(0, 8);
  const agenda = [...live, ...upcoming].slice(0, 8);
  // Fecha del chip: la del primer partido agendado
  const chipDate = agenda[0]?.scheduled_at ?? null;

  return (
    <div className="animate-fade-in space-y-8">
      <PageHero
        eyebrow="Agenda"
        title="Calendario"
        subtitle="Próximos partidos y duelos en juego, hora por hora."
        ghost="16"
        stats={[
          { k: "En juego", v: live.length, icon: <Radio className="h-4 w-4" /> },
          { k: "Programados", v: upcoming.length, icon: <Calendar className="h-4 w-4" /> },
          { k: "Sedes", v: new Set(matches.map((m) => m.tournament_name).filter(Boolean)).size, icon: <Trophy className="h-4 w-4" /> },
        ]}
      />

      {live.length > 0 && (
        <div className="relative z-10 -mt-4 flex items-center gap-2">
          <Badge variant="destructive" className="animate-pulse"><Radio className="mr-1 h-3 w-3" /> {live.length} en vivo</Badge>
          <span className="text-xs text-muted-foreground">Actualizado ahora</span>
        </div>
      )}

      <div className="stagger-in space-y-3">
        {agenda.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <Calendar className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-lg font-medium">No hay partidos programados</p>
              <p className="mt-1">Revisa los torneos para ver las próximas fechas.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {chipDate && (
              <div className="flex items-center gap-2 px-1">
                <span className="rounded-lg bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
                  {formatMatchDay(chipDate)} {formatMatchMonth(chipDate)}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Próximos partidos
                </span>
              </div>
            )}
            {agenda.map((m) => <MatchRow key={m.id} m={m} />)}
          </>
        )}
      </div>
    </div>
  );
}