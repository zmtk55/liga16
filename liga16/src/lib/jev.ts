// JEV — TypeSafe System One judgments para pádel
// Usa @typesafe-ai/sdk cuando TYPESAFE_API_KEY está configurado, si no fallback local determinístico.
// Primitivas: Score (forma), Choice (estilo), Noul (racha)

import type { PlayerCard, PlayerProfile, RankingEntry } from "@/types";

export type FormaLevel = 1 | 2 | 3 | 4 | 5;
export type Estilo = "ofensivo" | "defensivo" | "equilibrado" | "transición";
export type Ritmo = "ascendente" | "estable" | "descendente";

export interface JevForma {
  score: FormaLevel; // 1=bajón 5=pico
  confidence: number;
  label: string;
  distribution: Record<FormaLevel, number>;
}

export interface JevEstilo {
  choice: Estilo;
  confidence: number;
  probabilities: Record<Estilo, number>;
}

export interface JevRacha {
  probYes: number; // Noul
  // Palabras planas: la UI y los tests comparan contra estos valores.
  label: "sube" | "parejo" | "le cuesta" | "sin datos";
}

export interface JevAnalysis {
  forma: JevForma;
  estilo: JevEstilo;
  racha: JevRacha;
  consistencia: { score: number; label: string };
  ritmo: Ritmo;
  rival?: JevRival;
}

/** Lo que ya sabemos de verdad del jugador, si viene del récord derivado. */
export type DerivedInput = {
  played: number;
  won: number;
  form: Array<"G" | "P">;
  setsFor?: number;
  /** Rivales de los partidos recientes, con su nivel si el directorio lo tiene. */
  opponents?: Array<{ won: boolean; opponentLevel: number | null }>;
};

const MIN_RIVAL_SAMPLE = 3;

export interface JevRival {
  /** 0-100: cuánto rinde frente a rivales más fuertes que él. */
  score: number;
  /** 100 es ganar siempre; por debajo de 100, la media de la liga. */
  label: "Rinde de más" | "Rinde parejo" | "Le cuestan los mejores" | "Sin datos";
  /** Partidos con nivel de rival conocido que entró en el cálculo. */
  sample: number;
  reliable: boolean;
}

/**
 * Pondera el rendimiento por la calidad del rival: ganar 6-2 a un 5.0 dice más
 * que ganar 6-2 a un 3.0. Un partido pesa 0.75 + 0.25 × (nivel rival - nivel propio).
 */
export function rivalAdjusted({
  opponents,
  myLevel,
  played,
  won,
}: {
  opponents?: Array<{ won: boolean; opponentLevel: number | null }>;
  myLevel: number;
  played: number;
  won: number;
}): JevRival {
  const usable = (opponents ?? []).filter(
    (o): o is { won: boolean; opponentLevel: number } => typeof o.opponentLevel === "number",
  );
  if (usable.length === 0 || played === 0) {
    return { score: 0, label: "Sin datos", sample: usable.length, reliable: false };
  }
  let weightSum = 0;
  let weighted = 0;
  for (const o of usable) {
    const w = Math.min(1.5, Math.max(0.5, 0.75 + (o.opponentLevel - myLevel) * 0.25));
    weightSum += w;
    if (o.won) weighted += w;
  }
  const weightedRate = weightSum > 0 ? weighted / weightSum : 0;
  const rawRate = won / played;
  const score = Math.round(weightedRate * 100);
  const diff = weightedRate - rawRate;
  return {
    score,
    label: diff > 0.06 ? "Rinde de más" : diff < -0.06 ? "Le cuestan los mejores" : "Rinde parejo",
    sample: usable.length,
    reliable: usable.length >= MIN_RIVAL_SAMPLE,
  };
}

/**
 * Fallback local (determinístico, calibrado con stats reales) — no requiere API key.
 *
 * `derived` tiene prioridad sobre `card`: la ficha muestra el récord derivado y
 * el análisis debe salir de la misma fuente, o se contradicen en la misma pantalla.
 */
