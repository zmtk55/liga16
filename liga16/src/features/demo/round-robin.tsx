import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  americanoStandings,
  fullRotationRounds,
  generateAmericano,
  maxCourts,
  playoffFinalPairs,
  proposePlayoffPairs,
  validateAmericanoScore,
  type AmericanoRound,
  type AmericanoSortMode,
} from "@/lib/americano";

/**
 * DEMO AISLADA — round robin INDIVIDUAL con dobles de compañero rotativo
 * (rama investigacion/round-robin). Todo corre en memoria con nombres
 * ficticios: nada toca Supabase ni ningún torneo real.
 *
 * El flujo sigue lo que hacen las apps reales del formato (verificadas
 * navegándolas el 18-nov-2026): metes nombres, la app arma las rondas con
 * compañeros rotativos y lleva una tabla individual por puntos. Referencias:
 *  - https://www.rallyano.com/padel-americano/7-players (7 jugadores, 1
 *    cancha → 11 rondas, rotación completa, 3 descansan por ronda)
 *  - https://calcpark.com/padel-americano-generator (captura por puntos,
 *    tabla individual por puntos/diferencia/victorias, descansos parejos)
 *  - https://www.nextarena.co/tools/padel-americano-generator/7-players-1-court
 *    (alternativa corta: 6 rondas sin repetir compañero)
 *
 * Diseño mobile-first para uso EN CANCHA (referencia visual aportada por
 * Julian el 18-nov-2026: navegación por ronda con flechas, marcadores
 * grandes, descansos visibles): la meta es crear el round robin en menos de
 * 4 minutos y capturar puntos con una mano entre juegos.
 *
 * Reglas ELEGIDAS PARA ESTA PRUEBA: cada partido lo gana el primer equipo en
 * llegar a N puntos (la regla que describió Julian: "el primero que llegue a
 * 4, a veces a 5"), sin empate, y cada jugador se queda con los puntos que
 * anotó su equipo. Sin compensación por descanso: la tabla se puede ordenar
 * por total o por promedio por partido para ver el efecto.
 *
 * La pestaña Eliminatoria es una PROPUESTA A PRUEBA, reversible y marcada
 * como tal en pantalla (no es una regla confirmada por Julian): parejas
 * balanceadas desde la tabla, final directa con 4-7 y semifinales cruzadas
 * con 8+. Fuentes de la convención en proposePlayoffPairs (lib/americano.ts).
 */

const DEFAULT_NAMES = ["Ana", "Beto", "Carla", "Diego", "Elena", "Fede", "Gaby"];
const POINT_OPTIONS = [4, 5, 8, 16];
const MAX_PLAYERS = 12;

interface ScoreDraft {
  a: string;
  b: string;
}

function parseScore(draft: ScoreDraft | undefined, pointsPerMatch: number): { a: number; b: number } | null {
  if (!draft || draft.a.trim() === "" || draft.b.trim() === "") return null;
  const check = validateAmericanoScore(Number(draft.a), Number(draft.b), pointsPerMatch);
  return check.ok ? check.score : null;
}

/** Error visible cuando ambos lados están capturados pero el marcador no llega a N. */
function scoreError(draft: ScoreDraft | undefined, pointsPerMatch: number): string | null {
  if (!draft || draft.a.trim() === "" || draft.b.trim() === "") return null;
  const check = validateAmericanoScore(Number(draft.a), Number(draft.b), pointsPerMatch);
  return check.ok ? null : check.error;
}

