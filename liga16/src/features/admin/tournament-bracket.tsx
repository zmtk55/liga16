import { useMemo, useState } from "react";
import type { Pair, Match, TournamentCategory } from "@/types";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, Crown, RotateCcw, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { BENTO_CARD, BENTO_DARK, BENTO_LIGHT, BENTO_METRIC_MD } from "@/components/admin/bento";
import { AdminEmptyState } from "@/components/admin/empty-state";
import { computeStandings, isKnockoutRound } from "@/lib/groups";
import type { TournamentScoring } from "@/types";
import { moveSeed, type BracketEntry, type BracketMatch } from "@/lib/bracket";
import { tournamentProgress } from "@/lib/tournament-progress";
import { SIN_CATEGORIA } from "@/lib/format";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { db } from "@/lib/data";
import { toast } from "sonner";
import { hasMatchActivity, knockoutDrafts, knockoutLabel, knockoutRoundName, reconcileMatches, resolvedKnockout } from "@/lib/tournament-flow";
import { matchStatusKey } from "@/lib/match-state";

/**
 * Bracket de UNA categoría: siembra por puntos, con el primero plantado arriba.
 *
 * Congela la siembra al crear cruces y deriva avances de resultados por nodo.
 * Antes de crear, el admin puede mover semillas. Los partidos que
 * alimentan los ganadores se filtran a los de la categoría —una 4ta nunca puede
 * avanzar por un partido que jugó una 5ta.
 */