export function analyzePlayerLocal(
  player: PlayerProfile,
  card: PlayerCard | null,
  ranking: RankingEntry | null,
  derived?: DerivedInput | null
): JevAnalysis {
  const played = derived?.played ?? (card as unknown as PlayerCard | null)?.played ?? 0;
  const won = derived?.won ?? (card as unknown as PlayerCard | null)?.won ?? 0;
  const winRate = played > 0 ? won / played : 0;
  // Sin partidos no hay forma "mala": sería afirmar algo sin datos.
  const sinDatos = played === 0;
  const recentWins = (derived?.form ?? card?.recent_results?.map((r) => ({ r })) ?? [])
    .filter((x) => (typeof x === "string" ? x : x.r).startsWith("G")).length;
  const trend = card?.trend ?? [];
  const trendSlope = trend.length > 1 ? trend[trend.length - 1] - trend[0] : 0;
  const delta = ranking?.delta ?? 0;

  // Score forma 1-5
  let formaScore: FormaLevel = 3;
  if (sinDatos) formaScore = 3;
  else if (winRate > 0.75 && recentWins >= 2 && trendSlope > 0) formaScore = 5;
  else if (winRate > 0.6 && recentWins >= 2) formaScore = 4;
  else if (winRate > 0.45) formaScore = 3;
  else if (winRate > 0.3) formaScore = 2;
  else formaScore = 1;
  // Palabras pensadas para que un jugador las entienda sin manual.
  // Evitamos "déjà vu", "engranado" y "bache" (en España "bache" es un hoyo).
  const formaLabels: Record<FormaLevel, string> = {
    1: "Le cuesta marcar diferencias",
    2: "Juega de más a menos",
    3: "Juega parejo",
    4: "Viene enbuen momento",
    5: "Está jugando su mejor pádel",
  };
  const dist: Record<FormaLevel, number> = { 1: 0.05, 2: 0.1, 3: 0.15, 4: 0.2, 5: 0.15 };
  dist[formaScore] = 0.62;
  // Normalizar de verdad: dividir sin guardar el resultado no hace nada.
  const sum = Object.values(dist).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(dist)) dist[k as unknown as FormaLevel] = v / sum;

  // Choice estilo — heurística por posición + mano + nivel
  let estilo: Estilo = "equilibrado";
  if (sinDatos) estilo = "equilibrado";
  else if (player.preferred_position === "drive" && player.dominant_hand === "right" && (player.official_level ?? 0) > 4.5) estilo = "ofensivo";
  else if (player.preferred_position === "reves" && player.dominant_hand === "left") estilo = "defensivo";
  else if (Math.abs(trendSlope) < 1) estilo = "equilibrado";
  else estilo = "transición";
  const estiloProbs: Record<Estilo, number> = { ofensivo: 0.15, defensivo: 0.15, equilibrado: 0.15, transición: 0.15 };
  estiloProbs[estilo] = 0.58;
  const eSum = Object.values(estiloProbs).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(estiloProbs)) estiloProbs[k as Estilo] = v / eSum;

  // Noul racha
  const probYes = sinDatos
    ? 0.5
    : Math.min(0.92, Math.max(0.08, 0.35 + winRate * 0.5 + (recentWins / 3) * 0.2 + (delta > 0 ? 0.1 : delta < 0 ? -0.1 : 0)));
  const rachaLabel: JevRacha["label"] = sinDatos
    ? "sin datos"
    : probYes > 0.65 ? "sube" : probYes < 0.35 ? "le cuesta" : "parejo";

  const consistencia = sinDatos ? 0 : winRate > 0.7 ? 88 : winRate > 0.55 ? 72 : winRate > 0.4 ? 54 : 38;
  const ritmo: Ritmo = sinDatos || trend.length < 2 ? "estable" : trendSlope > 1 ? "ascendente" : trendSlope < -1 ? "descendente" : "estable";

  // Rival real: ganar no vale igual contra todos. Ponderamos cada partido por el
  // nivel del rival de ese partido, no por su nivel declarado.
  const rival = rivalAdjusted({
    opponents: derived?.opponents,
    myLevel: player.official_level ?? player.declared_level,
    played,
    won,
  });

  return {
    forma: {
      score: formaScore,
      // Sin partidos no se afirma nada con confianza.
      confidence: sinDatos ? 0 : 0.68 + winRate * 0.15,
      label: sinDatos ? "Aún no hay partidos" : formaLabels[formaScore],
      distribution: dist,
    },
    estilo: { choice: estilo, confidence: sinDatos ? 0 : 0.61 + Math.abs(trendSlope) * 0.02, probabilities: estiloProbs },
    racha: { probYes, label: rachaLabel },
    consistencia: {
      score: consistencia,
      label: sinDatos
        ? "Sin datos"
        : consistencia > 75
          ? "Gana parejo casi siempre"
          : consistencia > 55
            ? "Gana más de lo que pierde"
            : "Le cuesta mantener el nivel",
    },
    ritmo,
    rival,
  } as JevAnalysis;
}

