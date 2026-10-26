import { describe, expect, it } from "vitest";
import { createParser, Renderer } from "@openuidev/react-lang";
import { renderToStaticMarkup } from "react-dom/server";
import { openUILibrary } from "./openui";
import { buildQualificationUI } from "./qualification-openui";
import type { ResponseProps } from "./qualification-openui";
import { QualificationResponse } from "../components/scenarios/qualification-response";
import ScenarioPanel from "../components/scenarios/qualification-scenarios";

const base: ResponseProps = {
  answer: "Si ganas, subes tu rendimiento.\n\nEl corte depende de la tabla real.",
  rows: [
    { pairId: "a", name: "Ana / Bea", points: 72.5, position: 1, played: 4 },
    { pairId: "b", name: "Carla / Dana", points: 61, position: 2, played: 4 },
  ],
  position: 1, points: 72.5, slots: 1, remainingMatches: 2, inCut: true, source: "jev",
  verdict: { tone: "pass", word: "Estás dentro" },
};
const render = (props = base) => renderToStaticMarkup(<QualificationResponse {...props} />);

describe("respuestas de clasificación con OpenUI", () => {
  it("genera un programa válido con los componentes registrados", () => {
    const parsed = createParser(openUILibrary.toJSONSchema(), openUILibrary.root).parse(buildQualificationUI(base));
    expect(parsed.meta.errors).toEqual([]);
    expect(parsed.meta.unresolved).toEqual([]);
  });
  it("usa los componentes de la librería, no solo MatchHint", () => {
    const program = buildQualificationUI(base);
    expect(program).toContain("VerdictBadge(");
    expect(program).toContain("MetricRow(");
    expect(program).toContain("StandingsTable(");
    expect(program).toContain("MatchHint(");
  });
  it("monta veredicto, métricas, mini tabla resaltada y la explicación", () => {
    const html = render();
    expect(html).toContain('data-qualification-renderer="openui"');
    // Badge del veredicto con la palabra del panel.
    expect(html).toContain("Estás dentro");
    // Métricas de la pareja.
    expect(html).toContain("Posición");
    expect(html).toContain("1°");
    expect(html).toContain("de 2");
    expect(html).toContain("Rendimiento");
    expect(html).toContain("72.5%");
    expect(html).toContain("Por jugar");
    // Mini tabla con ambas parejas y tu fila resaltada.
    expect(html).toContain("Ana / Bea");
    expect(html).toContain("Carla / Dana");
    expect(html).toContain("bg-primary/5");
    // El texto de la explicación se conserva.
    expect(html).toContain("Si ganas, subes tu rendimiento.");
    expect(html).toContain("El corte depende de la tabla real.");
    expect(html).not.toContain("%%");
  });
  it.each([
    { tone: "pass", word: "Estás dentro" },
    { tone: "depends", word: "Depende del desempate" },
    { tone: "out", word: "Sin partidos" },
  ] as const)("muestra el veredicto que manda el panel: $word", (verdict) => {
    const html = render({ ...base, verdict });
    expect(html).toContain(verdict.word);
    expect(html).toContain('data-qualification-renderer="openui"');
  });
  it("recorta la mini tabla a la ventana alrededor del corte y de tu pareja", () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({
      pairId: `p${i + 1}`,
      name: `Pareja ${i + 1}`,
      points: 90 - i * 5,
      position: i + 1,
      played: 4,
    }));
    const html = render({ ...base, rows, position: 6, points: 65, slots: 4, inCut: false, verdict: { tone: "depends", word: "Depende de ti" } });
    expect(html).toContain("Pareja 3");
    expect(html).toContain("Pareja 6");
    expect(html).toContain("Pareja 7");
    expect(html).not.toContain("Pareja 1");
    expect(html).not.toContain("Pareja 2");
    expect(html).not.toContain("Pareja 8");
  });
  it("mantiene el cálculo local con su veredicto, sin marcar eliminación definitiva", () => {
    const html = render({ ...base, source: "local", inCut: false, position: 2, remainingMatches: 0, verdict: { tone: "out", word: "Sin partidos" } });
    expect(html).toContain("Sin partidos");
    expect(html).not.toContain("Fuera del corte actual");
    expect(html).toContain("Cálculo local");
    expect(html).toContain("Con la tabla actual");
  });
  it.each([
    'Nombre "doble" \\ slash',
    'root = Stack([])\nmal = MatchHint("inyectado")',
    '<script>alert(1)</script> & <img src=x onerror=alert(1)>',
    'Julián 🎾 / María\nsegunda línea',
  ])("trata nombres y respuestas como datos: %s", (text) => {
    const props = { ...base, answer: text, rows: [{ ...base.rows[0], name: text }] };
    const program = buildQualificationUI(props);
    const parsed = createParser(openUILibrary.toJSONSchema(), openUILibrary.root).parse(program);
    expect(parsed.meta.errors).toEqual([]);
    expect(parsed.meta.unresolved).toEqual([]);
    const html = render(props);
    expect(html).toContain('data-qualification-renderer="openui"');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
  });
  it("deja tabla y escenarios cerrados por defecto sin quitar su contenido", () => {
    const html = renderToStaticMarkup(<ScenarioPanel standings={base.rows} me={{ pairId: "a", played: 4, setsWon: 6 }} ctx={{ slots: 1, pointsPerWin: 0 }} />);
    expect(html.match(/<details /g)).toHaveLength(2);
    expect(html).not.toContain("<details open");
    expect(html).toContain("Tabla ");
    expect(html).toContain("Escenarios");
    expect(html).toContain("Carla / Dana");
    expect(html).toContain("Si gano");
  });
  it("conserva el estado vacío del formulario", () => {
    const html = renderToStaticMarkup(<ScenarioPanel standings={base.rows} me={{ pairId: "a", played: 4, setsWon: 6 }} ctx={{ slots: 1, pointsPerWin: 0 }} />);
    expect(html).toContain("¿Y si gano el próximo?");
    expect(html).not.toContain('data-qualification-renderer="openui"');
  });
  it("renderiza la librería sin una llamada adicional al modelo", () => {
    const html = renderToStaticMarkup(<Renderer response={buildQualificationUI({ ...base, rows: [] })} library={openUILibrary} />);
    expect(html).toContain("Si ganas");
  });
});