function CategoryBracket({
  pairs,
  matches,
  scoring,
  slots,
  tournamentId, onReload, onEditMatch, categoryName,
}: {
  pairs: Pair[];
  matches: Match[];
  scoring?: TournamentScoring | null;
  slots: number;
  categoryName: string;
  tournamentId: string;
  onReload: () => Promise<void>;
  onEditMatch: (id: string) => void;
}) {
  const [confirmStart, setConfirmStart] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = matches.some((m) => isKnockoutRound(m.round));
  const [ordenManual, setOrdenManual] = useState<BracketEntry[] | null>(null);

  const table = useMemo(() => {
    const ids = pairs.map((p) => p.id);
    const names = Object.fromEntries(pairs.map((p) => [p.id, p.name]));
    // computeStandings no numera posiciones: el orden lo hacemos aqui, con los
    // mismos criterios que usa la tabla de posiciones (puntos, sets, juegos).
    return computeStandings(ids, matches.filter((m) => !isKnockoutRound(m.round)), names, scoring ?? undefined)
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
    if (locked) return pairs.filter((p) => p.seed != null).sort((a, b) => a.seed! - b.seed!).map((p) => ({
      pairId: p.id, name: p.name, seed: p.seed!, points: table.find((r) => r.pairId === p.id)?.points ?? 0,
    }));
    if (!ordenManual) return base.map((e, i) => ({ ...e, seed: i + 1 }));
    // Se re-siembra por posición para respetar lo que movió el admin.
    return base.map((e, i) => ({ ...(ordenManual[i] ?? e), seed: i + 1 }));
  }, [table, pairs, slots, ordenManual, locked]);

  const bracket = useMemo(() => resolvedKnockout(clasificadas, matches), [clasificadas, matches]);
  const legacy = locked && (clasificadas.length < 2 || matches.some((m) => isKnockoutRound(m.round) && !/ · r\d+-m\d+$/.test(m.round)));
  const groupGames = matches.filter((m) => !isKnockoutRound(m.round));
  const groupsReady = groupGames.length > 0 && groupGames.every((m) => !!m.winner && ["finished", "walkover"].includes(m.status));
  const readyMatches = bracket.matches.filter((m) => m.a && m.b && !m.bye);
  const savedNode = (m: BracketMatch) => matches.find((x) => x.round === knockoutLabel(m, bracket.rounds) &&
    ((x.side_a.pair_id === m.a?.pairId && x.side_b.pair_id === m.b?.pairId) || (x.side_b.pair_id === m.a?.pairId && x.side_a.pair_id === m.b?.pairId)));

  async function generate() {
    if (busy || legacy || !groupsReady) return;
    setBusy(true);
    try {
      const all = await db.listMatchesByTournament(tournamentId);
      const ids = new Set(pairs.map((p) => p.id));
      const current = all.filter((m) => ids.has(m.side_a.pair_id ?? "") && ids.has(m.side_b.pair_id ?? ""));
      if (!current.some((m) => !isKnockoutRound(m.round)) || !current.filter((m) => !isKnockoutRound(m.round)).every((m) => !!m.winner && ["finished", "walkover"].includes(m.status))) throw new Error("Termina la fase de grupos antes de generar eliminatorias");
      const ko = current.filter((m) => isKnockoutRound(m.round));
      const desired = knockoutDrafts(clasificadas, ko, tournamentId, categoryName);
      const plan = reconcileMatches(ko, desired);
      if (!locked) {
        // Freeze qualification and manual seeding across reloads and score edits.
        for (const p of pairs) await db.updatePair(p.id, { seed: clasificadas.find((e) => e.pairId === p.id)?.seed ?? null });
      }
      if (plan.create.length) await db.createMatches(plan.create);
      for (const m of plan.remove) await db.deleteMatchById(m.id);
      await onReload();
      toast.success(plan.create.length ? `${plan.create.length} cruces creados. Captura los resultados para habilitar la siguiente ronda.` : "Eliminatorias al día");
    } catch (e) { toast.error((e as Error).message); await onReload(); }
    finally { setBusy(false); }
  }

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
  const rondaNombre = (n: number) => knockoutRoundName(n, bracket.rounds);
  const jugados = matches.filter((m) => matchStatusKey(m) === "finished").length;
  const finalistas = prog ? prog.finalists.filter(Boolean) : [];

  return (
    <section className="space-y-4">
      {/* Panorama: dónde va el torneo, cuánto falta y quién sigue vivo. */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className={cn(BENTO_CARD, BENTO_DARK, "flex flex-col justify-between gap-5 lg:col-span-5")}>
          <p className="text-xs font-bold uppercase tracking-widest opacity-70">En qué anda</p>
          <div>
            <p className={BENTO_METRIC_MD}>
              {prog ? (prog.finished ? "Terminado" : rondaNombre(prog.currentRound)) : "Fase de grupos"}
            </p>
            {prog && !prog.finished && (
              <p className="mt-2 text-sm opacity-80">
                {prog.pendingInRound} {prog.pendingInRound === 1 ? "cruce" : "cruces"} por definir en esta ronda
              </p>
            )}
          </div>
        </div>
        <div className={cn(BENTO_CARD, BENTO_LIGHT, "flex flex-col justify-between gap-5 lg:col-span-3")}>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Partidos jugados</p>
          <p className={BENTO_METRIC_MD}>
            {jugados}
            <span className="text-muted-foreground"> / {matches.length}</span>
          </p>
        </div>
        <div
          className={cn(
            BENTO_CARD,
            "flex flex-col justify-between gap-5 border border-transparent bg-primary text-primary-foreground lg:col-span-4",
          )}
        >
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest opacity-80">
            <Crown className="h-3.5 w-3.5" aria-hidden /> {prog?.champion ? "Campeón" : "Finalistas"}
          </p>
          {prog?.champion ? (
            <p className="font-display text-3xl font-bold leading-none tracking-tight">{prog.champion.name}</p>
          ) : finalistas.length > 0 ? (
            <p className="font-display text-xl font-bold leading-tight">
              {finalistas.map((f) => f!.name).join(" vs ")}
            </p>
          ) : (
            <p className="text-sm font-medium opacity-80">Por definir: se conocen al jugarse las semifinales.</p>
          )}
        </div>
      </div>

      {/* Siembra: quién entra y en qué lugar. Se puede mover; el árbol se rehace solo. */}
      <div className={cn(BENTO_CARD, BENTO_LIGHT, "space-y-4")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-display text-lg font-bold leading-none">Siembra</h4>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Pasan <strong className="text-foreground">{Math.min(slots, table.length)}</strong> de {table.length} parejas.
              La 1 se enfrenta a la última; la 1 y la 2 solo se cruzan en la final.
            </p>
          </div>
          <Button variant="outline" size="sm" className="rounded-full" disabled={locked || busy} onClick={() => setOrdenManual(null)}>
            <RotateCcw className="h-4 w-4" /> Orden por puntos
          </Button>
        </div>
        <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {clasificadas.map((p, i) => (
            <li key={p.pairId} className="flex min-w-0 items-center gap-3 rounded-2xl border bg-background/60 p-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.name}</p>
                <p className="text-xs tabular-nums text-muted-foreground">{p.points} pts</p>
              </div>
              <div className="flex shrink-0 gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => mover(p.pairId, -1)}
                  disabled={locked || busy || i === 0}
                  aria-label={`Subir a ${p.name} en la siembra`}
                >
                  <ChevronDown className="h-4 w-4 rotate-180" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => mover(p.pairId, 1)}
                  disabled={locked || busy || i === clasificadas.length - 1}
                  aria-label={`Bajar a ${p.name} en la siembra`}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <p className="text-sm text-muted-foreground">{legacy ? "Eliminatorias antiguas sin siembra o identificador de cruce. Revisa estos partidos antes de continuar; no se cambiarán automáticamente." :
          !groupsReady ? "Termina todos los partidos de grupos antes de crear eliminatorias." : locked ? "Siembra fijada. Captura los cruces y pulsa Generar siguiente ronda. Los pases libres avanzan sin partido." :
          "Al crear eliminatorias se fijan los clasificados y la siembra. Los pases libres avanzan sin partido."}</p>
        <Button disabled={busy || legacy || !groupsReady || clasificadas.length < 2} onClick={() => locked ? void generate() : setConfirmStart(true)}>{busy ? "Generando…" : locked ? "Generar siguiente ronda" : "Crear eliminatorias"}</Button>
        {readyMatches.map((m) => {
          const saved = savedNode(m);
          return <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <p className="text-sm">{rondaNombre(m.round)}: {m.a!.name} vs {m.b!.name}</p>
            {saved ? <Button size="sm" variant="outline" onClick={() => onEditMatch(saved.id)}>{hasMatchActivity(saved) ? "Ver / editar resultado" : "Capturar resultado"}</Button> : <span className="text-xs text-muted-foreground">Genera esta ronda para capturar</span>}
          </div>;
        })}
      </div>
      <ConfirmDialog open={confirmStart} onOpenChange={setConfirmStart} title="¿Crear eliminatorias y fijar la siembra?"
        description="Se usarán los clasificados y el orden mostrado. Después no se podrá volver a sortear ni mover semillas."
        confirmLabel="Crear eliminatorias" onConfirm={() => void generate()} />
      {/* El árbol: las rondas fluyen de izquierda a derecha hasta la final. */}
      <div className={cn(BENTO_CARD, BENTO_LIGHT, "p-4 sm:p-6")}>
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-0">
            {Array.from({ length: bracket.rounds }, (_, r) => r + 1).map((ronda) => {
              const cruces = bracket.matches.filter((m) => m.round === ronda);
              const esFinal = ronda === bracket.rounds;
              return (
                <div key={ronda} className="flex w-64 shrink-0 flex-col">
                  <p
                    className={cn(
                      "mb-3 mx-4 rounded-full px-3 py-1 text-center text-xs font-bold uppercase tracking-wider",
                      esFinal ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {rondaNombre(ronda)}
                  </p>
                  <div className="flex flex-1 flex-col">
                    {cruces.map((m, idx) => (
                      <div key={m.id} className="relative flex flex-1 items-center px-4 py-2">
                        {ronda > 1 && (
                          <span aria-hidden className="absolute left-0 top-1/2 w-4 border-t-2 border-border" />
                        )}
                        {!esFinal && (
                          <>
                            <span aria-hidden className="absolute right-0 top-1/2 w-4 border-t-2 border-border" />
                            <span
                              aria-hidden
                              className={cn(
                                "absolute right-0 w-4 border-r-2 border-border",
                                idx % 2 === 0 ? "top-1/2 h-1/2" : "bottom-1/2 h-1/2",
                              )}
                            />
                          </>
                        )}
                        <MatchCard m={m} ronda={ronda} esFinal={esFinal} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Un cruce: dos renglones, el ganador resaltado en naranja y el que cae atenuado. */
function MatchCard({ m, ronda, esFinal }: { m: BracketMatch; ronda: number; esFinal: boolean }) {
  const renglon = (e: BracketEntry | null) => {
    const gano = Boolean(e && m.played && m.winnerId === e.pairId);
    const perdio = Boolean(e && m.played && m.winnerId !== e.pairId);
    const vacio = ronda === 1 ? "Descansa (bye)" : "Por definir";
    return (
      <div
        className={cn(
          "flex items-center gap-2.5 px-3 py-2.5 text-sm",
          gano && "bg-primary/15",
          perdio && "text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
            gano ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {e ? e.seed : "–"}
        </span>
        <span className={cn("min-w-0 flex-1 truncate", e ? "font-semibold" : "italic text-muted-foreground", perdio && "font-medium")}>
          {e?.name ?? vacio}
        </span>
        {gano && <Check className="h-4 w-4 shrink-0 text-primary-strong" aria-label="Avanza" />}
      </div>
    );
  };
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-2xl border-2 bg-card",
        esFinal ? "border-primary" : m.played ? "border-primary/40" : "border-border",
        m.bye && "opacity-70",
      )}
    >
      {renglon(m.a)}
      <div className="border-t">{renglon(m.b)}</div>
    </div>
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
  tournamentId, onReload, onEditMatch,
}: {
  pairs: Pair[];
  matches: Match[];
  categories: TournamentCategory[];
  scoring?: TournamentScoring | null;
  slots: number;
  tournamentId: string;
  onReload: () => Promise<void>;
  onEditMatch: (id: string) => void;
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
        className="rounded-3xl border bg-card"
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
          !!s && (s.pair_id ? ids.has(s.pair_id) : namesInCat.has(pairNameKey(s)));
        const catMatches = matches.filter((m) => inCat(m.side_a) && inCat(m.side_b));
        const name = nameByCatId.get(categoryId) ?? (categoryId ? "" : SIN_CATEGORIA);
        return (
          <div key={categoryId || "__sin_categoria__"} className="space-y-4">
            {byCategory.length > 1 && (
              <h3 className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-foreground px-4 py-1.5 font-display text-sm font-bold text-background">{name}</span>
                <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
                  {catPairs.length} parejas · {catMatches.length} partidos
                </span>
              </h3>
            )}
            <CategoryBracket
              pairs={catPairs}
              matches={catMatches}
              scoring={scoring}
              slots={slots}
              tournamentId={tournamentId} onReload={onReload} onEditMatch={onEditMatch} categoryName={name}
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
