import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/data";
import type { Team } from "@/types";
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
import { divisionOptions, sexLabel, sexOptions, winRate } from "@/lib/format";
import { Users } from "lucide-react";

export default function RankingsPage() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [division, setDivision] = useState("all");
  const [sex, setSex] = useState("all");

  useEffect(() => {
    let active = true;
    db.listTeams().then((data) => {
      if (active) setTeams(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!teams) return [] as Team[];
    let list = [...teams];
    if (division !== "all") list = list.filter((t) => t.division === division);
    if (sex !== "all") list = list.filter((t) => t.sex === sex);
    return list
      .sort((a, b) => {
        // Primero por división, luego por posición, luego por puntos
        const divOrder = ["1ra", "2da", "3ra", "4ta", "5ta", "6ta", "Novatos"];
        const da = divOrder.indexOf(a.division);
        const db_ = divOrder.indexOf(b.division);
        if (da !== db_) return da - db_;
        if (a.position !== b.position) return a.position - b.position;
        return b.points - a.points;
      })
      .map((t) => ({ ...t }));
  }, [teams, division, sex]);

  return (
    <section className="animate-fade-in space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Ranking</h1>
        <p className="text-muted-foreground">
          Clasificación oficial de parejas por división y rama
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Select value={division} onValueChange={setDivision}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="División" />
          </SelectTrigger>
          <SelectContent>
            {divisionOptions.map((d) => (
              <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sex} onValueChange={setSex}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Rama" />
          </SelectTrigger>
          <SelectContent>
            {sexOptions.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {teams === null ? (
        <Skeleton className="h-96 w-full" />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay equipos en esta división y rama todavía.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Equipo / Pareja</TableHead>
                  <TableHead>Jugadores</TableHead>
                  <TableHead className="text-right">División</TableHead>
                  <TableHead className="hidden text-right md:table-cell">PJ</TableHead>
                  <TableHead className="hidden text-right md:table-cell">PG</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Efect.</TableHead>
                  <TableHead className="text-right">Puntos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      {t.position > 0 ? t.position : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.city}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>
                          {t.player1?.name ?? "—"} / {t.player2?.name ?? "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{t.division}</Badge>
                      <Badge variant="secondary" className="ml-1">
                        {sexLabel(t.sex)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-right md:table-cell">
                      {t.played}
                    </TableCell>
                    <TableCell className="hidden text-right md:table-cell">
                      {t.won}
                    </TableCell>
                    <TableCell className="hidden text-right md:table-cell">
                      {winRate(t.played, t.won)}%
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {t.points.toLocaleString("es-MX")}
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
