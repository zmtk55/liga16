import type { StandingLike } from "./qualification";
import type { ScenarioTone } from "./qualification-scenarios";

export interface ResponseProps {
  answer: string;
  rows: StandingLike[];
  position: number;
  points: number;
  slots: number;
  remainingMatches: number;
  inCut: boolean;
  source: "jev" | "local";
  /**
   * Veredicto del panel (se calcula en lib/qualification-scenarios.ts y se
   * pasa tal cual: misma fuente, sin duplicar la lógica aquí).
   */
  verdict: { tone: ScenarioTone; word: string };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const fmtPct = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * La ventana de la mini tabla sigue la misma lógica del rail del panel:
 * alrededor de la línea de semifinales y de tu pareja, con tope de filas
 * para que la respuesta no se vuelva una segunda tabla completa.
 */
function tableWindow(
  rows: StandingLike[],
  position: number,
  slots: number,
): Array<{ pos: number; name: string; pct: number }> {
  const seen = new Set<string>();
  const sorted = rows
    .filter((r) => {
      if (seen.has(r.pairId)) return false;
      seen.add(r.pairId);
      return true;
    })
    .sort((a, b) => a.position - b.position || b.points - a.points);
  const idxMe = sorted.findIndex((r) => r.position === position);
  const me = idxMe === -1 ? 0 : idxMe;
  const start = Math.max(0, Math.min(me, slots - 1) - 1);
  const end = Math.min(sorted.length, Math.max(slots + 1, me + 2));
  return sorted
    .slice(start, end)
    .map((r) => ({ pos: r.position, name: r.name, pct: round1(r.points) }));
}

// Solo serializamos datos como literales JSON. Nunca interpolar texto de una
// pregunta, nombre o respuesta como instrucciones de OpenUI Lang.
export function buildQualificationUI(props: ResponseProps): string {
  // La respuesta ahora sí usa la librería OpenUI: badge del veredicto, las
  // métricas de tu pareja y la mini tabla con tu fila resaltada, además del
  // texto de la explicación (MatchHint) al final.
  const total = props.rows.length;
  const table = tableWindow(props.rows, props.position, props.slots);
  const parts = [
    `VerdictBadge(${JSON.stringify(props.verdict.tone)}, ${JSON.stringify(props.verdict.word)})`,
    `MetricRow(${JSON.stringify("Posición")}, ${JSON.stringify(`${props.position}°`)}, ${JSON.stringify(`de ${total}`)})`,
    `MetricRow(${JSON.stringify("Rendimiento")}, ${JSON.stringify(`${fmtPct(round1(props.points))}%`)}, ${JSON.stringify(`pasan ${props.slots}`)})`,
    `MetricRow(${JSON.stringify("Por jugar")}, ${JSON.stringify(String(props.remainingMatches))}, ${JSON.stringify(props.remainingMatches === 1 ? "partido" : "partidos")})`,
    `StandingsTable(${JSON.stringify(table)}, ${JSON.stringify(props.position)})`,
    `MatchHint(${JSON.stringify(props.answer)})`,
  ];
  return `root = Stack([${parts.join(", ")}])`;
}
