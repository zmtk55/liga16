"use client";

import { AdminLoadFailed } from "@/components/admin/empty-state";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { BarChart3, ClipboardList } from "lucide-react";
import { db } from "@/lib/data";
import { useMatchUpdated } from "@/lib/refresh";
import type { Team } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { AdminFacet, AdminFacets } from "@/components/admin/filter-facets";
import { countActive } from "@/lib/filters";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminEmptyState } from "@/components/admin/empty-state";
import { PairAvatars } from "@/components/cards/card-kit";
import { AdminPageHeader, AdminStat, AdminStatStrip } from "@/components/admin/page-header";
import { sexLabel, winRate } from "@/lib/format";
import {
  categoryFacet,
  groupByDivision,
  teamCategoryKey,
} from "@/lib/categories";

/**
 * Ranking de PAREJAS, derivado.
 *
 * No se edita aquí a propósito: la fuente de verdad son los resultados que
 * captura el admin en Resultados. Editar puntos a mano haría que el ranking
 * dejara de coincidir con los partidos y perdería la trazabilidad.
 *
 * Tarjetas agrupadas por división y rama, con posición y puntos visibles.
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
  const [categoria, setCategoria] = useState("all");
  const [sex, setSex] = useState("all");

  const [loadError, setLoadError] = useState<string | null>(null);
  const loadTeams = () => {
    let active = true;
    db.listTeams().then((t) => {
      if (active) { setTeams(t); setLoadError(null); }
    }).catch((e) => { if (active) setLoadError((e as Error)?.message || "Error al cargar el ranking"); });
    return () => { active = false; };
  };

  // Refresca el ranking cuando se guarda un resultado (en esta pestaña o en otra).
  useMatchUpdated(() => {
    db.listTeams().then((t) => setTeams(t));
  });

  useEffect(() => {
    return loadTeams();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (teams ?? []).filter(
      (t) =>
        (categoria === "all" || teamCategoryKey(t) === categoria) &&
        (sex === "all" || t.sex === sex) &&
        (!q ||
          t.name.toLowerCase().includes(q) ||
          [t.player1?.name, t.player2?.name]
            .filter(Boolean)
            .some((n) => (n as string).toLowerCase().includes(q))),
    );
  }, [teams, query, categoria, sex]);

  /**
   * El filtro sale de los datos: las categorías que los torneos registraron de
   * verdad. Era `divisionOptions` —1ra…Novatos escrito a mano—, así que ofrecía
   * divisiones que no existen y le faltaban "Suma 9" y "Mixtos", que sí.
   */
  const categorias = useMemo(() => categoryFacet(teams ?? []), [teams]);
  const ramas = useMemo(() => {
    const n = new Map<string, number>();
    for (const t of teams ?? []) n.set(t.sex, (n.get(t.sex) ?? 0) + 1);
    return [...n.entries()]
      .map(([key, count]) => ({ key, label: sexLabel(key), n: count }))
      .sort((a, b) => b.n - a.n);
  }, [teams]);

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

  if (loadError && teams === null) {
    return (
      <AdminLoadFailed
        title="Ranking de parejas"
        description="Se calcula con los resultados que capturas. Cambia un resultado y el ranking se actualiza."
        what="el ranking"
        message={loadError}
        onRetry={() => { loadTeams(); }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Ranking de parejas"
        description="Se calcula con los resultados que capturas. Cambia un resultado y el ranking se actualiza."
      >
        <AdminStatStrip loading={teams === null}>
          <AdminStat value={resumen.parejas} label="Parejas" />
          <AdminStat value={resumen.conPartidos} label="Con partidos" />
          <AdminStat value={resumen.grupos} label="Grupos" />
        </AdminStatStrip>
      </AdminPageHeader>

      <div className="flex flex-col gap-3 rounded-3xl bg-card px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
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

      <Card className="rounded-3xl border-0 bg-transparent shadow-none">
        {/* Buscador + las dos barras de filtro debajo. El FilterBar envuelve a las
            barras como `children`, así que el buscador sigue arriba y los
            filtros se leen de un vistazo. */}
        <CardHeader>
          <FilterBar
            search={query}
            onSearch={setQuery}
            searchPlaceholder="Buscar pareja o jugador…"
            resultCount={filtered.length}
            resultLabel="parejas"
            activeCount={countActive(categoria, sex)}
            onClear={() => {
              setQuery("");
              setCategoria("all");
              setSex("all");
            }}
          >
            {/* Los filtros van como barra y no como desplegables: las opciones
                se leen enteras sin abrirlas, y son las que hay de verdad. */}
            <AdminFacets>
              <AdminFacet
                label="Categoría"
                value={categoria}
                onChange={setCategoria}
                options={categorias.length > 1 ? categorias : []}
                allLabel="Todas"
              />
              <AdminFacet
                label="Rama"
                value={sex}
                onChange={setSex}
                options={ramas.length > 1 ? ramas : []}
                allLabel="Todas"
              />
            </AdminFacets>
          </FilterBar>
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
            <AdminEmptyState
              icon={<BarChart3 className="h-5 w-5 text-muted-foreground" />}
              title="No hay parejas en este filtro"
              description="Las parejas se inscriben desde Equipos y sus resultados se capturan en Resultados."
            />
          )}

          {filtered.length > 0 && (
            <div className="space-y-8">
              {groups.map(g => <section key={g.label} className="space-y-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold"><span className="h-2 w-2 rounded-full bg-primary" />{g.label}</h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{g.teams.map(t => <article key={t.id} className="overflow-hidden rounded-3xl border bg-card transition-colors hover:border-primary/40">
                  <div className="flex items-start justify-between gap-3 p-5"><PairAvatars names={[t.player1?.name ?? t.name, t.player2?.name ?? ""]} size="sm" /><span className="font-display text-3xl font-bold text-primary">{t.position > 0 ? `#${t.position}` : "Sin posición"}</span></div>
                  <div className="space-y-4 px-5 pb-5"><h3 className="font-display text-xl font-semibold">{t.name}</h3><p className="text-xs text-muted-foreground">{[t.player1?.name,t.player2?.name].filter(Boolean).join(" · ")}</p>
                    <div className="rounded-2xl bg-zinc-950 p-4 text-white"><p className="text-xs text-white/60">Puntos ganados / jugados</p><p className="mt-2 font-display text-4xl font-bold tabular-nums">{t.rendimiento_pct != null ? `${t.rendimiento_pct}%` : "–"}</p></div>
                    <dl className="grid grid-cols-3 gap-2 text-center text-xs"><div><dt className="text-muted-foreground">Jugados</dt><dd className="mt-1 text-lg font-semibold">{t.played}</dd></div><div><dt className="text-muted-foreground">Ganados</dt><dd className="mt-1 text-lg font-semibold">{t.won}</dd></div><div><dt className="text-muted-foreground">Perdidos</dt><dd className="mt-1 text-lg font-semibold">{t.lost}</dd></div></dl>
                    <div className="flex justify-between gap-2 border-t pt-3 text-xs text-muted-foreground"><span>Sets {t.played > 0 ? `${t.sets_for} / ${t.sets_against}` : "–"}</span><span>Efectividad {t.played > 0 ? `${winRate(t.played,t.won)}%` : "–"}</span></div>
                  </div>
                </article>)}</div>
              </section>)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
