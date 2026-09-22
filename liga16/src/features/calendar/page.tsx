import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { Match } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock, MapPin, Radio } from "lucide-react";
import { formatMatchScore } from "@/lib/scoring";
import { formatMatchDateTime, initials } from "@/lib/format";

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

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Agenda</h1>
        <p className="text-muted-foreground">Próximos partidos y partidos en juego</p>
      </header>

      {live.length > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="animate-pulse"><Radio className="mr-1 h-3 w-3" /> {live.length} en vivo</Badge>
          <span className="text-xs text-muted-foreground">Actualizado ahora</span>
        </div>
      )}

      <div className="space-y-3">
        {agenda.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">No hay partidos programados. Revisa los torneos para ver las próximas fechas.</CardContent></Card>
        ) : (
          agenda.map((m) => {
            const aNames = m.side_a.pair_name.split("/").map((s) => s.trim());
            const bNames = m.side_b.pair_name.split("/").map((s) => s.trim());
            const isLive = m.status === "live";
            return (
              <Card key={m.id} className={`${isLive ? "border-red-500/30 bg-red-50/20 dark:bg-red-950/10" : "hover:border-primary/20"} transition-colors`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground truncate">{m.tournament_name} · {m.category_name} · {m.round}</CardTitle>
                    {isLive ? <Badge variant="destructive" className="animate-pulse text-xs">EN VIVO</Badge> : <Badge variant="secondary">Programado</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Parejas con avatars */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="flex -space-x-2">
                        {aNames.slice(0,2).map((n, i) => (
                          <Avatar key={i} className="h-9 w-9 border-2 border-background"><AvatarFallback className="text-xs">{initials(n)}</AvatarFallback></Avatar>
                        ))}
                      </div>
                      <div className="min-w-0">
                        <p className={`truncate text-sm ${m.winner === "a" ? "font-bold text-emerald-600" : "font-medium"}`}>{m.side_a.pair_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{aNames.join(" · ")}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-muted-foreground">VS</span>
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                      <div className="min-w-0 text-right">
                        <p className={`truncate text-sm ${m.winner === "b" ? "font-bold text-emerald-600" : "font-medium"}`}>{m.side_b.pair_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{bNames.join(" · ")}</p>
                      </div>
                      <div className="flex -space-x-2">
                        {bNames.slice(0,2).map((n, i) => (
                          <Avatar key={i} className="h-9 w-9 border-2 border-background"><AvatarFallback className="text-xs">{initials(n)}</AvatarFallback></Avatar>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <span className="font-mono tabular-nums font-medium">{formatMatchScore(m.sets)}</span>
                    <span className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {m.scheduled_at ? formatMatchDateTime(m.scheduled_at) : "Sin hora"}</span>
                      {m.court_name && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {m.court_name}</span>}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </section>
  );
}