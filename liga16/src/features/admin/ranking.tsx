"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { BarChart3, ClipboardList } from "lucide-react";
import { db } from "@/lib/data";
import type { Team } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FilterBar } from "@/components/ui/filter-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { PairAvatars } from "@/components/cards/card-kit";
import { AdminPageHeader, AdminStat, AdminStatStrip } from "@/components/admin/page-header";
import { divisionOptions, sexOptions, winRate } from "@/lib/format";
import { groupByDivision } from "@/lib/categories";

/**
 * Ranking de PAREJAS, derivado.
 *
 * No se edita aquí a propósito: la fuente de verdad son los resultados que
 * captura el admin en Resultados. Editar puntos a mano haría que el ranking
 * dejara de coincidir con los partidos y perdería la trazabilidad.
 *
 * Es una TABLA y no un grid de cards porque el dato que ordena —el % de puntos—
 * sólo se compara si las columnas están alineadas: en cards había que leer
 * una por una y no se veía quién estaba arriba. Se agrupa por división + rama
 * porque la posición sólo significa algo dentro de su grupo.
 */
export default function AdminRanking() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  // El buscador vive en el FilterBar de la página y escribe ?q= (estándar admin).
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const setQuery = (v: string) => {
    const next = new URLSearchParams(params);
    if (!v) next.delete("q");
    else next.set("q", v);
    setParams(next, { replace: true });
  };
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
    return (teams ?? []).filter(
      (t) =>
        (division === "all" || t.division === division) &&
        (sex === "all" || t.sex === sex) &&
        (!q ||
          t.name.toLowerCase().includes(q) ||
          [t.player1?.name, t.player2?.name]
            .filter(Boolean)
            .some((n) => (n as string).toLowerCase().includes(q))),
    );
  }, [teams, query, division, sex]);

  // Un grupo por división + rama, cada uno con su posición ya resuelta.
  const groups = useMemo(() => groupByDivision(filtered), [filtered]);

  /**
   * Cifras de cabecera. La posición de una pareja solo significa algo dentro de
   * su división, así que "en el corte" se cuenta por grupo y no sobre la lista
   * completa mezclada.
   */
  const resumen = useMemo(() => {
    const all = teams ?? [];
    const conPartidos = all.filter((t) => t.played > 0);
    return {
      parejas: all.length,
      conPartidos: conPartidos.length,
      grupos: groupByDivision(conPartidos).length,
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
          <AdminStat value={resumen.grupos} label="Grupos" />
        </AdminStatStrip>
      </AdminPageHeader>

      <div className="flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Para mover el ranking, captura o corrige un partido.
        </p>
        <Link
          to="/admin/resultados"
          className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          <ClipboardList className="h-4 w-4" /> Ir a Resultados
        </Link>
      </div>

      <Card>
        {/* Los tres filtros (buscador, división, rama) en UNA fila: el FilterBar
            ya colapsa lo que sobra detrás de "Filtros" y los deja en chips
            removibles. Antes eran tres bloques apilados —pills de división, pills
            de rama y buscador— y para leer la tabla había que.scrollarse
            por encima de todo eso. */}
        <CardHeader>
          <FilterBar
            search={query}
            onSearch={setQuery}
            searchPlaceholder="Buscar pareja o jugador…"
            selects={[
              {
                key: "division",
                ariaLabel: "Filtrar por división",
                allLabel: "Todas las divisiones",
                value: division,
                onChange: setDivision,
                options: divisionOptions.filter((d) => d.value !== "all"),
              },
              {
                key: "sex",
                ariaLabel: "Filtrar por rama",
                allLabel: "Todas las ramas",
                value: sex,
                onChange: setSex,
                options: sexOptions.filter((s) => s.value !== "all"),
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
        <CardContent className="p-0">
          {teams === null && (
            <div className="space-y-2 p-4" aria-label="Cargando ranking">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          )}

          {teams !== null && filtered.length === 0 && (
            <Empty className="border-0 py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                </EmptyMedia>
                <EmptyTitle className="text-base">No hay parejas en este filtro</EmptyTitle>
                <EmptyDescription>
                  Las parejas se inscriben desde Equipos y sus resultados se capturan en Resultados.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {filtered.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Pareja</TableHead>
                  <TableHead className="text-center">PJ</TableHead>
                  <TableHead className="text-center">PG</TableHead>
                  <TableHead className="text-center">PP</TableHead>
                  <TableHead className="text-center">Sets</TableHead>
                  {/* La columna que ORDENA la tabla. El % de puntos es
                      puntos ganados / puntos jugados, no victorias: es lo que
                      hace que un 6-0 perdido pese igual que un 10-8 ganado. */}
                  <TableHead className="text-right">% puntos</TableHead>
                  <TableHead className="text-right">Efectividad</TableHead>
                </TableRow>
              </TableHeader>
              {groups.map((g) => (
                <TableBody key={g.label}>
                  {/* Encabezado de grupo dentro de la tabla: la posición de una
                      pareja no compite contra las de otra división. */}
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={8} className="py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.label}
                    </TableCell>
                  </TableRow>
                  {g.teams.map((t) => {
                    const pct = t.played > 0 ? winRate(t.played, t.won) : 0;
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-center font-mono tabular-nums text-muted-foreground">
                          {t.position > 0 ? t.position : "—"}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <PairAvatars names={[t.player1?.name ?? t.name, t.player2?.name ?? ""]} size="sm" />
                            <span className="flex flex-col leading-tight">
                              <span className="font-medium">{t.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {[t.player1?.name, t.player2?.name].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="text-center tabular-nums">{t.played || "—"}</TableCell>
                        <TableCell className="text-center tabular-nums">{t.won || "—"}</TableCell>
                        <TableCell className="text-center tabular-nums">{t.lost || "—"}</TableCell>
                        <TableCell className="text-center tabular-nums text-muted-foreground">
                          {t.played > 0 ? `${t.sets_for}–${t.sets_against}` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {t.rendimiento_pct != null ? `${t.rendimiento_pct}%` : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {t.played > 0 ? `${pct}%` : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              ))}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}