export default function RoundRobinDemo() {
  // La lista puede venir precargada desde la inscripcion: /demo/round-robin?jugadores=Ana,Beto,...
  const [searchParams] = useSearchParams();
  const rosterFromUrl = (searchParams.get("jugadores") ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const [inscritos, setInscritos] = useState<string[]>(rosterFromUrl);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [courts, setCourts] = useState(1);
  const [pointsPerMatch, setPointsPerMatch] = useState(4);
  const [roundMode, setRoundMode] = useState<"full" | "short">("full");
  const [seed, setSeed] = useState(1);
  const [names, setNames] = useState<string[]>([]);
  const [rounds, setRounds] = useState<AmericanoRound[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ScoreDraft>>({});
  const [sortMode, setSortMode] = useState<AmericanoSortMode>("total");
  const [currentRound, setCurrentRound] = useState(0);
  const [configOpen, setConfigOpen] = useState(true);
  const [view, setView] = useState<"rounds" | "standings" | "playoff">("rounds");
  // Marcadores de la eliminatoria (propuesta); llaves "po-*", separadas de las rondas.
  const [playoffDrafts, setPlayoffDrafts] = useState<Record<string, ScoreDraft>>({});

  // La lista de inscritos manda. Fuera de limite NO se recorta: se bloquea la
  // generacion con aviso claro y los nombres quedan intactos.
  const previewCount = Math.min(inscritos.length, MAX_PLAYERS);
  const overLimit = inscritos.length > MAX_PLAYERS;
  const canGenerate = inscritos.length >= 4 && !overLimit;
  const nombreLimpio = nuevoNombre.trim();
  const esDuplicado =
    nombreLimpio !== "" && inscritos.some((x) => x.toLowerCase() === nombreLimpio.toLowerCase());
  const fullRounds = fullRotationRounds(previewCount, courts);
  const restingPerRound = inscritos.length - courts * 4;

  const scores = useMemo(() => {
    const map: Record<string, { a: number; b: number }> = {};
    for (const [key, draft] of Object.entries(drafts)) {
      const parsed = parseScore(draft, pointsPerMatch);
      if (parsed) map[key] = parsed;
    }
    return map;
  }, [drafts, pointsPerMatch]);

  const standings = useMemo(
    () => (names.length > 0 ? americanoStandings(names.length, rounds, scores, sortMode) : []),
    [names, rounds, scores, sortMode],
  );

  const playedCount = Object.keys(scores).length;
  const totalMatches = rounds.reduce((acc, r) => acc + r.matches.length, 0);
  const ri = Math.min(currentRound, Math.max(0, rounds.length - 1));
  const round = rounds[ri];

  // Eliminatoria (PROPUESTA reversible): parejas balanceadas desde el orden
  // actual de la tabla; se recalcula solo al capturar puntos.
  const playoff = useMemo(
    () => (names.length >= 4 ? proposePlayoffPairs(standings.map((r) => r.player)) : null),
    [names.length, standings],
  );
  // Las llaves de la eliminatoria llevan las parejas: si la tabla (o el
  // criterio total/promedio) cambia y cambian las parejas, un marcador viejo
  // NUNCA se pega a parejas nuevas ni deja campeones obsoletos.
  function poKey(prefix: string, teamA: [number, number], teamB: [number, number]) {
    return `${prefix}-${teamA[0]}-${teamA[1]}-${teamB[0]}-${teamB[1]}`;
  }

  const sfScores = useMemo(
    () =>
      playoff
        ? playoff.semifinals.map((m, i) =>
            parseScore(playoffDrafts[poKey(`po-sf-${i}`, m.teamA, m.teamB)], pointsPerMatch),
          )
        : [],
    [playoff, playoffDrafts, pointsPerMatch],
  );
  const finalPairs = useMemo(
    () => (playoff ? playoffFinalPairs(playoff, sfScores) : null),
    [playoff, sfScores],
  );
  const finalKey = finalPairs ? poKey("po-final", finalPairs[0], finalPairs[1]) : null;
  const finalScore = finalKey ? parseScore(playoffDrafts[finalKey], pointsPerMatch) : null;
  const championNames =
    finalScore && finalPairs
      ? (finalScore.a > finalScore.b ? finalPairs[0] : finalPairs[1])
          .map((p) => names[p])
          .join(" y ")
      : null;

  function inscribir() {
    if (!nombreLimpio || esDuplicado) return;
    setInscritos((prev) => [...prev, nombreLimpio]);
    setNuevoNombre("");
  }

  function quitar(index: number) {
    setInscritos((prev) => prev.filter((_, i) => i !== index));
  }

  function generate() {
    if (!canGenerate) return;
    const usableCourts = Math.min(courts, maxCourts(inscritos.length));
    setNames(inscritos);
    const roundsWanted = roundMode === "full" ? fullRounds : 6;
    setRounds(generateAmericano(inscritos.length, usableCourts, roundsWanted, seed));
    setDrafts({});
    setPlayoffDrafts({});
    setCurrentRound(0);
    setConfigOpen(false);
    setView("rounds");
  }

  function revolver() {
    const nextSeed = seed + 1;
    setSeed(nextSeed);
    const roundsWanted = roundMode === "full" ? fullRotationRounds(names.length, courts) : 6;
    setRounds(
      generateAmericano(names.length, Math.min(courts, maxCourts(names.length)), roundsWanted, nextSeed),
    );
    setDrafts({});
    setPlayoffDrafts({});
    setCurrentRound(0);
  }

  function simulateRemaining() {
    setDrafts((prev) => {
      const next = { ...prev };
      rounds.forEach((r, ridx) => {
        r.matches.forEach((_, mi) => {
          const key = `${ridx}-${mi}`;
          if (parseScore(next[key], pointsPerMatch)) return;
          const loser = Math.floor(Math.random() * pointsPerMatch); // 0..N-1: el ganador llega a N
          next[key] =
            Math.random() < 0.5
              ? { a: String(pointsPerMatch), b: String(loser) }
              : { a: String(loser), b: String(pointsPerMatch) };
        });
      });
      return next;
    });
  }

  type DraftSetter = Dispatch<SetStateAction<Record<string, ScoreDraft>>>;

  function setScore(setter: DraftSetter, key: string, side: "a" | "b", value: string) {
    const clean = value.replace(/[^0-9]/g, "").slice(0, 2);
    setter((prev) => ({ ...prev, [key]: { ...(prev[key] ?? { a: "", b: "" }), [side]: clean } }));
  }

  /** Botones +/− para capturar con una mano: tocar "+" hasta llegar al marcador. */
  function bump(setter: DraftSetter, key: string, side: "a" | "b", delta: number) {
    setter((prev) => {
      const cur = prev[key] ?? { a: "", b: "" };
      const from = cur[side] === "" ? 0 : Number(cur[side]);
      const to = Math.max(0, Math.min(pointsPerMatch, from + delta));
      return { ...prev, [key]: { ...cur, [side]: String(to) } };
    });
  }

  function teamNames(team: [number, number]) {
    return (
      <>
        {names[team[0]]}
        <br />
        {names[team[1]]}
      </>
    );
  }

  function scoreBox(
    map: Record<string, ScoreDraft>,
    setter: DraftSetter,
    key: string,
    side: "a" | "b",
  ) {
    const draft = map[key] ?? { a: "", b: "" };
    return (
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          className="h-12 w-10 px-0 text-lg"
          aria-label="quitar punto"
          onClick={() => bump(setter, key, side, -1)}
        >
          −
        </Button>
        <Input
          className="h-12 w-14 px-1 text-center text-xl font-semibold tabular-nums"
          inputMode="numeric"
          placeholder="0"
          value={draft[side]}
          onChange={(e) => setScore(setter, key, side, e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          className="h-12 w-10 px-0 text-lg"
          aria-label="agregar punto"
          onClick={() => bump(setter, key, side, 1)}
        >
          +
        </Button>
      </div>
    );
  }

  /** Partido de la eliminatoria (propuesta): misma captura que las rondas, llaves "po-*". */
  function renderPlayoffMatch(
    label: string,
    teamA: [number, number],
    teamB: [number, number],
    key: string,
  ) {
    const draft = playoffDrafts[key] ?? { a: "", b: "" };
    const score = parseScore(draft, pointsPerMatch);
    const invalid = scoreError(draft, pointsPerMatch);
    return (
      <div key={key} className="space-y-2 rounded-xl border p-3">
        <p className="text-center text-xs text-muted-foreground">{label}</p>
        <div className="flex items-baseline justify-between gap-2">
          <p className="min-w-0 flex-1 text-base font-semibold leading-snug">
            {teamNames(teamA)}
            {score && score.a > score.b && (
              <span className="block text-xs font-normal text-primary">ganaron</span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">vs</p>
          <p className="min-w-0 flex-1 text-right text-base font-semibold leading-snug">
            {teamNames(teamB)}
            {score && score.b > score.a && (
              <span className="block text-xs font-normal text-primary">ganaron</span>
            )}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          {scoreBox(playoffDrafts, setPlayoffDrafts, key, "a")}
          {scoreBox(playoffDrafts, setPlayoffDrafts, key, "b")}
        </div>
        {invalid && <p className="text-center text-xs text-destructive">{invalid}</p>}
      </div>
    );
  }

  return (
    <div className="demo-round-robin mx-auto max-w-2xl space-y-3 px-3 pb-28 pt-3 sm:space-y-6 sm:px-4 sm:py-8">
      {/* La preview de Vercel inyecta un boton flotante (vercel-live-feedback) que tapa
          controles del borde derecho en movil; se oculta solo en esta pagina de demo.
          Ademas: con el teclado abierto (input enfocado) la barra fija del sitio se oculta
          para no tapar el campo ni el boton; la regla solo vive en esta ruta. */}
      <style>{`vercel-live-feedback { display: none !important; }
body:has(.demo-round-robin :is(input, textarea):focus) [aria-label="Navegación principal"] { display: none !important; }`}</style>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-lg font-bold">Round robin individual</h1>
        <p className="text-xs text-muted-foreground">Demo ficticia · se reinicia al recargar</p>
      </div>

      {names.length > 0 && !configOpen ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
          <span className="font-medium">
            {names.length} jugadores · a {pointsPerMatch} puntos · {playedCount}/{totalMatches} con
            puntos
          </span>
          <span className="flex gap-3 text-muted-foreground">
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => setConfigOpen(true)}
            >
              Editar
            </button>
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={simulateRemaining}
            >
              Simular
            </button>
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => {
                setDrafts({});
                setPlayoffDrafts({});
              }}
            >
              Borrar
            </button>
            <button type="button" className="underline underline-offset-2" onClick={revolver}>
              Revolver
            </button>
          </span>
        </div>
      ) : (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Inscripción y formato</CardTitle>
          <CardDescription>
            Inscribe jugadores (4 a {MAX_PLAYERS}); las rondas salen de esta lista.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  inscribir();
                }
              }}
              placeholder="Nombre del jugador"
              className="h-12 text-base"
            />
            <Button
              type="button"
              className="h-12 px-5"
              onClick={inscribir}
              disabled={!nombreLimpio || esDuplicado}
            >
              Inscribir
            </Button>
          </div>
          {esDuplicado && (
            <p className="text-xs text-destructive">Ese nombre ya está inscrito.</p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="text-xs text-muted-foreground">
              {inscritos.length === 0
                ? "Sin inscritos todavía."
                : `${inscritos.length} ${inscritos.length === 1 ? "inscrito" : "inscritos"}`}
            </p>
            {rosterFromUrl.length > 0 && (
              <p className="text-xs text-muted-foreground">· precargada desde el enlace</p>
            )}
            {inscritos.length === 0 && (
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={() => setInscritos(DEFAULT_NAMES)}
              >
                Usar ejemplo de {DEFAULT_NAMES.length}
              </Button>
            )}
          </div>
          {inscritos.length > 0 && (
            <ul className="divide-y rounded-xl border">
              {inscritos.map((n, i) => (
                <li key={n} className="flex items-center justify-between gap-2 py-1 pl-3 pr-1">
                  <span className="text-sm font-medium">
                    <span className="text-muted-foreground">{i + 1}.</span> {n}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 w-9 px-0 text-muted-foreground"
                    aria-label={`Quitar a ${n}`}
                    onClick={() => quitar(i)}
                  >
                    ×
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {inscritos.length > 0 && inscritos.length < 4 && (
            <p className="text-xs text-destructive">Hacen falta al menos 4 inscritos.</p>
          )}
          {overLimit && (
            <p className="text-xs text-destructive">
              Esta prueba admite hasta {MAX_PLAYERS} inscritos; sobran{" "}
              {inscritos.length - MAX_PLAYERS}. Quita nombres para poder generar — ninguno se
              pierde de la lista.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Puntos por partido</p>
              <div className="flex gap-2">
                {POINT_OPTIONS.map((p) => (
                  <Button
                    key={p}
                    type="button"
                    variant={pointsPerMatch === p ? "default" : "outline"}
                    className="h-10 w-11 px-0"
                    onClick={() => setPointsPerMatch(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Gana el primero en llegar; sin empate.</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Canchas</p>
              <div className="flex gap-2">
                {Array.from({ length: maxCourts(previewCount) }, (_, i) => i + 1).map((c) => (
                  <Button
                    key={c}
                    type="button"
                    variant={courts === c ? "default" : "outline"}
                    className="h-10 w-11 px-0"
                    onClick={() => setCourts(c)}
                  >
                    {c}
                  </Button>
                ))}
              </div>
              {restingPerRound > 0 && (
                <p className="text-xs text-muted-foreground">{restingPerRound} descansan por ronda.</p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Rondas</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={roundMode === "full" ? "default" : "outline"}
                  className="h-10"
                  onClick={() => setRoundMode("full")}
                >
                  Completa ({fullRounds})
                </Button>
                {inscritos.length === 7 && courts === 1 && (
                  <Button
                    type="button"
                    variant={roundMode === "short" ? "default" : "outline"}
                    className="h-10"
                    onClick={() => setRoundMode("short")}
                  >
                    Corta (6)
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Completa = todos son compañeros de todos al menos una vez.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              className="h-12 flex-1 text-base"
              onClick={generate}
              disabled={!canGenerate}
            >
              {names.length > 0 ? "Regenerar" : "Generar rondas"}
            </Button>
            {names.length > 0 && (
              <>
                <Button type="button" variant="outline" className="h-12" onClick={simulateRemaining}>
                  Simular puntos
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12"
                  onClick={() => {
                    setDrafts({});
                    setPlayoffDrafts({});
                  }}
                >
                  Borrar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12"
                  onClick={revolver}
                >
                  Revolver
                </Button>
              </>
            )}
          </div>
          {names.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {names.length} jugadores · {rounds.length} rondas · {totalMatches} partidos ·{" "}
              {playedCount} con puntos.
            </p>
          )}
        </CardContent>
      </Card>
      )}

      {round && (
        <section className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant={view === "rounds" ? "default" : "outline"}
              className="h-10 text-sm"
              onClick={() => setView("rounds")}
            >
              Rondas
            </Button>
            <Button
              type="button"
              variant={view === "standings" ? "default" : "outline"}
              className="h-10 text-sm"
              onClick={() => setView("standings")}
            >
              Tabla
            </Button>
            <Button
              type="button"
              variant={view === "playoff" ? "default" : "outline"}
              className="h-10 text-sm"
              onClick={() => setView("playoff")}
            >
              Eliminatoria
            </Button>
          </div>
            {view === "rounds" ? (
              <>
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-12 w-12 px-0 text-xl"
                aria-label="ronda anterior"
                disabled={ri === 0}
                onClick={() => setCurrentRound(ri - 1)}
              >
                ‹
              </Button>
              <div className="text-center">
                <p className="text-lg font-bold">
                  Ronda {ri + 1} <span className="text-sm font-normal text-muted-foreground">de {rounds.length}</span>
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-12 px-0 text-xl"
                aria-label="ronda siguiente"
                disabled={ri >= rounds.length - 1}
                onClick={() => setCurrentRound(ri + 1)}
              >
                ›
              </Button>
            </div>

            <div className="space-y-3">
              {round.matches.map((match, mi) => {
                const key = `${ri}-${mi}`;
                const draft = drafts[key] ?? { a: "", b: "" };
                const score = parseScore(draft, pointsPerMatch);
                const invalid = scoreError(draft, pointsPerMatch);
                const partial = !score && !invalid && (draft.a !== "" || draft.b !== "");
                return (
                  <div key={key} className="space-y-2 rounded-xl border p-3">
                    <p className="text-center text-xs text-muted-foreground">Cancha {match.court}</p>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="min-w-0 flex-1 text-base font-semibold leading-snug">
                        {teamNames(match.teamA)}
                        {score && score.a > score.b && (
                          <span className="block text-xs font-normal text-primary">ganaron</span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">vs</p>
                      <p className="min-w-0 flex-1 text-right text-base font-semibold leading-snug">
                        {teamNames(match.teamB)}
                        {score && score.b > score.a && (
                          <span className="block text-xs font-normal text-primary">ganaron</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {scoreBox(drafts, setDrafts, key, "a")}
                      {scoreBox(drafts, setDrafts, key, "b")}
                    </div>
                    {partial && (
                      <p className="text-center text-xs text-muted-foreground">
                        Falta un lado del marcador para contar el partido.
                      </p>
                    )}
                    {invalid && <p className="text-center text-xs text-destructive">{invalid}</p>}
                  </div>
                );
              })}
            </div>

            {round.resting.length > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                Descansan: <span className="font-medium">{round.resting.map((p) => names[p]).join(", ")}</span>
              </p>
            )}

              </>
            ) : view === "standings" ? (
              <>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={sortMode === "total" ? "default" : "outline"}
                onClick={() => setSortMode("total")}
              >
                Puntos totales
              </Button>
              <Button
                type="button"
                size="sm"
                variant={sortMode === "average" ? "default" : "outline"}
                onClick={() => setSortMode("average")}
              >
                Promedio por partido
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">#</th>
                    <th className="py-2 pr-2 font-medium">Jugador</th>
                    <th className="py-2 pr-2 font-medium">PJ</th>
                    <th className="py-2 pr-2 font-medium">PG</th>
                    <th className="py-2 pr-2 font-medium">Puntos</th>
                    <th className="py-2 pr-2 font-medium">Dif</th>
                    <th className="py-2 font-medium">Prom</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row, i) => (
                    <tr key={row.player} className="border-b last:border-0">
                      <td className="py-2 pr-2 font-mono tabular-nums">{i + 1}</td>
                      <td className="py-2 pr-2 font-medium">{names[row.player]}</td>
                      <td className="py-2 pr-2 tabular-nums">{row.played}</td>
                      <td className="py-2 pr-2 tabular-nums">{row.wins}</td>
                      <td className="py-2 pr-2 tabular-nums">{row.points}</td>
                      <td className="py-2 pr-2 tabular-nums">
                        {row.diff > 0 ? `+${row.diff}` : row.diff}
                      </td>
                      <td className="py-2 tabular-nums">
                        {row.average != null ? row.average.toFixed(1) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Con descansos no todos juegan lo mismo: el total favorece a quien jugó más, el
              promedio nivela. Cuál define al ganador es una regla por elegir.
            </p>
              </>
            ) : (
              <>
                <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  Propuesta a prueba, reversible: las parejas salen balanceadas de la tabla (mejor
                  con peor clasificado; los empates se rompen como en la tabla: puntos, diferencia,
                  victorias). No es una regla confirmada; se puede cambiar.
                </p>
                {names.length < 4 ? (
                  <p className="text-sm text-muted-foreground">
                    Se necesitan al menos 4 inscritos para armar la eliminatoria.
                  </p>
                ) : !playoff ? null : (
                  <>
                    {playedCount < totalMatches && (
                      <p className="text-xs text-muted-foreground">
                        La tabla todavía tiene partidos sin puntos; las parejas usan el orden actual
                        y se recalculan solas al capturar.
                      </p>
                    )}
                    {playoff.mode === "semifinals" ? (
                      <>
                        {playoff.semifinals.map((m, i) =>
                          renderPlayoffMatch(m.label, m.teamA, m.teamB, poKey(`po-sf-${i}`, m.teamA, m.teamB)),
                        )}
                        {finalPairs ? (
                          renderPlayoffMatch("Final", finalPairs[0], finalPairs[1], poKey("po-final", finalPairs[0], finalPairs[1]))
                        ) : (
                          <p className="text-center text-sm text-muted-foreground">
                            La final se arma cuando las dos semifinales tengan marcador: cada pareja
                            ganadora avanza junta.
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Clasifican los 4 primeros de la tabla; con 8 o más habría semifinales.
                        </p>
                        {renderPlayoffMatch("Final", finalPairs![0], finalPairs![1], poKey("po-final", finalPairs![0], finalPairs![1]))}
                      </>
                    )}
                    {championNames && (
                      <p className="rounded-xl bg-primary/10 p-3 text-center text-base font-bold">
                        Campeones: {championNames}
                        {playedCount < totalMatches && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            Provisional: todavía faltan partidos de ronda por capturar.
                          </span>
                        )}
                      </p>
                    )}
                  </>
                )}
              </>
            )}
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        Prueba aislada en memoria; no usa el onboarding real. Sesión corta solo definida para 7;
        con otras cantidades se ofrece la rotación completa.{" "}
        <Link to="/torneos" className="font-semibold text-primary underline-offset-4 hover:underline">
          Volver a torneos
        </Link>
      </p>
    </div>
  );
                        }
