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
 * Reglas ELEGIDAS PARA ESTA PRUEBA (no son preferencia confirmada de nadie):
 * cada partido se juega a N puntos en total (los dos marcadores suman N,
 * como el americano clásico que describe Rallyano) y cada jugador se queda
 * con los puntos que anotó su equipo. Sin compensación por descanso: la tabla
 * se puede ordenar por total o por promedio por partido para ver el efecto.
 */

const DEFAULT_NAMES = ["Ana", "Beto", "Carla", "Diego", "Elena", "Fede", "Gaby"];
const POINT_OPTIONS = [16, 21, 24, 32];
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

/** Error visible cuando ambos lados están capturados pero no suman N. */
function scoreError(draft: ScoreDraft | undefined, pointsPerMatch: number): string | null {
  if (!draft || draft.a.trim() === "" || draft.b.trim() === "") return null;
  const check = validateAmericanoScore(Number(draft.a), Number(draft.b), pointsPerMatch);
  return check.ok ? null : check.error;
}

export default function RoundRobinDemo() {
  const [namesText, setNamesText] = useState(DEFAULT_NAMES.join("\n"));
  const [courts, setCourts] = useState(1);
  const [pointsPerMatch, setPointsPerMatch] = useState(21);
  const [roundCount, setRoundCount] = useState(11);
  const [seed, setSeed] = useState(1);
  const [names, setNames] = useState<string[]>([]);
  const [rounds, setRounds] = useState<AmericanoRound[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ScoreDraft>>({});
  const [sortMode, setSortMode] = useState<AmericanoSortMode>("total");

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

  function generate() {
    if (parsedNames.length < 4) return;
    const usableCourts = Math.min(courts, maxCourts(parsedNames.length));
    setNames(parsedNames);
    setRounds(generateAmericano(parsedNames.length, usableCourts, roundCount, seed));
    setDrafts({});
  }

  function simulateRemaining() {
    setDrafts((prev) => {
      const next = { ...prev };
      rounds.forEach((round, ri) => {
        round.matches.forEach((_, mi) => {
          const key = `${ri}-${mi}`;
          if (parseScore(next[key], pointsPerMatch)) return;
          const loser = Math.floor(Math.random() * Math.floor(pointsPerMatch / 2)); // 0..<N/2
          next[key] =
            Math.random() < 0.5
              ? { a: String(pointsPerMatch - loser), b: String(loser) }
              : { a: String(loser), b: String(pointsPerMatch - loser) };
        });
      });
      return next;
    });
  }

  function setScore(key: string, side: "a" | "b", value: string) {
    const clean = value.replace(/[^0-9]/g, "").slice(0, 2);
    setDrafts((prev) => ({ ...prev, [key]: { ...(prev[key] ?? { a: "", b: "" }), [side]: clean } }));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <Badge variant="secondary">Demo · datos ficticios</Badge>
        <h1 className="text-2xl font-bold">Round robin individual (dobles rotativos)</h1>
        <p className="text-sm text-muted-foreground">
          Escribes los nombres, se arman las rondas con compañeros que rotan y cada quien suma sus
          puntos en una tabla individual. Nada se guarda en la app ni toca tus torneos; se reinicia
          al recargar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Nombres y formato</CardTitle>
          <CardDescription>
            Un nombre por línea (4 a {MAX_PLAYERS}). Generar de nuevo borra los puntos capturados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={namesText}
            onChange={(e) => setNamesText(e.target.value)}
            rows={8}
            className="max-w-sm"
          />
          {parsedNames.length > 0 && parsedNames.length < 4 && (
            <p className="text-xs text-destructive">Hacen falta al menos 4 nombres.</p>
          )}
          <div className="space-y-2">
            <p className="text-sm font-medium">Canchas</p>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: maxCourts(parsedNames.length) }, (_, i) => i + 1).map((c) => (
                <Button
                  key={c}
                  type="button"
                  variant={courts === c ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCourts(c)}
                >
                  {c}
                </Button>
              ))}
            </div>
            {restingPerRound > 0 && (
              <p className="text-xs text-muted-foreground">
                Con {parsedNames.length} jugadores y {courts} cancha{courts > 1 ? "s" : ""},{" "}
                {restingPerRound} descansan por ronda (se turnan parejo).
              </p>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Puntos por partido</p>
            <div className="flex flex-wrap gap-2">
              {POINT_OPTIONS.map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={pointsPerMatch === p ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPointsPerMatch(p)}
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Rondas</p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="h-9 w-20 text-center"
                inputMode="numeric"
                value={String(roundCount)}
                onChange={(e) => {
                  const v = Number(e.target.value.replace(/[^0-9]/g, ""));
                  if (Number.isInteger(v) && v >= 1 && v <= 30) setRoundCount(v);
                  else if (e.target.value === "") setRoundCount(1);
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setRoundCount(fullRounds)}>
                Rotación completa ({fullRounds})
              </Button>
              {parsedNames.length === 7 && courts === 1 && (
                <Button type="button" variant="outline" size="sm" onClick={() => setRoundCount(6)}>
                  Sesión corta (6)
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Rotación completa = todos llegan a ser compañeros de todos al menos una vez. Con menos
              rondas, nadie repite compañero mientras se pueda evitar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={generate} disabled={parsedNames.length < 4}>
              {names.length > 0 ? "Regenerar demo" : "Generar rondas"}
            </Button>
            {names.length > 0 && (
              <>
                <Button type="button" variant="outline" onClick={simulateRemaining}>
                  Simular puntos
                </Button>
                <Button type="button" variant="outline" onClick={() => setDrafts({})}>
                  Borrar puntos
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSeed((s) => s + 1);
                    setRounds(generateAmericano(names.length, Math.min(courts, maxCourts(names.length)), roundCount, seed + 1));
                    setDrafts({});
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

      {names.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>2. Rondas y captura de puntos</CardTitle>
            <CardDescription>
              Regla de esta prueba: cada partido se juega a {pointsPerMatch} puntos en total, así
              que los dos marcadores deben sumar {pointsPerMatch} (13-8 vale, 21-14 no). La tabla se
              actualiza sola y puedes corregir cualquier marcador escribiendo de nuevo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {rounds.map((round, ri) => (
              <div key={ri} className="space-y-3">
                <p className="text-sm font-semibold">Ronda {ri + 1}</p>
                <div className="space-y-2">
                  {round.matches.map((match, mi) => {
                    const key = `${ri}-${mi}`;
                    const draft = drafts[key] ?? { a: "", b: "" };
                    const score = parseScore(draft, pointsPerMatch);
                    const invalid = scoreError(draft, pointsPerMatch);
                    const partial = !score && !invalid && (draft.a !== "" || draft.b !== "");
                    return (
                      <div key={key} className="rounded-xl border p-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          <div className="min-w-40 flex-1">
                            <p className="text-sm font-medium">
                              {names[match.teamA[0]]} &amp; {names[match.teamA[1]]}{" "}
                              <span className="text-muted-foreground">vs</span>{" "}
                              {names[match.teamB[0]]} &amp; {names[match.teamB[1]]}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Cancha {match.court}
                              {score
                                ? score.a === score.b
                                  ? " · empate"
                                  : ` · ganaron ${
                                      score.a > score.b
                                        ? `${names[match.teamA[0]]} & ${names[match.teamA[1]]}`
                                        : `${names[match.teamB[0]]} & ${names[match.teamB[1]]}`
                                    }`
                                : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              className="h-8 w-12 px-1 text-center text-sm"
                              inputMode="numeric"
                              placeholder="0"
                              value={draft.a}
                              onChange={(e) => setScore(key, "a", e.target.value)}
                            />
                            <span className="text-xs text-muted-foreground">-</span>
                            <Input
                              className="h-8 w-12 px-1 text-center text-sm"
                              inputMode="numeric"
                              placeholder="0"
                              value={draft.b}
                              onChange={(e) => setScore(key, "b", e.target.value)}
                            />
                          </div>
                        </div>
                        {partial && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Falta un lado del marcador para contar el partido.
                          </p>
                        )}
                        {invalid && <p className="mt-2 text-xs text-destructive">{invalid}</p>}
                      </div>
                    );
                  })}
                </div>
                {round.resting.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Descansan: {round.resting.map((p) => names[p]).join(", ")}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {names.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>3. Tabla individual en vivo</CardTitle>
            <CardDescription>
              Cada jugador suma los puntos que hizo su equipo en cada ronda.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Ordenar por:</span>
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
              quien jugó más; el promedio nivela. Cuál de las dos define al ganador es una regla por
              elegir — las apps de referencia usan el total y reparten los descansos lo más parejo
              posible (algunas dan puntos de compensación al que descansa).
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Qué se está probando aquí</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Este es el formato que usan las apps de americano: metes nombres, salen rondas de
            dobles con compañeros rotativos y una tabla individual por puntos. Con 7 jugadores y 1
            cancha, la rotación completa son 11 rondas: todos llegan a ser compañeros de todos con
            una sola pareja repetida (es el mínimo posible: con 7 no existe rotación perfecta sin
            repetir), y todos juegan 6 o 7 partidos.
          </p>
          <p>
            Reglas elegidas para esta prueba (no confirmadas): partido a N puntos en total (los
            marcadores suman N, como el americano clásico; con N par puede haber empate), cada
            jugador se queda con los puntos de su equipo, sin compensación por descanso. Todo se
            puede cambiar.
          </p>
          <p>
            Lo que NO decide esta demo: si el torneo vale por total o por promedio, qué pasa si
            alguien se va a mitad, y si se ofrece también mexicano (emparejar por la tabla en vez de
            rotación fija).
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
