import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { db } from "@/lib/data";
import type { Team } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Trophy, TrendingUp, Users } from "lucide-react";
import { initials, sexLabel, winRate } from "@/lib/format";

export default function TeamDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [team, setTeam] = useState<Team | null | undefined>(undefined);

  useEffect(() => {
    if (!slug) return;
    db.listTeams().then((list) => {
      const t = list.find((x) => x.slug === slug) ?? null;
      setTeam(t);
    });
  }, [slug]);

  if (team === undefined) return <div className="space-y-3"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!team) return <div className="space-y-4"><Button asChild variant="ghost" size="sm"><Link to="/equipos"><ArrowLeft className="h-4 w-4" /> Equipos</Link></Button><p className="text-muted-foreground">Equipo no encontrado.</p></div>;

  const winRatePct = winRate(team.played, team.won);

  return (
    <section className="space-y-6">
      <Button asChild variant="ghost" size="sm"><Link to="/equipos"><ArrowLeft className="h-4 w-4" /> Equipos</Link></Button>

      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-xl font-black">{initials(team.name)}</div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black tracking-tight">{team.name}</h1>
            <p className="text-sm text-muted-foreground">{team.city} · {team.division} {sexLabel(team.sex)} · #{team.position} · {team.points} pts</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge>#{team.position}</Badge>
              <Badge variant="secondary">{team.division}</Badge>
              {team.titles > 0 && <Badge variant="outline"><Trophy className="mr-1 h-3 w-3" /> {team.titles} títulos</Badge>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">PJ / PG / PP</CardTitle></CardHeader><CardContent><p className="text-2xl font-black">{team.played} / <span className="text-emerald-600">{team.won}</span> / {team.lost}</p><Progress value={winRatePct} className="mt-2 h-2" /><p className="mt-1 text-xs text-muted-foreground">{winRatePct}% efectividad · {team.sets_for}-{team.sets_against} sets</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Pareja</CardTitle></CardHeader><CardContent className="space-y-2">
          {[team.player1, team.player2].map((p, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border p-2">
              <Avatar className="h-9 w-9"><AvatarFallback>{p ? initials(p.name) : "?"}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{p?.name ?? "Pendiente"}</p><p className="text-xs text-muted-foreground">Nivel {p?.level.toFixed(1) ?? "—"}</p></div>
              {p && <Link to={`/jugadores/${p.player_id}`} className="text-xs text-primary hover:underline">Ver perfil</Link>}
            </div>
          ))}
        </CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Posición</CardTitle></CardHeader><CardContent><p className="text-3xl font-black">#{team.position}</p><p className="text-sm text-muted-foreground">{team.points} puntos · {team.division}</p></CardContent></Card>
      </div>
    </section>
  );
}