/** Si hay API key, JEV corre de verdad; si no, el fallback local. */
export const JEV_REMOTE_ENABLED = Boolean(import.meta.env.VITE_TYPESAFE_API_KEY as string | undefined);

/** Registro de una pareja, tal como lo resumen los resultados capturados. */
export type PairRecordInput = {
  played: number;
  won: number;
  /** Resultado de cada partido, del más antiguo al más reciente. */
  form?: Array<"G" | "P">;
};

export interface PairPerformance {
  /** 1 = mal momento, 5 = en pico. Mismos cortes que la forma de un jugador. */
  forma: FormaLevel;
  formaLabel: string;
  winRate: number;
  racha: { label: JevRacha["label"]; won: number; lost: number };
  /** Últimos resultados, del más antiguo al más reciente. */
  form: Array<"G" | "P">;
}

/**
 * Desempeño de una PAREJA a partir de los resultados que capturó el admin.
 * El ranking no se edita a mano: se calcula desde estos partidos, así que
 * esta lectura es la misma que ve el público.
 *
 * Reutiliza los cortes de `analyzePlayerLocal` para que "en forma" signifique
 * lo mismo para una persona que para una dupla.
 */
export function analyzePairLocal(record: PairRecordInput): PairPerformance {
  const played = Math.max(record.played, 0);
  const winRate = played ? record.won / played : 0;
  const form = record.form ?? [];
  const recentWins = form.slice(-3).filter((r) => r === "G").length;

  let forma: FormaLevel = 3;
  if (winRate > 0.75 && recentWins >= 2) forma = 5;
  else if (winRate > 0.6 && recentWins >= 2) forma = 4;
  else if (winRate > 0.45) forma = 3;
  else if (winRate > 0.3) forma = 2;
  else forma = 1;

  const formaLabels: Record<FormaLevel, string> = {
    1: "Le cuesta marcar diferencias",
    2: "Juega de más a menos",
    3: "Juega parejo",
    4: "Viene en buen momento",
    5: "Está jugando su mejor pádel",
  };

  // Momentum: los últimos 3 pesan más que la temporada entera, que es lo que
  // la gente entiende por "racha".
  const last3 = form.slice(-3);
  const streakWon = last3.filter((r) => r === "G").length;
  const racha: JevRacha["label"] =
    last3.length === 0 ? "sin datos" : streakWon === 3 ? "sube" : streakWon === 0 ? "le cuesta" : "parejo";

  return {
    forma,
    formaLabel: played === 0 ? "Aún no hay partidos" : formaLabels[forma],
    winRate: Math.round(winRate * 100),
    racha: { label: racha, won: streakWon, lost: last3.length - streakWon },
    form,
  };
}

