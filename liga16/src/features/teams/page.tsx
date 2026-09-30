import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { db } from "@/lib/data";
import type { Team } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CardShell, CardIdentity, CardFooterStrip, CardStat } from "@/components/cards/card-kit";
import { PageHero } from "@/components/page-hero";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { divisionOptions, sexLabel, sexOptions, winRate } from "@/lib/format";
import { ArrowRight, Search } from "lucide-react";

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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((team) => {
            const wr = winRate(team.played, team.won);
            return (
              <Link
                key={team.slug}
                to={`/equipos/${team.slug}`}
                className="group block focus:outline-none"
              >
                <CardShell accent className="h-full">
                  <CardContent className="p-4">
                    <CardIdentity
                      titleLines={[
                        team.player1?.name ?? team.name.split(" / ")[0],
                        team.player2?.name ?? team.name.split(" / ")[1] ?? "",
                      ].filter(Boolean)}
                      meta={[team.division, sexLabel(team.sex)].filter(Boolean).join(" · ")}
                      end={
                        team.position > 0 ? (
                          <span className="text-stat tabular-nums text-muted-foreground/40 transition-colors group-hover:text-primary">
                            #{team.position}
                          </span>
                        ) : undefined
                      }
                    />
                  </CardContent>
                  <CardFooterStrip
                    stats={
                      <>
                        <CardStat value={team.played} label="PJ" />
                        <CardStat value={`${team.won}–${team.lost}`} label="Récord" />
                        <CardStat
                          value={team.played > 0 ? `${wr}%` : "—"}
                          label="Efect."
                          tone={team.played > 0 && wr >= 60 ? "text-emerald-600 dark:text-emerald-400" : undefined}
                        />
                      </>
                    }
                    chip={team.played === 0 ? <Badge variant="outline">Nuevo</Badge> : undefined}
                  />
                </CardShell>
              </Link>
            );
          })}
        </div>
      )}

      {/* CTA final estilo landing */}
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-muted/30 px-6 py-8 text-center">
        <p className="font-headline text-xl uppercase tracking-tight md:text-2xl">
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
