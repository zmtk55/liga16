import { knockoutBracket } from "@/lib/americano-knockout";
import { firstBoxStage, secondBoxStage, validBoxCount, boxStageReady, boxGroupPlayers, boxStageScores } from "@/lib/americano-box";
import { validClubs, generateClubAmericano, nextClubMexicanoRound, clubTotals, type Club } from "@/lib/americano-clubs";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  esDinamica,
  esClub,
  esParejasFijas,
  esMix,
  generateMixAmericano,
  nextMixicanoRound,
  type Genero,
  generateTeamAmericano,
  nextTeamMexicanoRound,
  teamMexicanoTotalRounds,
  nextMexicanoRound,
  mexicanoRoundReady,
  mexicanoTotalRounds,
  type AmericanoModalidad,
  AMERICANO_DEMO_STORAGE_KEY,
  americanoStandings,
  deriveAppliedConfig,
  fullRotationRounds,
  generateAmericano,
  partnershipCoverage,
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
const MAX_PLAYERS = 16;

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
html:has(.demo-round-robin), body:has(.demo-round-robin) { overscroll-behavior-y: contain; }
/* Todo control habilitado muestra que se puede usar (cursor), y los
   inhabilitados lo niegan: affordance visible, no solo color. */
.demo-round-robin :is(button, [role="combobox"], summary, label:has(:not(:disabled) > input)):not(:disabled):not([data-disabled]) { cursor: pointer; }
.demo-round-robin :is(button, [role="combobox"]):disabled, .demo-round-robin [data-disabled] { cursor: not-allowed; }`;

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

export default function RoundRobinDemo({ embedded = false }: { embedded?: boolean }) {
  // La lista puede venir precargada desde la inscripcion: /demo/round-robin?jugadores=Ana,Beto,...
  const [searchParams] = useSearchParams();
  const rosterFromUrl = (searchParams.get("jugadores") ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  // La URL puede proponer inscritos nuevos, pero nunca borra una partida
  // guardada: solo se reemplaza al aplicar con confirmación de pérdida.
  const [stored] = useState<StoredDemo>(readStoredDemo);
  const restored = stored.snapshot;
  const [inscritos, setInscritos] = useState<string[]>(rosterFromUrl.length ? rosterFromUrl : restored?.inscritos ?? []);
  const [nuevoNombre, setNuevoNombre] = useState("");
  // Tras inscribir, el foco vuelve solo al campo (pedido de Julian: capturar
  // varios nombres seguidos sin re-tocar el input ni perder el teclado).
  const nombreInputRef = useRef<HTMLInputElement>(null);
  // Chip de configuración abierto (canchas / meta / rondas), estilo la app de
  // referencia: la configuración se resume en chips y se despliega al tocar.
  // Onboarding previo al juego: paso 1 = jugadores, paso 2 = canchas y modo.
  const [onbStep, setOnbStep] = useState<1 | 2>(1);
  const [confirmReset, setConfirmReset] = useState(false);
  const confirmRef = useRef<HTMLParagraphElement>(null);
  const routeRef = useRef<HTMLElement>(null);
  const gameRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (confirmReset) confirmRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [confirmReset]);
  const [courts, setCourts] = useState(restored?.courts ?? 1);
  // Meta de referencia interna: solo se usa para simular marcadores plausibles;
  // no hay selector en pantalla (el marcador es libre y el empate vale).
  const [pointsPerMatch] = useState(restored?.pointsPerMatch ?? 4);
  const [modalidad, setModalidad] = useState<AmericanoModalidad>(restored?.modalidad ?? "americano");
  const [generosDraft, setGenerosDraft] = useState<Record<string, Genero>>(() =>
    Object.fromEntries((restored?.names ?? []).flatMap((name, i) => restored?.generos?.[i] ? [[name, restored.generos[i]]] : [])),
  );
  const [appliedGeneros, setAppliedGeneros] = useState<Genero[]>(restored?.generos ?? []);
  const [clubsDraft, setClubsDraft] = useState<Record<string, Club>>(() =>
    Object.fromEntries((restored?.names ?? []).flatMap((name, i) => restored?.clubs?.[i] ? [[name, restored.clubs[i]]] : [])),
  );
  const [appliedClubs, setAppliedClubs] = useState<Club[]>(restored?.clubs ?? []);
  const [roundMode, setRoundMode] = useState<"full" | "short">(restored?.roundMode ?? "full");
  // Lo que realmente usan las rondas en juego. Se deduce de las rondas
  // guardadas, así editar la configuración sin aplicar nunca cambia la partida.
  const [applied, setApplied] = useState<{
    courts: number;
    mode: "full" | "short";
    modalidad: AmericanoModalidad;
  }>(() => ({
    ...deriveAppliedConfig(
      restored?.rounds ?? [],
      restored?.names.length ?? 0,
      { courts: restored?.courts ?? 1, mode: restored?.roundMode ?? "full" },
      restored?.modalidad ?? "americano",
    ),
    modalidad: restored?.modalidad ?? "americano",
  }));
  const [seed, setSeed] = useState(restored?.seed ?? 1);
  const [names, setNames] = useState<string[]>(restored?.names ?? []);
  const [coberturaIncompleta, setCoberturaIncompleta] = useState(false);
  const [rounds, setRounds] = useState<AmericanoRound[]>(restored?.rounds ?? []);
  const [drafts, setDrafts] = useState<Record<string, ScoreDraft>>(restored?.drafts ?? {});
  const [boxGroup, setBoxGroup] = useState(0);
  const [sortMode, setSortMode] = useState<AmericanoSortMode>(restored?.sortMode ?? "total");
  const [currentRound, setCurrentRound] = useState(restored?.currentRound ?? 0);
  const skipRoundScroll = useRef(true);
  useEffect(() => {
    if (skipRoundScroll.current) { skipRoundScroll.current = false; return; }
    gameRef.current?.scrollIntoView({ block: "start" });
  }, [currentRound]);
  const [configOpen, setConfigOpen] = useState(true);
  const skipRouteScroll = useRef(true);
  useEffect(() => {
    if (skipRouteScroll.current) { skipRouteScroll.current = false; return; }
    routeRef.current?.scrollIntoView({ block: "start" });
  }, [onbStep, configOpen]);

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
      // Solo se escribe cuando no es el Normal Americano: el guardado de la
      // versión publicada queda con exactamente la misma forma.
      ...(applied.modalidad === "americano" ? {} : { modalidad: applied.modalidad }),
      ...(esMix(applied.modalidad) ? { generos: appliedGeneros } : {}),
      ...(esClub(applied.modalidad) ? { clubs: appliedClubs } : {}),
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
    applied.modalidad,
    appliedGeneros,
    appliedClubs,
  ]);

  // La lista de inscritos manda. Fuera de limite NO se recorta: se bloquea la
  // generacion con aviso claro y los nombres quedan intactos.
  const previewCount = Math.min(inscritos.length, MAX_PLAYERS);
  const overLimit = inscritos.length > MAX_PLAYERS;
  const porParejas = esParejasFijas(modalidad);
  const parejasAplicadas = esParejasFijas(applied.modalidad);
  const mixSeleccionado = esMix(modalidad);
  const mixGeneros = inscritos.map((name) => generosDraft[name]);
  const mixMujeres = mixGeneros.filter((g) => g === "f").length;
  const mixHombres = mixGeneros.filter((g) => g === "m").length;
  const mixValido = mixMujeres >= 2 && mixMujeres === mixHombres && mixMujeres + mixHombres === inscritos.length;
  const clubSeleccionado = esClub(modalidad);
  const draftClubs = inscritos.map((name, i) => clubsDraft[porParejas ? inscritos[i-i%2] : name]);
  const clubValido = draftClubs.every(Boolean) && validClubs(draftClubs as Club[], porParejas);
  const boxSeleccionado = modalidad === "beat-box";
  const boxAplicado = applied.modalidad === "beat-box";
  const knockoutSeleccionado = modalidad === "playoffs";
  const knockoutAplicado = applied.modalidad === "playoffs";
  const limiteModalidad = boxSeleccionado || knockoutSeleccionado ? 16 : 12;
  const canGenerate = (!knockoutSeleccionado || inscritos.length >= 6) && inscritos.length <= limiteModalidad && (!boxSeleccionado || validBoxCount(inscritos.length)) && inscritos.length >= 4 && !overLimit && (!porParejas || inscritos.length % 2 === 0) && (!mixSeleccionado || mixValido) && (!clubSeleccionado || clubValido);
  const titulos: Record<AmericanoModalidad, string> = {
    americano: "Normal Americano",
    mexicano: "Mexicano",
    "team-americano": "Team Americano",
    "team-mexicano": "Team Mexicano",
    "mix-americano": "Mix Americano",
    mixicano: "Mixicano",
    "club-americano": "Club Americano",
    "club-mexicano": "Club Mexicano",
    "club-team-americano": "Club Team Americano",
    "club-team-mexicano": "Club Team Mexicano",
    "beat-box": "Beat the Box",
    playoffs: "Playoffs",
  };
  // Foto del encabezado por modalidad (pedido de Julian: imagen distinta según
  // el tipo de torneo, no solo otro título ni otro color). Todas de Unsplash,
  // verificadas una por una en su página como "Free to use under the Unsplash
  // License" (se descartaron las Unsplash+ de pago); autor junto a cada URL.
  const fotosHeader: Record<AmericanoModalidad, { url: string; autor: string }> = {
    americano: { url: "https://images.unsplash.com/photo-1770230901556-4e1c0bacfb09", autor: "Ashford Marx" },
    "mix-americano": { url: "https://images.unsplash.com/photo-1767128890609-227bdfdb7f5c", autor: "erjola qerimi" },
    mexicano: { url: "https://images.unsplash.com/photo-1767128890583-b3f8dc30bdbc", autor: "erjola qerimi" },
    mixicano: { url: "https://images.unsplash.com/photo-1612534847738-b3af9bc31f0c", autor: "Manuel Pappacena" },
    "team-americano": { url: "https://images.unsplash.com/photo-1767128890439-1af9ca2ff1ac", autor: "erjola qerimi" },
    "team-mexicano": { url: "https://images.unsplash.com/photo-1658723745294-89c5e056efb5", autor: "Sergio Contreras" },
    "club-americano": { url: "https://images.unsplash.com/photo-1759355456246-6937354a395d", autor: "Fakhar Imam" },
    "club-mexicano": { url: "https://images.unsplash.com/photo-1737229302954-a79054b8375f", autor: "Jon Matthews" },
    "club-team-americano": { url: "https://images.unsplash.com/photo-1709587825135-80b00570c355", autor: "Bruno Vaccaro Vercellino" },
    "club-team-mexicano": { url: "https://images.unsplash.com/photo-1689942963385-f5bd03f3b270", autor: "José Alejandro Cuffia" },
    "beat-box": { url: "https://images.unsplash.com/photo-1657704358775-ed705c7388d2", autor: "Oskar Hagberg" },
    playoffs: { url: "https://images.unsplash.com/photo-1709587823534-11c11a163c07", autor: "Bruno Vaccaro Vercellino" },
  };
  // Tinte del encabezado por modalidad (pedido de Julian: que se distingan
  // por imagen/gradiente, no solo por el título). Misma foto; cambia el
  // gradiente de color. El scrim oscuro de legibilidad se mantiene igual.
  const tintesHeader: Record<AmericanoModalidad, string> = {
    americano: "from-orange-500/60",
    "mix-americano": "from-rose-500/60",
    mexicano: "from-emerald-500/60",
    mixicano: "from-violet-500/60",
    "team-americano": "from-sky-500/60",
    "team-mexicano": "from-teal-500/60",
    "club-americano": "from-amber-500/60",
    "club-mexicano": "from-lime-500/60",
    "club-team-americano": "from-indigo-500/60",
    "club-team-mexicano": "from-fuchsia-500/60",
    "beat-box": "from-red-500/60",
    playoffs: "from-yellow-400/60",
  };
  const explicaciones: Record<AmericanoModalidad, string> = {
    americano: "Todos juegan con todos: en cada ronda cambias de compañero y de rivales. En la duración completa todos llegan a ser pareja de todos; en la corta no repites compañero. Gana quien va arriba en la tabla, por puntos o por promedio, como prefieras.",
    "mix-americano": "Como el Americano, pero cada pareja es una mujer y un hombre. Hace falta el mismo número de mujeres y de hombres; con 3 o 5 por lado se repite una pareja en el último partido. Gana quien va arriba en la tabla, por puntos o por promedio.",
    mexicano: "La primera ronda se sortea; después, la posición de cada uno manda: el 1º juega con el 4º y el 2º con el 3º (convención propia), así los partidos se igualan a tu nivel. Se juega una ronda menos que jugadores (6 con 7). Gana quien va arriba en la tabla, por puntos o por promedio.",
    mixicano: "Como el Mexicano, pero con parejas mixtas: una mujer y un hombre por lado. Tras el sorteo inicial, la posición ordena cada ronda nueva: en cada grupo de 2 mujeres y 2 hombres, la 1ª con el 2º contra la 2ª con el 1º (convención propia). Se juega una ronda menos que jugadores. Gana quien va arriba en la tabla, por puntos o por promedio.",
    "team-americano": "Juegas todo el torneo con el mismo compañero. Las parejas se arman al azar y cada una se enfrenta a todas las demás una vez. Gana la pareja que va arriba en la tabla, por puntos o por promedio.",
    "team-mexicano": "Juegas todo el torneo con el mismo compañero. Tras el sorteo inicial, la tabla de parejas decide cada ronda nueva: la 1ª contra la 2ª, la 3ª contra la 4ª, y así. Se juega una ronda menos que parejas (3 con 8 jugadores). Gana la pareja que va arriba en la tabla.",
    "club-americano": "Dos equipos (clubes) con el mismo número de jugadores, al menos 4 por club. Tu compañero siempre es de tu club y los rivales del otro, hasta que juegues con cada compañero una vez. Hay ganador individual (puntos o promedio) y también gana el club que más puntos sume.",
    "club-mexicano": "Dos clubes iguales, al menos 4 jugadores por club. Tras el sorteo inicial, la posición dentro de cada club ordena los partidos y juega primero quien menos veces ha jugado; a veces repites compañero (se avisa en pantalla). Se juega una ronda menos que jugadores. Hay ganador individual (puntos o promedio) y de club.",
    "club-team-americano": "Dos clubes con parejas fijas, al menos 2 por club. Cada pareja juega una vez contra todas las del club contrario. Gana la pareja que va arriba en la tabla y el club que más puntos acumule.",
    "club-team-mexicano": "Dos clubes con parejas fijas, al menos 2 por club. Tras el sorteo inicial, las parejas se ordenan por puntos y cruzan con las del otro club, dando turno primero a las que menos han jugado. Gana la pareja que va arriba en la tabla y el club que más acumule.",
    "beat-box": "Grupos de 4 jugadores, uno por cancha (8, 12 o 16 en total). Etapa 1: 3 rondas, todos juegan con todos en su grupo. Etapa 2: los grupos se rearman por posición (los mejores van al A+) y se juegan 3 rondas desde cero. El ganador sale del grupo A+; si empatan en puntos, no se declara ganador.",
    playoffs: "Eliminación directa con parejas fijas: pierdes y quedas fuera. Las parejas se ordenan por favoritos (siembra), que puedes ajustar; si el número no es exacto, las mejores pasan de ronda sin jugar. Un empate no avanza: hay que corregir el marcador. En esta demo, de 3 a 8 parejas; 9 a 32 y cuadro B siguen pendientes.",
  };
  const nombreLimpio = nuevoNombre.trim();
  const esDuplicado =
    nombreLimpio !== "" && inscritos.some((x) => x.toLowerCase() === nombreLimpio.toLowerCase());
  const jugando = names.length > 0 && !configOpen;
  const maxC = maxCourts(previewCount);
  const courtsSel = boxSeleccionado ? Math.max(1, inscritos.length / 4) : Math.min(courts, maxC);
  const cortaPosible = inscritos.length === 7 && courtsSel === 1;
  const modoEfectivo: "full" | "short" = cortaPosible && modalidad === "americano" ? roundMode : "full";
  const fullRounds = fullRotationRounds(previewCount, courtsSel);
  const esMexicano = esDinamica(applied.modalidad);
  const totalRondas = boxAplicado ? 6 :
    (applied.modalidad === "mexicano" || applied.modalidad === "mixicano" || applied.modalidad === "club-mexicano")
      ? mexicanoTotalRounds(names.length)
      : (applied.modalidad === "team-mexicano" || applied.modalidad === "club-team-mexicano")
        ? teamMexicanoTotalRounds(names.length)
        : rounds.length;
  const cambios =
    inscritos.join("\u0001") !== names.join("\u0001") ||
    courtsSel !== applied.courts ||
    modoEfectivo !== applied.mode ||
    modalidad !== applied.modalidad ||
    (mixSeleccionado && JSON.stringify(mixGeneros) !== JSON.stringify(appliedGeneros)) ||
    (clubSeleccionado && JSON.stringify(draftClubs) !== JSON.stringify(appliedClubs));
  const perdidos =
    Object.values(drafts).filter((d) => d.a.trim() !== "" || d.b.trim() !== "").length +
    Object.values(playoffDrafts).filter((d) => d.a.trim() !== "" || d.b.trim() !== "").length;
  const restingPerRound = inscritos.length - courtsSel * 4;

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

  const knockout = knockoutBracket(names.length, playoffDrafts, playoffKeys);
  const playedCount = knockoutAplicado ? knockout.finished : Object.keys(scores).length;
  const totalMatches = knockoutAplicado ? names.length / 2 - 1 : boxAplicado ? names.length / 4 * 6 : esMexicano
    ? totalRondas * Math.max(1, rounds[0]?.matches.length ?? 1)
    : rounds.reduce((acc, r) => acc + r.matches.length, 0);
  const puedeArmarSiguiente =
    esMexicano && rounds.length < totalRondas && mexicanoRoundReady(rounds, scores) &&
    rounds.every((r,ri)=>r.matches.every((_,mi)=>scores[`${ri}-${mi}`] !== undefined));
  const ri = Math.min(currentRound, Math.max(0, rounds.length - 1));
  const round = rounds[ri];
  const boxStage: 1 | 2 = rounds.length > 3 ? 2 : 1;
  const boxTable = boxAplicado
    ? americanoStandings(names.length, rounds.slice(boxStage === 1 ? 0 : 3, boxStage === 1 ? 3 : 6), boxStageScores(scores, boxStage), sortMode)
      .filter((row) => boxGroupPlayers(rounds, boxStage, boxGroup).includes(row.player))
    : [];
  const tableRows = boxAplicado ? boxTable : standings;
  const metricoLider = (r: (typeof tableRows)[number]) => (sortMode === "average" ? (r.average ?? 0) : r.points);
  const puntajeLider = tableRows.length ? metricoLider(tableRows[0]) : 0;
  const liderClaro = tableRows.some((r) => metricoLider(r) < puntajeLider);
  const boxComplete = boxAplicado && rounds.length === 6 && rounds.every((r,ri)=>r.matches.every((_,mi)=>scores[`${ri}-${mi}`] !== undefined));
  const boxFinalRows = boxComplete ? americanoStandings(names.length,rounds.slice(3),boxStageScores(scores,2),"total").filter((row)=>boxGroupPlayers(rounds,2,0).includes(row.player)) : [];
  const boxTied = boxFinalRows.length>1 && boxFinalRows[0].points===boxFinalRows[1].points;
  const puedeArmarEtapa2 = boxAplicado && boxStageReady(rounds, scores);
  function armarEtapa2() {
    if (!puedeArmarEtapa2) return;
    const next = secondBoxStage(names.length, rounds, scores);
    if (next.length !== 3) return;
    setRounds([...rounds, ...next]);
    setCurrentRound(3);
    setBoxGroup(0);
  }

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
  const validPo: Record<string, string> = knockoutAplicado ? {...knockout.validKeys} : { ...currentPoKeys };
  if (!knockoutAplicado && finalKey) validPo["po-final"] = finalKey;
  const validSig = knockoutAplicado ? JSON.stringify(knockout.validKeys) : `${JSON.stringify(currentPoKeys)}|${finalKey ?? ""}`;
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

  /** Mexicano: agrega UNA ronda armada con la tabla actual; las anteriores no se tocan. */
  function armarSiguienteRonda() {
    if (!puedeArmarSiguiente) return;
    const nueva =
      esClub(applied.modalidad)
        ? nextClubMexicanoRound(appliedClubs, applied.courts, parejasAplicadas, rounds, scores, seed)
        : applied.modalidad === "mixicano"
        ? nextMixicanoRound(appliedGeneros, applied.courts, rounds, scores, seed)
        : applied.modalidad === "team-mexicano"
        ? nextTeamMexicanoRound(names.length, applied.courts, rounds, scores, seed)
        : nextMexicanoRound(names.length, applied.courts, rounds, scores, seed);
    setRounds([...rounds, nueva]);
    setCurrentRound(rounds.length);
  }

  function quitar(index: number) {
    setInscritos((prev) => prev.filter((_, i) => i !== index));
  }

  function generate() {
    if (!canGenerate) return;
    const usableCourts = boxSeleccionado ? inscritos.length / 4 : Math.min(courts, maxCourts(inscritos.length));
    setNames(inscritos);
    const modo = modoEfectivo;
    setCourts(usableCourts);
    setRoundMode(modo);
    setApplied({ courts: usableCourts, mode: modo, modalidad });
    setConfirmReset(false);
    if (knockoutSeleccionado) {
      setCoberturaIncompleta(false);
      setRounds([]);
    } else if (boxSeleccionado) {
      setCoberturaIncompleta(false);
      setRounds(firstBoxStage(inscritos.length, seed));
      setBoxGroup(0);
    } else if (clubSeleccionado) {
      const clubs = draftClubs as Club[];
      setAppliedClubs(clubs);
      setCoberturaIncompleta(false);
      setRounds(esDinamica(modalidad)
        ? [nextClubMexicanoRound(clubs, usableCourts, porParejas, [], {}, seed)]
        : generateClubAmericano(clubs, usableCourts, porParejas));
    } else if (esMix(modalidad)) {
      const generos = mixGeneros as Genero[];
      setAppliedGeneros(generos);
      setCoberturaIncompleta(false);
      setRounds(modalidad === "mixicano"
        ? [nextMixicanoRound(generos, usableCourts, [], {}, seed)]
        : generateMixAmericano(generos, usableCourts, seed));
    } else if (modalidad === "mexicano") {
      setAppliedGeneros([]);
      setCoberturaIncompleta(false);
      setRounds([nextMexicanoRound(inscritos.length, usableCourts, [], {}, seed)]);
    } else if (modalidad === "team-mexicano") {
      setCoberturaIncompleta(false);
      setRounds([nextTeamMexicanoRound(inscritos.length, usableCourts, [], {}, seed)]);
    } else if (modalidad === "team-americano") {
      setCoberturaIncompleta(false);
      setRounds(generateTeamAmericano(inscritos.length, usableCourts));
    } else {
      const roundsWanted = modo === "full" ? fullRotationRounds(inscritos.length, usableCourts) : 6;
      const generadas = generateAmericano(inscritos.length, usableCourts, roundsWanted, seed);
      const cov = partnershipCoverage(generadas, inscritos.length);
      setCoberturaIncompleta(modo === "full" && cov.covered < cov.total);
      setRounds(generadas);
    }
    setDrafts({});
    setPlayoffDrafts({});
    setPlayoffKeys({});
    setCurrentRound(0);
    setConfigOpen(false);
    setView("rounds");
  }

  /** Vuelve a la partida sin aplicar nada: descarta los cambios de la edición. */
  function continuarPartida() {
    setInscritos(names);
    setCourts(applied.courts);
    setRoundMode(applied.mode);
    setModalidad(applied.modalidad);
    setClubsDraft(Object.fromEntries(names.flatMap((name,i) => appliedClubs[i] ? [[name,appliedClubs[i]]] : [])));
    setGenerosDraft(Object.fromEntries(names.flatMap((name, i) => appliedGeneros[i] ? [[name, appliedGeneros[i]]] : [])));
    setConfirmReset(false);
    setConfigOpen(false);
  }

  function irAPaso(n: 1 | 2) {
    setOnbStep(n);
    setConfirmReset(false);
    setConfigOpen(true);
  }

  function revolver() {
    if (perdidos > 0) return; // nunca borra marcadores en silencio
    const nextSeed = seed + 1;
    setSeed(nextSeed);
    if (knockoutAplicado) return;
    if (boxAplicado) {
      setRounds(firstBoxStage(names.length, nextSeed));
      setCurrentRound(0);
      setBoxGroup(0);
      return;
    }
    if (esClub(applied.modalidad)) {
      setRounds(esDinamica(applied.modalidad)
        ? [nextClubMexicanoRound(appliedClubs, applied.courts, parejasAplicadas, [], {}, nextSeed)]
        : generateClubAmericano(appliedClubs, applied.courts, parejasAplicadas));
      setCurrentRound(0);
      return;
    }
    if (esMix(applied.modalidad)) {
      setRounds(applied.modalidad === "mixicano"
        ? [nextMixicanoRound(appliedGeneros, applied.courts, [], {}, nextSeed)]
        : generateMixAmericano(appliedGeneros, applied.courts, nextSeed));
      setCurrentRound(0);
      return;
    }
    if (esDinamica(applied.modalidad)) {
      setRounds([
        applied.modalidad === "team-mexicano"
          ? nextTeamMexicanoRound(names.length, applied.courts, [], {}, nextSeed)
          : nextMexicanoRound(names.length, applied.courts, [], {}, nextSeed),
      ]);
      setCurrentRound(0);
      return;
    }
    const roundsWanted = applied.mode === "full" ? fullRotationRounds(names.length, applied.courts) : 6;
    const generadas = generateAmericano(
      names.length,
      Math.min(applied.courts, maxCourts(names.length)),
      roundsWanted,
      nextSeed,
    );
    const cov = partnershipCoverage(generadas, names.length);
    setCoberturaIncompleta(applied.mode === "full" && cov.covered < cov.total);
    setRounds(generadas);
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
    if (perdidos > 0 && !window.confirm(`Borrar ${perdidos} marcador${perdidos===1?"":"es"} de esta partida. Esta acción no se puede deshacer. ¿Continuar?`)) return;
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
    if (key.startsWith("ko-") && playoffDrafts[key]?.done) {
      const prospective = knockoutBracket(names.length, {...playoffDrafts, [key]: {...playoffDrafts[key], done: false}}, playoffKeys);
      const lost = Object.keys(playoffDrafts).filter((k)=>k!==key && k.startsWith("ko-") && !prospective.validKeys[k] && playoffDrafts[k]?.done).length;
      if (lost > 0 && !window.confirm(`Corregir este cruce borra ${lost} resultado${lost===1?"":"s"} posterior${lost===1?"":"es"}. ¿Continuar?`)) return;
    }
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
    const tileBtn = "h-11 w-9 rounded-xl border-0 bg-muted px-0 text-xl hover:bg-accent max-[339px]:w-8";
    const tileInput = "h-11 w-10 rounded-xl border-0 bg-background dark:bg-background px-0.5 text-center text-xl font-bold tabular-nums max-[339px]:w-9 max-[339px]:text-lg";
    return (
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          className={tileBtn}
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
          className={tileInput}
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
          className={tileBtn}
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

  /** Tarjeta de partido compacta (referencia: marcadores arriba, parejas
      debajo, una sola fila de cabecera). Cada pareja queda centrada bajo SU
      marcador; Terminar vive en la cabecera, no en una fila aparte. */
  function matchCard(o: {
    key: string;
    label: string;
    teamA: [number, number];
    teamB: [number, number];
    map: Record<string, ScoreDraft>;
    setter: DraftSetter;
    draft: ScoreDraft;
    onWrite?: () => void;
    tieText: string;
  }) {
    const { key, draft, map, setter, onWrite } = o;
    const score = parseScore(draft);
    const status = scoreStatus(draft);
    const empty = draft.a.trim() === "" && draft.b.trim() === "";
    const nameCls = "min-w-0 break-words text-center text-sm font-bold leading-tight";
    return (
      <div key={key} className="space-y-2.5 rounded-2xl border bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">{o.label}</p>
            {status === "playing" && (
              <span className="whitespace-nowrap rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                En juego
              </span>
            )}
            {score && score.a === score.b && (
              <span className="whitespace-nowrap rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {o.tieText}
              </span>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant={draft.done ? "outline" : empty ? "secondary" : "default"}
            className={draft.done ? "h-8 shrink-0 px-3 text-sm font-medium" : "h-8 shrink-0 px-4 text-sm font-bold"}
            disabled={!draft.done && empty}
            onClick={() => toggleDone(setter, key, onWrite)}
          >
            {draft.done ? "Corregir" : "Terminar"}
          </Button>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center justify-items-center gap-x-1.5">
          {scoreBox(map, setter, key, "a", onWrite, draft.done)}
          <span className="text-xs font-medium text-muted-foreground">vs</span>
          {scoreBox(map, setter, key, "b", onWrite, draft.done)}
        </div>
        <div className="grid grid-cols-2 gap-x-6">
          <p className={nameCls}>
            {teamNames(o.teamA)}
            {score && score.a > score.b && (
              <span className="block text-xs font-semibold text-primary">ganaron</span>
            )}
          </p>
          <p className={nameCls}>
            {teamNames(o.teamB)}
            {score && score.b > score.a && (
              <span className="block text-xs font-semibold text-primary">ganaron</span>
            )}
          </p>
        </div>
        {typeof status === "object" && (
          <p className="text-center text-xs text-red-600 dark:text-red-400">{status.error}</p>
        )}
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
    return matchCard({
      key,
      label,
      teamA,
      teamB,
      map: { ...playoffDrafts, [key]: draft },
      setter: setPlayoffDrafts,
      draft,
      onWrite: markWrite,
      tieText: "Empate: defínanlo",
    });
  }

  return (
    <div className={embedded ? "demo-round-robin space-y-3 pb-32" : "demo-round-robin mx-auto max-w-2xl space-y-3 px-3 pb-36 pt-3 sm:space-y-6 sm:px-4 sm:py-8"}>
      {/* La preview de Vercel inyecta un boton flotante (vercel-live-feedback) que tapa
          controles del borde derecho en movil; se oculta solo en esta pagina de demo.
          Ademas: con el teclado abierto (input enfocado) la barra fija del sitio se oculta
          para no tapar el campo ni el boton; la regla solo vive en esta ruta. */}
      <style>{DEMO_STYLE}</style>
      {!embedded && (
        <div className="relative overflow-hidden rounded-2xl">
          {/* Foto real según la modalidad (ver fotosHeader) con overlay
              oscuro; patrón de los pins de referencia: foto + acento +
              titular. */}
          <img
            src={`${fotosHeader[jugando ? applied.modalidad : modalidad].url}?w=800&h=500&fit=crop&q=80`}
            alt="Cancha de pádel"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className={`absolute inset-0 bg-gradient-to-br ${tintesHeader[jugando ? applied.modalidad : modalidad]} via-transparent to-black/40`} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/25" />
          <div className="relative space-y-1.5 p-4 pt-12">
            <p className="inline-block rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground">
              Demo · datos ficticios
            </p>
            <h1 className="font-display text-2xl font-bold leading-tight text-white">
              {titulos[jugando ? applied.modalidad : modalidad]}
            </h1>
            <p className="text-xs text-white/80">
              el avance se guarda solo en este navegador
            </p>
          </div>
        </div>
      )}
      {saveWarning && (
        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{saveWarning}</p>
      )}

      {/* Ruta del onboarding: cada tramo es un paso real. Los pasos ya hechos
          vuelven sin perder datos; "Torneos" lleva a la lista real. */}
      <nav ref={routeRef} aria-label="Ruta" className="-mb-1 scroll-mt-20">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          {!embedded && (
            <>
              <li>
                <Link to="/torneos" className="underline-offset-2 hover:underline">
                  Torneos
                </Link>
              </li>
              <li aria-hidden="true">›</li>
            </>
          )}
          {(
            [
              [1, "Jugadores"],
              [2, "Canchas y rondas"],
              [3, "Jugar"],
            ] as const
          ).map(([n, label], i) => {
            const actual = jugando ? 3 : onbStep;
            const alcanzable =
              n === 1 || (n === 2 && inscritos.length >= 4 && !overLimit) || (n === 3 && names.length > 0);
            const esActual = actual === n;
            return (
              <li key={n} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden="true">›</span>}
                {esActual ? (
                  <span aria-current="step" className="font-semibold text-foreground">
                    {label}
                  </span>
                ) : alcanzable ? (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-xs font-normal text-muted-foreground underline-offset-2"
                    onClick={() => (n === 3 ? continuarPartida() : irAPaso(n))}
                  >
                    {label}
                  </Button>
                ) : (
                  <span>{label}</span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {jugando ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
          <span className="font-medium">
            {names.length} jugadores · {playedCount}/
            {totalMatches} terminados
          </span>
          <span className="flex items-center gap-3 text-muted-foreground">
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-xs font-normal text-muted-foreground underline-offset-2"
              onClick={() => irAPaso(1)}
            >
              Editar
            </Button>
            {!knockoutAplicado && <DropdownMenu>
              <DropdownMenuTrigger className="underline underline-offset-2 outline-none">
                Opciones
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-36 rounded-xl">
                <DropdownMenuItem className="rounded-lg" onSelect={() => simulateRemaining()}>
                  Simular puntos
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-lg" onSelect={() => clearDemo()}>
                  Borrar marcadores
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="rounded-lg"
                  onSelect={() => revolver()}
                  disabled={perdidos > 0}
                >
                  Revolver sorteo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>}
          </span>
        </div>
      ) : onbStep === 1 ? (
        <div className="space-y-3">
          {/* Paso 1: jugadores (el número de jugadores es el de inscritos). */}
          {inscritos.length > 0 && (
            <ul className="overflow-hidden rounded-2xl border bg-muted/40 divide-y divide-border/60">
              {inscritos.map((n, i) => (
                <li key={n} className="flex items-center gap-3 py-2 pl-3 pr-2">
                  <span className="flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg bg-background text-xs font-bold text-muted-foreground">
                    {n.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 break-words text-sm font-medium leading-snug">{n}</span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full text-lg leading-none"
                    aria-label={`Quitar a ${n}`}
                    onClick={() => quitar(i)}
                  >
                    −
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span
              className={
                overLimit ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"
              }
            >
              {overLimit
                ? `Máximo ${MAX_PLAYERS}: quita ${inscritos.length - MAX_PLAYERS} (ninguno se pierde)`
                : inscritos.length < 4
                  ? "Inscribe al menos 4 jugadores"
                  : "Listo para elegir canchas y rondas"}
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
              variant={nombreLimpio ? "default" : "secondary"}
              className="h-12 w-12 rounded-lg px-0 text-xl"
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

          {inscritos.length === 0 && (
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-xs font-medium text-muted-foreground underline-offset-2"
              onClick={() => setInscritos(DEFAULT_NAMES)}
            >
              Usar ejemplo de {DEFAULT_NAMES.length} jugadores
            </Button>
          )}

          <Button
            type="button"
            variant={canGenerate ? "default" : "secondary"}
            className="h-12 w-full rounded-xl text-base font-bold"
            onClick={() => setOnbStep(2)}
            disabled={inscritos.length < 4 || overLimit}
          >
            Siguiente
          </Button>
          {names.length > 0 && (
            <Button type="button" variant="outline" className="h-11 w-full rounded-xl" onClick={continuarPartida}>
              Continuar partida ({playedCount}/{totalMatches} terminados)
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Paso 2: canchas y modo de juego, siempre visibles. Lo que no se
              puede con los jugadores actuales aparece apagado y dice por qué. */}
          <div className="space-y-2">
            <label htmlFor="modalidad-demo" className="text-sm font-semibold">Modalidad</label>
            <Select
              value={modalidad}
              onValueChange={(v) => {
                setModalidad(v as AmericanoModalidad);
                setConfirmReset(false);
              }}
            >
              <SelectTrigger
                id="modalidad-demo"
                aria-label="Modalidad"
                className="h-12 w-full rounded-xl px-3 text-base font-semibold"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="americano" disabled={inscritos.length>12}>Normal Americano</SelectItem>
                <SelectItem value="mix-americano" disabled={inscritos.length > 12 || inscritos.length % 2 !== 0}>Mix Americano{inscritos.length % 2 !== 0 ? " (necesita jugadores pares)" : ""}</SelectItem>
                <SelectItem value="mexicano" disabled={inscritos.length > 12}>Mexicano</SelectItem>
                <SelectItem value="mixicano" disabled={inscritos.length > 12 || inscritos.length % 2 !== 0}>Mixicano{inscritos.length % 2 !== 0 ? " (necesita jugadores pares)" : ""}</SelectItem>
                <SelectItem value="team-americano" disabled={inscritos.length > 12 || inscritos.length % 2 !== 0}>Team Americano{inscritos.length % 2 !== 0 ? " (necesita jugadores pares)" : ""}</SelectItem>
                <SelectItem value="team-mexicano" disabled={inscritos.length > 12 || inscritos.length % 2 !== 0}>Team Mexicano{inscritos.length % 2 !== 0 ? " (necesita jugadores pares)" : ""}</SelectItem>
                <SelectItem value="club-team-americano" disabled={inscritos.length > 12 || inscritos.length < 8 || inscritos.length % 4 !== 0}>Club Team Americano</SelectItem>
                <SelectItem value="club-americano" disabled={inscritos.length > 12 || inscritos.length < 8 || inscritos.length % 2 !== 0}>Club Americano</SelectItem>
                <SelectItem value="club-mexicano" disabled={inscritos.length > 12 || inscritos.length < 8 || inscritos.length % 2 !== 0}>Club Mexicano</SelectItem>
                <SelectItem value="club-team-mexicano" disabled={inscritos.length > 12 || inscritos.length < 8 || inscritos.length % 4 !== 0}>Club Team Mexicano</SelectItem>
                <SelectItem value="beat-box" disabled={!validBoxCount(inscritos.length)}>Beat the Box{!validBoxCount(inscritos.length) ? " (8, 12 o 16 jugadores)" : ""}</SelectItem>
                <SelectItem value="playoffs" disabled={inscritos.length < 6 || inscritos.length % 2 !== 0}>Playoffs · 3 a 8 parejas</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs leading-relaxed text-muted-foreground">{explicaciones[modalidad]}</p>
          </div>

          {inscritos.length > limiteModalidad && <p role="status" className="text-xs text-muted-foreground">En esta demo Beat the Box y Playoffs admiten 16 jugadores. Los otros modos admiten hasta 12.</p>}
          {clubSeleccionado && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Clubes</legend>
              <div className="divide-y overflow-hidden rounded-xl border">
                {inscritos.map((name,i) => porParejas && i%2 ? null : (
                  <div key={name} className="flex items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1 break-words text-sm font-medium">{name}{porParejas ? <> / {inscritos[i+1]}</> : null}</span>
                    <Select value={clubsDraft[name]} onValueChange={(club) => {
                        setClubsDraft((prev) => ({...prev, [name]: club as "A" | "B"}));
                        setConfirmReset(false);
                      }}>
                      <SelectTrigger aria-label={`Club de ${name}`} className="h-11 w-auto min-w-28 rounded-lg px-2 text-sm">
                        <SelectValue placeholder="Elegir" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">Club A</SelectItem>
                        <SelectItem value="B">Club B</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              {!clubValido && <p role="status" className="text-xs text-muted-foreground">Asigna todos a clubes iguales, al menos 4 jugadores por club{porParejas ? " y parejas completas" : ""}.</p>}
              {esDinamica(modalidad) && <p className="text-xs text-muted-foreground">Primera ronda sorteada. Después se ordena cada club por puntos; pueden repetirse compañeros. Los descansos se reparten por partidos jugados.</p>}
            </fieldset>
          )}

          {mixSeleccionado && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Jugadores del mixto</legend>
              <p className="text-xs text-muted-foreground">Mismo número de mujeres y hombres, al menos 2 de cada uno.</p>
              <div className="divide-y overflow-hidden rounded-xl border">
                {inscritos.map((name) => (
                  <div key={name} className="flex items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1 break-words text-sm font-medium">{name}</span>
                    <Select
                      value={generosDraft[name]}
                      onValueChange={(value) => {
                        setGenerosDraft((prev) => ({ ...prev, [name]: value as Genero }));
                        setConfirmReset(false);
                      }}
                    >
                      <SelectTrigger aria-label={`Género de ${name}`} className="h-11 w-auto min-w-28 rounded-lg px-2 text-sm">
                        <SelectValue placeholder="Elegir" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="f">Mujer</SelectItem>
                        <SelectItem value="m">Hombre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <p role="status" className="text-xs text-muted-foreground">{mixMujeres} mujeres · {mixHombres} hombres{!mixValido ? ". Completa la lista con grupos iguales para empezar." : ""}</p>
            </fieldset>
          )}

          {porParejas && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Parejas fijas{knockoutSeleccionado ? " · orden de siembra" : ""}</legend>
              <p className="text-xs text-muted-foreground">Elige compañero. Cambiarlo intercambia su lugar en la lista.</p>
              {Array.from({ length: Math.floor(inscritos.length / 2) }, (_, pair) => {
                const i = pair * 2;
                return (
                  <div key={pair} className="grid grid-cols-[1fr_1fr] items-center gap-2 rounded-xl border px-3 py-2">
                    <span className="break-words text-sm font-medium">{knockoutSeleccionado ? `${pair+1}. ` : ""}{inscritos[i]}</span>
                    <Select
                      value={String(i + 1)}
                      onValueChange={(v) => {
                        const other = Number(v);
                        setInscritos((prev) => {
                          const next = [...prev];
                          [next[i + 1], next[other]] = [next[other], next[i + 1]];
                          return next;
                        });
                        setConfirmReset(false);
                      }}
                    >
                      <SelectTrigger aria-label={`Compañero de ${inscritos[i]}`} className="h-11 min-w-0 rounded-lg px-2 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {inscritos.map((name, j) => j !== i ? <SelectItem key={j} value={String(j)}>{name}</SelectItem> : null)}
                      </SelectContent>
                    </Select>
                    {knockoutSeleccionado && <label className="col-span-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">Posición de siembra
                      <Select value={String(pair)} onValueChange={(v)=>{
                        const dest=Number(v)*2;
                        setInscritos((prev)=>{const next=[...prev];[next[i],next[dest]]=[next[dest],next[i]];[next[i+1],next[dest+1]]=[next[dest+1],next[i+1]];return next;});
                        setConfirmReset(false);
                      }}>
                        <SelectTrigger aria-label={`Siembra de pareja ${pair+1}`} className="h-11 w-auto min-w-16 rounded-lg px-2 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{Array.from({length:inscritos.length/2},(_,idx)=><SelectItem key={idx} value={String(idx)}>{idx+1}</SelectItem>)}</SelectContent>
                      </Select>
                    </label>}

                  </div>
                );
              })}
            </fieldset>
          )}

          <div className="space-y-2">
            <p className="text-sm font-semibold">Canchas</p>
            {knockoutSeleccionado ? <p className="text-xs text-muted-foreground">La llave no asigna horario ni cancha. Puedes jugar los cruces disponibles en las canchas libres.</p> : boxSeleccionado ? <p className="text-sm">{courtsSel} canchas, una por grupo de 4.</p> : <>
            <ToggleGroup
              type="single"
              value={String(courtsSel)}
              onValueChange={(v) => {
                if (v) {
                  setCourts(Number(v));
                  setConfirmReset(false);
                }
              }}
              spacing={8}
              aria-label="Número de canchas"
              className="w-full min-w-full"
            >
              {Array.from({ length: 3 }, (_, i) => i + 1).map((c) => {
                const ok = c <= maxC;
                return (
                  <ToggleGroupItem
                    key={c}
                    value={String(c)}
                    disabled={!ok}
                    aria-label={`${c} ${c === 1 ? "cancha" : "canchas"}`}
                    className={`h-12 flex-1 rounded-xl border text-sm font-semibold transition-colors data-[state=on]:border-primary data-[state=on]:bg-primary/15 data-[state=on]:text-primary data-[state=off]:bg-muted/40 ${ok ? "" : "opacity-40"}`}
                  >
                    {c} {c === 1 ? "cancha" : "canchas"}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
            {maxC < 3 && (
              <p className="text-xs text-muted-foreground">
                Con {inscritos.length} jugadores el máximo es {maxC} {maxC === 1 ? "cancha" : "canchas"};{" "}
                {maxC + 1} canchas necesitan {(maxC + 1) * 4} jugadores.{" "}
                <Button type="button" variant="link" className="h-auto p-0 text-xs underline-offset-2" onClick={() => setOnbStep(1)}>
                  Agregar jugadores
                </Button>
              </p>
            )}
            </>}
          </div>

          {modalidad === "americano" && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Rondas</p>
            <RadioGroup
              value={modoEfectivo}
              onValueChange={(v) => {
                setRoundMode(v as "full" | "short");
                setConfirmReset(false);
              }}
              className="space-y-2"
              aria-label="Duración en rondas"
            >
              <label
                className={`block w-full rounded-xl border px-3 py-2.5 text-left ${
                  modoEfectivo === "full" ? "border-primary bg-primary/15" : "bg-muted/40"
                }`}
              >
                <RadioGroupItem value="full" className="sr-only" aria-label={`Completa (${fullRounds} rondas)`} />
                <span className="block text-sm font-semibold">Completa ({fullRounds} rondas)</span>
                <span className="block text-xs text-muted-foreground">
                  Todos juegan con todos como pareja.
                </span>
              </label>
              <label
                className={`block w-full rounded-xl border px-3 py-2.5 text-left ${
                  modoEfectivo === "short" ? "border-primary bg-primary/15" : "bg-muted/40"
                } ${cortaPosible ? "" : "opacity-40"}`}
              >
                <RadioGroupItem value="short" disabled={!cortaPosible} className="sr-only" aria-label="Corta (6 rondas)" />
                <span className="block text-sm font-semibold">Corta (6 rondas)</span>
                <span className="block text-xs text-muted-foreground">
                  {cortaPosible
                    ? "Sin repetir compañero."
                    : "Solo con 7 jugadores y 1 cancha."}
                </span>
              </label>
            </RadioGroup>
          </div>
          )}

          <p className="text-xs text-muted-foreground">
            {inscritos.length} jugadores · {courtsSel} {courtsSel === 1 ? "cancha" : "canchas"} ·{" "}
            {knockoutSeleccionado ? Math.ceil(Math.log2(inscritos.length/2)) : boxSeleccionado ? 6 : (modalidad === "mexicano" || modalidad === "mixicano" || modalidad === "club-mexicano")
              ? mexicanoTotalRounds(inscritos.length)
              : modalidad === "mix-americano"
                ? (mixValido ? generateMixAmericano(mixGeneros as Genero[], courtsSel, seed).length : "—")
              : modalidad === "club-americano" || modalidad === "club-team-americano"
                ? (clubValido ? generateClubAmericano(draftClubs as Club[], courtsSel, porParejas).length : "—")
              : modalidad === "team-mexicano" || modalidad === "club-team-mexicano"
                ? teamMexicanoTotalRounds(inscritos.length)
                : modalidad === "team-americano"
                  ? generateTeamAmericano(inscritos.length, courtsSel).length
                  : modoEfectivo === "full"
                    ? fullRounds
                    : 6}{" "}
            rondas
            {!knockoutSeleccionado && restingPerRound > 0 ? (modalidad === "mix-americano" || modalidad === "team-americano" ? " · descansos según la ronda" : ` · descansan ${restingPerRound} por ronda`) : ""}
          </p>

          {names.length > 0 && cambios && perdidos > 0 && confirmReset && (
            <p ref={confirmRef} role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              Aplicar estos cambios arma rondas nuevas y borra {perdidos}{" "}
              {perdidos === 1 ? "marcador" : "marcadores"}. Si no quieres perderlos, continúa la partida.
            </p>
          )}

          {names.length === 0 || (cambios && (perdidos === 0 || confirmReset)) ? (
            <Button
              type="button"
              variant={canGenerate ? "default" : "secondary"}
              className="h-12 w-full rounded-xl text-base font-bold"
              onClick={generate}
              disabled={!canGenerate}
            >
              {names.length === 0
                ? "¡Empezar!"
                : perdidos > 0
                  ? `Sí, reiniciar y borrar ${perdidos}`
                  : "Aplicar y reiniciar rondas"}
            </Button>
          ) : cambios ? (
            <Button
              type="button"
              className="h-12 w-full rounded-xl text-base font-bold"
              onClick={() => setConfirmReset(true)}
              disabled={!canGenerate}
            >
              Aplicar cambios
            </Button>
          ) : null}
          {names.length > 0 && (
            <Button
              type="button"
              variant={cambios ? "outline" : "default"}
              className="h-11 w-full rounded-xl"
              onClick={continuarPartida}
            >
              Seguir sin cambios ({playedCount}/{totalMatches})
            </Button>
          )}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs font-normal text-muted-foreground underline-offset-2"
            onClick={() => setOnbStep(1)}
          >
            ‹ Atrás: jugadores
          </Button>
        </div>
      )}

      {knockoutAplicado && jugando && (
        <section ref={gameRef} className="scroll-mt-20 space-y-4">
          <p className="text-xs text-muted-foreground">Llave a prueba, reversible. El empate no avanza: corrige y define un ganador. Corregir un cruce anterior borra resultados posteriores que ya no correspondan.</p>
          {knockout.rounds.map((nodes,stage)=><div key={stage} className="space-y-3">
            <h2 className="text-base font-bold">{knockout.rounds.length-stage===1?"Final":knockout.rounds.length-stage===2?"Semifinales":"Cuartos de final"}</h2>
            {nodes.map((node)=>{
              if(node.bye) return <div key={node.key} className="rounded-xl border px-3 py-2 text-sm"><span className="font-semibold">{node.winner?.map((p)=>names[p]).join(" / ")}</span> · pase directo</div>;
              if(!node.teamA || !node.teamB) return <div key={node.key} className="rounded-xl border border-dashed px-3 py-3 text-xs text-muted-foreground">Cruce {node.index+1}: espera ganadores de los cruces anteriores.</div>;
              const scoreDraft=playoffKeys[node.key]===node.signature?playoffDrafts[node.key]??{a:"",b:""}:{a:"",b:""};
              return matchCard({
                key:node.key,label:`Cruce ${node.index+1}`,teamA:node.teamA,teamB:node.teamB,
                map:{[node.key]:scoreDraft},draft:scoreDraft,setter:setPlayoffDrafts,
                onWrite:()=>setPlayoffKeys((prev)=>({...prev,[node.key]:node.signature!})),
                tieText:"Empate: corrige para avanzar",
              });
            })}
          </div>)}
          {knockout.champion && <p role="status" className="rounded-xl bg-primary/10 px-3 py-3 text-center font-bold">Campeones: {knockout.champion.map((p)=>names[p]).join(" / ")}</p>}
        </section>
      )}

      {round && jugando && (
        <section ref={gameRef} className="scroll-mt-20 space-y-3">
          {boxComplete && <p role="status" className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold">{boxTied ? "Empate en puntos en A+: falta definir el desempate, no hay ganador declarado." : `Ganador de A+: ${names[boxFinalRows[0].player]} · ${boxFinalRows[0].points} puntos en etapa 2`}</p>}
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => v && setView(v as typeof view)}
            spacing={4}
            aria-label="Vista"
            className="w-full min-w-full rounded-xl bg-muted p-1"
          >
            {(
              [
                ["rounds", "Rondas"],
                ["standings", "Tabla"],
                ["playoff", "Eliminatoria"],
              ] as const
            ).map(([v, label]) => (
              <ToggleGroupItem
                key={v}
                value={v}
                className="flex-1 rounded-lg py-2 text-sm font-medium transition-colors data-[state=on]:bg-background data-[state=on]:font-bold data-[state=on]:shadow-sm data-[state=off]:text-muted-foreground"
              >
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
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
                  Ronda {ri + 1} <span className="text-sm font-normal text-muted-foreground">de {totalRondas}</span>
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

            {boxAplicado && <p className="text-center text-xs text-muted-foreground">Etapa {ri < 3 ? 1 : 2} · ronda {ri % 3 + 1} de 3{ri >= 3 ? ". Grupos A+, B+ y siguientes según la etapa 1." : ". Cada cancha tiene su propia tabla."}</p>}
            {coberturaIncompleta && (
              <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                Aviso: con esta configuración no se pudo armar la rotación completa; alguna pareja
                podría no llegar a coincidir.
              </p>
            )}

            <div className="space-y-3">
              {round.matches.map((match, mi) => {
                const key = `${ri}-${mi}`;
                const draft = drafts[key] ?? { a: "", b: "" };
                return matchCard({
                  key,
                  label: boxAplicado && ri >= 3 ? `Grupo ${String.fromCharCode(64+match.court)}+ · Cancha ${match.court}` : `Cancha ${match.court}`,
                  teamA: match.teamA,
                  teamB: match.teamB,
                  map: drafts,
                  setter: setDrafts,
                  draft,
                  tieText: "Empate",
                });
              })}
            </div>

            {esMexicano && rounds.length > 1 && (
              <p className="text-center text-xs text-muted-foreground">
                Si corriges un marcador, la tabla cambia; las rondas ya armadas no.
              </p>
            )}

            {puedeArmarEtapa2 && <Button type="button" className="h-12 w-full rounded-xl" onClick={armarEtapa2}>Armar etapa 2 con las tablas</Button>}
            {boxAplicado && rounds.length > 3 && <p className="text-xs text-muted-foreground">Corregir la etapa 1 cambia sus puntos, no los grupos ya armados de la etapa 2.</p>}
            {puedeArmarSiguiente && ri === rounds.length - 1 && (
              <Button
                type="button"
                className="h-12 w-full rounded-xl text-base font-bold"
                onClick={armarSiguienteRonda}
              >
                Armar ronda {rounds.length + 1} con la tabla
              </Button>
            )}

            {round.resting.length > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                Descansan: <span className="font-medium">{round.resting.map((p) => names[p]).join(", ")}</span>
              </p>
            )}

              </>
            ) : view === "standings" ? (
              <>
            <ToggleGroup
              type="single"
              value={sortMode}
              onValueChange={(v) => v && setSortMode(v as typeof sortMode)}
              spacing={4}
              aria-label="Orden de la tabla"
              className="w-56 rounded-xl bg-muted p-1"
            >
              {(
                [
                  ["total", "Puntos"],
                  ["average", "Promedio"],
                ] as const
              ).map(([v, label]) => (
                <ToggleGroupItem
                  key={v}
                  value={v}
                  className="flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors data-[state=on]:bg-background data-[state=on]:font-bold data-[state=on]:shadow-sm data-[state=off]:text-muted-foreground"
                >
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {boxAplicado && <div className="space-y-2"><p className="text-sm font-semibold">Tabla · Etapa {boxStage}</p><Select value={String(boxGroup)} onValueChange={(v)=>setBoxGroup(Number(v))}><SelectTrigger aria-label="Grupo de la tabla" className="h-11 w-full rounded-xl px-3 text-sm"><SelectValue /></SelectTrigger><SelectContent>{Array.from({length:names.length/4},(_,i)=><SelectItem key={i} value={String(i)}>Grupo {String.fromCharCode(65+i)}{boxStage===2?"+":""}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">{boxStage===2?"Los puntos se cuentan desde cero en cada grupo de la etapa 2. El ganador se define en A+.":"Tabla separada por cancha. Al cerrar las 3 rondas se armará la etapa 2."}</p></div>}
            {esClub(applied.modalidad) && (() => {
              const totals = clubTotals(appliedClubs, rounds, scores);
              return <div className="flex justify-between rounded-xl border px-3 py-2 text-sm font-semibold"><span>Club A · {totals.A}</span><span>Club B · {totals.B}</span></div>;
            })()}
            {/* Tabla compacta de una línea por jugador (referencia: leaderboard):
                posición, nombre, PJ/PG/dif en pequeño y los puntos a la derecha. */}
            <div className="overflow-hidden rounded-2xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="h-auto w-8 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">#</TableHead>
                    <TableHead className="h-auto px-1 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{parejasAplicadas ? "Pareja" : "Jugador"}</TableHead>
                    <TableHead className="h-auto w-11 px-1 py-1.5 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">PJ</TableHead>
                    <TableHead className="h-auto w-11 px-1 py-1.5 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">PG</TableHead>
                    <TableHead className="h-auto w-12 px-1 py-1.5 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Dif</TableHead>
                    <TableHead className="h-auto w-14 px-3 py-1.5 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{sortMode === "average" ? "Prom" : "Pts"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.filter((row) => !parejasAplicadas || row.player % 2 === 0).map((row, i) => (
                    <TableRow
                      key={row.player}
                      className={`text-sm tabular-nums ${
                        liderClaro && metricoLider(row) === puntajeLider ? "bg-primary/10 hover:bg-primary/10" : ""
                      }`}
                    >
                      <TableCell className="px-3 py-2 font-bold text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="min-w-0 whitespace-normal break-words px-1 py-2 font-semibold leading-snug">{esClub(applied.modalidad) ? <small className="mr-1 text-muted-foreground">{appliedClubs[row.player]}</small> : null}{names[row.player]}{parejasAplicadas ? <><br />{names[row.player + 1]}</> : null}</TableCell>
                      <TableCell className="px-1 py-2 text-right text-muted-foreground">{row.played}</TableCell>
                      <TableCell className="px-1 py-2 text-right text-muted-foreground">{row.wins}</TableCell>
                      <TableCell className="px-1 py-2 text-right text-muted-foreground">
                        {row.diff > 0 ? `+${row.diff}` : row.diff}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right text-lg font-extrabold">
                        {sortMode === "average"
                          ? row.average != null
                            ? row.average.toFixed(1)
                            : "s/d"
                          : row.points}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {!boxAplicado && (
              <p className="text-xs text-muted-foreground">
                Con descansos no todos juegan lo mismo: el total favorece a quien jugó más, el
                promedio nivela. Cuál define al ganador es una regla por elegir.
              </p>
            )}
              </>
            ) : (
              <>
                <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  Propuesta a prueba, reversible: parejas balanceadas desde la tabla. No es una
                  regla confirmada; se puede cambiar.
                </p>
                {boxAplicado ? <p className="text-sm text-muted-foreground">Beat the Box termina en los grupos de la etapa 2, no en esta eliminatoria.</p> : parejasAplicadas ? (
                  <p className="text-sm text-muted-foreground">La propuesta individual no aplica a parejas fijas. Esta eliminatoria todavía no está configurada.</p>
                ) : names.length < 4 ? (
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

      {!embedded && (
        <div className="space-y-1 text-center text-xs text-muted-foreground">
          <p>
            Prueba aislada
          </p>
          <Collapsible>
            <CollapsibleTrigger className="select-none">Más sobre esta prueba</CollapsibleTrigger>
            <CollapsibleContent>
              <p className="mt-1">
                Los resultados se guardan en este navegador y no cambian los torneos reales.
                Modalidades de la demo: hasta 12 jugadores; Beat the Box y Playoffs, hasta 16.
                Super Mexicano, Playoffs de 9 a 32 parejas y cuadro B siguen pendientes.
              </p>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  );
  }
