import type { StandingLike } from "./qualification";

export interface ResponseProps {
  answer: string;
  rows: StandingLike[];
  position: number;
  points: number;
  slots: number;
  remainingMatches: number;
  inCut: boolean;
  source: "jev" | "local";
}

// Solo serializamos datos como literales JSON. Nunca interpolar texto de una
// pregunta, nombre o respuesta como instrucciones de OpenUI Lang.
export function buildQualificationUI(props: ResponseProps): string {
  const { answer, rows, position, points, slots, remainingMatches, inCut, source } = props;
  const literal = (value: unknown) => JSON.stringify(value);
  return [
    'root = Stack([verdict, answer, position, cut, remaining, source, standings])',
    `verdict = VerdictBadge(${literal(inCut ? "pass" : "depends")}, ${literal(inCut ? "Dentro del corte actual" : "Fuera del corte actual")})`,
    `answer = MatchHint(${literal(answer)})`,
    `position = MetricRow("Posición actual", ${literal(`${position}° · ${points}%`)})`,
    `cut = MetricRow("Clasifican", ${literal(String(slots))}, "parejas")`,
    `remaining = MetricRow("Por jugar", ${literal(String(remainingMatches))}, "partidos de esta pareja")`,
    `source = MetricRow("Lectura", ${literal(source === "jev" ? "JEV" : "Cálculo local")}, "con la tabla actual; no es una predicción")`,
    `standings = StandingsTable(${literal(rows.map((row) => ({ pos: row.position, name: row.name, pct: row.points })))}, ${position})`,
  ].join("\n");
}
