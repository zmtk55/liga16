/**
 * Respuestas de clasificación, escritas a partir de la tabla real.
 *
 * No hay LLM detrás (el endpoint que se usaba no existe), así que la calidad
 * sale de dos cosas: entender a quién nombra la pregunta y simular ese
 * resultado sobre la tabla. Si preguntas "¿y si Julián le gana a Víctor?",
 * se suman los puntos del ganador, se reordena y se dice qué pasa contigo.
 */
import type { QualificationView, StandingLike } from "@/lib/qualification";
import type { JevReading, QuestionIntent } from "@/lib/jev-question";

interface Args {
  prompt: string;
  rows: StandingLike[];
  me: { pairId: string };
  q: QualificationView;
  slots: number;
  pointsPerWin: number;
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

/** "Victor Armando / Victor Orozco" → "Victor Armando" (para no repetir la pareja entera). */
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

  hits.sort((a, b) => b.score - a.score || a.at - b.at);
  return hits
    .slice(0, 2)
    .sort((a, b) => a.at - b.at)
    .map((h) => h.row);
}

/** Aplica una victoria (puntos al ganador) y devuelve la tabla reordenada. */
function simulateWin(
  rows: StandingLike[],
  winner: StandingLike,
  pointsPerWin: number,
) {
  return rows
    .map((r) =>
      r.pairId === winner.pairId ? { ...r, points: r.points + pointsPerWin } : r,
    )
    .sort((a, b) => b.points - a.points || a.position - b.position)
    .map((r, i) => ({ ...r, position: i + 1 }));
}

