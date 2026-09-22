import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { db } from "@/lib/data";
import type { PlayerProfile } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    db.listPlayers().then((data) => {
      if (active) setPlayers(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!players) return [];
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      (p) =>
        p.display_name.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q),
    );
  }, [players, query]);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Jugadores</h1>
        <p className="text-muted-foreground">
          Directorio de jugadores del circuito Liga16
        </p>
      </header>

      <Input
        placeholder="Buscar por nombre o ciudad…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />

      {players === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">No se encontraron jugadores.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Link key={p.id} to={`/jugadores/${p.id}`} className="transition-opacity hover:opacity-90">
              <Card className="h-full">
                <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                  <Avatar>
                    <AvatarFallback>{initials(p.display_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">
                      {p.display_name}
                    </CardTitle>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.city}, {p.state}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">
                    Nivel {(p.official_level ?? p.declared_level).toFixed(1)}
                  </Badge>
                  <Badge variant="outline">{handLabel[p.dominant_hand]}</Badge>
                  <Badge variant="outline">
                    {positionLabel[p.preferred_position]}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}