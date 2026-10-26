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
};
const render = (props = base) => renderToStaticMarkup(<QualificationResponse {...props} />);

describe("respuestas de clasificación con OpenUI", () => {
  it("genera un programa válido con los componentes registrados", () => {
    const parsed = createParser(openUILibrary.toJSONSchema(), openUILibrary.root).parse(buildQualificationUI(base));
    expect(parsed.meta.errors).toEqual([]);
    expect(parsed.meta.unresolved).toEqual([]);
  });
  it("monta Renderer con la explicación sin duplicar tabla ni métricas", () => {
    const html = render();
    expect(html).toContain('data-qualification-renderer="openui"');
    expect(html).toContain("Si ganas, subes tu rendimiento.");
    expect(html).toContain("El corte depende de la tabla real.");
    expect(html).not.toContain("Dentro del corte actual");
    expect(html).not.toContain("Carla / Dana");
    expect(html).not.toContain("Posición actual");
    expect(html).not.toContain("%%");
    expect(html).not.toContain("Víctor Orozco");
  });
  it("mantiene el cálculo local y no marca fuera como eliminación definitiva", () => {
    const html = render({ ...base, source: "local", inCut: false, position: 2, remainingMatches: 0 });
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
    expect(html).toContain("Tabla de clasificación");
    expect(html).toContain("Explorar escenarios");
    expect(html).toContain("Carla / Dana");
    expect(html).toContain("Si gano el próximo");
  });
  it("conserva el estado vacío del formulario", () => {
    const html = renderToStaticMarkup(<ScenarioPanel standings={base.rows} me={{ pairId: "a", played: 4, setsWon: 6 }} ctx={{ slots: 1, pointsPerWin: 0 }} />);
    expect(html).toContain("Pregunta por tu pase");
    expect(html).not.toContain('data-qualification-renderer="openui"');
  });
  it("renderiza la librería sin una llamada adicional al modelo", () => {
    const html = renderToStaticMarkup(<Renderer response={buildQualificationUI({ ...base, rows: [] })} library={openUILibrary} />);
    expect(html).toContain("Si ganas");
  });
});
