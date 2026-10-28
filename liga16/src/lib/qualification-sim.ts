/**
 * Frase de predicción basada en simulación real: aplica el cruce preguntado a
 * los partidos del torneo, recalcula la tabla con el orden del torneo y
 * compara posiciones. Dice "depende del marcador" cuando es así y siempre
 * aclara que los marcadores revisados no son todos los posibles.
 */
import { DEFAULT_RANK_ORDER, type RankCriterion } from "@/lib/liga16-scoring";
import { simulateResult, type Roster } from "@/lib/rank-simulator";
import type { Match, TournamentScoring } from "@/types";

export interface SimContext {
  tournamentName: string;
  roster: Roster[];
  matches: Match[];
  order?: RankCriterion[];
  scoring?: TournamentScoring;
  /** Cupos a semifinales del torneo (semifinal_slots). null = el torneo no lo define. */
  slots: number | null;
  /** pair_id de las bajas: sus resultados cuentan, pero no ocupan cupo. */
  withdrawn?: ReadonlySet<string>;
}

export const RANK_LABEL: Record<RankCriterion, string> = {
  points_pct: "% de puntos",
  sets_diff: "diferencia de sets",
  matches_won: "partidos ganados",
  sets_won: "sets ganados",
  matches_played: "partidos jugados",
  head_to_head: "dominio (enfrentamiento directo)",
};

export const orderText = (order?: RankCriterion[]) =>
  (order?.length ? order : DEFAULT_RANK_ORDER).map((c) => RANK_LABEL[c]).join(" > ");

const place = (list: number[]) =>
  list.length === 1 ? `${list[0]}°` : `entre ${list[0]}° y ${list[list.length - 1]}°`;

const PENDING = new Set(["scheduled", "live", "disputed"]);
const sidesOf = (m: Match) => [m.side_a.pair_id, m.side_b.pair_id];
const isPending = (m: Match) => !m.winner && PENDING.has(m.status);
const nameOf = (sim: SimContext, id: string) => sim.roster.find((r) => r.id === id)?.name ?? "?";

/** Dónde queda `meId` y qué pasa con el corte, en frase. */
function whereText(sim: SimContext, positions: number[]): string {
  const place1 = `en los marcadores revisados quedarías ${place(positions)}`;
  if (sim.slots == null) return `${place1} (el torneo no define cuántos pasan a semifinales)`;
  const slots = sim.slots;
  const cut = positions.every((p) => p >= 1 && p <= slots)
    ? `dentro de los ${slots} que pasan`
    : positions.every((p) => p > slots || p === 0)
      ? `fuera de los ${slots} que pasan`
      : `dentro o fuera de los ${slots} que pasan según el marcador`;
  return `${place1}, ${cut}`;
}

/** Reglas y alcance, después del resultado. La muestra limitada va siempre visible. */
const footer = (sim: SimContext, n: number) =>
  `Orden de ${sim.tournamentName}: ${orderText(sim.order)}.${n ? ` Muestra limitada: ${n} marcadores válidos revisados, no todos los posibles.` : ""}`;

/** Sets sin tie-break: el simulador no tiene lista acotada de marcadores. */
const noSim = (sim: SimContext) =>
  sim.scoring?.no_tie_break
    ? `No puedo simular escenarios en ${sim.tournamentName}: sus sets se juegan sin tie-break y los marcadores posibles no tienen tope, así que cualquier muestra acotada sería engañosa.`
    : null;

function run(sim: SimContext, a: string, b: string, winnerSide: "a" | "b", meId: string) {
  const r = simulateResult({
    roster: sim.roster,
    matches: sim.matches,
    a: { id: a, name: nameOf(sim, a) },
    b: { id: b, name: nameOf(sim, b) },
    winnerSide,
    order: sim.order,
    scoring: sim.scoring,
    withdrawn: sim.withdrawn,
  });
  return { mine: r.positions.get(meId) ?? [], n: r.scoresChecked };
}

