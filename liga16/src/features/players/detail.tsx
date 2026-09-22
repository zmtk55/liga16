import { useEffect, useState, Suspense, lazy } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, CalendarDays, Trophy } from "lucide-react";
import { db } from "@/lib/data";
import type { PlayerCard, PlayerProfile, RankingEvent } from "@/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/shared/stat-card";
import { formatDate } from "@/lib/format";

const LevelTrendChart = lazy(() => import("./level-trend-chart").then((m) => ({ default: m.LevelTrendChart })));

const handLabel: Record<PlayerProfile["dominant_hand"], string> = {
  right: "Diestro",
  left: "Zurdo",
  both: "Ambidiestro",
};

const positionLabel: Record<PlayerProfile["preferred_position"], string> = {
  drive: "Drive",
  reves: "Revés",
  both: "Ambos",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [card, setCard] = useState<PlayerCard | null>(null);
  const [events, setEvents] = useState<RankingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([db.getPlayer(id), db.getPlayerCard(id), db.getPlayerRankingEvents(id)])
      .then(([p, c, e]) => {
        if (!active) return;
        setPlayer(p);
        setCard(c);
        setEvents(e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <section className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </section>
    );
  }

  if (!player) {
    return (
      <section className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/jugadores">
            <ArrowLeft className="h-4 w-4" /> Jugadores
          </Link>
        </Button>
        <p className="text-muted-foreground">Jugador no encontrado.</p>
      </section>
    );
  }

  const trendData = card?.trend.map((v, i) => ({ i, v })) ?? [];

  return (
    <section className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/jugadores">
          <ArrowLeft className="h-4 w-4" /> Jugadores
        </Link>
      </Button>

      <header className="flex flex-wrap items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="text-lg">
            {initials(player.display_name)}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">
              {player.display_name}
            </h1>
            <Badge variant="secondary">{player.sex}</Badge>
            {!player.is_public && <Badge variant="outline">Perfil privado</Badge>}
          </div>
          <p className="text-muted-foreground">
            @{player.username} · {player.city}, {player.state}
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Nivel"
          value={(player.official_level ?? player.declared_level).toFixed(1)}
          trend={
            player.official_level != null
              ? `Oficial (declarado ${player.declared_level.toFixed(1)})`
              : "Declarado"
          }
        />
        <StatCard title="Títulos" value={String(card?.titles ?? 0)} icon={<Trophy className="h-4 w-4 text-muted-foreground" />} />
        <StatCard
          title="Récord"
          value={`${card?.record.won ?? 0}G / ${card?.record.played ?? 0}PJ`}
        />
        <StatCard
          title="Pareja frecuente"
          value={card?.frequent_partner ?? "—"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Detalles</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              Mano dominante:{" "}
              <Badge variant="outline">{handLabel[player.dominant_hand]}</Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              Posición:{" "}
              <Badge variant="outline">{positionLabel[player.preferred_position]}</Badge>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              País: {player.country}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              Usuario: @{player.username}
            </div>
            {player.bio && (
              <p className="col-span-full text-muted-foreground">{player.bio}</p>
            )}
            {card && card.recent_results.length > 0 && (
              <div className="col-span-full">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Últimos resultados
                </p>
                <div className="flex flex-wrap gap-2">
                  {card.recent_results.map((r, i) => (
                    <Badge key={i} variant={r.startsWith("G") ? "default" : "outline"}>
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {trendData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tendencia de nivel</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<Skeleton className="h-56 w-full" />}>
                <LevelTrendChart data={trendData} />
              </Suspense>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Eventos de ranking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {events.length === 0 ? (
            <p className="text-muted-foreground">
              Sin eventos de ranking registrados.
            </p>
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
              >
                <div className="space-y-0.5">
                  <p className="font-medium">{ev.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(ev.created_at)}
                  </p>
                </div>
                <Badge variant="secondary">+{ev.points} pts</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}