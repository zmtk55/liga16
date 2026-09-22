import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { Team } from "@/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, TrendingUp, Crown } from "lucide-react";
import { TeamCrest } from "@/components/cards/card-image";

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function divisionLabel(division: string, sex: string) {
  const sexLabel = sex === "M" ? "M" : sex === "F" ? "F" : "M/X";
  return `${division} ${sexLabel}`;
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
          Parejas del circuito Liga16 por categoría (1ra a 6ta y Novatos)
        </p>
      </header>

      {teams === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => {
            const winRate = team.played ? Math.round((team.won / team.played) * 100) : 0;
            const setDiff = team.sets_for - team.sets_against;
            return (
              <Card key={team.id} className="overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg animate-slide-up">
                <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-primary/20 via-primary/5 to-background">
                  <TeamCrest
                    name={team.name}
                    crestUrl={team.crest_url}
                    className="absolute inset-0 h-full w-full"
                  />
                  {team.position === 1 && (
                    <div className="absolute top-2 right-2 animate-float">
                      <Badge variant="default" className="shadow-sm">
                        <Crown className="h-3 w-3 mr-1" /> Líder
                      </Badge>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2">
                    <Badge variant="secondary" className="text-xs">
                      {divisionLabel(team.division, team.sex)}
                    </Badge>
                  </div>
                </div>
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold">
                      {team.crest_url ? (
                        <img src={team.crest_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
                      ) : (
                        initials(team.name)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg truncate">{team.name}</CardTitle>
                        <Badge variant={team.position === 1 ? "default" : "secondary"} className="shrink-0">
                          #{team.position}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {team.division} · {team.points} pts
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Pareja: 2 jugadores */}
                  <div className="rounded-lg border p-2 space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Pareja</p>
                    {team.player1 ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{team.player1.name}</span>
                        <Badge variant="secondary" className="text-xs shrink-0">N {team.player1.level.toFixed(1)}</Badge>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Jugador 1 pendiente</p>
                    )}
                    {team.player2 ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{team.player2.name}</span>
                        <Badge variant="secondary" className="text-xs shrink-0">N {team.player2.level.toFixed(1)}</Badge>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Jugador 2 pendiente</p>
                    )}
                  </div>

                  {/* Estadísticas */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-muted p-2">
                      <p className="text-xs text-muted-foreground">PJ</p>
                      <p className="text-lg font-bold">{team.played}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-500/10 p-2">
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">Ganados</p>
                      <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{team.won}</p>
                    </div>
                    <div className="rounded-lg bg-blue-500/10 p-2">
                      <p className="text-xs text-blue-700 dark:text-blue-400">Efectividad</p>
                      <p className="text-lg font-bold">{winRate}%</p>
                    </div>
                  </div>

                  {/* Sets */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Sets</span>
                    <span className="tabular-nums">
                      {team.sets_for} <span className="text-muted-foreground">/</span> {team.sets_against}
                      {" · "}
                      <span className={setDiff > 0 ? "text-emerald-600" : setDiff < 0 ? "text-red-500" : "text-muted-foreground"}>
                        {setDiff > 0 ? "+" : ""}{setDiff}
                      </span>
                    </span>
                  </div>

                  {/* Posición */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Posición</span>
                      <span>#{team.position} · {team.points} pts</span>
                    </div>
                    <Progress value={team.position <= 2 ? 100 : Math.max(10, 100 - team.position * 10)} className="h-2" />
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