/** Cruce preguntado: solo se simula un partido REAL pendiente de la fase de grupos. */
export function crossAnswer(args: { sim: SimContext; winnerId: string; loserId: string; meId: string }): string {
  const { sim, winnerId, loserId, meId } = args;
  const wn = nameOf(sim, winnerId);
  const ln = nameOf(sim, loserId);
  if (!sim.roster.some((r) => r.id === winnerId) || !sim.roster.some((r) => r.id === loserId)) {
    return `No puedo simular ese cruce: ${wn} y ${ln} no están las dos en la tabla de ${sim.tournamentName}.`;
  }
  const between = sim.matches.filter((m) => sidesOf(m).includes(winnerId) && sidesOf(m).includes(loserId));
  const pending = between.find(isPending);
  if (!pending) {
    const played = between.find((m) => m.winner);
    const winnerName = played ? (played.winner === "a" ? played.side_a.pair_name : played.side_b.pair_name) : null;
    return played
      ? `${wn} y ${ln} ya jugaron en ${sim.tournamentName} (ganó ${winnerName}) y no hay otro partido pendiente entre ellos en la fase de grupos, así que no hay un cruce que simular.`
      : `En ${sim.tournamentName} no hay un partido pendiente entre ${wn} y ${ln} en la fase de grupos, así que no hay un cruce que simular.`;
  }
  const blocked = noSim(sim);
  if (blocked) return blocked;
  const winnerSideInMatch = pending.side_a.pair_id === winnerId ? "a" : "b";
  const { mine, n } = run(sim, pending.side_a.pair_id as string, pending.side_b.pair_id as string, winnerSideInMatch, meId);
  if (mine.length === 0) return `Con ese resultado no puedo calcular tu posición todavía: aún no tienes partidos con marcador.`;
  return `Si ${wn} le gana a ${ln}: ${whereText(sim, mine)}.\n\n${footer(sim, n)}`;
}

/** Tus partidos pendientes (ganar/perder) y los de otros que mueven tu lugar. */
export function ownAnswer(args: { sim: SimContext; meId: string; mode: "win" | "lose" | "both" }): string {
  const { sim, meId, mode } = args;
  const blocked = noSim(sim);
  if (blocked) return blocked;
  const pend = sim.matches.filter(isPending);
  const mineP = pend.filter((m) => sidesOf(m).includes(meId));
  const lines: string[] = [];
  let checked = 0;
  for (const m of mineP) {
    const mySide = m.side_a.pair_id === meId ? "a" : "b";
    const rival = nameOf(sim, (mySide === "a" ? m.side_b.pair_id : m.side_a.pair_id) as string);
    const parts: string[] = [];
    for (const [label, side, want] of [
      ["si ganas", mySide, mode !== "lose"],
      ["si pierdes", mySide === "a" ? "b" : "a", mode !== "win"],
    ] as const) {
      if (!want) continue;
      const { mine, n } = run(sim, m.side_a.pair_id as string, m.side_b.pair_id as string, side, meId);
      checked = Math.max(checked, n);
      parts.push(`${label}, ${whereText(sim, mine)}`);
    }
    lines.push(`Contra ${rival}: ${parts.join("; ")}.`);
  }
  if (mineP.length === 0) lines.push("No tienes partidos pendientes de la fase de grupos en este torneo.");

  const others: string[] = [];
  for (const m of pend.filter((x) => !sidesOf(x).includes(meId))) {
    const ids = sidesOf(m) as string[];
    if (ids.some((i) => !sim.roster.some((r) => r.id === i))) continue;
    const wa = run(sim, ids[0], ids[1], "a", meId);
    const wb = run(sim, ids[0], ids[1], "b", meId);
    checked = Math.max(checked, wa.n);
    const union = new Set([...wa.mine, ...wb.mine]);
    if (union.size > 1) {
      const same = place(wa.mine) === place(wb.mine);
      others.push(
        same
          ? `${nameOf(sim, ids[0])} vs ${nameOf(sim, ids[1])} (en los marcadores revisados quedarías ${place(wa.mine)} según el marcador)`
          : `${nameOf(sim, ids[0])} vs ${nameOf(sim, ids[1])} (si gana el primero ${place(wa.mine)}; si gana el segundo ${place(wb.mine)})`,
      );
    }
  }
  if (others.length) lines.push(`Partidos de otras parejas que mueven tu lugar: ${others.join("; ")}.`);
  else if (pend.some((x) => !sidesOf(x).includes(meId))) lines.push("Ningún partido pendiente de otras parejas cambia tu lugar, con ningún ganador.");

  return [...lines, footer(sim, checked)].join("\n\n");
}
