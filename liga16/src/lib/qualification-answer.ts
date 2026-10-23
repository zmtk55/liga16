/**
 * Respuestas de clasificación, escritas a partir de la tabla real.
 *
 * OJO con las cifras: en Liga16 `points` NO son puntos de partido, es el
 * porcentaje de rendimiento (`RENDIMIENTO_PTS`, el del Excel). Por eso aquí no
 * se suman "3 puntos por victoria" ni se inventan totales: se habla de
 * posiciones y de puntos porcentuales, y el efecto de ganar se explica en
 * palabras (el porcentaje exacto depende de los juegos de cada partido).
 *
 * JEV aporta la lectura de la pregunta (intención y qué parejas nombra); el
 * texto y las cifras los arma este archivo.
 */
import type { QualificationView, StandingLike } from "@/lib/qualification";
import type { JevReading, QuestionIntent } from "@/lib/jev-question";

interface Args {
  prompt: string;
  rows: StandingLike[];
  me: { pairId: string };
  q: QualificationView;
  slots: number;
  remainingMatches: number;
  /** Lectura semántica de JEV; si falta, se usan las palabras clave. */
  reading?: JevReading | null;
}

/** Sin acentos ni mayúsculas: "Julián" y "julian" son la misma persona. */
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const fmt = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");

/** "Victor Armando / Victor Orozco" → "Victor Armando". */
const short = (name: string) => name.split("/")[0].trim();

/** Parejas nombradas en la pregunta, en el orden en que aparecen. */
function teamsMentioned(prompt: string, rows: StandingLike[]): StandingLike[] {
  const p = norm(prompt);
  const hits: Array<{ row: StandingLike; at: number; score: number }> = [];

  for (const row of rows) {
    const parts = row.name.split("/").map((x) => norm(x.trim()));
    let score = 0;
    let at = Number.POSITIVE_INFINITY;

    for (const part of parts) {
      if (part.length >= 5 && p.includes(part)) {
        score += 3;
        at = Math.min(at, p.indexOf(part));
        continue;
      }
      for (const word of part.split(/\s+/)) {
        if (word.length >= 4 && p.includes(word)) {
          score += 1;
          at = Math.min(at, p.indexOf(word));
        }
      }
    }

    if (score > 0) hits.push({ row, at, score });
  }

  hits.sort((a, b) => a.at - b.at || b.score - a.score);
  return hits
    .slice(0, 2)
    .map((h) => h.row);
}

