import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { computeStandings, drawGroupsByCategory, roundRobinRounds } from "@/lib/groups";
import { captureRowToSet, checkFinishedMatch } from "@/lib/match-result";
import { DEFAULT_SCORING, formatMatchScore } from "@/lib/scoring";
import type { Match, SetScore, UUID } from "@/types";

/**
 * DEMO AISLADA — investigación "round robins" (rama investigacion/round-robin).
 *
 * Todo corre en memoria con parejas ficticias: nada toca Supabase ni ningún
 * torneo real. La página existe para que Julian vea cómo se comporta el
 * formato antes de decidir si se construye en serio.
 *
 * Lo que la demo SÍ reutiliza del código real (eso es lo que se está
 * evaluando): roundRobinRounds (método del círculo), drawGroupsByCategory,
 * computeStandings (tabla con % de puntos estilo Excel) y checkFinishedMatch
 * (la misma regla que cierra partidos en Resultados).
 */

const DEMO_PAIRS = [
  "Ana / Luisa",
  "Marco / Beto",
  "Caro / Vero",
  "Diego / Rodo",
  "Pao / Fer",
  "Hugo / Iván",
  "Lupita / Gaby",
  "Nico / Alex",
  "Sofía / Vale",
  "Rafa / Chuy",
  "Monse / Dani",
  "Pepe / Toño",
];

type Mode = "single" | "groups";

interface ScoreDraft {
  s1: { a: string; b: string };
  s2: { a: string; b: string };
  stb: { a: string; b: string };
}

const emptyDraft = (): ScoreDraft => ({
  s1: { a: "", b: "" },
  s2: { a: "", b: "" },
  stb: { a: "", b: "" },
});

/** Genera los partidos de la demo con la MISMA lógica del sorteo real. */
function buildDemoMatches(pairIds: UUID[], mode: Mode): Match[] {
  const groups =
    mode === "single"
      ? [{ name: "Grupo único", pairIds }]
      : drawGroupsByCategory(
          pairIds.map((id) => ({ id, category_id: null, categoryName: "" })),
          () => 2,
        );
  let seq = 0;
  return groups.flatMap((g) =>
    roundRobinRounds(g.pairIds).flatMap((round, i) =>
      round.map(([a, b]) => {
        seq += 1;
        return {
          id: `demo-${seq}`,
          tournament_id: "demo",
          round: `${g.name} · J${i + 1}`,
          court_name: null,
          scheduled_at: null,
          status: "scheduled" as const,
          side_a: { pair_id: a, pair_name: "" },
          side_b: { pair_id: b, pair_name: "" },
          sets: [] as SetScore[],
          winner: null,
        } satisfies Match;
      }),
    ),
  );
}

/** Marcador ficticio pero realista para simular: 2 sets + súper TB si hace falta. */
function randomResult(): SetScore[] {
  const set = (): SetScore => {
    const loser = Math.floor(Math.random() * 5); // 0–4
    return Math.random() < 0.15
      ? { a: 7, b: 6, tiebreak_a: null, tiebreak_b: null }
      : { a: 6, b: loser, tiebreak_a: null, tiebreak_b: null };
  };
  const flip = (s: SetScore): SetScore => ({ a: s.b, b: s.a, tiebreak_a: null, tiebreak_b: null });
  const first = Math.random() < 0.5 ? set() : flip(set());
  const second = Math.random() < 0.5 ? set() : flip(set());
  const aWonFirst = first.a > first.b;
  const aWonSecond = second.a > second.b;
  if (aWonFirst === aWonSecond) return [first, second];
  // 1-1: súper tie-break a 10 con diferencia de 2
  const loserPts = Math.floor(Math.random() * 8); // 0–7
  const stb: SetScore =
    Math.random() < 0.5
      ? { a: 10, b: loserPts, tiebreak_a: null, tiebreak_b: null }
      : { a: loserPts, b: 10, tiebreak_a: null, tiebreak_b: null };
  return [first, second, stb];
}

