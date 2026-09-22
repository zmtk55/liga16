import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { Match, MatchStatus } from "@/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const statusMeta: Record<
  MatchStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  live: { label: "En vivo", variant: "destructive" },
  scheduled: { label: "Programado", variant: "secondary" },
  finished: { label: "Finalizado", variant: "outline" },
  walkover: { label: "W.O.", variant: "outline" },
  disputed: { label: "En disputa", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "outline" },
};

function formatWhen(iso: string | null) {
  if (!iso) return "Sin fecha";
  return new Date(iso).toLocaleString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function setsSummary(m: Match) {
  if (m.sets.length === 0) return "—";
  return m.sets.map((s) => `${s.a}-${s.b}`).join("  ");
}

export default function CalendarPage() {
  const [matches, setMatches] = useState<Match[] | null>(null);

  useEffect(() => {
    let active = true;
    db.listRecentMatches().then((data) => {
      if (active) setMatches(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          Calendario de Partidos
        </h1>
        <p className="text-muted-foreground">
          Partidos en vivo, programados y resultados recientes
        </p>
      </header>

      {matches === null ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => {
            const meta = statusMeta[m.status];
            return (
              <Card key={m.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {m.tournament_name} · {m.category_name} · {m.round}
                    </CardTitle>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span
                      className={
                        m.winner === "a" ? "font-semibold" : undefined
                      }
                    >
                      {m.side_a.pair_name}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {setsSummary(m)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span
                      className={
                        m.winner === "b" ? "font-semibold" : undefined
                      }
                    >
                      {m.side_b.pair_name}
                    </span>
                  </div>
                  <p className="pt-1 text-xs text-muted-foreground">
                    {formatWhen(m.scheduled_at)}
                    {m.court_name ? ` · ${m.court_name}` : ""}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}