export function answerQualification({
  prompt,
  rows,
  me,
  q,
  slots,
  remainingMatches,
  reading,
}: Args): string {
  const p = norm(prompt);
  const myPoints = rows.find((r) => r.pairId === me.pairId)?.points ?? 0;
  const lastPlace = rows[slots - 1];
  const lastPoints = lastPlace?.points ?? 0;
  const rival = q.mustBeat[q.mustBeat.length - 1] ?? null;
  const chaser =
    rows.find((r) => r.position === q.position + 1) ?? rows[slots] ?? null;
  const other = q.inCut ? chaser : rival;
  const left = remainingMatches;
  /** Diferencia en PUNTOS PORCENTUALES con la última plaza (no puntos de partido). */
  const gapPct = Math.max(0, Math.round((lastPoints - myPoints) * 10) / 10);
  const tied = !q.inCut && gapPct === 0;

  /** Cómo estás, sin inventar puntos. */
  const standing = q.inCut
    ? `estás ${q.position}° con ${fmt(myPoints)}% de rendimiento y entras a semifinales`
    : tied
      ? `estás ${q.position}° con ${fmt(myPoints)}%, empatado con la última plaza, pero por debajo en el desempate`
      : `estás ${q.position}° con ${fmt(myPoints)}%, a ${fmt(gapPct)} puntos porcentuales de la última plaza (${fmt(lastPoints)}%)`;

  const localIntent = (): QuestionIntent => {
    if (/no tengo|sin partido|ya no|acab|termin/.test(p)) return "sin_partidos";
    if (/rival|no pase|delante|arriba/.test(p)) return "rival";
    if (/posibilidad|probabilidad|chance/.test(p)) return "probabilidad";
    if (/perder|pierdo|pierd|elimin|riesgo/.test(p)) return "perder";
    if (/gan|vence|derrot|paso|clasific|semifinal|pr[oó]ximo|siguiente/.test(p))
      return "ganar";
    return "otra";
  };
  const intent: QuestionIntent =
    reading?.intent && reading.intent !== "otra" ? reading.intent : localIntent();

  /* ---------- 1. Cruce entre dos parejas ---------- */
  const mentions = teamsMentioned(prompt, rows);
  const byPair = (pairId?: string) =>
    pairId ? rows.find((r) => r.pairId === pairId) : undefined;

  const unique = (list: Array<StandingLike | undefined>) => {
    const seen = new Set<string>();
    return list.filter((r): r is StandingLike => {
      if (!r || seen.has(r.pairId)) return false;
      seen.add(r.pairId);
      return true;
    });
  };

  const jevPair = unique([byPair(reading?.winnerId), byPair(reading?.loserId)]);
  const teams = jevPair.length === 2 ? jevPair : unique(mentions);
  const asksAboutResult =
    intent === "cruzar_resultado" ||
    /gan|vence|derrot|pierd|le gana/.test(p) ||
    mentions.length === 2;

  if (teams.length === 2 && asksAboutResult) {
    const [winner, loser] = teams;

    const first = `Si ${winner.name} le gana a ${loser.name}:`;
    const second = `Perder no resta: ${short(loser.name)} se queda con su ${fmt(loser.points)}% de rendimiento. ${short(winner.name)} sí suma y sube el suyo, pero cuánto depende de los juegos de ese partido.`;

    let mine: string;
    if (q.inCut) {
      mine = `Tu lugar no depende de ese cruce: estás ${q.position}° y sigues dentro con ${fmt(myPoints)}%.`;
    } else if (loser.pairId === other?.pairId && tied) {
      mine = `Ese partido no te mete: estás empatado en ${fmt(myPoints)}% con ${short(loser.name)} y el lugar lo decide el desempate, no un resultado de él.`;
    } else if (loser.pairId === other?.pairId) {
      mine = `${short(loser.name)} es el que tienes delante: si no suma, sigue a ${fmt(loser.points)}% y tú necesitas ganar para acercarte a esos ${fmt(gapPct)} puntos porcentuales.`;
    } else if (left === 0) {
      mine = `Ya no te quedan partidos: ese cruce no mueve tu ${fmt(myPoints)}%, así que tu pase depende del desempate o de que el de arriba no sume.`;
    } else {
      mine = `A ti te sirve de poco mientras no ganes: te quedan ${left} partido${left === 1 ? "" : "s"} y necesitas subir tu ${fmt(myPoints)}%.`;
    }

    return [
      first,
      second,
      mine,
      /porcentaje|probabilidad|posibilidades/.test(p)
        ? `Mi estimación con esta tabla: ${Math.round(q.semifinalProbability)}% de pasar. Es una estimación, no un resultado.`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  /* ---------- 2. Posibilidades ---------- */
  if (intent === "probabilidad" || /posibilidad|probabilidad|chance/.test(p)) {
    if (left === 0) {
      return `Sin partidos por jugar no hay nada que calcular: ${standing}. Tu lugar ya está escrito y solo lo mueve el desempate.`;
    }
    return q.inCut
      ? `Hoy ${standing}, con ${left} partido${left === 1 ? "" : "s"} por jugar. Ganar sube tu porcentaje y te mantiene arriba.`
      : `Hoy ${standing}. Te quedan ${left} partido${left === 1 ? "" : "s"}: necesitas ganar y que ${other ? short(other.name) : "el de arriba"} no sume para recortar esos ${fmt(gapPct)} puntos porcentuales.`;
  }

  /* ---------- 3. El rival ---------- */
  if (intent === "rival" || /rival|no pase|delante|arriba/.test(p)) {
    if (!other) {
      return `No tienes a nadie pegado en la tabla: ${standing}. Gana lo que te queda y el pase se resuelve solo.`;
    }
    const diff = Math.round((other.points - myPoints) * 10) / 10;
    const relation =
      diff === 0
        ? `está empatado contigo en ${fmt(other.points)}%`
        : diff > 0
          ? `te lleva ${fmt(diff)} puntos porcentuales (${fmt(other.points)}%)`
          : `está ${fmt(Math.abs(diff))} puntos porcentuales por detrás (${fmt(other.points)}%)`;

    const how =
      diff <= 0
        ? `El que necesita sumar es ${short(other.name)}, no tú: si pierde, se queda con su porcentaje y no te alcanza.`
        : tied
          ? `Si ${short(other.name)} pierde, no sube y sigue empatado contigo: ahí decide el desempate.`
          : `Para pasarlo tienes que ganar y subir tu porcentaje, y que ${short(other.name)} no sume; si él también gana, la diferencia se mantiene o crece.`;

    return [`${other.name} (${other.position}°) ${relation}.`, how, `Ahora mismo ${standing}.`].join("\n\n");
  }

  /* ---------- 4. Ya no hay partidos ---------- */
  if (intent === "sin_partidos" || /no tengo|sin partido|ya no|acab|termin/.test(p)) {
    return left === 0
      ? `Ya no juegas, así que no depende de ti: ${standing}. Lo único que puede moverte es el desempate o que el torneo ajuste la tabla.`
      : `Todavía te queda${left === 1 ? "" : "n"} ${left} partido${left === 1 ? "" : "s"}. ${standing}.`;
  }

  /* ---------- 5. Si pierdo ---------- */
  if (intent === "perder" || /perder|pierdo|pierd|elimin|riesgo/.test(p)) {
    if (left === 0) return `No te queda ningún partido que perder: ${standing}.`;
    return q.inCut
      ? `Si pierdes no sumas y tu ${fmt(myPoints)}% se queda igual, pero el de abajo puede acercarse: con ${left - 1} partido${left - 1 === 1 ? "" : "s"} más lo recuperas.`
      : `Si pierdes no sumas y sigues con ${fmt(myPoints)}%: con ${left - 1} partido${left - 1 === 1 ? "" : "s"} por jugar y ${fmt(gapPct)} puntos porcentuales de diferencia, te queda poco margen.`;
  }

  /* ---------- 6. Si gano ---------- */
  if (intent === "ganar" || /gan|paso|clasific|semifinal|pr[oó]ximo|siguiente/.test(p)) {
    if (left === 0) return `Ya no hay próximo partido: ${standing}.`;
    return q.inCut
      ? [
          `Si ganas el próximo subes tu ${fmt(myPoints)}% de rendimiento y sigues dentro (${q.position}°).`,
          `Te queda${left - 1 === 1 ? "" : "n"} ${left - 1} partido${left - 1 === 1 ? "" : "s"} para pelear el orden del grupo.`,
        ].join("\n\n")
      : [
          `Si ganas el próximo subes tu ${fmt(myPoints)}% de rendimiento, pero cuánto sube depende de los juegos de ese partido.`,
          `Necesitas recortar ${fmt(gapPct)} puntos porcentuales a la última plaza (${fmt(lastPoints)}%) y que ${other ? short(other.name) : "el de arriba"} no sume.`,
        ].join("\n\n");
  }

  /* ---------- 7. Sin intención clara ---------- */
  return q.inCut
    ? [`${standing}.`, `Con ${left} partido${left === 1 ? "" : "s"} por jugar, gana uno y no regalas el promedio.`].join("\n\n")
    : [
        `${standing}.`,
        `Necesitas ganar y que ${other ? short(other.name) : "el de arriba"} no sume. Si quieres, dime dos parejas y te explico ese cruce.`,
      ].join("\n\n");
}
