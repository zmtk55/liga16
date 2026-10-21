import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { db } from "@/lib/data";
import { useMatchUpdated } from "@/lib/refresh";
import type { Team } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamCard } from "@/components/cards/team-card";
import { CardShell, CardIdentity } from "@/components/cards/card-kit";
import { TeamCrest } from "@/components/cards/card-image";
import { PageHero } from "@/components/page-hero";
import { FilterMenu } from "@/components/ui/filter-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { sexLabel, winRate } from "@/lib/format";
import {
  categoryFacet,
  teamCategoryKey,
  teamCategoryLabel,
} from "@/lib/categories";
import { ArrowRight, LayoutGrid, Rows3, Table2, X } from "lucide-react";

type View = "grid" | "compact" | "table";

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  // El buscador del header (variante "search", ADR-0009) escribe aquí: una sola
  // búsqueda, en un solo sitio, y la URL la hace compartible.
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  // La categoría real del torneo ("Suma 9", "4ta Varonil"), no la división
  // derivada. Vive en la URL como el resto de filtros de la sección: sobrevive
  // al ir y venir y un enlace ya filtrado se puede compartir.
  const categoria = params.get("categoria") ?? "all";
  const sex = params.get("sex") ?? "all";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const setSex = (v: string) => setParam("sex", v);
  const navigate = useNavigate();
  const [view, setView] = useState<View>("grid");

  /**
   * Limpia varios filtros de una vez.
   *
   * `setParam` lee `params` del render en curso, así que llamarla dos veces seguidas
   * escribía dos veces sobre el mismo objeto viejo: la segunda pisaba a la primera
   * y "Limpiar" solo apagaba el último filtro. Hacían falta dos clics para quitar
   * dos filtros.
   */
  function clearParams(...keys: string[]) {
    const next = new URLSearchParams(params);
    for (const k of keys) next.delete(k);
    setParams(next, { replace: true });
  }

  // El récord y los puntos de cada pareja salen de los partidos: al guardar un
  // resultado, la lista se recalcula sola.
  useMatchUpdated(() => {
    db.listTeams()
      .then((data) => setTeams(data))
      .catch(() => setTeams([]));
  });

  useEffect(() => {
    let active = true;
    // El `catch` importa: sin él, si la petición falla el estado se queda en
    // `null` para siempre y la página se queda en esqueletos grises, sin error
    // y sin reintentar. Con lista vacía el usuario ve "no hay equipos" y sabe
    // que algo falló, en vez de una pantalla que nunca carga.
    db.listTeams()
      .then((data) => {
        if (active) setTeams(data);
      })
      .catch(() => {
        if (active) setTeams([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!teams) return [];
    const query = q.trim().toLowerCase();
    return teams.filter((t) => {
      if (categoria !== "all" && teamCategoryKey(t) !== categoria) return false;
      if (sex !== "all" && t.sex !== sex) return false;
      if (
        query &&
        !t.name.toLowerCase().includes(query) &&
        !`${t.player1?.name ?? ""} ${t.player2?.name ?? ""}`
          .toLowerCase()
          .includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [teams, q, categoria, sex]);

/**
   * Las categorías salen de los equipos CARGADOS, no de una lista fija.
   *
   * El filtro era `divisionOptions` —1ra…Novatos, escritos a mano— y por eso
   * "Suma 9" no aparecía aunque la pareja compitiese ahí: `division` es un
   * bucket derivado y el nombre real se perdía. Peor: la lista ofrecía
   * divisiones que en el circuito no existen. Si no hay 2da, no hay por qué
   * ofrecer 2da.
   *
   * Con esto el filtro ofrece exactamente lo que hay, y "Suma 9" aparece solo y
   * separada porque existe de verdad. La barra vive en `lib/categories.ts`
   * porque `/ranking`, `/admin/ranking` y `/jugadores` necesitan lo mismo.
   */
  const categorias = useMemo(() => categoryFacet(teams ?? []), [teams]);

  /** Ramas con parejas de verdad, no el catálogo entero de la BD. */
  const ramas = useMemo(() => {
    const n = new Map<string, number>();
    for (const t of teams ?? []) n.set(t.sex, (n.get(t.sex) ?? 0) + 1);
    return [...n.entries()]
      .map(([key, count]) => ({ key, label: sexLabel(key), n: count }))
      .sort((a, b) => b.n - a.n);
  }, [teams]);

  return (
    <div className="animate-fade-in space-y-8">
      <PageHero
        title="Equipos"
        subtitle="Las parejas de Liga16, división por división. Récord y puntos calculados de los partidos reales del circuito."
      />

      {/* El buscador vive en el header (variante "search", ADR-0009): una sola
          búsqueda por sección, siempre en el mismo sitio. Aquí solo lo propio de
          la sección —la categoría en la que compiten y la rama—, que no aplica a
          las demás. */}
      <div className="relative z-10 -mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterMenu
            label="Categoría"
            value={categoria}
            onChange={(v) => setParam("categoria", v)}
            options={categorias.length > 1 ? categorias : []}
            allLabel="Todas"
            showCount
          />
          <FilterMenu
            label="Rama"
            value={sex}
            onChange={setSex}
            options={ramas.length > 1 ? ramas : []}
            allLabel="Todas"
            showCount
          />
          {(categoria !== "all" || sex !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => clearParams("categoria", "sex")}
            >
              <X className="h-3.5 w-3.5" /> Limpiar
            </Button>
          )}
          {/* Selector de vista, como en /jugadores y /ranking. Antes esta lista
              solo tenía tarjetas: quien llegaba a comparar treinta parejas con
              la tabla de su Excel no tenía dónde comparar. */}
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => { if (v) setView(v as View); }}
            variant="outline"
            className="rounded-lg border"
          >
            <ToggleGroupItem value="grid" aria-label="Vista tarjetas" className="px-2.5">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="compact" aria-label="Vista compacta" className="px-2.5">
              <Rows3 className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Vista tabla" className="px-2.5">
              <Table2 className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        {categorias.length > 1 && (
          <p className="text-xs text-muted-foreground">
            Las categorías son las del torneo ("Suma 9", "4ta Varonil"), no la
            división en la que caen. Solo aparecen las que existen.{" "}
            <Link
              to="/torneos"
              className="inline-flex min-h-6 items-center underline underline-offset-4 hover:text-foreground"
            >
              Ver los torneos
            </Link>
          </p>
        )}
      </div>

      {teams === null ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Ningún equipo coincide con la búsqueda. Prueba con otra división o
            género.
          </CardContent>
        </Card>
      ) : view === "grid" ? (
        /* Mismas reglas de retícula que la galería de jugadores: la card es de
           ancho fijo (max-w-xs), así que en columnas anchas se centra en su hueco
           en vez de estirar el diseño. El enlace al detalle va dentro de la card
           —envolverla con un Link haría que el click fuera siempre navegación y
           nunca un flip. */
        <div className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((team) => (
            <TeamCard key={team.slug} team={team} />
          ))}
        </div>
      ) : view === "compact" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((team) => (
            <Link
              key={team.slug}
              to={`/equipos/${team.slug}`}
              className="group"
            >
              <CardShell
                className="rounded-xl border bg-card p-3 transition-colors hover:bg-muted/60"
              >
                <CardIdentity
                  lead={
                    <TeamCrest
                      name={team.name}
                      crestUrl={team.crest_url}
                      className="h-9 w-9 shrink-0"
                    />
                  }
                  title={team.name}
                  meta={
                    <span className="text-xs text-muted-foreground">
                      {team.won}–{team.played - team.won} · {winRate(team.played, team.won)}%
                    </span>
                  }
                />
              </CardShell>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Pareja</TableHead>
                  <TableHead className="hidden sm:table-cell">Categoría</TableHead>
                  <TableHead className="hidden md:table-cell">Rama</TableHead>
                  <TableHead className="text-right">Pos</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">PJ</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">PG</TableHead>
                  <TableHead className="text-right">Efect.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t, i) => (
                  <TableRow key={t.slug} className="cursor-pointer" onClick={() => navigate(`/equipos/${t.slug}`)}>
                    <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <Link
                        to={`/equipos/${t.slug}`}
                        className="flex items-center gap-2.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <TeamCrest name={t.name} crestUrl={t.crest_url} className="h-8 w-8" />
                        <span className="font-medium">{t.name}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{teamCategoryLabel(t)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline">{sexLabel(t.sex)}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.position > 0 ? t.position : "—"}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{t.played}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{t.won}</TableCell>
                    <TableCell className="text-right tabular-nums">{winRate(t.played, t.won)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* CTA final estilo landing */}
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-muted/30 px-6 py-8 text-center">
        <p className="font-headline text-xl uppercase tracking-tight md:text-2xl">
          ¿Tu pareja aún no está en el muro?
        </p>
        <p className="max-w-md text-sm text-muted-foreground">
          Inscríbanse al próximo torneo y aparezcan aquí con su récord oficial.
        </p>
        <Button
          asChild
          size="lg"
          className="mt-1 font-bold uppercase tracking-wide"
        >
          <Link to="/torneos">
            Ver torneos abiertos <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
