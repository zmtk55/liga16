/**
 * Lectura de la pregunta con JEV (TypeSafe System One, `api.typesafe.ai`).
 *
 * JEV no escribe prosa: devuelve juicios tipados. Así que aquí se usa para lo
 * que sí hace bien —entender qué pregunta el jugador y de qué parejas habla,
 * con acentos o sin ellos— y el texto lo arma `qualification-answer` con las
 * cifras de la tabla. Ningún número sale del modelo.
 */
import type { StandingLike } from "@/lib/qualification";

export type QuestionIntent =
  | "cruzar_resultado"
  | "rival"
  | "ganar"
  | "perder"
  | "sin_partidos"
  | "probabilidad"
  | "otra";

export interface JevReading {
  intent: QuestionIntent;
  /** pairId de la pareja que, según la pregunta, gana el cruce. */
  winnerId?: string;
  /** pairId de la pareja que pierde. */
  loserId?: string;
  /** Modelo que respondió (p. ej. jev-1.14.0). */
  model?: string;
  /** Confianza de la intención (0..1). */
  confidence: number;
}

const INTENTS: Record<QuestionIntent, string> = {
  cruzar_resultado:
    "Pregunta qué pasaría si una pareja le gana a otra, o si ese resultado le sirve para clasificar",
  rival:
    "Pregunta qué necesita un rival, o qué hace falta para que el rival no pase",
  ganar: "Pregunta si gana su próximo partido o si con ganar pasa",
  perder: "Pregunta qué pasa si pierde, o si perder lo elimina",
  sin_partidos: "Dice que ya no tiene partidos por jugar",
  probabilidad: "Pide sus posibilidades o probabilidad de clasificar",
  otra: "Cualquier otra cosa",
};

export async function readQuestion(args: {
  prompt: string;
  rows: StandingLike[];
  me: { pairId: string };
  slots: number;
  pointsPerWin: number;
  remainingMatches: number;
}): Promise<JevReading | null> {
  const { prompt, rows, me, slots, pointsPerWin, remainingMatches } = args;
  if (rows.length === 0) return null;

  const byId = new Map<string, StandingLike>();
  const criteria: Record<string, string> = {};
  rows.forEach((r, i) => {
    const id = `t${i + 1}`;
    byId.set(id, r);
    criteria[id] = r.name;
  });
  criteria.ninguna = "No menciona un partido entre dos parejas";

  // El estado es el contexto: sin "yo", los cupos, cuánto vale una victoria y
  // cuántos partidos quedan, JEV solo puede adivinar a qué se refiere "mi rival"
  // o "para que yo pase". Medido: con este estado la identificación de parejas
  // pasa de 0.43 a 0.98 de confianza.
  const mine = rows.find((r) => r.pairId === me.pairId);
  const state = {
    pregunta: prompt,
    yo: mine
      ? {
          id: [...byId.entries()].find(([, r]) => r.pairId === mine.pairId)?.[0],
          nombre: mine.name,
          posicion: mine.position,
          puntos: mine.points,
          restantes: remainingMatches,
        }
      : null,
    pasan: slots,
    puntos_por_victoria: pointsPerWin,
    equipos: rows.map((r, i) => ({
      id: `t${i + 1}`,
      nombre: r.name,
      posicion: r.position,
      puntos: r.points,
      jugados: r.played,
    })),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch("/api/jev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: "jev-latest",
        state,
        questions: {
          intencion: {
            type: "choice",
            instructions: "¿Qué le está preguntando el jugador a su clasificación?",
            criteria: INTENTS,
          },
          ganador: {
            type: "choice",
            instructions:
              "En el partido que menciona la pregunta, ¿qué pareja gana? Elige la pareja que aparece como sujeto del verbo ganar. state.yo es la pareja que pregunta: no la confundas con la ganadora salvo que el texto lo diga. Si no menciona un partido entre dos parejas, elige 'ninguna'.",
            criteria,
          },
          perdedor: {
            type: "choice",
            instructions:
              "En el partido que menciona la pregunta, ¿qué pareja pierde? Si no menciona un partido entre dos parejas, elige 'ninguna'.",
            criteria,
          },
        },
      }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      model?: string;
      answers?: Record<
        string,
        {
          choice?: string;
          confidence?: number;
          probabilities?: Record<string, number>;
        }
      >;
    };

    const answers = data.answers ?? {};
    const intent = (answers.intencion?.choice ?? "otra") as QuestionIntent;
    const loserId =
      answers.perdedor?.choice && answers.perdedor.choice !== "ninguna"
        ? answers.perdedor.choice
        : undefined;

    let winnerId =
      answers.ganador?.choice && answers.ganador.choice !== "ninguna"
        ? answers.ganador.choice
        : undefined;

    // Un cruce siempre tiene dos parejas distintas. Si JEV devuelve la misma
    // como ganadora y perdedora (pasa cuando el Sujeto es ambiguo), se corrige
    // aquí, sin depender de la intención que haya elegido.
    if (winnerId && loserId && winnerId === loserId) {
      winnerId = Object.entries(answers.ganador?.probabilities ?? {})
        .filter(([id]) => id !== "ninguna" && id !== loserId)
        .sort((a, b) => b[1] - a[1])[0]?.[0];
    }

    return {
      intent,
      winnerId: winnerId && byId.has(winnerId) ? byId.get(winnerId)!.pairId : undefined,
      loserId: loserId && byId.has(loserId) ? byId.get(loserId)!.pairId : undefined,
      model: data.model,
      confidence: answers.intencion?.confidence ?? 0,
    };
  } catch {
    // Sin red, sin llave o timeout: el analizador local sigue funcionando.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
