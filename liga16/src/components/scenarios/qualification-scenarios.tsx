import type { ComponentProps } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import "./qualification-panel.css";
import { AdminPageHeader, AdminStat } from "@/components/admin/page-header";
import { BentoCard } from "@/components/admin/bento-card";
import { BENTO_CARD, BENTO_LIGHT } from "@/components/admin/bento";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  Send,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  ChevronDown,
  Trophy,
} from "lucide-react";
import type { StandingLike, MyLine, CutContext } from "@/lib/qualification";
import { buildScenarios, buildVerdict } from "@/lib/qualification-scenarios";
import type { ScenarioTone } from "@/lib/qualification-scenarios";
import { qualificationFor } from "@/lib/qualification";
import { answerQualification } from "@/lib/qualification-answer";
import type { SimContext } from "@/lib/qualification-sim";
import { QualificationResponse } from "./qualification-response";
import { readQuestion } from "@/lib/jev-question";

interface Props {
  standings: StandingLike[];
  me: MyLine;
  ctx: CutContext;
  remainingMatches?: number;
  /** Contexto del torneo para simular cruces; sin él, solo aritmética de %. */
  sim?: SimContext | null;
}

const SIM_FREQUENT = [
  "¿Qué posición me queda si gano mis partidos pendientes?",
  "¿Qué posición me queda si pierdo mis partidos pendientes?",
  "¿Qué partidos de otras parejas mueven mi lugar?",
];
const SIM_LABELS = ["Si gano", "Si pierdo", "Partidos que me mueven"];

const FREQUENT = [
  "¿Paso a semifinales si gano el próximo?",
  "¿Qué necesito para que mi rival no pase?",
  "¿Ya no tengo más partidos: estoy adentro o fuera?",
];

/** Tono del veredicto. El color nunca es el mensaje: lo lleva el icono. */
const TONE_ICON: Record<ScenarioTone, typeof Trophy> = {
  pass: Trophy,
  depends: TrendingUp,
  out: ShieldAlert,
};


/** Conserva summary/teclado nativos; anima altura al abrir y al cerrar. */
function AnimatedDetails({ children, ...props }: ComponentProps<"details">) {
  const ref = useRef<HTMLDetailsElement>(null);
  const animation = useRef<Animation | null>(null);
  const targetOpen = useRef(false);
  useEffect(() => () => animation.current?.cancel(), []);
  return <details {...props} ref={ref} onClick={(event) => {
    const details = ref.current;
    const target = event.target;
    if (!details || !(target instanceof Element) || target.closest("summary") !== details.querySelector("summary")) return;
    event.preventDefault();
    const opening = !targetOpen.current;
    targetOpen.current = opening;
    const start = details.getBoundingClientRect().height;
    animation.current?.cancel();
    details.style.height = "";
    details.open = opening;
    const end = details.getBoundingClientRect().height;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    details.open = true;
    const effect = details.animate([{ height: `${start}px` }, { height: `${end}px` }], { duration: 220, easing: "cubic-bezier(0.2, 0, 0, 1)" });
    animation.current = effect;
    effect.onfinish = () => { details.open = opening; animation.current = null; };
  }}>{children}</details>;
}

