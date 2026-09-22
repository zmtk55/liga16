import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { db } from "@/lib/data";
import type { PlayerProfile, RankingEntry, PlayerCard } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/cards/card-image";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Trophy, TrendingUp } from "lucide-react";

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

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerProfile[] | null>(null);
  const [rankings, setRankings] = useState<RankingEntry[] | null>(null);
  const [cards, setCards] = useState<Record<string, PlayerCard> | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([db.listPlayers(), db.listRankings()]).then(async ([list, rks]) => {
      if (!active) return;
      setPlayers(list);
      setRankings(rks);
      const byId: Record<string, PlayerCard> = {};
      await Promise.all(list.map(async (p) => {
        const c = await db.getPlayerCard(p.id);
        if (c) byId[p.id] = c;
      }));
      if (active) setCards(byId);
    });
    return () => { active = false; };
  }, []);

  const rankById = useMemo(() => {
    if (!rankings) return new Map<string, RankingEntry>();
    return new Map(rankings.map((r) => [r.player_id, r]));
  }, [rankings]);

  const filtered = useMemo(() => {
    if (!players) return [];
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => p.display_name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q));
  }, [players, query]);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Jugadores</h1>
        <p className="text-muted-foreground">Directorio de jugadores del padel Reforma</p>
      </header>

      <Input placeholder="Buscar por nombre…" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-sm" />

      {players === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">No se encontraron jugadores.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const rk = rankById.get(p.id);
            const card = cards?.[p.id];
            const winPct = card && card.record.played ? Math.round((card.record.won / card.record.played) * 100) : 0;
            return (
              <Link key={p.id} to={`/jugadores/${p.id}`} className="group">
                <Card className="h-full transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
                    <PlayerAvatar
                      name={p.display_name}
                      photoUrl={p.photo_url}
                      className="h-12 w-12"
                    />
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-base leading-tight">{p.display_name}</CardTitle>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        {p.sex}
                      </p>
                    </div>
                    {rk && (
                      <Badge variant={rk.position <= 3 ? "default" : "secondary"} className="shrink-0">#{rk.position}</Badge>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-muted p-2">
                        <p className="text-[11px] text-muted-foreground">Nivel</p>
                        <p className="font-bold">{(p.official_level ?? p.declared_level).toFixed(1)}</p>
                      </div>
                      <div className="rounded-lg bg-primary/10 p-2">
                        <p className="text-[11px] text-muted-foreground">Puntos</p>
                        <p className="font-bold">{rk ? rk.points.toLocaleString("es-MX") : "—"}</p>
                      </div>
                      <div className="rounded-lg bg-amber-500/10 p-2">
                        <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-0.5"><Trophy className="h-3 w-3" /> Títulos</p>
                        <p className="font-bold">{card?.titles ?? 0}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {card ? `${card.record.won}/${card.record.played} ganados` : "Sin datos"}</span>
                        <span>{winPct}%</span>
                      </div>
                      <Progress value={winPct} className="h-1.5" />
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="text-xs">{handLabel[p.dominant_hand]}</Badge>
                      <Badge variant="outline" className="text-xs">{positionLabel[p.preferred_position]}</Badge>
                      {card?.frequent_partner && <Badge variant="secondary" className="text-xs">con {card.frequent_partner.split(" ")[0]}</Badge>}
                    </div>
                    {rk && <p className="text-xs text-muted-foreground">{rk.played} PJ · {rk.won} PG · Δ {rk.delta > 0 ? `+${rk.delta}` : rk.delta}</p>}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}