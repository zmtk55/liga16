import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AMERICANO_DEMO_STORAGE_KEY,
  americanoStandings,
  fullRotationRounds,
  generateAmericano,
  maxCourts,
  parseAmericanoDemo,
  playoffFinalPairs,
  proposePlayoffPairs,
  serializeAmericanoDemo,
  validateAmericanoScore,
  type AmericanoDemoSnapshot,
  type AmericanoRound,
  type AmericanoSortMode,
} from "@/lib/americano";

/**
 * DEMO AISLADA — round robin INDIVIDUAL con dobles de compañero rotativo
 * (rama investigacion/round-robin). Nombres ficticios: nada toca Supabase
 * ni ningún torneo real. El avance se guarda SOLO en el localStorage de
 * este navegador, para que un refresco accidental no borre el partido.
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
 * Reglas de captura (ajustadas por Julian el 18-nov-2026): marcador libre
 * de enteros no negativos, sin obligar a llegar a N ni a una suma fija; el
 * partido se CIERRA con "Terminar" (un 2-2 también puede ser final y el
 * empate es válido). Los puntos configurados son solo referencia. Cada
 * jugador suma los puntos que anotó su equipo (así un 4-0 vale más que un
 * 3-1). Sin compensación por descanso: la tabla se puede ordenar por total
 * o por promedio por partido para ver el efecto.
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
  /** El partido solo cuenta en la tabla cuando se cierra con "Terminar". */
  done?: boolean;
}

/** CSS local de la página (ver className "demo-round-robin" en la raíz). */
const DEMO_STYLE = `vercel-live-feedback { display: none !important; }
body:has(.demo-round-robin :is(input, textarea):focus) [aria-label="Navegación principal"] { display: none !important; }
/* Un jalón hacia abajo en el tope ya no dispara el refresco de Chrome
   (reportado por Julian: recargar borraba todo). El scroll normal sigue
   igual: solo se corta el gesto de overscroll, no el desplazamiento. */
html:has(.demo-round-robin), body:has(.demo-round-robin) { overscroll-behavior-y: contain; }`;

interface StoredDemo {
  snapshot: AmericanoDemoSnapshot | null;
  corrupt: boolean;
  available: boolean;
}

/** Lee el respaldo una sola vez; nunca truena aunque el storage falle. */
function readStoredDemo(): StoredDemo {
  try {
    const text = window.localStorage.getItem(AMERICANO_DEMO_STORAGE_KEY);
    // Sonda de escritura: getItem puede funcionar aunque setItem falle
    // (modo privado / cuota), y el aviso honesto se decide aquí al cargar.
    window.localStorage.setItem("liga16-demo-rr-sonda", "1");
    window.localStorage.removeItem("liga16-demo-rr-sonda");
    if (text === null) return { snapshot: null, corrupt: false, available: true };
    const snapshot = parseAmericanoDemo(text);
    return { snapshot, corrupt: snapshot === null, available: true };
  } catch {
    return { snapshot: null, corrupt: false, available: false };
  }
}

function parseScore(draft: ScoreDraft | undefined): { a: number; b: number } | null {
  if (!draft || !draft.done || draft.a.trim() === "" || draft.b.trim() === "") return null;
  const check = validateAmericanoScore(Number(draft.a), Number(draft.b));
  return check.ok ? check.score : null;
}

type ScoreStatus = "empty" | "playing" | "final" | { error: string };

/**
 * Estado del marcador para MOSTRAR: sin marcador, EN JUEGO (cualquier
 * captura no cerrada, incluido un 2-2 que sigue abierto) o FINAL (cerrado
 * con "Terminar"; el empate es un final válido). Ya no hay error por "no
 * llegar a N": los puntos configurados son solo referencia. El único error
 * posible es cerrar sin ambos lados. Contar en la tabla sigue igual: solo
 * un marcador cerrado y válido suma puntos/PJ (parseScore).
 */