// Wrapper que intenta usar TypeSafe SDK si hay API key, si no usa local
export async function analyzePlayerWithJev(
  player: PlayerProfile,
  card: PlayerCard | null,
  ranking: RankingEntry | null
): Promise<JevAnalysis> {
  const key = import.meta.env.VITE_TYPESAFE_API_KEY as string | undefined;
  if (!key) return analyzePlayerLocal(player, card, ranking);

  try {
    const { TypeSafeClient, score, choice, noul } = await import("@typesafe-ai/sdk");
    const client = new TypeSafeClient({ apiKey: key });
    const state = {
      player: {
        nombre: player.display_name,
        nivel: player.official_level ?? player.declared_level,
        mano: player.dominant_hand,
        posicion: player.preferred_position,
        ciudad: player.city,
        titulos: card?.titles ?? 0,
        record: card ? { played: (card as unknown as { played: number }).played ?? 0, won: (card as unknown as { won: number }).won ?? 0 } : { played: 0, won: 0 },
        recientes: card?.recent_results.join(" | ") ?? "sin datos",
        tendencia: (card?.trend ?? []).join(","),
        ranking: ranking ? `#${ranking.position} ${ranking.points}pts Δ${ranking.delta}` : "sin ranking",
        bio: player.bio ?? "",
      },
    };
    const res = await (client.systemOne as unknown as (req: unknown) => Promise<{ answers: unknown }>)({
      state,
      questions: {
        forma: score("Evalúa forma competitiva reciente del jugador de pádel", { 1: "Bajón", 2: "Irregular", 3: "Estable", 4: "En forma", 5: "Pico" } as unknown as Parameters<typeof score>[1]),
        estilo: choice("Estilo de juego predominante en pádel", {
          ofensivo: "Atacante, define en red, volea agresiva",
          defensivo: "Contención, globo y bandeja, espera error rival",
          equilibrado: "Versátil, adapta según pareja y rival",
          transición: "Transición rápida defensa-ataque",
        }),
        racha: noul("¿Está actualmente en racha positiva?"),
      },
    });
    // Map SDK response to our type, fallback to local if shape differs
    const a = res.answers as Record<string, unknown> & {
      forma?: { score?: number; confidence?: number; distribution?: Record<number, number> };
      estilo?: { choice?: string; confidence?: number; probabilities?: Record<string, number> };
      racha?: { probYes?: number; probability?: number };
    };
    if (a?.forma?.score && a?.estilo?.choice) {
      return {
        forma: {
          score: a.forma.score as FormaLevel,
          confidence: a.forma.confidence ?? 0.7,
          label: String(a.forma.score),
          distribution: a.forma.distribution ?? { 1: 0.2, 2: 0.2, 3: 0.2, 4: 0.2, 5: 0.2 },
        },
        estilo: {
          choice: a.estilo.choice as Estilo,
          confidence: a.estilo.confidence ?? 0.65,
          probabilities: a.estilo.probabilities ?? { ofensivo: 0.25, defensivo: 0.25, equilibrado: 0.25, transición: 0.25 },
        },
        racha: {
          probYes: a.racha?.probYes ?? a.racha?.probability ?? 0.5,
          label: (a.racha?.probYes ?? 0.5) > 0.65 ? "sube" : (a.racha?.probYes ?? 0.5) < 0.35 ? "le cuesta" : "parejo",
        },
        consistencia: { score: 70, label: "Gana más de lo que pierde" },
        ritmo: "estable",
      };
    }
    return analyzePlayerLocal(player, card, ranking);
  } catch {
    return analyzePlayerLocal(player, card, ranking);
  }
}

export function comparePlayers(a: JevAnalysis, b: JevAnalysis) {
  const formaDiff = a.forma.score - b.forma.score;
  const consDiff = a.consistencia.score - b.consistencia.score;
  return { formaDiff, consDiff, estiloMatch: a.estilo.choice === b.estilo.choice };
}
