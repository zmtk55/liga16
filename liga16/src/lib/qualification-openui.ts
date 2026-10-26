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
  // El estado y la tabla ya viven arriba/en los detalles del panel. La respuesta
  // de OpenUI aporta solo la explicación, no una segunda copia del dashboard.
  return `root = Stack([MatchHint(${JSON.stringify(props.answer)})])`;
}