function scoreStatus(draft: ScoreDraft | undefined): ScoreStatus {
  if (!draft || (draft.a.trim() === "" && draft.b.trim() === "")) return "empty";
  if (!draft.done) return "playing";
  if (draft.a.trim() === "" || draft.b.trim() === "") {
    return { error: "Marca ambos lados para cerrar el partido." };
  }
  const check = validateAmericanoScore(Number(draft.a), Number(draft.b));
  return check.ok ? "final" : { error: check.error };
}

export default function RoundRobinDemo() {
  // La lista puede venir precargada desde la inscripcion: /demo/round-robin?jugadores=Ana,Beto,...
  const [searchParams] = useSearchParams();
  const rosterFromUrl = (searchParams.get("jugadores") ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  // Si la URL trae ?jugadores=... es un inicio NUEVO explícito y manda sobre
  // lo guardado; si no, se restaura el avance de este navegador tal cual
  // quedó (misma lista, mismas rondas y marcadores, nada se regenera).
  const [stored] = useState<StoredDemo>(readStoredDemo);
  const restored = rosterFromUrl.length === 0 ? stored.snapshot : null;
  const [inscritos, setInscritos] = useState<string[]>(restored?.inscritos ?? rosterFromUrl);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [courts, setCourts] = useState(restored?.courts ?? 1);
  const [pointsPerMatch, setPointsPerMatch] = useState(restored?.pointsPerMatch ?? 4);
  const [roundMode, setRoundMode] = useState<"full" | "short">(restored?.roundMode ?? "full");
  const [seed, setSeed] = useState(restored?.seed ?? 1);
  const [names, setNames] = useState<string[]>(restored?.names ?? []);
  const [rounds, setRounds] = useState<AmericanoRound[]>(restored?.rounds ?? []);
  const [drafts, setDrafts] = useState<Record<string, ScoreDraft>>(restored?.drafts ?? {});
  const [sortMode, setSortMode] = useState<AmericanoSortMode>(restored?.sortMode ?? "total");
  const [currentRound, setCurrentRound] = useState(restored?.currentRound ?? 0);
  const [configOpen, setConfigOpen] = useState(restored?.configOpen ?? true);
  const [view, setView] = useState<"rounds" | "standings" | "playoff">(restored?.view ?? "rounds");
  const [saveWarning] = useState<string | null>(
    stored.available
      ? stored.corrupt
        ? "No se pudo leer el avance guardado (datos dañados); se empezó de cero."
        : null
      : "Este navegador no permite guardar el avance: al recargar se perderá.",
  );
  // Marcadores de la eliminatoria (propuesta), llaveados por posición
  // ("po-sf-0", "po-final"); playoffKeys guarda con QUÉ parejas se capturó
  // cada marcador: si las parejas cambian, el marcador deja de ser válido.
  const [playoffDrafts, setPlayoffDrafts] = useState<Record<string, ScoreDraft>>(
    restored?.playoffDrafts ?? {},
  );
  const [playoffKeys, setPlayoffKeys] = useState<Record<string, string>>(
    restored?.playoffKeys ?? {},
  );

  // Guarda el estado COMPLETO tras cada cambio, para que recargar o cerrar
  // y reabrir la URL lo restaure tal cual. El efecto corre después del
  // render, así que lo que se guarda ya incluye la poda de marcadores de la
  // eliminatoria invalidados: un refresco NO puede resucitarlos.
  const skipFirstSave = useRef(true);
  useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      if (restored) return; // lo restaurado ya está en el storage; no reescribir
    }
    const snapshot: AmericanoDemoSnapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      inscritos,
      courts,
      pointsPerMatch,
      roundMode,
      seed,
      names,
      rounds,
      drafts,
      sortMode,
      currentRound,
      configOpen,
      view,
      playoffDrafts,
      playoffKeys,
    };
    try {
      window.localStorage.setItem(AMERICANO_DEMO_STORAGE_KEY, serializeAmericanoDemo(snapshot));
    } catch {
      // Si el storage no sirve, el aviso ya se mostró al cargar (sonda).
    }
  }, [
    restored,
    inscritos,
    courts,
    pointsPerMatch,
    roundMode,
    seed,
    names,
    rounds,
    drafts,
    sortMode,
    currentRound,
    configOpen,
    view,
    playoffDrafts,
    playoffKeys,
  ]);

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
      const parsed = parseScore(draft);
      if (parsed) map[key] = parsed;
    }
    return map;
  }, [drafts]);

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
  // Huella de las parejas de cada llave: si la tabla (o el criterio
  // total/promedio) cambia y cambian las parejas, el marcador capturado para
  // las parejas anteriores deja de contar y se BORRA (no se restaura si las
  // parejas vuelven: una final invalidada queda vacía hasta nueva captura).
  function poKey(prefix: string, teamA: [number, number], teamB: [number, number]) {
    return `${prefix}-${teamA[0]}-${teamA[1]}-${teamB[0]}-${teamB[1]}`;
  }

  const currentPoKeys = useMemo(() => {
    const map: Record<string, string> = {};
    if (playoff) {
      playoff.semifinals.forEach((m, i) => {
        map[`po-sf-${i}`] = poKey(`po-sf-${i}`, m.teamA, m.teamB);
      });
    }
    return map;
  }, [playoff]);

  const sfScores = useMemo(
    () =>
      playoff
        ? playoff.semifinals.map((_, i) => {
            const key = `po-sf-${i}`;
            if (playoffKeys[key] !== currentPoKeys[key]) return null;
            return parseScore(playoffDrafts[key]);
          })
        : [],
    [playoff, playoffKeys, currentPoKeys, playoffDrafts],
  );
  const finalPairs = useMemo(
    () => (playoff ? playoffFinalPairs(playoff, sfScores) : null),
    [playoff, sfScores],
  );
  const finalKey = finalPairs ? poKey("po-final", finalPairs[0], finalPairs[1]) : null;
  const finalScore =
    finalKey && playoffKeys["po-final"] === finalKey
      ? parseScore(playoffDrafts["po-final"])
      : null;

  // Poda en render (patrón de estado derivado de React): en cuanto cambian
  // las parejas válidas, lo capturado para otras parejas se elimina; así una
  // final invalidada NO resucita si la combinación vuelve después.
  const validPo: Record<string, string> = { ...currentPoKeys };
  if (finalKey) validPo["po-final"] = finalKey;
  const validSig = `${JSON.stringify(currentPoKeys)}|${finalKey ?? ""}`;
  const [prunedSig, setPrunedSig] = useState("");
  if (prunedSig !== validSig) {
    setPrunedSig(validSig);
    setPlayoffDrafts((prev) => {
      const keys = Object.keys(prev);
      if (keys.every((k) => playoffKeys[k] === validPo[k])) return prev;
      const next: Record<string, ScoreDraft> = {};
      for (const k of keys) if (playoffKeys[k] === validPo[k]) next[k] = prev[k];
      return next;
    });
  }
  // Empate en la final: resultado válido en rondas, pero la eliminatoria
  // necesita un ganador; sin definir NO se declaran campeones.
  const championNames =
    finalScore && finalPairs && finalScore.a !== finalScore.b
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
    setPlayoffKeys({});
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
    setPlayoffKeys({});
    setCurrentRound(0);
  }

  function simulateRemaining() {
    setDrafts((prev) => {
      const next = { ...prev };
      rounds.forEach((r, ridx) => {
        r.matches.forEach((_, mi) => {
          const key = `${ridx}-${mi}`;
          if (parseScore(next[key])) return;
          // Marcadores plausibles alrededor de la meta de referencia, cerrados.
          const a = Math.floor(Math.random() * (pointsPerMatch + 1));
          const b = Math.floor(Math.random() * (pointsPerMatch + 1));
          next[key] = { a: String(a), b: String(b), done: true };
        });
      });
      return next;
    });
  }

  // Borrado EXPLÍCITO de los puntos capturados: además del estado limpia el
  // respaldo, para que lo borrado no reaparezca al recargar. La ronda
  // (quién juega con quién) se conserva; solo se limpian marcadores.
  function clearDemo() {
    setDrafts({});
    setPlayoffDrafts({});
    setPlayoffKeys({});
    try {
      window.localStorage.removeItem(AMERICANO_DEMO_STORAGE_KEY);
    } catch {
      // sin storage no hay nada que limpiar
    }
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
      const to = Math.max(0, Math.min(99, from + delta));
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

  /** Cierre/apertura explícita del partido: cerrado cuenta en la tabla. */
  function toggleDone(setter: DraftSetter, key: string, onWrite?: () => void) {
    onWrite?.();
    setter((prev) => {
      const cur = prev[key] ?? { a: "", b: "" };
      return { ...prev, [key]: { ...cur, done: !cur.done } };
    });
  }

  function scoreBox(
    map: Record<string, ScoreDraft>,
    setter: DraftSetter,
    key: string,
    side: "a" | "b",
    onWrite?: () => void,
    locked?: boolean,
  ) {
    const draft = map[key] ?? { a: "", b: "" };
    return (
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          className="h-12 w-10 px-0 text-lg"
          aria-label="quitar punto"
          disabled={locked}
          onClick={() => {
            onWrite?.();
            bump(setter, key, side, -1);
          }}
        >
          −
        </Button>
        <Input
          className="h-12 w-14 px-1 text-center text-xl font-semibold tabular-nums"
          inputMode="numeric"
          placeholder="0"
          disabled={locked}
          value={draft[side]}
          onChange={(e) => {
            onWrite?.();
            setScore(setter, key, side, e.target.value);
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="h-12 w-10 px-0 text-lg"
          aria-label="agregar punto"
          disabled={locked}
          onClick={() => {
            onWrite?.();
            bump(setter, key, side, 1);
          }}
        >
          +
        </Button>
      </div>
    );
  }

  /** Partido de la eliminatoria (propuesta): misma captura que las rondas.
      La llave es por posición y el marcador solo se muestra/cuenta si fue
      capturado para ESTAS parejas (huella en playoffKeys). */
  function renderPlayoffMatch(
    label: string,
    teamA: [number, number],
    teamB: [number, number],
    key: string,
  ) {
    const pairKey = poKey(key, teamA, teamB);
    const draft =
      playoffKeys[key] === pairKey ? (playoffDrafts[key] ?? { a: "", b: "" }) : { a: "", b: "" };
    const markWrite = () => setPlayoffKeys((prev) => ({ ...prev, [key]: pairKey }));
    const score = parseScore(draft);
    const status = scoreStatus(draft);
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
          {scoreBox({ ...playoffDrafts, [key]: draft }, setPlayoffDrafts, key, "a", markWrite, draft.done)}
          {scoreBox({ ...playoffDrafts, [key]: draft }, setPlayoffDrafts, key, "b", markWrite, draft.done)}
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            className="rounded-full border px-4 py-1 text-xs font-medium disabled:opacity-40"
            disabled={!draft.done && (draft.a.trim() === "" || draft.b.trim() === "")}
            onClick={() => toggleDone(setPlayoffDrafts, key, markWrite)}
          >
            {draft.done ? "Corregir" : "Terminar"}
          </button>
          {status === "playing" && (
            <span className="text-xs text-muted-foreground">En juego</span>
          )}
          {score && score.a === score.b && (
            <span className="text-xs text-muted-foreground">Empate: defínanlo</span>
          )}
        </div>
        {typeof status === "object" && (
          <p className="text-center text-xs text-red-600 dark:text-red-400">{status.error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="demo-round-robin mx-auto max-w-2xl space-y-3 px-3 pb-28 pt-3 sm:space-y-6 sm:px-4 sm:py-8">
      {/* La preview de Vercel inyecta un boton flotante (vercel-live-feedback) que tapa
          controles del borde derecho en movil; se oculta solo en esta pagina de demo.
          Ademas: con el teclado abierto (input enfocado) la barra fija del sitio se oculta
          para no tapar el campo ni el boton; la regla solo vive en esta ruta. */}
      <style>{DEMO_STYLE}</style>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-lg font-bold">Round robin individual</h1>
        <p className="text-xs text-muted-foreground">
          Demo ficticia · el avance se guarda solo en este navegador
        </p>
        {saveWarning && (
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{saveWarning}</p>
        )}
      </div>

      {names.length > 0 && !configOpen ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
          <span className="font-medium">
            {names.length} jugadores · meta {pointsPerMatch} (referencia) · {playedCount}/
            {totalMatches} terminados
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
              onClick={clearDemo}
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
            <p className="text-xs text-red-600 dark:text-red-400">Ese nombre ya está inscrito.</p>
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
            <p className="text-xs text-red-600 dark:text-red-400">Hacen falta al menos 4 inscritos.</p>
          )}
          {overLimit && (
            <p className="text-xs text-red-600 dark:text-red-400">
              Esta prueba admite hasta {MAX_PLAYERS} inscritos; sobran{" "}
              {inscritos.length - MAX_PLAYERS}. Quita nombres para poder generar — ninguno se
              pierde de la lista.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Puntos por partido (solo referencia)</p>
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
              <p className="text-xs text-muted-foreground">
                El marcador es libre: cierra el partido con Terminar; el empate también vale.
              </p>
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
                    setPlayoffKeys({});
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
              {playedCount} terminados.
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
                const score = parseScore(draft);
                const status = scoreStatus(draft);
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
                      {scoreBox(drafts, setDrafts, key, "a", undefined, draft.done)}
                      {scoreBox(drafts, setDrafts, key, "b", undefined, draft.done)}
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        className="rounded-full border px-4 py-1 text-xs font-medium disabled:opacity-40"
                        disabled={!draft.done && (draft.a.trim() === "" || draft.b.trim() === "")}
                        onClick={() => toggleDone(setDrafts, key)}
                      >
                        {draft.done ? "Corregir" : "Terminar"}
                      </button>
                      {status === "playing" && (
                        <span className="text-xs text-muted-foreground">En juego</span>
                      )}
                      {score && score.a === score.b && (
                        <span className="text-xs text-muted-foreground">Empate</span>
                      )}
                    </div>
                    {typeof status === "object" && (
                      <p className="text-center text-xs text-red-600 dark:text-red-400">
                        {status.error}
                      </p>
                    )}
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
                  victorias y, si persiste, orden de inscripción). No es una regla confirmada; se
                  puede cambiar.
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
                          renderPlayoffMatch(m.label, m.teamA, m.teamB, `po-sf-${i}`),
                        )}
                        {finalPairs ? (
                          renderPlayoffMatch("Final", finalPairs[0], finalPairs[1], "po-final")
                        ) : (
                          <p className="text-center text-sm text-muted-foreground">
                            La final se arma cuando las dos semifinales estén cerradas: cada pareja
                            ganadora avanza junta. Una semifinal empatada no avanza a nadie hasta
                            definirse.
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Clasifican los 4 primeros de la tabla; con 8 o más habría semifinales.
                        </p>
                        {renderPlayoffMatch("Final", finalPairs![0], finalPairs![1], "po-final")}
                      </>
                    )}
                    {finalScore && finalScore.a === finalScore.b && (
                      <p className="text-center text-xs text-muted-foreground">
                        Final empatada: defínanla (Corregir y ajustar) para tener campeones.
                      </p>
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
        Prueba aislada; el avance se guarda solo en este navegador (no se sube a ningún lado) y
        no usa el onboarding real. Sesión corta solo definida para 7; con otras cantidades se
        ofrece la rotación completa.{" "}
        <Link to="/torneos" className="font-semibold text-primary underline-offset-4 hover:underline">
          Volver a torneos
        </Link>
      </p>
    </div>
  );
}
