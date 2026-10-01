"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ClipboardList,
  Minus,
} from "lucide-react";
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
import {
  AdminPageHeader,
  AdminStat,
  AdminStatStrip,
} from "@/components/admin/page-header";
import {
  AdminTableEmpty,
  AdminTableSkeleton,
} from "@/components/admin/table-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { GroupFilterBar } from "@/components/shadcn-space/blocks/navbar-01/group-filter-bar";
import { divisionOptions, sexLabel, sexOptions, winRate } from "@/lib/format";
import { groupByDivision } from "@/lib/categories";

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
    const q = query.trim().toLowerCase();
    return [...(teams ?? [])]
      .filter(
        (t) =>
          (division === "all" || t.division === division) &&
          (sex === "all" || t.sex === sex),
      )
      .filter((t) => !q || t.name.toLowerCase().includes(q))
      .sort((a, b) => a.position - b.position || b.points - a.points);
  }, [teams, query, division, sex]);

  /**
   * Cifras de cabecera. La posición de una pareja solo significa algo dentro de
   * su división, así que "en el corte" se cuenta por grupo y no sobre la lista
   * completa mezclada.
   */
  const resumen = useMemo(() => {
    const conPartidos = (teams ?? []).filter((t) => t.played > 0);
    const grupos = groupByDivision(
      conPartidos.length > 0 ? conPartidos : (teams ?? []),
    );
    return {
      parejas: (teams ?? []).length,
      conPartidos: conPartidos.length,
      divisiones: grupos.length,
      cortes: grupos.filter((g) => g.teams.some((t) => t.position === 1))
        .length,
    };
  }, [teams]);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Ranking de parejas"
        description="Se calcula con los resultados que capturas. Cambia un resultado y esta tabla se mueve sola."
      >
        <AdminStatStrip>
          <AdminStat value={resumen.parejas} label="Parejas" />
          <AdminStat value={resumen.conPartidos} label="Con partidos" />
          <AdminStat value={resumen.divisiones} label="Divisiones" />
          <AdminStat
            value={resumen.cortes}
            label="Con líder"
            tone="text-primary"
          />
        </AdminStatStrip>
      </AdminPageHeader>

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
          <GroupFilterBar
            divisions={divisionOptions.filter((d) => d.value !== "all")}
            value={division}
            onChange={setDivision}
            clearValue="all"
          />
          <FilterBar
            search={query}
            onSearch={setQuery}
            searchPlaceholder="Buscar pareja…"
            selects={[
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
                <TableHead className="text-right">Ganadas – Perdidas</TableHead>
                <TableHead className="text-right">División / Rama</TableHead>
                <TableHead>Forma</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams === null && <AdminTableSkeleton columns={6} />}
              {teams !== null && filtered.length === 0 && (
                <AdminTableEmpty
                  colSpan={6}
                  icon={<BarChart3 className="h-5 w-5" />}
                  title="No hay parejas en este filtro"
                  description="Las parejas se inscriben desde Equipos y sus resultados se capturan en Resultados."
                />
              )}
              {filtered.map((t) => (
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
                    <div className="text-xs text-muted-foreground">
                      {t.city}
                    </div>
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
                    {t.won > t.lost ? (
                      <ArrowUpRight
                        className="h-4 w-4 text-success"
                        aria-label="En racha"
                      />
                    ) : t.won < t.lost ? (
                      <ArrowDownRight
                        className="h-4 w-4 text-destructive"
                        aria-label="En baja"
                      />
                    ) : (
                      <Minus
                        className="h-4 w-4 text-muted-foreground"
                        aria-label="Estable"
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
