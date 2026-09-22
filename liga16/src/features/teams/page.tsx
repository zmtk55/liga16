import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { Team } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[] | null>(null);

  useEffect(() => {
    let active = true;
    db.listTeams().then((data) => {
      if (active) setTeams(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Equipos</h1>
        <p className="text-muted-foreground">
          Equipos registrados en la Liga16 Nacional
        </p>
      </header>

      {teams === null ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((team) => (
            <Card key={team.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{team.name}</CardTitle>
                  <Badge variant="secondary">#{team.position}</Badge>
                </div>
                <CardDescription>
                  {team.category} · {team.city} · Capitán: {team.captain_name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">
                    PJ <strong className="text-foreground">{team.record.played}</strong>
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    G <strong>{team.record.won}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    P <strong className="text-foreground">{team.record.lost}</strong>
                  </span>
                  {team.titles > 0 && (
                    <span className="text-muted-foreground">
                      🏆 <strong className="text-foreground">{team.titles}</strong>
                    </span>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Plantilla ({team.members.length})
                  </p>
                  <ul className="space-y-0.5 text-sm">
                    {team.members.map((m) => (
                      <li key={m.player_id} className="flex justify-between">
                        <span>{m.name}</span>
                        <span className="text-muted-foreground">
                          {m.level.toFixed(1)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}