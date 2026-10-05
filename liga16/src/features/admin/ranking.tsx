"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowDownRight, ArrowUpRight, BarChart3, ClipboardList, Minus } from "lucide-react";
import { db } from "@/lib/data";
import type { Team } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardShell, CardIdentity, CardStat, CardFooterStrip, PairAvatars } from "@/components/cards/card-kit";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  // El buscador vive en el shell (SectionControl, ADR-0009) y escribe ?q=.
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
          {/* La rama va en pills y no en un desplegable (ADR-0009, tipo
              "filter"): se elige a ojo y se cambia varias veces; un Select
              esconde el resto y obliga a dos clics por filtro. Es el mismo
              criterio que el ranking público. */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Rama
            </p>
            <ToggleGroup
              type="single"
              value={sex}
              onValueChange={(v) => v && setSex(v)}
              variant="outline"
              size="sm"
              className="w-fit justify-start"
            >
              <ToggleGroupItem value="all">Todas</ToggleGroupItem>
              {sexOptions.filter((s) => s.value !== "all").map((s) => (
                <ToggleGroupItem key={s.value} value={s.value}>{s.label}</ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <FilterBar
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
              {teams === null && <AdminTableSkeleton columns={6} />}
              {teams !== null && filtered.length === 0 && (
                <AdminTableEmpty
                  colSpan={6}
                  icon={<BarChart3 className="h-5 w-5" />}
                  title="No hay parejas en este filtro"
                  description="Las parejas se inscriben desde Equipos y sus resultados se capturan en Resultados."
                />
              )}
              {/* Cards y no tabla: puesto, récord y efectividad son lo que se
                  lee de un vistazo; en tabla había que cruzarlos horizontalmente.
                  Es el mismo CardKit del ranking público. */}
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((t) => {
                  const [p1, p2] = t.name.split(" / ");
                  const pct = t.played > 0 ? winRate(t.played, t.won) : 0;
                  return (
                    <CardShell key={t.id} accent={t.position === 1}>
                      <CardContent className="p-4">
                        <CardIdentity
                          lead={<PairAvatars names={[p1, p2]} size="sm" />}
                          titleLines={[p1, p2].filter(Boolean)}
                          meta={[t.division, sexLabel(t.sex)].filter(Boolean).join(" · ")}
                          end={
                            <span className="text-stat tabular-nums text-muted-foreground/60">
                              {t.position > 0 ? `#${t.position}` : "—"}
                            </span>
                          }
                        />
                      </CardContent>
                      <CardFooterStrip
                        stats={
                          <>
                            <CardStat value={t.points.toLocaleString("es-MX")} label="Pts" />
                            <CardStat value={`${t.won}–${Math.max(t.lost, 0)}`} label="Récord" />
                            <CardStat
                              value={t.played > 0 ? `${pct}%` : "—"}
                              label="Efect."
                              tone={pct >= 60 ? "text-emerald-600 dark:text-emerald-400" : undefined}
                            />
                          </>
                        }
                        chip={
                          t.won > t.lost ? (
                            <Badge variant="outline" className="gap-1 text-success">
                              <ArrowUpRight className="h-3 w-3" /> Racha
                            </Badge>
                          ) : t.won < t.lost ? (
                            <Badge variant="outline" className="gap-1 text-destructive">
                              <ArrowDownRight className="h-3 w-3" /> Baja
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1"><Minus className="h-3 w-3" /> Estable</Badge>
                          )
                        }
                      />
                    </CardShell>
                  );
                })}
              </div>
        </CardContent>
      </Card>
    </div>
  );
}