export default function RoundRobinDemo() {
  const [pairCount, setPairCount] = useState(8);
  const [mode, setMode] = useState<Mode>("single");
  const [pairIds, setPairIds] = useState<UUID[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ScoreDraft>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});

  const nameById = useMemo(() => {
    const map: Record<string, string> = {};
    pairIds.forEach((id, i) => {
      map[id] = DEMO_PAIRS[i] ?? `Pareja ${i + 1}`;
    });
    return map;
  }, [pairIds]);

  const namedMatches = useMemo(
    () =>
      matches.map((m) => ({
        ...m,
        side_a: { ...m.side_a, pair_name: nameById[m.side_a.pair_id ?? ""] ?? "?" },
        side_b: { ...m.side_b, pair_name: nameById[m.side_b.pair_id ?? ""] ?? "?" },
      })),
    [matches, nameById],
  );

  const standings = useMemo(
    () => (pairIds.length > 0 ? computeStandings(pairIds, namedMatches, nameById) : []),
    [pairIds, namedMatches, nameById],
  );

  const played = namedMatches.filter((m) => m.winner != null).length;
  const jornadas = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of namedMatches) {
      map.set(m.round, [...(map.get(m.round) ?? []), m]);
    }
    return [...map.entries()];
  }, [namedMatches]);

  function generate(count: number, nextMode: Mode) {
    const ids = Array.from({ length: count }, (_, i) => `pair-${i + 1}`);
    setPairIds(ids);
    setMatches(buildDemoMatches(ids, nextMode));
    setDrafts({});
    setErrors({});
    setEditing({});
  }

  /** Corrección: reabre un partido ya guardado con su marcador precargado. */
  function startEdit(m: Match) {
    const row = (s: SetScore | undefined) => ({ a: s ? String(s.a ?? 0) : "", b: s ? String(s.b ?? 0) : "" });
    setDrafts((prev) => ({ ...prev, [m.id]: { s1: row(m.sets[0]), s2: row(m.sets[1]), stb: row(m.sets[2]) } }));
    setEditing((prev) => ({ ...prev, [m.id]: true }));
  }

  function saveResult(matchId: string) {
    const draft = drafts[matchId] ?? emptyDraft();
    const rows = [draft.s1, draft.s2, draft.stb].filter((r) => r.a !== "" || r.b !== "");
    const sets = rows.map((r) => captureRowToSet(r));
    const check = checkFinishedMatch(sets, DEFAULT_SCORING);
    if (!check.ok) {
      setErrors((prev) => ({ ...prev, [matchId]: check.error }));
      return;
    }
    setErrors((prev) => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId ? { ...m, sets: check.sets, winner: check.winner, status: "finished" as const } : m,
      ),
    );
    setEditing((prev) => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
  }

  function simulateRemaining() {
    setMatches((prev) =>
      prev.map((m) => {
        if (m.winner != null) return m;
        const sets = randomResult();
        const winner = checkFinishedMatch(sets, DEFAULT_SCORING);
        return winner.ok ? { ...m, sets, winner: winner.winner, status: "finished" as const } : m;
      }),
    );
    setDrafts({});
    setErrors({});
    setEditing({});
  }

  function clearResults() {
    setMatches((prev) => prev.map((m) => ({ ...m, sets: [], winner: null, status: "scheduled" as const })));
    setDrafts({});
    setErrors({});
    setEditing({});
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <Badge variant="secondary">Demo · datos ficticios</Badge>
        <h1 className="text-2xl font-bold">Round robin: cómo se comporta</h1>
        <p className="text-sm text-muted-foreground">
          Prototipo aislado de la investigación. Nada de lo que captures aquí se guarda en la app ni
          toca tus torneos. Usa la misma lógica real del sorteo y la tabla de posiciones.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Arma el torneo de prueba</CardTitle>
          <CardDescription>
            Generar de nuevo reinicia la demo y borra los resultados capturados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Número de parejas</p>
            <div className="flex flex-wrap gap-2">
              {[4, 5, 6, 7, 8, 9, 10, 12].map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant={pairCount === n ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPairCount(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Formato</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={mode === "single" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("single")}
              >
                Todos contra todos (1 grupo)
              </Button>
              <Button
                type="button"
                variant={mode === "groups" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("groups")}
              >
                2 grupos (como la fase actual)
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Decisión de diseño pendiente de tu OK: en "todos contra todos" el campeón sería el
              líder de la tabla al final, sin final. Con grupos se puede cerrar con eliminatoria
              como hoy o también por tabla.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => generate(pairCount, mode)}>
              {pairIds.length > 0 ? "Regenerar demo" : "Generar jornadas"}
            </Button>
            {pairIds.length > 0 && (
              <>
                <Button type="button" variant="outline" onClick={simulateRemaining}>
                  Simular resultados
                </Button>
                <Button type="button" variant="outline" onClick={clearResults}>
                  Borrar resultados
                </Button>
              </>
            )}
          </div>
          {pairIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {namedMatches.length} partidos en {jornadas.length} jornadas · {played} con resultado.
              Con {pairIds.length} parejas, todos contra todos son{" "}
              {(pairIds.length * (pairIds.length - 1)) / 2} partidos por grupo.
            </p>
          )}
        </CardContent>
      </Card>

      {pairIds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>2. Captura resultados por jornada</CardTitle>
            <CardDescription>
              Mismo formato que la app: Set 1, Set 2 y súper tie-break si hace falta. Valida con la
              regla real (2 sets ganados).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {jornadas.map(([round, ms]) => (
              <div key={round} className="space-y-3">
                <p className="text-sm font-semibold">{round}</p>
                <div className="space-y-2">
                  {ms.map((m) => {
                    const draft = drafts[m.id] ?? emptyDraft();
                    const setDraft = (setKey: keyof ScoreDraft, side: "a" | "b", value: string) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [m.id]: {
                          ...(prev[m.id] ?? emptyDraft()),
                          [setKey]: { ...(prev[m.id] ?? emptyDraft())[setKey], [side]: value.replace(/[^0-9]/g, "").slice(0, 2) },
                        },
                      }));
                    return (
                      <div key={m.id} className="rounded-xl border p-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          <div className="min-w-40 flex-1">
                            <p className="truncate text-sm font-medium">
                              {m.side_a.pair_name} <span className="text-muted-foreground">vs</span>{" "}
                              {m.side_b.pair_name}
                            </p>
                            {m.winner != null && (
                              <p className="text-xs text-muted-foreground">
                                {formatMatchScore(m.sets, DEFAULT_SCORING)} · ganó{" "}
                                {m.winner === "a" ? m.side_a.pair_name : m.side_b.pair_name}
                              </p>
                            )}
                          </div>
                          {m.winner != null && !editing[m.id] && (
                            <Button type="button" size="sm" variant="outline" onClick={() => startEdit(m)}>
                              Corregir
                            </Button>
                          )}
                          {(m.winner == null || editing[m.id]) && (
                            <div className="flex flex-wrap items-center gap-2">
                              {(["s1", "s2", "stb"] as const).map((setKey, idx) => (
                                <div key={setKey} className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground">
                                    {idx === 2 ? "STB" : `S${idx + 1}`}
                                  </span>
                                  <Input
                                    className="h-8 w-10 px-1 text-center text-sm"
                                    inputMode="numeric"
                                    value={draft[setKey].a}
                                    onChange={(e) => setDraft(setKey, "a", e.target.value)}
                                  />
                                  <span className="text-xs text-muted-foreground">-</span>
                                  <Input
                                    className="h-8 w-10 px-1 text-center text-sm"
                                    inputMode="numeric"
                                    value={draft[setKey].b}
                                    onChange={(e) => setDraft(setKey, "b", e.target.value)}
                                  />
                                </div>
                              ))}
                              <Button type="button" size="sm" variant="secondary" onClick={() => saveResult(m.id)}>
                                Guardar
                              </Button>
                            </div>
                          )}
                        </div>
                        {errors[m.id] && <p className="mt-2 text-xs text-destructive">{errors[m.id]}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {pairIds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>3. Tabla de posiciones en vivo</CardTitle>
            <CardDescription>
              Se recalcula sola con cada resultado, con el orden real de la liga (% de puntos,
              estilo Excel).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">#</th>
                    <th className="py-2 pr-2 font-medium">Pareja</th>
                    <th className="py-2 pr-2 font-medium">PJ</th>
                    <th className="py-2 pr-2 font-medium">PG</th>
                    <th className="py-2 pr-2 font-medium">Sets</th>
                    <th className="py-2 pr-2 font-medium">Pts a favor</th>
                    <th className="py-2 font-medium">% PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row) => (
                    <tr key={row.pairId} className="border-b last:border-0">
                      <td className="py-2 pr-2 font-mono tabular-nums">{row.jerarquia}</td>
                      <td className="py-2 pr-2 font-medium">{nameById[row.pairId]}</td>
                      <td className="py-2 pr-2 tabular-nums">{row.played}</td>
                      <td className="py-2 pr-2 tabular-nums">{row.won}</td>
                      <td className="py-2 pr-2 tabular-nums">
                        {row.setsFor}-{row.setsAgainst}
                      </td>
                      <td className="py-2 pr-2 tabular-nums">{row.pointsFor ?? 0}</td>
                      <td className="py-2 tabular-nums">
                        {row.pointsPercentage != null ? `${(row.pointsPercentage * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Qué se está probando aquí</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Las jornadas se generan con el método del círculo (el mismo del sorteo actual): cada
            pareja juega una vez contra todas y, con número impar (5, 7, 9), una descansa por jornada.
            Un resultado guardado se puede corregir con "Corregir" y la tabla se recalcula sola.
          </p>
          <p>
            La tabla usa el cálculo real de la liga: partidos ganados, dominio y % de puntos.
            Capturar un marcador inválido (por ejemplo 6-6 sin tie-break) muestra el mismo error
            que verías en Resultados.
          </p>
          <p>
            Lo que esta demo NO decide todavía: si el campeón sale directo de la tabla o si después
            de las jornadas hay eliminatoria, y si se necesitan modalidades con rotación de parejas
            (americano/mexicano), que serían otro modelo de datos.
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
