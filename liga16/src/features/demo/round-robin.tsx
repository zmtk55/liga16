import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  americanoStandings,
  fullRotationRounds,
  generateAmericano,
  maxCourts,
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
  const [namesText, setNamesText] = useState(DEFAULT_NAMES.join("\n"));
  const [courts, setCourts] = useState(1);
  const [pointsPerMatch, setPointsPerMatch] = useState(4);
  const [roundCount, setRoundCount] = useState(11);
  const [seed, setSeed] = useState(1);
  const [names, setNames] = useState<string[]>([]);
  const [rounds, setRounds] = useState<AmericanoRound[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ScoreDraft>>({});
  const [sortMode, setSortMode] = useState<AmericanoSortMode>("total");
  const [currentRound, setCurrentRound] = useState(0);

  const parsedNames = useMemo(
    () =>
      namesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, MAX_PLAYERS),
    [namesText],
  );
  const fullRounds = fullRotationRounds(parsedNames.length, courts);
  const restingPerRound = parsedNames.length - courts * 4;

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

  function generate() {
    if (parsedNames.length < 4) return;
    const usableCourts = Math.min(courts, maxCourts(parsedNames.length));
    setNames(parsedNames);
    setRounds(generateAmericano(parsedNames.length, usableCourts, roundCount, seed));
    setDrafts({});
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

  function setScore(key: string, side: "a" | "b", value: string) {
    const clean = value.replace(/[^0-9]/g, "").slice(0, 2);
    setDrafts((prev) => ({ ...prev, [key]: { ...(prev[key] ?? { a: "", b: "" }), [side]: clean } }));
  }

  /** Botones +/− para capturar con una mano: tocar "+" hasta llegar al marcador. */
  function bump(key: string, side: "a" | "b", delta: number) {
    setDrafts((prev) => {
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

  function scoreBox(key: string, side: "a" | "b") {
    const draft = drafts[key] ?? { a: "", b: "" };
    return (
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          className="h-12 w-10 px-0 text-lg"
          aria-label="quitar punto"
          onClick={() => bump(key, side, -1)}
        >
          −
        </Button>
        <Input
          className="h-12 w-14 px-1 text-center text-xl font-semibold tabular-nums"
          inputMode="numeric"
          placeholder="0"
          value={draft[side]}
          onChange={(e) => setScore(key, side, e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          className="h-12 w-10 px-0 text-lg"
          aria-label="agregar punto"
          onClick={() => bump(key, side, 1)}
        >
          +
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-3 py-4 sm:space-y-6 sm:px-4 sm:py-8">
      <div className="space-y-1">
        <Badge variant="secondary">Demo · datos ficticios</Badge>
        <h1 className="text-xl font-bold sm:text-2xl">Round robin individual (dobles rotativos)</h1>
        <p className="text-sm text-muted-foreground">
          Nombres, rondas con compañeros que rotan y tabla individual. Nada se guarda; se reinicia
          al recargar.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">1. Nombres y formato</CardTitle>
          <CardDescription>Un nombre por línea (4 a {MAX_PLAYERS}).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={namesText}
            onChange={(e) => setNamesText(e.target.value)}
            rows={7}
            className="text-base"
          />
          {parsedNames.length > 0 && parsedNames.length < 4 && (
            <p className="text-xs text-destructive">Hacen falta al menos 4 nombres.</p>
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
                {Array.from({ length: maxCourts(parsedNames.length) }, (_, i) => i + 1).map((c) => (
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
                  variant={roundCount === fullRounds ? "default" : "outline"}
                  className="h-10"
                  onClick={() => setRoundCount(fullRounds)}
                >
                  Completa ({fullRounds})
                </Button>
                {parsedNames.length === 7 && courts === 1 && (
                  <Button
                    type="button"
                    variant={roundCount === 6 ? "default" : "outline"}
                    className="h-10"
                    onClick={() => setRoundCount(6)}
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
              disabled={parsedNames.length < 4}
            >
              {names.length > 0 ? "Regenerar" : "Generar rondas"}
            </Button>
            {names.length > 0 && (
              <>
                <Button type="button" variant="outline" className="h-12" onClick={simulateRemaining}>
                  Simular puntos
                </Button>
                <Button type="button" variant="outline" className="h-12" onClick={() => setDrafts({})}>
                  Borrar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12"
                  onClick={() => {
                    setSeed((s) => s + 1);
                    setRounds(
                      generateAmericano(
                        names.length,
                        Math.min(courts, maxCourts(names.length)),
                        roundCount,
                        seed + 1,
                      ),
                    );
                    setDrafts({});
                    setCurrentRound(0);
                  }}
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

      {round && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">2. Rondas y puntos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                      {scoreBox(key, "a")}
                      {scoreBox(key, "b")}
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

            {ri < rounds.length - 1 && (
              <Button
                type="button"
                variant="secondary"
                className="h-12 w-full text-base"
                onClick={() => setCurrentRound(ri + 1)}
              >
                Siguiente ronda ›
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {names.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">3. Tabla individual en vivo</CardTitle>
            <CardDescription>Cada jugador suma los puntos que hizo su equipo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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
              Ojo: con descansos no todos juegan la misma cantidad de partidos. El total favorece a
              quien jugó más; el promedio nivela la cantidad (no la fuerza de los rivales). Cuál
              define al ganador es una regla por elegir.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Qué se está probando aquí</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            El formato de las apps de americano: nombres, rondas de dobles con compañeros rotativos
            y tabla individual. Con 7 jugadores y 1 cancha, la rotación completa son 11 rondas:
            todos son compañeros de todos con una sola pareja repetida (el mínimo posible), nadie
            descansa dos rondas seguidas y todos juegan 6 o 7 partidos.
          </p>
          <p>
            Lo que NO decide esta demo: si el torneo vale por total o por promedio, cómo se forman
            las parejas de semis y finales, y qué pasa si alguien se va a mitad.
          </p>
          <p>
            <Link to="/torneos" className="font-semibold text-primary underline-offset-4 hover:underline">
              Volver a torneos
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
