"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { BarChart3, ClipboardList, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { db } from "@/lib/data";
import type { Team } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminTableEmpty, AdminTableSkeleton } from "@/components/admin/table-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { analyzePairLocal } from "@/lib/jev";
import { divisionOptions, sexLabel, sexOptions, winRate } from "@/lib/format";

/**
 * Ranking de PAREJAS, derivado.
 *
 * No se edita aquí a propósito: la fuente de verdad son los resultados que
 * captura el admin en Resultados. Editar puntos a mano haría que el ranking
 * dejara de coincidir con los partidos y perdería la trazabilidad.
 */
export default function AdminRanking() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState("all");
  const [sex, setSex] = useState("all");

  useEffect(() => {
    let active = true;
    db.listTeams().then((t) => {
      if (active) setTeams(t);
    });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const order = ["1ra", "2da", "3ra", "4ta", "5ta", "6ta", "Novatos"];
    const q = query.trim().toLowerCase();
    return [...(teams ?? [])]
      .filter((t) => (division === "all" || t.division === division) && (sex === "all" || t.sex === sex))
      .filter((t) => !q || t.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const da = order.indexOf(a.division);
        const dbOrder = order.indexOf(b.division);
        if (da !== dbOrder) return da - dbOrder;
        return a.position - b.position || b.points - a.points;
      });
  }, [teams, query, division, sex]);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Ranking de parejas"
        description="Se calcula con los resultados que capturas. Cambia un resultado y esta tabla se mueve sola."
        action={
          <Badge variant="outline" className="h-8 gap-1.5 px-3">
            <BarChart3 className="h-3.5 w-3.5" /> Derivado
          </Badge>
        }
      />

      <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Para mover el ranking, captura o corrige un partido.
        </p>
        <Link
          to="/admin/resultados"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          <ClipboardList className="h-4 w-4" /> Ir a Resultados
        </Link>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <FilterBar
            search={query}
            onSearch={setQuery}
            searchPlaceholder="Buscar pareja…"
            selects={[
              {
                key: "division",
                ariaLabel: "Filtrar por división",
                allLabel: "Todas las divisiones",
                value: division,
                onChange: setDivision,
                options: divisionOptions.filter((d) => d.value !== "all"),
                className: "sm:w-48",
              },
              {
                key: "sex",
                ariaLabel: "Filtrar por rama",
                allLabel: "Todas las ramas",
                value: sex,
                onChange: setSex,
                options: sexOptions.filter((s) => s.value !== "all"),
                className: "sm:w-40",
              },
            ]}
            resultCount={filtered.length}
            resultLabel="parejas"
            onClear={() => {
              setQuery("");
              setDivision("all");
              setSex("all");
            }}
          />
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">#</TableHead>
                <TableHead>Pareja</TableHead>
                <TableHead className="text-right">Puntos</TableHead>
                <TableHead className="text-right">Record</TableHead>
                <TableHead className="text-right">División / Rama</TableHead>
                <TableHead>Desempeño</TableHead>
                <TableHead>Forma</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams === null && <AdminTableSkeleton columns={7} />}
              {teams !== null && filtered.length === 0 && (
                <AdminTableEmpty
                  colSpan={7}
                  icon={<BarChart3 className="h-5 w-5" />}
                  title="No hay parejas en este filtro"
                  description="Las parejas se inscriben desde Equipos y sus resultados se capturan en Resultados."
                />
              )}
              {filtered.map((t) => {
                const perf = analyzePairLocal({ played: t.played, won: t.won });
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-headline text-lg text-muted-foreground">
                      {t.position > 0 ? t.position : "—"}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/equipos/${t.slug}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {t.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{t.city}</div>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {t.points.toLocaleString("es-MX")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.won}–{Math.max(t.lost, 0)}
                      <div className="text-xs text-muted-foreground">
                        {winRate(t.played, t.won)}% de efectividad
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{t.division}</Badge>
                      <Badge variant="secondary" className="ml-1">
                        {sexLabel(t.sex)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{perf.formaLabel}</span>
                      <div className="text-xs text-muted-foreground capitalize">
                        {perf.racha.label}
                        {perf.racha.won + perf.racha.lost > 0 &&
                          ` · ${perf.racha.won}G ${perf.racha.lost}P`}
                      </div>
                    </TableCell>
                    <TableCell>
                      {t.won > t.lost ? (
                        <TrendingUp className="h-4 w-4 text-success" aria-label="En racha" />
                      ) : t.won < t.lost ? (
                        <TrendingDown className="h-4 w-4 text-destructive" aria-label="En baja" />
                      ) : (
                        <Minus className="h-4 w-4 text-muted-foreground" aria-label="Estable" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
