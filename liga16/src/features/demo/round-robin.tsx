import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
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
  // Tras inscribir, el foco vuelve solo al campo (pedido de Julian: capturar
  // varios nombres seguidos sin re-tocar el input ni perder el teclado).
  const nombreInputRef = useRef<HTMLInputElement>(null);
  // Chip de configuración abierto (canchas / meta / rondas), estilo la app de
  // referencia: la configuración se resume en chips y se despliega al tocar.
  const [chipOpen, setChipOpen] = useState<"canchas" | "rondas" | null>(null);
  const [courts, setCourts] = useState(restored?.courts ?? 1);
  // Meta de referencia interna: solo se usa para simular marcadores plausibles;
  // no hay selector en pantalla (el marcador es libre y el empate vale).
  const [pointsPerMatch] = useState(restored?.pointsPerMatch ?? 4);
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

  // Acepta un nombre o una LISTA pegada (separada por comas o renglones),
  // como la app de referencia ("Type a player or paste a list"): la alta
  // completa queda en segundos. Duplicados y vacíos se omiten.
  function inscribir() {
    const entrantes = nuevoNombre
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (entrantes.length === 0) return;
    setInscritos((prev) => {
      const next = [...prev];
      for (const n of entrantes) {
        if (n.length <= 30 && !next.some((x) => x.toLowerCase() === n.toLowerCase())) next.push(n);
      }
      return next;
    });
    setNuevoNombre("");
    nombreInputRef.current?.focus();
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
          // Marcadores plausibles alrededor de una referencia interna, cerrados.
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

  /** Cierre/apertura explícita del partido: cerrado cuenta en la tabla.
      Un lado sin tocar vale 0 al cerrar (el casillero ya muestra 0): así un
      4-0 se cierra sin obligar a capturar el cero a una mano en cancha. */
  function toggleDone(setter: DraftSetter, key: string, onWrite?: () => void) {
    onWrite?.();
    setter((prev) => {
      const cur = prev[key] ?? { a: "", b: "" };
      if (cur.done) return { ...prev, [key]: { ...cur, done: false } };
      return {
        ...prev,
        [key]: { a: cur.a === "" ? "0" : cur.a, b: cur.b === "" ? "0" : cur.b, done: true },
      };
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
          className="h-12 w-10 rounded-xl px-0 text-xl"
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
          className="h-12 w-[3.25rem] rounded-xl px-1 text-center text-xl font-bold tabular-nums"
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
          className="h-12 w-10 rounded-xl px-0 text-xl"
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
      <div key={key} className="space-y-3 rounded-2xl border bg-card p-4">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 break-words text-lg font-bold leading-tight">
            {teamNames(teamA)}
            {score && score.a > score.b && (
              <span className="block text-xs font-semibold text-primary">ganaron</span>
            )}
          </p>
          <p className="pt-1 text-xs font-medium text-muted-foreground">vs</p>
          <p className="min-w-0 flex-1 break-words text-right text-lg font-bold leading-tight">
            {teamNames(teamB)}
            {score && score.b > score.a && (
              <span className="block text-xs font-semibold text-primary">ganaron</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {scoreBox({ ...playoffDrafts, [key]: draft }, setPlayoffDrafts, key, "a", markWrite, draft.done)}
          {scoreBox({ ...playoffDrafts, [key]: draft }, setPlayoffDrafts, key, "b", markWrite, draft.done)}
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            className={
              draft.done
                ? "rounded-lg border px-5 py-2 text-sm font-medium"
                : "rounded-lg bg-primary px-6 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40"
            }
            disabled={!draft.done && draft.a.trim() === "" && draft.b.trim() === ""}
            onClick={() => toggleDone(setPlayoffDrafts, key, markWrite)}
          >
            {draft.done ? "Corregir" : "Terminar"}
          </button>
          {status === "playing" && (
            <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
              En juego
            </span>
          )}
          {score && score.a === score.b && (
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              Empate: defínanlo
            </span>
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
            {names.length} jugadores · {playedCount}/
            {totalMatches} terminados
          </span>
          <span className="flex items-center gap-3 text-muted-foreground">
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => setConfigOpen(true)}
            >
              Editar
            </button>
            <details className="relative">
              <summary className="cursor-pointer select-none underline underline-offset-2">
                Opciones
              </summary>
              <span className="absolute right-0 top-full z-20 mt-1 flex min-w-36 flex-col rounded-xl border bg-popover p-1 shadow-lg">
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-left"
                  onClick={simulateRemaining}
                >
                  Simular puntos
                </button>
                <button type="button" className="rounded-lg px-3 py-2 text-left" onClick={clearDemo}>
                  Borrar marcadores
                </button>
                <button type="button" className="rounded-lg px-3 py-2 text-left" onClick={revolver}>
                  Revolver sorteo
                </button>
              </span>
            </details>
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Configuración resumida en chips (como la app de referencia): se
              toca un chip y se elige; nada de formularios largos. */}
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <button
                type="button"
                className="rounded-lg border bg-card px-3 py-1.5 text-sm font-medium"
                onClick={() => setChipOpen(chipOpen === "canchas" ? null : "canchas")}
              >
                {courts} {courts === 1 ? "cancha" : "canchas"}
              </button>
              {chipOpen === "canchas" && (
                <div className="absolute left-0 top-full z-20 mt-1 min-w-36 rounded-xl border bg-popover p-1 shadow-lg">
                  {Array.from({ length: maxCourts(previewCount) }, (_, i) => i + 1).map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                        courts === c ? "font-bold text-primary" : ""
                      }`}
                      onClick={() => {
                        setCourts(c);
                        setChipOpen(null);
                      }}
                    >
                      {c} {c === 1 ? "cancha" : "canchas"}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                className="rounded-lg border bg-card px-3 py-1.5 text-sm font-medium"
                onClick={() => setChipOpen(chipOpen === "rondas" ? null : "rondas")}
              >
                {roundMode === "full" ? `Completa (${fullRounds})` : "Corta (6)"}
              </button>
              {chipOpen === "rondas" && (
                <div className="absolute left-0 top-full z-20 mt-1 min-w-52 rounded-xl border bg-popover p-1 shadow-lg">
                  <button
                    type="button"
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                      roundMode === "full" ? "font-bold text-primary" : ""
                    }`}
                    onClick={() => {
                      setRoundMode("full");
                      setChipOpen(null);
                    }}
                  >
                    Completa ({fullRounds}): todos con todos
                  </button>
                  {inscritos.length === 7 && courts === 1 && (
                    <button
                      type="button"
                      className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                        roundMode === "short" ? "font-bold text-primary" : ""
                      }`}
                      onClick={() => {
                        setRoundMode("short");
                        setChipOpen(null);
                      }}
                    >
                      Corta (6): sin repetir compañero
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Lista de inscritos: renglones con botón rojo de quitar, como la
              referencia. */}
          {inscritos.length > 0 && (
            <ul className="space-y-1">
              {inscritos.map((n, i) => (
                <li
                  key={n}
                  className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 py-1.5 pl-4 pr-2"
                >
                  <span className="min-w-0 truncate text-sm font-medium">{n}</span>
                  <button
                    type="button"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-lg leading-none text-white"
                    aria-label={`Quitar a ${n}`}
                    onClick={() => quitar(i)}
                  >
                    −
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span
              className={
                overLimit || (inscritos.length > 0 && inscritos.length < 4)
                  ? "font-medium text-red-600 dark:text-red-400"
                  : "text-muted-foreground"
              }
            >
              {overLimit
                ? `Máximo ${MAX_PLAYERS}: quita ${inscritos.length - MAX_PLAYERS} (ninguno se pierde)`
                : inscritos.length < 4
                  ? "Inscribe al menos 4 jugadores"
                  : restingPerRound > 0
                    ? `Listo · descansan ${restingPerRound} por ronda`
                    : "Listo para armar las rondas"}
            </span>
            <span className="shrink-0 text-muted-foreground">
              {inscritos.length} {inscritos.length === 1 ? "jugador" : "jugadores"}
            </span>
          </div>

          <div className="flex gap-2">
            <Input
              ref={nombreInputRef}
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  inscribir();
                }
              }}
              placeholder="Escribe un nombre"
              className="h-12 flex-1 rounded-xl text-base"
            />
            <Button
              type="button"
              className="h-12 w-12 rounded-xl px-0 text-xl"
              onClick={inscribir}
              disabled={!nombreLimpio}
              aria-label="Inscribir"
            >
              +
            </Button>
          </div>
          {esDuplicado && (
            <p className="text-xs text-red-600 dark:text-red-400">Ese nombre ya está inscrito.</p>
          )}
          {rosterFromUrl.length > 0 && inscritos.length > 0 && (
            <p className="text-xs text-muted-foreground">Lista precargada desde el enlace.</p>
          )}

          <Button
            type="button"
            className="h-14 w-full rounded-xl text-base font-extrabold uppercase tracking-wide"
            onClick={generate}
            disabled={!canGenerate}
          >
            {names.length > 0 ? "Regenerar rondas" : "¡Empezar!"}
          </Button>

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none font-medium">Opciones</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {inscritos.length === 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInscritos(DEFAULT_NAMES)}
                >
                  Usar ejemplo de {DEFAULT_NAMES.length}
                </Button>
              )}
              {names.length > 0 && (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={simulateRemaining}>
                    Simular puntos
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDrafts({});
                      setPlayoffDrafts({});
                      setPlayoffKeys({});
                    }}
                  >
                    Borrar marcadores
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={revolver}>
                    Revolver sorteo
                  </Button>
                </>
              )}
            </div>
          </details>
          {names.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {names.length} jugadores · {rounds.length} rondas · {totalMatches} partidos ·{" "}
              {playedCount} terminados.
            </p>
          )}
        </div>
      )}

      {round && (
        <section className="space-y-3">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
            {(
              [
                ["rounds", "Rondas"],
                ["standings", "Tabla"],
                ["playoff", "Eliminatoria"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                  view === v ? "bg-background font-bold shadow-sm" : "text-muted-foreground"
                }`}
                onClick={() => setView(v)}
              >
                {label}
              </button>
            ))}
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
                  <div key={key} className="space-y-3 rounded-2xl border bg-card p-4">
                    <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Cancha {match.court}
                    </p>
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 break-words text-lg font-bold leading-tight">
                        {teamNames(match.teamA)}
                        {score && score.a > score.b && (
                          <span className="block text-xs font-semibold text-primary">ganaron</span>
                        )}
                      </p>
                      <p className="pt-1 text-xs font-medium text-muted-foreground">vs</p>
                      <p className="min-w-0 flex-1 break-words text-right text-lg font-bold leading-tight">
                        {teamNames(match.teamB)}
                        {score && score.b > score.a && (
                          <span className="block text-xs font-semibold text-primary">ganaron</span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                      {scoreBox(drafts, setDrafts, key, "a", undefined, draft.done)}
                      {scoreBox(drafts, setDrafts, key, "b", undefined, draft.done)}
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        className={
                          draft.done
                            ? "rounded-lg border px-5 py-2 text-sm font-medium"
                            : "rounded-lg bg-primary px-6 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40"
                        }
                        disabled={!draft.done && draft.a.trim() === "" && draft.b.trim() === ""}
                        onClick={() => toggleDone(setDrafts, key)}
                      >
                        {draft.done ? "Corregir" : "Terminar"}
                      </button>
                      {status === "playing" && (
                        <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                          En juego
                        </span>
                      )}
                      {score && score.a === score.b && (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                          Empate
                        </span>
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
            <div className="grid w-56 grid-cols-2 gap-1 rounded-xl bg-muted p-1">
              {(
                [
                  ["total", "Puntos"],
                  ["average", "Promedio"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  className={`rounded-lg py-1.5 text-xs font-medium transition-colors ${
                    sortMode === v ? "bg-background font-bold shadow-sm" : "text-muted-foreground"
                  }`}
                  onClick={() => setSortMode(v)}
                >
                  {label}
                </button>
              ))}
            </div>
            <ul className="space-y-1.5">
              {standings.map((row, i) => (
                <li
                  key={row.player}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                    i === 0 ? "border border-primary/40 bg-primary/10" : "bg-muted/50"
                  }`}
                >
                  <span className="w-5 shrink-0 text-sm font-bold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {names[row.player]}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      PJ {row.played} · PG {row.wins} · dif {row.diff > 0 ? `+${row.diff}` : row.diff}
                    </span>
                  </span>
                  <span className="text-2xl font-extrabold tabular-nums">
                    {sortMode === "average"
                      ? row.average != null
                        ? row.average.toFixed(1)
                        : "—"
                      : row.points}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Con descansos no todos juegan lo mismo: el total favorece a quien jugó más, el
              promedio nivela. Cuál define al ganador es una regla por elegir.
            </p>
              </>
            ) : (
              <>
                <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  Propuesta a prueba, reversible: parejas balanceadas desde la tabla. No es una
                  regla confirmada; se puede cambiar.
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

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          Prueba aislada · el avance se guarda solo en este navegador ·{" "}
          <Link
            to="/torneos"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Volver a torneos
          </Link>
        </p>
        <details>
          <summary className="cursor-pointer select-none">Más sobre esta prueba</summary>
          <p className="mt-1">
            Nada se sube a ningún lado ni toca los torneos reales. Sesión corta solo definida
            para 7 jugadores y 1 cancha; con otras cantidades se ofrece la rotación completa.
          </p>
        </details>
      </div>
    </div>
  );
                }
