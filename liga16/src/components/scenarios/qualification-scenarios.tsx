import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import "./qualification-panel.css";
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
import { qualificationFor } from "@/lib/qualification";
import { answerQualification } from "@/lib/qualification-answer";
import { QualificationResponse } from "./qualification-response";
import { readQuestion } from "@/lib/jev-question";

interface Props {
  standings: StandingLike[];
  me: MyLine;
  ctx: CutContext;
  remainingMatches?: number;
}

const FREQUENT = [
  "¿Paso a semifinales si gano el próximo?",
  "¿Qué necesito para que mi rival no pase?",
  "¿Ya no tengo más partidos: estoy adentro o fuera?",
];

/** Tono del veredicto. El color nunca es el mensaje: lo lleva el icono. */
type Tone = "pass" | "depends" | "out";

const TONE_ICON: Record<Tone, typeof Trophy> = {
  pass: Trophy,
  depends: TrendingUp,
  out: ShieldAlert,
};

export default function ScenarioPanel({
  standings,
  me,
  ctx,
  remainingMatches = 0,
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
  const lastPlace = rows[slots - 1];
  const lastPlacePoints = round1(lastPlace?.points ?? 0);
  const gapPct = q.inCut ? 0 : Math.max(0, round1(lastPlacePoints - myPoints));
  const tiedAtCut = !q.inCut && gapPct === 0;
  // Quien está justo arriba (a quien hay que alcanzar) y justo abajo (el que
  // puede sacarte). Dentro de semifinales el peligro es el de abajo.
  const rival = q.mustBeat[q.mustBeat.length - 1] ?? null;
  const chaser = rows.find((r) => r.position === q.position + 1) ?? rows[slots] ?? null;
  const left = Math.max(0, remainingMatches);

  const verdict: { tone: Tone; word: string; sentence: string } = q.inCut
    ? {
        tone: "pass",
        word: "Estás dentro",
        sentence:
          left > 0
            ? `Vas ${q.position}° de ${rows.length} con ${fmtPct(myPoints)}% de rendimiento y pasan ${slots}. Te quedan ${left} partido${left === 1 ? "" : "s"}: ganar sube tu porcentaje y te mantiene arriba.`
            : `Vas ${q.position}° de ${rows.length} con ${fmtPct(myPoints)}% de rendimiento y pasan ${slots}. Ya jugaste todo: si nadie sube por debajo, sigues en semifinales.`,
      }
    : gapPct <= 1 && left > 0
      ? {
          tone: "depends",
          word: "Depende de ti",
          sentence: `Vas ${q.position}° con ${fmtPct(myPoints)}%: la última plaza está en ${fmtPct(lastPlacePoints)}%. Te queda${left === 1 ? "" : "n"} ${left} partido${left === 1 ? "" : "s"} y ganar sube tu porcentaje.`,
        }
      : left > 0
        ? {
            tone: "out",
            word: "Fuera por ahora",
            sentence: `Vas ${q.position}° de ${rows.length} y pasan ${slots}. Te separan ${fmtPct(gapPct)} puntos porcentuales de la última plaza (${fmtPct(lastPlacePoints)}%) con ${left} partido${left === 1 ? "" : "s"} por jugar: necesitas ganar y que ${rival ? rival.name.split("/")[0].trim() : "el de arriba"} no sume.`,
          }
        : {
            tone: "out",
            word: "Sin partidos",
            sentence: `Ya no te quedan partidos: quedaste ${q.position}° de ${rows.length} y pasan ${slots}. ${
              tiedAtCut
                ? `Estás empatado en ${fmtPct(myPoints)}% con la última plaza, así que el lugar lo decide el desempate.`
                : `Te separan ${fmtPct(gapPct)} puntos porcentuales de la última plaza (${fmtPct(lastPlacePoints)}%) y ya no puedes sumar.`
            }`,
          };

  /* ---------------- los tres finales ----------------
     Sin totales inventados: ganar sube el porcentaje, pero cuánto depende de
     los juegos de cada partido. */
  const scenarios: Array<{
    tone: Tone;
    label: string;
    when: string;
    then: string;
  }> = left === 0
    ? q.inCut
      ? [
          {
            tone: "pass",
            label: "Pasas",
            when: "La tabla no se mueve",
            then: `Terminas ${q.position}° con ${fmtPct(myPoints)}%; la última plaza quedó en ${fmtPct(lastPlacePoints)}%.`,
          },
          {
            tone: "depends",
            label: "Depende",
            when: chaser ? `${chaser.name} gana lo suyo` : "Alguien de abajo suma",
            then: chaser
              ? `${chaser.name} sube su ${fmtPct(round1(chaser.points))}% y te puede alcanzar: el lugar queda en manos del desempate.`
              : "El de abajo suma y el desempate decide.",
          },
          {
            tone: "out",
            label: "Riesgo",
            when: "Dos de abajo suman",
            then: `Puedes caer al ${q.position + 2}° y quedar fuera de semifinales.`,
          },
        ]
      : [
          {
            tone: "pass",
            label: "Pasas",
            when: "El desempate te favorece",
            then: rival
              ? `Estás empatado en ${fmtPct(myPoints)}% con ${rival.name}: si el desempate te deja arriba, entras.`
              : "Solo si el desempate te deja arriba.",
          },
          {
            tone: "depends",
            label: "Depende",
            when: "El desempate te deja abajo",
            then: `Con el mismo ${fmtPct(myPoints)}% quedas ${q.position}°: necesitas que el torneo ajuste la tabla.`,
          },
          {
            tone: "out",
            label: "Riesgo",
            when: rival ? `${rival.name} gana lo que le queda` : "Los de arriba suman",
            then: rival
              ? `${rival.name.split("/")[0].trim()} gana y su ${fmtPct(round1(rival.points))}% sube: la diferencia ya no se remonta.`
              : "La diferencia ya no se remonta.",
          },
        ]
    : q.inCut
      ? [
          {
            tone: "pass",
            label: "Pasas",
            when: `Ganas 1 de los ${left}`,
            then: `Tu ${fmtPct(myPoints)}% sube y sigues entre los ${slots} que van a semifinales.`,
          },
          {
            tone: "depends",
            label: "Depende",
            when: chaser ? `Pierdes y ${chaser.name} gana` : "Pierdes y alguien de abajo suma",
            then: chaser
              ? `Caes a ${q.position + 1}° y ${chaser.name} te puede empatar con su ${fmtPct(round1(chaser.points))}%: decide el desempate.`
              : `Caes a ${q.position + 1}° y se te acercan: decide el desempate.`,
          },
          {
            tone: "out",
            label: "Riesgo",
            when:
              left > 1
                ? `Pierdes 2 seguidos y ${chaser?.name ?? "el de abajo"} gana`
                : `Pierdes y ${chaser?.name ?? "el de abajo"} gana`,
            then: `${chaser ? `Quedas ${q.position + 2}° y ${chaser.name} sube al ${q.position}°.` : `Quedas ${q.position + 2}° y quedas fuera de semifinales.`} Aun así, si EL RIVAL PIERDE, te mantienes.`,
          },
        ]
      : [
          {
            tone: "pass",
            label: "Pasas",
            when: `Ganas tus ${left} partido${left === 1 ? "" : "s"} y ${rival?.name ?? "el rival"} no suma`,
            then: `Tu ${fmtPct(myPoints)}% sube con cada victoria y ${rival ? rival.name.split("/")[0].trim() : "el de arriba"} se queda con el suyo: recortas los ${fmtPct(gapPct)} puntos porcentuales.`,
          },
          {
            tone: "depends",
            label: "Depende",
            when: "Ganas 1 y el rival no gana",
            then: rival
              ? `${rival.name} se queda en ${fmtPct(round1(rival.points))}% y tú acercas tu ${fmtPct(myPoints)}%: cuánto recortas depende de los juegos de tu partido.`
              : `Te acercas a la última plaza (${fmtPct(lastPlacePoints)}%).`,
          },
          {
            tone: "out",
            label: "Riesgo",
            when: "Pierdes",
            then: `No sumas y te quedas con ${fmtPct(myPoints)}%, así que bajas a ${q.position + 1}°. ${
              left > 1
                ? `Todavía te quedaría${left === 2 ? "" : "n"} ${left - 1} partido${left - 1 === 1 ? "" : "s"} para recuperar.`
                : "Sería el último partido del rol."
            }`,
          },
        ];

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
    answerQualification({ prompt, rows, me, q, slots, remainingMatches: left, reading });

  const generate = async (prompt: string) => {
    const clean = prompt.trim();
    if (!clean) return;
    setLoading(true);
    setAnswer(null);
    // JEV entiende la pregunta (acentos, subjuntivo, a quién nombra); el texto
    // y las cifras los arma el código. Si falla, el analizador local responde.
    const reading = await readQuestion({ prompt: clean, rows, me, slots, remainingMatches: left });
    setSource(reading ? "jev" : "local");
    setAnswer(buildAnswer(clean, reading));
    setLoading(false);
  };

  const ask = (text: string) => {
    setQuestion(text);
    void generate(text);
  };

  const VerdictIcon = TONE_ICON[verdict.tone];

  return (
    <section
      aria-labelledby="escenarios-title"
      className="qualification-panel mx-auto max-w-7xl px-4 md:px-6"
    >
      <header className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
        <h2 id="escenarios-title" className="font-display text-3xl font-semibold leading-none tracking-tight">Clasificación</h2>
        <p className="text-xs text-muted-foreground">Semifinales · {slots} lugares</p>
      </header>

      <div className="grid gap-5 pb-5 lg:grid-cols-[0.6fr_1.4fr] lg:gap-8">
        <div>
          <div className="flex items-center gap-4">
            <span className="text-5xl font-semibold leading-none tracking-tight text-primary-strong tabular-nums">{q.position}°</span>
            <div>
              <p className="text-xs text-muted-foreground">Posición actual</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold"><VerdictIcon className="h-3.5 w-3.5" aria-hidden />{verdict.word}</p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {q.inCut
              ? left > 0 ? "Dentro del corte. Tu pase aún puede cambiar." : "Sin partidos pendientes. Dependes de los demás."
              : tiedAtCut ? "Empate en el corte. Decide el desempate." : `A ${fmtPct(gapPct)} puntos porcentuales del corte.`}
          </p>
          <dl className="mt-4 grid grid-cols-2 border-t border-border pt-3">
            <div>
              <dt className="text-xs text-muted-foreground">Rendimiento</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{fmtPct(myPoints)}%</dd>
            </div>
            <div className="border-l border-border pl-4">
              <dt className="text-xs text-muted-foreground">Por jugar</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{left}</dd>
            </div>
          </dl>
        </div>

      {/* Pregunta a la IA: monocromo, con marca animada y las frecuentes abajo. */}
      <div className="min-w-0 rounded-2xl bg-muted p-4 sm:p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden />Pregunta por tu pase</h3>
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
              <div className="animate-fade-in border-t border-border pt-3">
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
            {FREQUENT.map((f, index) => (
              <button
                key={f}
                type="button"
                onClick={() => ask(f)}
                disabled={loading}
                className="group inline-flex min-h-10 items-center gap-1.5 py-1 text-left text-xs leading-snug text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
              >
                {["Si gano", "Mi rival", "Sin partidos"][index]}
                <ArrowUpRight
                  className="h-3 w-3 shrink-0"
                  aria-hidden
                />
              </button>
            ))}
          </div>
        </div>
      </div>
      </div>
      <div className="grid items-start gap-x-8 border-t border-border md:grid-cols-2">
      {/* Tabla alrededor de la línea de semifinales. */}
      <details className="group min-w-0 border-b border-border">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          <span>Tabla <span className="ml-2 text-xs font-normal text-muted-foreground">{rows.length} parejas</span></span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="pb-6">
        <ol className="overflow-hidden rounded-[var(--radius)] border bg-card">
          {rail.hiddenAbove > 0 && (
            <li className="border-b px-3 py-1 text-xs text-muted-foreground">
              ↑ {rail.hiddenAbove} pareja{rail.hiddenAbove === 1 ? "" : "s"} arriba
            </li>
          )}
          {rail.items.map((r) => {
            const isMe = r.pairId === me.pairId;
            const isLastPlace = r.position === slots;
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
                      semifinales · {slots} lugares
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
      </details>

      {/* Los tres finales: una superficie con filas separadas, no texto suelto. */}
      <details className="group min-w-0 border-b border-border">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          <span>Escenarios</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <ul className="divide-y">
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
      </details>

      </div>
    </section>
  );
}