export default function ScenarioPanel({
  standings,
  me,
  ctx,
  remainingMatches = 0,
  sim = null,
}: Props) {
  // La tabla llega con el equipo repetido (`[team, ...resto]`); duplicado,
  // "5° de 6" mentía y el rail mostraba la misma pareja dos veces.
  const rows = useMemo(() => {
    const seen = new Set<string>();
    return standings
      .filter((s) => {
        if (seen.has(s.pairId)) return false;
        seen.add(s.pairId);
        return true;
      })
      .sort((a, b) => a.position - b.position || b.points - a.points);
  }, [standings]);

  const q = useMemo(() => qualificationFor(rows, me, ctx), [rows, me, ctx]);

  const requestInFlight = useRef(false);
  const [askedQuestion, setAskedQuestion] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** Quién interpretó la última pregunta: JEV (TypeSafe) o el analizador local. */
  const [source, setSource] = useState<"jev" | "local" | null>(null);

  /* ---------------- cifras que sostienen todo el panel ----------------
     `team.points` NO son puntos de partido: es el porcentaje de rendimiento
     (RENDIMIENTO_PTS, el del Excel de la liga). Por eso aquí no se suma "3 por
     victoria": se habla de posiciones y de puntos porcentuales. */
  const slots = Math.max(1, ctx.slots);
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const fmtPct = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const myLine = rows.find((r) => r.pairId === me.pairId);
  const myPoints = round1(myLine?.points ?? 0);
  const gapPct = q.inCut
    ? 0
    : Math.max(0, round1(round1(rows[slots - 1]?.points ?? 0) - myPoints));
  const tiedAtCut = !q.inCut && gapPct === 0;
  const left = Math.max(0, remainingMatches);

  // Veredicto y escenarios se arman en lib/qualification-scenarios.ts (puras y
  // probadas): solo nombran movimientos que todavía son posibles, usando los
  // partidos que le quedan a CADA pareja (`remaining`), no solo los tuyos.
  const scenarioInput = { rows, q, mePairId: me.pairId, slots, left };
  const verdict = buildVerdict(scenarioInput);
  const scenarios = buildScenarios(scenarioInput);

  /* ---------------- tabla alrededor de la línea de semifinales ---------------- */
  const rail = useMemo(() => {
    const idxMe = rows.findIndex((r) => r.pairId === me.pairId);
    const start = Math.max(0, Math.min(idxMe === -1 ? 0 : idxMe, slots - 1) - 1);
    const end = Math.min(
      rows.length,
      Math.max(slots + 1, (idxMe === -1 ? 0 : idxMe) + 2),
    );
    return {
      items: rows.slice(start, end),
      hiddenAbove: start,
      hiddenBelow: Math.max(0, rows.length - end),
    };
  }, [rows, me.pairId, slots]);

  // Respuestas: ver lib/qualification-answer.ts (simula el cruce que preguntes).
  const buildAnswer = (prompt: string, reading: Awaited<ReturnType<typeof readQuestion>>) =>
    answerQualification({ prompt, rows, me, q, slots, remainingMatches: left, reading, sim });

  const generate = async (prompt: string) => {
    const clean = prompt.trim();
    if (!clean || requestInFlight.current) return;
    requestInFlight.current = true;
    setAskedQuestion(clean);
    setLoading(true);
    setAnswer(null);
    // JEV entiende la pregunta (acentos, subjuntivo, a quién nombra); el texto
    // y las cifras los arma el código. Si falla, el analizador local responde.
    const reading = await readQuestion({ prompt: clean, rows, me, slots, remainingMatches: left });
    setSource(reading ? "jev" : "local");
    setAnswer(buildAnswer(clean, reading));
    setLoading(false);
    requestInFlight.current = false;
  };

  const ask = (text: string) => {
    setQuestion(text);
    void generate(text);
  };

  const VerdictIcon = TONE_ICON[verdict.tone];
  /** Con torneo real todo sale de la simulación; sin él, el panel anterior (aritmética de %). */
  const simMode = sim !== null;

  return (
    <section
      aria-label="Clasificación"
      className="qualification-panel mx-auto max-w-7xl px-4 md:px-6"
    >
      <AdminPageHeader title="Clasificación" />
      <div className="qualification-stats mb-4 mt-3 grid grid-cols-3 gap-3">
        <AdminStat value={`${q.position}°`} label="Posición" icon={simMode ? undefined : <VerdictIcon className="h-3.5 w-3.5" aria-hidden />} className="gap-3 p-4 [&>span:first-child]:text-4xl" />
        <AdminStat value={`${fmtPct(myPoints)}%`} label="Rend." className="gap-3 p-4 [&>span:first-child]:text-4xl" />
        <AdminStat value={left} label="Por jugar" className="gap-3 p-4 [&>span:first-child]:text-4xl" />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {simMode ? (
          <span className="text-muted-foreground">
            {sim?.slots != null ? `Semifinales · ${sim.slots} lugares` : "Este torneo no define cuántas parejas pasan a semifinales"}
          </span>
        ) : (
          <>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary-strong">{verdict.word}</span>
            <span className="text-muted-foreground">Semifinales · {slots} lugares{!q.inCut && !tiedAtCut ? ` · A ${fmtPct(gapPct)} p.p. del corte` : ""}</span>
          </>
        )}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[1.5fr_1fr]">
      {/* Pregunta a la IA: monocromo, con marca animada y las frecuentes abajo. */}
      <BentoCard className={cn(BENTO_CARD, BENTO_LIGHT, "qualification-interactive min-w-0 gap-0 p-5")}>
        <h3 className="flex items-center gap-2.5 text-base font-semibold"><span aria-hidden className="h-2.5 w-2.5 rounded-[4px] bg-primary" />Pregunta por tu pase<Sparkles className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden /></h3>
        <form
          className="mt-3 rounded-xl border border-border bg-card p-2.5 transition-shadow focus-within:ring-2 focus-within:ring-ring/30"
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
        >
          <label htmlFor="clasificacion-pregunta" className="sr-only">
            Pregunta sobre tu clasificación a semifinales
          </label>
          <textarea
            id="clasificacion-pregunta"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="¿Y si gano el próximo?"
            rows={1}
            className="block min-h-10 w-full resize-y border-0 bg-transparent px-1 py-1.5 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground"
            autoComplete="off"
          />

          <div className="mt-1 flex items-center justify-end gap-3">
          <Button
            type="submit"
            size="sm"
            className="h-9 shrink-0 rounded-lg bg-foreground px-3 text-background hover:bg-foreground/85 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
            disabled={loading || !question.trim()}
            aria-label="Preguntar a la IA"
          >
            <Send className="h-3.5 w-3.5" aria-hidden />
            <span className="ml-2 text-xs">{loading ? "Analizando…" : "Preguntar"}</span>
          </Button>
          </div>
        </form>

        <div className="mt-3">
          <div aria-live="polite" aria-busy={loading}>
            {loading && (
              <div className="space-y-1.5 py-1">
                <span className="sr-only">Analizando tu situación…</span>
                <span className="block h-3 w-4/5 animate-pulse rounded bg-muted-foreground/20" />
                <span className="block h-3 w-3/5 animate-pulse rounded bg-muted-foreground/20" />
              </div>
            )}

            {!loading && answer && (
              <div className="qualification-answer border-t border-border pt-3">
                <div className="min-w-0 flex-1 space-y-3">
                  <QualificationResponse
                    answer={answer}
                    rows={rows}
                    position={q.position}
                    points={myPoints}
                    slots={slots}
                    remainingMatches={left}
                    inCut={q.inCut}
                    source={source === "jev" ? "jev" : "local"}
                  />
                </div>
              </div>
            )}


          </div>

          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0">
            {(simMode ? SIM_FREQUENT : FREQUENT).map((f, index) => (
              <button
                key={f}
                type="button"
                onClick={() => ask(f)}
                disabled={loading}
                aria-pressed={askedQuestion === f}
                className="group inline-flex min-h-10 items-center gap-1.5 py-1 text-left text-xs leading-snug text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
              >
                {(simMode ? SIM_LABELS : ["Si gano", "Mi rival", "Sin partidos"])[index]}
                <ArrowUpRight
                  className="h-3 w-3 shrink-0"
                  aria-hidden
                />
              </button>
            ))}
          </div>
        </div>
      </BentoCard>
      <div className="grid items-start gap-4">
      {/* Tabla alrededor de la línea de semifinales. */}
      <AnimatedDetails className={cn(BENTO_CARD, BENTO_LIGHT, "qualification-interactive group min-w-0 p-5")}>
        <summary className="flex min-h-6 cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2.5"><span aria-hidden className="h-2.5 w-2.5 rounded-[4px] bg-primary" />Tabla <span className="ml-2 text-xs font-normal text-muted-foreground">{rows.length} parejas</span></span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="pt-4">
        <ol className="overflow-hidden rounded-[var(--radius)] border bg-card">
          {rail.hiddenAbove > 0 && (
            <li className="border-b px-3 py-1 text-xs text-muted-foreground">
              ↑ {rail.hiddenAbove} pareja{rail.hiddenAbove === 1 ? "" : "s"} arriba
            </li>
          )}
          {rail.items.map((r) => {
            const isMe = r.pairId === me.pairId;
            const isLastPlace = r.position === slots && (!simMode || sim?.slots != null);
            return (
              <li key={r.pairId}>
                <div
                  className={`flex items-center gap-3 px-3 py-2 text-sm ${
                    isMe ? "bg-primary/[0.07]" : ""
                  }`}
                >
                  <span className="w-6 shrink-0 font-bold text-base tabular-nums text-muted-foreground">
                    {r.position}°
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate ${isMe ? "font-semibold" : ""}`}
                    title={r.name}
                  >
                    {r.name}
                    {isMe && (
                      <span className="ms-2 rounded-full bg-primary/15 px-1.5 py-0.5 text-caption uppercase tracking-wide text-primary-strong dark:text-primary">
                        tú
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-bold text-base tabular-nums">
                    {round1(r.points)}%
                  </span>
                </div>
                {isLastPlace && (
                  <div className="flex items-center gap-2 px-3">
                    <span className="h-px flex-1 bg-border" aria-hidden />
                    <span className="py-1 text-caption uppercase tracking-[0.14em] text-muted-foreground">
                      semifinales · {simMode ? sim?.slots : slots} lugares
                    </span>
                    <span className="h-px flex-1 bg-border" aria-hidden />
                  </div>
                )}
              </li>
            );
          })}
          {rail.hiddenBelow > 0 && (
            <li className="border-t px-3 py-1 text-xs text-muted-foreground">
              ↓ {rail.hiddenBelow} pareja{rail.hiddenBelow === 1 ? "" : "s"} más abajo
            </li>
          )}
        </ol>
        </div>
      </AnimatedDetails>

      {!simMode && (
      <>
      {/* Los tres finales: una superficie con filas separadas, no texto suelto. */}
      <AnimatedDetails className={cn(BENTO_CARD, BENTO_LIGHT, "qualification-interactive group min-w-0 p-5")}>
        <summary className="flex min-h-6 cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2.5"><span aria-hidden className="h-2.5 w-2.5 rounded-[4px] bg-primary" />Escenarios</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <ul className="mt-4 divide-y">
          {scenarios.map((s) => {
            const Icon = TONE_ICON[s.tone];
            return (
              <li
                key={s.label}
                className="grid gap-x-5 gap-y-1.5 px-4 py-4 sm:grid-cols-[7.5rem_minmax(0,1fr)]"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-foreground/75">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="text-sm font-semibold">{s.label}</span>
                </div>
                <div className="min-w-0 sm:pt-1">
                  <p className="text-sm font-medium">{s.when}</p>
                  <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
                    {s.then}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="border-t px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          Los escenarios asumen que los demás no suman entre sí; la tabla se
          recalcula con cada resultado guardado.
        </p>
      </AnimatedDetails>

      </>
      )}

      </div>
      </div>
    </section>
  );
}
