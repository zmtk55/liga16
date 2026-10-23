import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowUpRight,
  MessageSquare,
  Send,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Trophy,
} from "lucide-react";
import type { StandingLike, MyLine, CutContext } from "@/lib/qualification";
import { qualificationFor } from "@/lib/qualification";
import { answerQualification } from "@/lib/qualification-answer";
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

const TONE_LABEL: Record<Tone, string> = {
  pass: "Pasa",
  depends: "Depende",
  out: "Riesgo",
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

  /* ---------------- cifras que sostienen todo el panel ---------------- */
  const pw = ctx.pointsPerWin > 0 ? ctx.pointsPerWin : 3;
  const slots = Math.max(1, ctx.slots);
  // Puntos a un decimal: sumar 3 a 3.6 daba 6.600000000000001 en pantalla.
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const myLine = rows.find((r) => r.pairId === me.pairId);
  const myPoints = round1(myLine?.points ?? 0);
  const lastPlace = rows[slots - 1];
  const lastPlacePoints = round1(lastPlace?.points ?? 0);
  // Quien está justo arriba (a quien hay que alcanzar) y justo abajo (el que
  // puede sacarte). Dentro de semifinales el peligro es el de abajo.
  const rival = q.mustBeat[q.mustBeat.length - 1] ?? null;
  const chaser = rows.find((r) => r.position === q.position + 1) ?? rows[slots] ?? null;
  const left = Math.max(0, remainingMatches);
  const winAllPoints = round1(myPoints + pw * left);
  const oneWinPoints = round1(myPoints + pw * Math.min(1, left));

  const missing = q.inCut ? 0 : q.pointsNeeded;
  const winsNeeded = Math.max(0, Math.ceil(missing / pw));

  const verdict: { tone: Tone; word: string; sentence: string } = q.inCut
    ? {
        tone: "pass",
        word: "Estás dentro",
        sentence:
          left > 0
            ? `Vas ${q.position}° de ${rows.length} y pasan ${slots} a semifinales. Te quedan ${left} partido${left === 1 ? "" : "s"}: una victoria te mantiene arriba.`
            : `Vas ${q.position}° de ${rows.length} y pasan ${slots} a semifinales. Ya jugaste todo: si nadie te alcanza, estás en semifinales.`,
      }
    : missing <= pw && left > 0
      ? {
          tone: "depends",
          word: "Depende de ti",
          sentence: `Vas ${q.position}° de ${rows.length}. Te falta${missing === 1 ? "" : "n"} ${missing} punto${missing === 1 ? "" : "s"} para entrar a semifinales y te queda${left === 1 ? "" : "n"} ${left} partido${left === 1 ? "" : "s"}: ganar uno te mete.`,
        }
      : left > 0
        ? {
            tone: "out",
            word: "Fuera por ahora",
            sentence: `Vas ${q.position}° de ${rows.length} y pasan ${slots} a semifinales. Te faltan ${missing} puntos con ${left} partido${left === 1 ? "" : "s"} por jugar: necesitas ${winsNeeded} victoria${winsNeeded === 1 ? "" : "s"} y que ${rival?.name ?? "el de arriba"} no sume.`,
          }
        : {
            tone: "out",
            word: "Sin partidos",
            sentence: `Ya no te quedan partidos: quedaste ${q.position}° de ${rows.length} y pasan ${slots}. ${
              myPoints === lastPlacePoints
                ? `Estás empatado en ${myPoints} puntos con la última plaza, así que el lugar lo decide el desempate.`
                : `Te faltan ${missing} punto${missing === 1 ? "" : "s"} para la última plaza (${lastPlacePoints}) y ya no puedes sumar.`
            }`,
          };

  /* ---------------- los tres finales, con números ---------------- */
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
            then: `Terminas ${q.position}° con ${myPoints} pts y la última plaza quedó en ${lastPlacePoints}.`,
          },
          {
            tone: "depends",
            label: "Depende",
            when: chaser ? `${chaser.name} gana lo suyo` : "Alguien de abajo suma",
            then: chaser
              ? `${chaser.name} se te pone a tiro con ${round1(chaser.points + pw)} pts: tu lugar queda en manos del promedio de sets.`
              : "El de abajo suma y el promedio de sets decide.",
          },
          {
            tone: "out",
            label: "Riesgo",
            when: "Dos de abajo suman",
            then: `Caes al ${q.position + 2}° y quedas fuera de semifinales.`,
          },
        ]
      : [
          {
            tone: "pass",
            label: "Pasas",
            when: "El desempate te favorece",
            then: rival
              ? `Estás empatado en ${myPoints} pts con ${rival.name}: si el promedio de sets te deja arriba, entras.`
              : "Solo si el desempate te deja arriba.",
          },
          {
            tone: "depends",
            label: "Depende",
            when: "El desempate te deja abajo",
            then: `Con los mismos ${myPoints} pts quedas ${q.position}°: necesitas que el torneo ajuste la tabla.`,
          },
          {
            tone: "out",
            label: "Riesgo",
            when: rival ? `${rival.name} gana lo que le queda` : "Los de arriba suman",
            then: rival
              ? `Se va a ${round1(rival.points + pw)} pts y la diferencia ya no se remonta.`
              : "La diferencia ya no se remonta.",
          },
        ]
    : q.inCut
      ? [
          {
            tone: "pass",
            label: "Pasas",
            when: `Ganas 1 de los ${left}`,
            then: `Llegas a ${oneWinPoints} pts y sigues entre los ${slots} que van a semifinales.`,
          },
          {
            tone: "depends",
            label: "Depende",
            when: chaser ? `Pierdes y ${chaser.name} gana` : "Pierdes y alguien de abajo suma",
            then: chaser
              ? `Caes a ${q.position + 1}° y ${chaser.name} te empata con ${round1(chaser.points)} pts: tu pase queda en manos del promedio de sets.`
              : `Caes a ${q.position + 1}° y se te acercan: tu pase queda en manos del promedio de sets.`,
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
            when: `Ganas tus ${left} partido${left === 1 ? "" : "s"} y ${rival?.name ?? "el rival"} pierde`,
            then: `Sumas ${winAllPoints} pts y la última plaza va en ${lastPlacePoints}. ${
              winAllPoints > lastPlacePoints
                ? "Con eso alcanza, sin contar lo que sumen los demás."
                : `Aun ganando todo te faltan ${Math.max(0, lastPlacePoints - winAllPoints + 1)} pts: necesitas que arriba no sumen.`
            }`,
          },
          {
            tone: "depends",
            label: "Depende",
            when: "Ganas 1 y el rival no gana",
            then: rival
              ? `Tú llegas a ${oneWinPoints} pts y ${rival.name} sigue en ${round1(rival.points)}: ${
                  oneWinPoints > rival.points
                    ? `le pasas por ${oneWinPoints - rival.points}.`
                    : `te faltan ${rival.points - oneWinPoints + 1} pts para pasarle.`
                }`
              : `Con ${oneWinPoints} pts te acercas a la última plaza (${lastPlacePoints} pts).`,
          },
          {
            tone: "out",
            label: "Riesgo",
            when: "Pierdes",
            then: `Te quedas en ${myPoints} pts y bajas a ${q.position + 1}°. ${
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
    answerQualification({ prompt, rows, me, q, slots, pointsPerWin: pw, remainingMatches: left, reading });

  const generate = async (prompt: string) => {
    const clean = prompt.trim();
    if (!clean) return;
    setLoading(true);
    setAnswer(null);
    // JEV entiende la pregunta (acentos, subjuntivo, a quién nombra); el texto
    // y las cifras los arma el código. Si falla, el analizador local responde.
    const reading = await readQuestion({ prompt: clean, rows, me, slots, pointsPerWin: pw, remainingMatches: left });
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
      className="mx-auto max-w-7xl space-y-8 px-4 md:px-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
            Semifinales · {slots} lugares
          </p>
          <h2
            id="escenarios-title"
            className="font-black text-2xl uppercase leading-none tracking-[-0.03em] md:text-3xl"
          >
            Qué necesitas para pasar
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">Con la tabla real del torneo</p>
      </div>

      {/* Veredicto: superficie póster de la casa (oscura en ambos temas). */}
      <div className="liga16-card liga16-surface--poster relative overflow-hidden rounded-[var(--radius)]">
        <span className="liga16-stripe" aria-hidden />
        <div className="grid gap-5 p-4 pt-5 sm:p-5 md:grid-cols-[1.15fr_1fr] md:items-end">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 text-caption uppercase tracking-[0.14em] text-white/65">
              <VerdictIcon className="h-4 w-4" aria-hidden />
              {TONE_LABEL[verdict.tone]}
            </span>
            <p className="font-black text-3xl uppercase leading-none tracking-[-0.04em] sm:text-4xl">
              {verdict.word}
            </p>
            <p className="max-w-[60ch] text-sm leading-relaxed text-[hsl(var(--surface-inverse-foreground))]/75">
              {verdict.sentence}
            </p>
          </div>

          <dl className="grid grid-cols-2 divide-x divide-white/10 border-t border-white/10 sm:grid-cols-4">
            {[
              { l: "Posición", v: `${q.position}°` },
              { l: "Pasan", v: `${slots}` },
              { l: "Faltan", v: q.inCut ? "0 pts" : myPoints === lastPlacePoints ? "empate" : `${missing} ${missing === 1 ? "pt" : "pts"}` },
              { l: "Quedan", v: `${left} PJ` },
            ].map((s) => (
              <div key={s.l} className="px-3 py-2 first:ps-0">
                <dt className="text-caption uppercase tracking-[0.12em] text-white/55">
                  {s.l}
                </dt>
                <dd className="font-bold text-xl leading-none tabular-nums">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Tabla alrededor de la línea de semifinales. */}
      <div>
        <p className="mb-2 text-caption uppercase tracking-[0.14em] text-muted-foreground">
          Tabla hacia semifinales
        </p>
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
                  >
                    {r.name}
                    {isMe && (
                      <span className="ms-2 rounded-full bg-primary/15 px-1.5 py-0.5 text-caption uppercase tracking-wide text-primary-strong dark:text-primary">
                        tú
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-bold text-base tabular-nums">
                    {round1(r.points)} pts
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

      {/* Los tres finales: una superficie con filas separadas, no texto suelto. */}
      <div className="overflow-hidden rounded-[var(--radius)] border bg-card">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b px-4 py-3">
          <h3 className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
            Los tres finales posibles
          </h3>
          <span className="text-xs text-muted-foreground">con la tabla de hoy</span>
        </div>

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
      </div>

      {/* Pregunta a la IA: monocromo, con marca animada y las frecuentes abajo. */}
      <div className="overflow-hidden rounded-[var(--radius)] border bg-card">
        <form
          className="flex items-center gap-3 p-3 sm:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
        >
          <span
            className="liga16-ai-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background sm:h-10 sm:w-10"
            aria-hidden
          >
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>

          <label htmlFor="clasificacion-pregunta" className="sr-only">
            Pregunta sobre tu clasificación a semifinales
          </label>
          <Input
            id="clasificacion-pregunta"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Pregunta por tu pase…"
            className="h-10 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 sm:text-base"
            autoComplete="off"
          />

          <Button
            type="submit"
            size="sm"
            className="h-9 w-9 shrink-0 bg-foreground p-0 text-background hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 sm:h-10 sm:w-auto sm:px-3"
            disabled={loading || !question.trim()}
            aria-label="Preguntar a la IA"
          >
            <Send className="h-4 w-4 sm:me-1.5" aria-hidden />
            <span className="hidden sm:inline">{loading ? "Analizando…" : "Preguntar"}</span>
          </Button>
        </form>

        <div className="border-t px-3 py-2.5 sm:px-4">
          <div aria-live="polite" aria-busy={loading}>
            {loading && (
              <div className="space-y-1.5 py-1">
                <span className="sr-only">Analizando tu situación…</span>
                <span className="block h-3 w-4/5 animate-pulse rounded bg-muted-foreground/20" />
                <span className="block h-3 w-3/5 animate-pulse rounded bg-muted-foreground/20" />
              </div>
            )}

            {!loading && answer && (
              <div className="animate-fade-in flex items-start gap-3 py-1">
                <MessageSquare
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="max-w-[72ch] whitespace-pre-line text-sm leading-relaxed">
                    {answer}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {q.position}° · {myPoints} pts · pasan {slots} · {left} partido
                    {left === 1 ? "" : "s"} por jugar ·{" "}
                    {source === "jev" ? "lectura JEV" : "cálculo local"}
                  </p>
                </div>
              </div>
            )}

            {!loading && !answer && (
              <p className="text-xs text-muted-foreground">
                Nombra dos parejas y simulo el cruce: «¿y si Julián le gana a
                Víctor Orozco?»
              </p>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {FREQUENT.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => ask(f)}
                disabled={loading}
                className="group inline-flex items-center gap-1 text-left text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-50"
              >
                {f}
                <ArrowUpRight
                  className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
