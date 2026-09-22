import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { TrendingDown, TrendingUp } from "lucide-react";
import { db } from "@/lib/data";
import type { RankingEntry } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function RankingsPage() {
  const [rankings, setRankings] = useState<RankingEntry[] | null>(null);
  const [sex, setSex] = useState("all");
  const [city, setCity] = useState("all");

  useEffect(() => {
    let active = true;
    db.listRankings().then((data) => {
      if (active) setRankings(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const cities = useMemo(() => {
    if (!rankings) return [] as string[];
    return Array.from(new Set(rankings.map((r) => r.city))).sort();
  }, [rankings]);

  const filtered = useMemo(() => {
    if (!rankings) return [] as RankingEntry[];
    return rankings
      .filter(
        (r) =>
          (sex === "all" || r.sex === sex) &&
          (city === "all" || r.city === city),
      )
      .map((r, i) => ({ ...r, position: i + 1 }));
  }, [rankings, sex, city]);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Ranking</h1>
        <p className="text-muted-foreground">
          Clasificación oficial del circuito Liga16
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Select value={sex} onValueChange={setSex}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Rama" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="M">Masculino</SelectItem>
            <SelectItem value="F">Femenino</SelectItem>
          </SelectContent>
        </Select>

        <Select value={city} onValueChange={setCity}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Ciudad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las ciudades</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rankings === null ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Jugador</TableHead>
                  <TableHead className="hidden sm:table-cell">Ciudad</TableHead>
                  <TableHead className="text-right">Nivel</TableHead>
                  <TableHead className="hidden text-right md:table-cell">PJ</TableHead>
                  <TableHead className="hidden text-right md:table-cell">PG</TableHead>
                  <TableHead className="text-right">Puntos</TableHead>
                  <TableHead className="w-20 text-right">Cambio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.player_id}>
                    <TableCell className="font-medium">{r.position}</TableCell>
                    <TableCell>
                      <Link
                        to={`/jugadores/${r.player_id}`}
                        className="font-medium hover:underline"
                      >
                        {r.player_name}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {r.city}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{r.level.toFixed(1)}</Badge>
                    </TableCell>
                    <TableCell className="hidden text-right md:table-cell">
                      {r.played}
                    </TableCell>
                    <TableCell className="hidden text-right md:table-cell">
                      {r.won}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {r.points.toLocaleString("es-MX")}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.delta === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : r.delta > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                          <TrendingUp className="h-3.5 w-3.5" />+{r.delta}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-red-500">
                          <TrendingDown className="h-3.5 w-3.5" />
                          {r.delta}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </section>
  );
}