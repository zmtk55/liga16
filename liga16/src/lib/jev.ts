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
  label: "en racha" | "estable" | "bache";
}

export interface JevAnalysis {
  forma: JevForma;
  estilo: JevEstilo;
  racha: JevRacha;
  consistencia: { score: number; label: string };
  ritmo: Ritmo;
}

// Fallback local (determinístico, calibrado con stats reales) — no requiere API key
export function analyzePlayerLocal(
  player: PlayerProfile,
  card: PlayerCard | null,
  ranking: RankingEntry | null
): JevAnalysis {
  const won = (card as unknown as PlayerCard | null)?.won ?? 0;
  const played = (card as unknown as PlayerCard | null)?.played ?? 1;
  const winRate = won / Math.max(played, 1);
  const recentWins = card?.recent_results.filter((r) => r.startsWith("G")).length ?? 0;
  const trend = card?.trend ?? [];
  const trendSlope = trend.length > 1 ? trend[trend.length - 1] - trend[0] : 0;
  const delta = ranking?.delta ?? 0;

  // Score forma 1-5
  let formaScore: FormaLevel = 3;
  if (winRate > 0.75 && recentWins >= 2 && trendSlope > 0) formaScore = 5;
  else if (winRate > 0.6 && recentWins >= 2) formaScore = 4;
  else if (winRate > 0.45) formaScore = 3;
  else if (winRate > 0.3) formaScore = 2;
  else formaScore = 1;
  const formaLabels: Record<FormaLevel, string> = {
    1: "Bajón - necesita rodaje",
    2: "Irregular",
    3: "Estable",
    4: "En forma",
    5: "Pico competitivo",
  };
  const dist: Record<FormaLevel, number> = { 1: 0.05, 2: 0.1, 3: 0.15, 4: 0.2, 5: 0.15 };
  dist[formaScore] = 0.62;
  const sum = Object.values(dist).reduce((a, b) => a + b, 0);
  (Object.keys(dist) as unknown as FormaLevel[]).forEach((k) => (dist[k]! /= sum));

  // Choice estilo — heurística por posición + mano + nivel
  let estilo: Estilo = "equilibrado";
  if (player.preferred_position === "drive" && player.dominant_hand === "right" && (player.official_level ?? 0) > 4.5) estilo = "ofensivo";
  else if (player.preferred_position === "reves" && player.dominant_hand === "left") estilo = "defensivo";
  else if (Math.abs(trendSlope) < 1) estilo = "equilibrado";
  else estilo = "transición";
  const estiloProbs: Record<Estilo, number> = { ofensivo: 0.15, defensivo: 0.15, equilibrado: 0.15, transición: 0.15 };
  estiloProbs[estilo] = 0.58;
  const eSum = Object.values(estiloProbs).reduce((a, b) => a + b, 0);
  (Object.keys(estiloProbs) as Estilo[]).forEach((k) => (estiloProbs[k] /= eSum));

  // Noul racha
  const probYes = Math.min(0.92, Math.max(0.08, 0.35 + winRate * 0.5 + (recentWins / 3) * 0.2 + (delta > 0 ? 0.1 : delta < 0 ? -0.1 : 0)));
  const rachaLabel: JevRacha["label"] = probYes > 0.65 ? "en racha" : probYes < 0.35 ? "bache" : "estable";

  const consistencia = winRate > 0.7 ? 88 : winRate > 0.55 ? 72 : winRate > 0.4 ? 54 : 38;
  const ritmo: Ritmo = trendSlope > 1 ? "ascendente" : trendSlope < -1 ? "descendente" : "estable";

  return {
    forma: { score: formaScore, confidence: 0.68 + winRate * 0.15, label: formaLabels[formaScore], distribution: dist },
    estilo: { choice: estilo, confidence: 0.61 + Math.abs(trendSlope) * 0.02, probabilities: estiloProbs },
    racha: { probYes, label: rachaLabel },
    consistencia: { score: consistencia, label: consistencia > 75 ? "Muy consistente" : consistencia > 55 ? "Consistente" : "Volátil" },
    ritmo,
  } as JevAnalysis;
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
          label: (a.racha?.probYes ?? 0.5) > 0.65 ? "en racha" : (a.racha?.probYes ?? 0.5) < 0.35 ? "bache" : "estable",
        },
        consistencia: { score: 70, label: "Consistente" },
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
