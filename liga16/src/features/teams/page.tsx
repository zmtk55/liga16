import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { db } from "@/lib/data";
import type { Team } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronRight, Search } from "lucide-react";
import { initials, sexLabel } from "@/lib/format";

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [q, setQ] = useState("");
  const [division, setDivision] = useState("all");
  const [city, setCity] = useState("all");

  useEffect(() => {
    let active = true;
    db.listTeams().then((data) => { if (active) setTeams(data); });
    return () => { active = false; };
  }, []);

  const cities = useMemo(() => {
    if (!teams) return [];
    return Array.from(new Set(teams.map((t) => t.city))).sort();
  }, [teams]);

  const filtered = useMemo(() => {
    if (!teams) return [];
    return teams.filter((t) => {
      if (division !== "all" && t.division !== division) return false;
      if (city !== "all" && t.city !== city) return false;
      if (q.trim() && !t.name.toLowerCase().includes(q.toLowerCase()) && !`${t.player1?.name ?? ""} ${t.player2?.name ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [teams, q, division, city]);

  return (
    <section className="animate-fade-in space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Equipos</h1>
        <p className="text-muted-foreground">Parejas del circuito por división y ciudad</p>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar pareja o jugador…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Select value={division} onValueChange={setDivision}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="División" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="1ra">1ra</SelectItem>
              <SelectItem value="2da">2da</SelectItem>
              <SelectItem value="3ra">3ra</SelectItem>
              <SelectItem value="4ta">4ta</SelectItem>
              <SelectItem value="5ta">5ta</SelectItem>
              <SelectItem value="6ta">6ta</SelectItem>
              <SelectItem value="Novatos">Novatos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Ciudad" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas ciudades</SelectItem>
              {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {teams === null ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Ningún equipo coincide con la búsqueda. Prueba con otra división o ciudad.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {filtered.map((team) => {
              const winRate = team.played ? Math.round((team.won / team.played) * 100) : 0;
              return (
                <Link key={team.id} to={`/equipos/${team.slug}`} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex -space-x-2">
                    <Avatar className="h-9 w-9 border-2 border-background"><AvatarFallback className="text-xs">{team.player1 ? initials(team.player1.name) : "?"}</AvatarFallback></Avatar>
                    <Avatar className="h-9 w-9 border-2 border-background"><AvatarFallback className="text-xs">{team.player2 ? initials(team.player2.name) : "?"}</AvatarFallback></Avatar>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{team.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{team.city} · {team.division} {sexLabel(team.sex)} · {team.player1?.name ?? "?"} / {team.player2?.name ?? "?"}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-3 text-xs">
                    <span className="tabular-nums"><span className="font-bold">#{team.position}</span> · {team.points} pts</span>
                    <Badge variant={winRate >= 60 ? "default" : winRate >= 40 ? "secondary" : "outline"}>{winRate}%</Badge>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}
    </section>
  );
}