export function answerQualification({
  prompt,
  rows,
  me,
  q,
  slots,
  pointsPerWin,
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
  const missing = q.inCut ? 0 : q.pointsNeeded;
  const winsNeeded = Math.max(0, Math.ceil(missing / pointsPerWin));

  /** Cómo estás respecto de la última plaza, sin el "a 1" que mentía en empates. */
  const standing = q.inCut
    ? `estás ${q.position}° y entras a semifinales`
    : myPoints === lastPoints
      ? `estás ${q.position}° empatado en ${fmt(myPoints)} puntos con la última plaza, pero por debajo en el desempate`
      : `estás ${q.position}° a ${missing} punto${missing === 1 ? "" : "s"} de la última plaza (${fmt(lastPoints)})`;

  const winOne = myPoints + pointsPerWin;
  const winAll = myPoints + pointsPerWin * left;

  /* ---------- 0. Qué quiso preguntar: JEV si respondió, si no las palabras ---------- */
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

  /* ---------- 1. La pregunta nombra a dos parejas: se simula ese cruce ---------- */
  const named =
    reading?.winnerId && reading?.loserId
      ? [rows.find((r) => r.pairId === reading.winnerId), rows.find((r) => r.pairId === reading.loserId)]
      : teamsMentioned(prompt, rows);
  const teams = named.filter(Boolean) as StandingLike[];
  const asksAboutResult =
    intent === "cruzar_resultado" ||
    /gan|vence|derrot|pierd|le gana/.test(p) ||
    teams.length === 2;

  if (teams.length === 2 && asksAboutResult) {
    const [winner, loser] = teams;
    const after = simulateWin(rows, winner, pointsPerWin);
    const mineAfter = after.find((r) => r.pairId === me.pairId);
    const posAfter = mineAfter?.position ?? q.position;
    const inCutAfter = posAfter <= slots;

    let effect: string;
    if (!q.inCut && inCutAfter) {
      effect = `Con ese resultado entras: pasas al ${posAfter}°.`;
    } else if (q.inCut && !inCutAfter) {
      effect = `Ojo: con eso caes al ${posAfter}° y quedas fuera.`;
    } else if (inCutAfter) {
      effect = `Sigues dentro, en ${posAfter}°.`;
    } else {
      effect = `No te mueve: sigues ${posAfter}°, fuera de semifinales.`;
    }

    const isMyRival = other && loser.pairId === other.pairId;
    const tail = isMyRival && left === 0
      ? `${short(loser.name)} es justo el que tienes delante y ya no te quedan partidos: con ${fmt(myPoints)} puntos empatados, el lugar lo decide el desempate, no un resultado.`
      : isMyRival
        ? `${short(loser.name)} es justo el que tienes delante: para dejarlo atrás necesitas que él no sume y ganar tú, que te pondría en ${fmt(winOne)}.`
        : left === 0
          ? "Como ya no te quedan partidos, ese cruce no cambia tu lugar: tu pase depende del desempate, no de ese resultado."
          : `Te quedan ${left} partido${left === 1 ? "" : "s"}: gana${left === 1 ? "" : "s"} y ${short(loser.name)} no suma y te metes.`;

    return [
      `Si ${winner.name} le gana a ${loser.name}:`,
      `${short(loser.name)} se queda en ${fmt(loser.points)} puntos (perder no resta) y ${short(winner.name)} sube a ${fmt(winner.points + pointsPerWin)}. ${effect}`,
      tail.trim(),
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  /* ---------- 2. Pregunta por "posibilidades" / probabilidad ---------- */
  if (intent === "probabilidad" || /posibilidad|probabilidad|chance|qu[eé] tan cerca/.test(p)) {
    if (left === 0) {
      return `Sin partidos por jugar no hay nada que calcular: ${standing}. Tu lugar ya está escrito y solo lo mueve el desempate.`;
    }
    return q.inCut
      ? `Hoy ${standing} con ${left} partido${left === 1 ? "" : "s"} por jugar. Con una victoria llegas a ${fmt(winOne)} y el pase queda prácticamente asegurado.`
      : `Hoy ${standing}. Te quedan ${left} partido${left === 1 ? "" : "s"}: necesitas ${winsNeeded} victoria${winsNeeded === 1 ? "" : "s"} para llegar a ${fmt(winAll)} puntos y que ${other?.name ?? "el de arriba"} no sume.`;
  }

  /* ---------- 3. Pregunta por el rival ---------- */
  if (intent === "rival" || /rival|no pase|delante|arriba/.test(p)) {
    if (!other) {
      return `No tienes a nadie pegado en la tabla: ${standing}. Gana lo que te queda y el pase se resuelve solo.`;
    }
    const gap = other.points - myPoints;
    const relation =
      gap === 0
        ? `está empatado contigo en ${fmt(other.points)} puntos`
        : gap > 0
          ? `te lleva ${fmt(gap)} punto${gap === 1 ? "" : "s"} (${fmt(other.points)})`
          : `está ${fmt(Math.abs(gap))} punto${Math.abs(gap) === 1 ? "" : "s"} por detrás (${fmt(other.points)})`;

    const how =
      gap < 0
        ? `El que necesita ganar es ${short(other.name)}, no tú: si pierde, no suma y el pase se le aleja.`
        : gap === 0
          ? left === 0
            ? `Está empatado contigo y tú ya no juegas: si ${short(other.name)} gana, se va a ${fmt(other.points + pointsPerWin)} y el pase se le queda; si pierde, sigue en ${fmt(other.points)} y el lugar lo decide el desempate.`
            : `Están empatados: si ${other.name} pierde y tú ganas, te pones arriba con ${fmt(winOne)}.`
          : `Para pasarlo tienes que ganar (llegarías a ${fmt(winOne)}) y que él no sume; si él gana también, la distancia se abre a ${fmt(gap + pointsPerWin)}.`;

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
    if (left === 0) {
      return `No te queda ningún partido que perder: ${standing}.`;
    }
    return q.inCut
      ? `Si pierdes te quedas en ${fmt(myPoints)} y bajas al ${q.position + 1}°, pero sigues vivo: con ${left - 1} partido${left - 1 === 1 ? "" : "s"} más lo recuperas, y si ${other?.name ?? "el rival"} pierde no te saca.`
      : `Si pierdes te quedas en ${fmt(myPoints)} y se te va el margen: con ${left - 1} partido${left - 1 === 1 ? "" : "s"} por jugar y ${missing} puntos de diferencia, la derrota te deja casi fuera.`;
  }

  /* ---------- 6. Si gano ---------- */
  if (intent === "ganar" || /gan|paso|clasific|semifinal|pr[oó]ximo|siguiente/.test(p)) {
    if (left === 0) {
      return `Ya no hay próximo partido: ${standing}.`;
    }
    return q.inCut
      ? [
          `Si ganas el próximo llegas a ${fmt(winOne)} y sigues dentro (${q.position}°).`,
          `Te queda${left - 1 === 1 ? "" : "n"} ${left - 1} partido${left - 1 === 1 ? "" : "s"} para pelear el orden del grupo.`,
        ].join("\n\n")
      : [
          `Si ganas el próximo llegas a ${fmt(winOne)}: ${winOne > lastPoints ? `entras, porque la última plaza está en ${fmt(lastPoints)}` : `aún te faltan ${fmt(lastPoints - winOne + 1)} para la última plaza (${fmt(lastPoints)})`}.`,
          `Necesitas ${winsNeeded} victoria${winsNeeded === 1 ? "" : "s"} de ${left} y que ${other ? short(other.name) : "el de arriba"} no gane todo.`,
        ].join("\n\n");
  }

  /* ---------- 7. Sin intención clara ---------- */
  return q.inCut
    ? [`${standing}.`, `Con ${left} partido${left === 1 ? "" : "s"} por jugar, gana uno y no regalas el promedio.`].join("\n\n")
    : [
        `${standing}.`,
        `Necesitas ${winsNeeded} victoria${winsNeeded === 1 ? "" : "s"} de ${left} y que ${other ? short(other.name) : "el de arriba"} pierda al menos una. Si quieres, dime dos parejas y simulo el cruce.`,
      ].join("\n\n");
}
