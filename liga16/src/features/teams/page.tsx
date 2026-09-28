import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { db } from "@/lib/data";
import type { Team } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHero } from "@/components/page-hero";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { divisionOptions, sexOptions, winRate } from "@/lib/format";
import { ArrowRight, Search, Users2 } from "lucide-react";

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [q, setQ] = useState("");
  const [division, setDivision] = useState("all");
  const [sex, setSex] = useState("all");

  useEffect(() => {
    let active = true;
    db.listTeams().then((data) => { if (active) setTeams(data); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    if (!teams) return [];
    const query = q.trim().toLowerCase();
    return teams.filter((t) => {
      if (division !== "all" && t.division !== division) return false;
      if (sex !== "all" && t.sex !== sex) return false;
      if (
        query &&
        !t.name.toLowerCase().includes(query) &&
        !`${t.player1?.name ?? ""} ${t.player2?.name ?? ""}`.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [teams, q, division, sex]);

  const stats = useMemo(
    () => [
      { k: "Parejas", v: teams?.length ?? "…" },
      { k: "Divisiones", v: teams ? new Set(teams.map((t) => t.division)).size : "…" },
      { k: "Partidos", v: teams?.reduce((s, t) => s + t.played, 0) ?? "…" },
    ],
    [teams],
  );

  return (
    <div className="animate-fade-in space-y-8">
      <PageHero
        eyebrow="El circuito"
        title="Equipos"
        subtitle="Las parejas de Liga16, división por división. Récord y puntos calculados de los partidos reales del circuito."
        stats={stats}
      />

      {/* Filtros: búsqueda + división + rama, sobre el hero */}
      <div className="relative z-10 -mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar pareja o jugador…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={division} onValueChange={setDivision}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="División" />
            </SelectTrigger>
            <SelectContent>
              {divisionOptions.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sex} onValueChange={setSex}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Rama" />
            </SelectTrigger>
            <SelectContent>
              {sexOptions.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {teams === null ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Ningún equipo coincide con la búsqueda. Prueba con otra división o rama.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((team) => {
            const wr = winRate(team.played, team.won);
            return (
              <Link
                key={team.slug}
                to={`/equipos/${team.slug}`}
                className="group block focus:outline-none"
              >
                <Card className="h-full overflow-hidden border-border/60 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-lg">
                  {/* Franja de división estilo póster */}
                  <div aria-hidden className="h-1 bg-primary" />
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex -space-x-2.5">
                        <Avatar className="h-11 w-11 border-2 border-background">
                          <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                            {team.player1 ? team.player1.name.slice(0, 2).toUpperCase() : "?"}
                          </AvatarFallback>
                        </Avatar>
                        <Avatar className="h-11 w-11 border-2 border-background">
                          <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                            {team.player2 ? team.player2.name.slice(0, 2).toUpperCase() : "?"}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-bold tracking-tight">{team.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {team.city || "Ciudad de México"} · {team.division} · {team.player1?.name ?? "?"} / {team.player2?.name ?? "?"}
                        </p>
                      </div>
                      {team.position > 0 && (
                        <span className="shrink-0 font-display text-2xl tabular-nums text-muted-foreground/40 transition-colors group-hover:text-primary">
                          #{team.position}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users2 className="h-3.5 w-3.5" />
                        {team.played > 0 ? `${team.won}–${team.lost} en ${team.played} partido${team.played === 1 ? "" : "s"}` : "Sin partidos jugados"}
                      </span>
                      {team.played > 0 ? (
                        <Badge variant={wr >= 60 ? "default" : wr >= 40 ? "secondary" : "outline"}>
                          {wr}%
                        </Badge>
                      ) : (
                        <Badge variant="outline">Nuevo</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* CTA final estilo landing */}
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-muted/30 px-6 py-8 text-center">
        <p className="font-display text-xl uppercase tracking-tight md:text-2xl">
          ¿Tu pareja aún no está en el muro?
        </p>
        <p className="max-w-md text-sm text-muted-foreground">
          Inscríbanse al próximo torneo y aparezcan aquí con su récord oficial.
        </p>
        <Button asChild size="lg" className="mt-1 font-bold uppercase tracking-wide">
          <Link to="/torneos">
            Ver torneos abiertos <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
