import { useMemo, useState } from "react";
import type { Pair, Match, TournamentCategory } from "@/types";
import { Button } from "@/components/ui/button";
import { ChevronDown, RotateCcw, Trophy } from "lucide-react";
import { AdminEmptyState } from "@/components/admin/empty-state";
import { computeStandings } from "@/lib/groups";
import type { TournamentScoring } from "@/types";
import { buildBracket, moveSeed, resolveBracket, type BracketEntry } from "@/lib/bracket";
import { tournamentProgress } from "@/lib/tournament-progress";
import { SIN_CATEGORIA } from "@/lib/format";
import { matchStatusKey } from "@/lib/match-state";

/**
 * Bracket de UNA categoría: siembra por puntos, con el primero plantado arriba.
 *
 * No guarda nada: se deriva de los resultados que el admin ya capturó, así que
 * mover una semilla o corregir un partido lo recalcula solo. Los partidos que
 * alimentan los ganadores se filtran a los de la categoría —una 4ta nunca puede
 * avanzar por un partido que jugó una 5ta.
 */
function CategoryBracket({
  pairs,
  matches,
  scoring,
  slots,
}: {
  pairs: Pair[];
  matches: Match[];
  scoring?: TournamentScoring | null;
  slots: number;
}) {
  const [ordenManual, setOrdenManual] = useState<BracketEntry[] | null>(null);

  const table = useMemo(() => {
    const ids = pairs.map((p) => p.id);
    const names = Object.fromEntries(pairs.map((p) => [p.id, p.name]));
    // computeStandings no numera posiciones: el orden lo hacemos aqui, con los
    // mismos criterios que usa la tabla de posiciones (puntos, sets, juegos).
    return computeStandings(ids, matches, names, scoring ?? undefined)
      .slice()
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.setsFor - a.setsFor ||
          b.gamesFor - a.gamesFor ||
          a.pairId.localeCompare(b.pairId),
      );
  }, [pairs, matches, scoring]);

  // Clasifican las primeras `slots`; el resto se queda esperando. Si la categoría
  // tiene menos parejas que el cupo, clasifican todas: no hay de dónde elegir.
  const clasificadas: BracketEntry[] = useMemo(() => {
    const base = table.slice(0, slots).map((row) => {
      const pair = pairs.find((p) => p.id === row.pairId);
      return {
        seed: 0,
        pairId: row.pairId,
        name: pair?.name ?? row.pairId,
        points: row.points,
      };
    });
    if (!ordenManual) return base.map((e, i) => ({ ...e, seed: i + 1 }));
    // Se re-siembra por posición para respetar lo que movió el admin.
    return base.map((e, i) => ({ ...(ordenManual[i] ?? e), seed: i + 1 }));
  }, [table, pairs, slots, ordenManual]);

  const base = useMemo(() => buildBracket(clasificadas), [clasificadas]);
  const bracket = useMemo(() => {
    // El ganador de cada cruce sale de los resultados que el admin ya capturó.
    const terminado = matches.filter((m) => matchStatusKey(m) === "finished" && m.winner);
    return {
      ...base,
      matches: resolveBracket(base, (a, b) => {
        const partido = terminado.find(
          (m) =>
            (m.side_a.pair_id === a.pairId && m.side_b.pair_id === b.pairId) ||
            (m.side_a.pair_id === b.pairId && m.side_b.pair_id === a.pairId),
        );
        if (!partido) return null;
        const ganador = partido.winner === "a" ? partido.side_a.pair_id : partido.side_b.pair_id;
        return ganador ?? null;
      }),
    };
  }, [base, matches]);

  function mover(pairId: string, delta: number) {
    setOrdenManual((prev) => {
      const base = prev ?? clasificadas;
      const idx = base.findIndex((e) => e.pairId === pairId);
      const destino = idx + delta;
      if (idx === -1 || destino < 0 || destino >= base.length) return prev;
      return moveSeed(base, idx + 1, destino + 1);
    });
  }

  if (pairs.length < 2) return null;

  const prog = tournamentProgress({
    matches: bracket.matches,
    rounds: bracket.rounds,
    played: matches.filter((m) => matchStatusKey(m) === "finished").length,
    total: matches.length,
  });
  const rondaNombre = (n: number) =>
    n >= bracket.rounds ? "Final" : n === bracket.rounds - 1 ? "Semifinales" : `Ronda ${n}`;

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            En qué anda
          </p>
          {prog ? (
            <p className="mt-1 font-display text-xl leading-none">
              {prog.finished ? "Terminado" : rondaNombre(prog.currentRound)}
            </p>
          ) : (
            <p className="mt-1 font-display text-xl leading-none">Fase de grupos</p>
          )}
          {prog && !prog.finished && (
            <p className="mt-1 text-xs text-muted-foreground">
              {prog.pendingInRound} {prog.pendingInRound === 1 ? "partido" : "partidos"} sin capturar
            </p>
          )}
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Partidos
          </p>
          <p className="mt-1 font-display text-xl leading-none tabular-nums">
            {matches.filter((m) => matchStatusKey(m) === "finished").length}
            <span className="text-sm text-muted-foreground"> / {matches.length}</span>
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {prog?.champion ? "Campeón" : "Finalistas"}
          </p>
          {prog?.champion ? (
            <p className="mt-1 truncate font-display text-xl leading-none text-primary">
              {prog.champion.name}
            </p>
          ) : prog && prog.finalists.filter(Boolean).length > 0 ? (
            <p className="mt-1 truncate text-sm font-medium">
              {prog.finalists.filter(Boolean).map((f) => f!.name).join(" vs ")}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Por definir</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
        <p className="text-sm text-muted-foreground">
          Pasan <strong className="text-foreground">{Math.min(slots, table.length)}</strong> de{" "}
          {table.length} parejas. La siembra sale de los puntos: la primera se planta arriba.
        </p>
        <Button variant="outline" size="sm" onClick={() => setOrdenManual(null)}>
          <RotateCcw className="h-4 w-4" /> Volver al orden por puntos
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {clasificadas.map((p, i) => (
          <div key={p.pairId} className="flex min-w-0 items-center gap-2 rounded-lg border bg-card p-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.name}</p>
              <p className="text-xs tabular-nums text-muted-foreground">{p.points} pts</p>
            </div>
            <div className="flex shrink-0 flex-col">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => mover(p.pairId, -1)}
                disabled={i === 0}
                aria-label={`Subir a ${p.name} en la siembra`}
              >
                <ChevronDown className="h-4 w-4 rotate-180" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => mover(p.pairId, 1)}
                disabled={i === clasificadas.length - 1}
                aria-label={`Bajar a ${p.name} en la siembra`}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: bracket.rounds }, (_, r) => r + 1).map((ronda) => (
          <div key={ronda}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {ronda === bracket.rounds ? "Final" : `Ronda ${ronda}`}
            </p>
<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {bracket.matches
                .filter((m) => m.round === ronda)
                .map((m) => {
                  // Solo la primera ronda puede tener bye; en las siguientes
                  // un hueco es "ganador de la ronda anterior", no una baja.
                  const etiqueta = (e: BracketEntry | null) =>
                    e ? `S${e.seed}` : ronda === 1 ? "bye" : "ganador de la ronda anterior";
                  const linea = (e: BracketEntry | null, rival: BracketEntry | null) => {
                    const gano =
                      e && rival && m.played && m.a?.pairId === e.pairId && m.a !== null && m.b !== null
                        ? m.a.pairId !== m.b?.pairId
                        : false;
                    return (
                      <div
                        className={`flex items-center gap-2 px-3 py-2 text-sm ${
                          m.played && e ? (gano ? "bg-success/10" : "") : ""
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate font-medium">{e?.name ?? "—"}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {etiqueta(e)}
                        </span>
                      </div>
                    );
                  };
                  return (
                    <div
                      key={m.id}
                      className={`overflow-hidden rounded-lg border bg-card ${m.played ? "border-success/40" : ""}`}
                    >
                      {linea(m.a, m.b)}
                      <div className="border-t">{linea(m.b, m.a)}</div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Brackets del torneo, uno por categoría.
 *
 * Una categoría es una competencia cerrada: 4tas solo contra 4tas, 5tas solo
 * contra 5tas. Por eso aquí no hay un bracket único con todas las parejas —sería
 * un torneo que nadie está disputando— sino uno por categoría, con sus puntos y
 * sus cruces. Los partidos que cuentan para una categoría son los que van entre
 * parejas de esa misma categoría.
 */
export function BracketPanel({
  pairs,
  matches,
  categories,
  scoring,
  slots,
}: {
  pairs: Pair[];
  matches: Match[];
  categories: TournamentCategory[];
  scoring?: TournamentScoring | null;
  slots: number;
}) {
  const nameByCatId = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  // Orden: primero las categorías del torneo en su orden, y al final las parejas
  // sin categoría, para que no se pierdan de la vista.
  const byCategory = useMemo(() => {
    const order = new Map(categories.map((c, i) => [c.id, i]));
    const buckets = new Map<string, Pair[]>();
    for (const p of pairs) {
      const key = p.category_id ?? "";
      buckets.set(key, [...(buckets.get(key) ?? []), p]);
    }
    return [...buckets.entries()].sort(
      ([a], [b]) =>
        (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER) ||
        a.localeCompare(b),
    );
  }, [pairs, categories]);

  if (pairs.length === 0) {
    return (
      <AdminEmptyState
        className="border bg-card"
        icon={<Trophy className="h-5 w-5" />}
        title="Sin parejas en este torneo"
        description="Cuando inscribas parejas, aquí se genera el bracket."
      />
    );
  }

  const conParejas = byCategory.filter(([, list]) => list.length >= 2);

  return (
    <div className="space-y-6">
      {byCategory.length > 1 && (
        <p className="text-sm text-muted-foreground">
          Un bracket por categoría: las 4tas solo juegan contra 4tas y las 5tas contra 5tas.
        </p>
      )}
      {conParejas.map(([categoryId, catPairs]) => {
        const ids = new Set(catPairs.map((p) => p.id));
        // Un partido pertenece a la categoría solo si AMBOS lados son de ella. Por id
        // cuando existe, y por nombre cuando no: el asistente crea los partidos
        // sin `pair_id` (solo el texto del lado), así que filtrando solo por id
        // cualquier torneo hecho con el asistente salía con "0 partidos" y sin
        // ganadores resolverse nunca, mientras la pestaña de posiciones —que sí
        // cae a nombres— mostraba los mismos partidos bien.
        const pairNameKey = (s: { pair_name: string } | null) =>
          (s?.pair_name ?? "").trim().toLowerCase();
        const namesInCat = new Set(catPairs.map((p) => p.name.trim().toLowerCase()));
        const inCat = (s: { pair_id: string | null; pair_name: string } | null) =>
          !!s && (ids.has(s.pair_id ?? "") || namesInCat.has(pairNameKey(s)));
        const catMatches = matches.filter((m) => inCat(m.side_a) && inCat(m.side_b));
        const name = nameByCatId.get(categoryId) ?? (categoryId ? "" : SIN_CATEGORIA);
        return (
          <div key={categoryId || "__sin_categoria__"} className="space-y-4">
            {byCategory.length > 1 && (
              <h3 className="flex flex-wrap items-center gap-2 border-b pb-2 text-sm font-semibold">
                {name}
                <span className="text-xs font-normal text-muted-foreground">
                  {catPairs.length} parejas · {catMatches.length} partidos
                </span>
              </h3>
            )}
            <CategoryBracket
              pairs={catPairs}
              matches={catMatches}
              scoring={scoring}
              slots={slots}
            />
          </div>
        );
      })}
      {conParejas.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Cada categoría necesita al menos 2 parejas para armar su bracket.
        </p>
      )}
    </div>
  );
}
