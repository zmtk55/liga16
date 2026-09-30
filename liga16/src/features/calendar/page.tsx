import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { Match } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHero } from "@/components/page-hero";
import { Radio, Calendar, Trophy } from "lucide-react";
import { formatMatchDay, formatMatchMonth } from "@/lib/format";
import { MatchCard } from "@/components/cards/card-kit";

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
            {agenda.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}