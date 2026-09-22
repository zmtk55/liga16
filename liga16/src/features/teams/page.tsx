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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Users, TrendingUp, Crown } from "lucide-react";

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

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
          Equipos registrados en la Liga16 Nacional — estadísticas y plantilla
        </p>
      </header>

      {teams === null ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((team) => {
            const winRate = team.record.played ? Math.round((team.record.won / team.record.played) * 100) : 0;
            const avgLevel = team.members.length
              ? (team.members.reduce((s, m) => s + m.level, 0) / team.members.length).toFixed(1)
              : "—";
            return (
              <Card key={team.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold">
                      {team.crest_url ? <img src={team.crest_url} alt="" className="h-12 w-12 rounded-xl object-cover" /> : initials(team.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg truncate">{team.name}</CardTitle>
                        <Badge variant={team.position === 1 ? "default" : "secondary"} className="shrink-0">
                          #{team.position}
                        </Badge>
                        {team.titles > 0 && (
                          <Badge variant="outline" className="gap-1">
                            <Crown className="h-3 w-3" /> {team.titles}
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="truncate">
                        {team.category} · {team.city} · Cap. {team.captain_name} · Nivel medio {avgLevel}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-muted p-2">
                      <p className="text-xs text-muted-foreground">PJ</p>
                      <p className="text-lg font-bold">{team.record.played}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-500/10 p-2">
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">Ganados</p>
                      <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{team.record.won}</p>
                    </div>
                    <div className="rounded-lg bg-muted p-2">
                      <p className="text-xs text-muted-foreground">Win rate</p>
                      <p className="text-lg font-bold">{winRate}%</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Efectividad</span>
                      <span>{winRate}%</span>
                    </div>
                    <Progress value={winRate} className="h-2" />
                  </div>
                  <div>
                    <p className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <Users className="h-3 w-3" /> Plantilla ({team.members.length})
                    </p>
                    <ul className="space-y-1.5">
                      {team.members.map((m) => (
                        <li key={m.player_id} className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-sm">
                          <span className="font-medium">{m.name}</span>
                          <Badge variant="secondary" className="text-xs">N {m.level.toFixed(1)}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {team.titles > 0 && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Trophy className="h-3 w-3" /> {team.titles} título{team.titles > 1 ? "s" : ""} conquistado{team.titles > 1 ? "s" : ""}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}