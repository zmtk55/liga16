import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { Table, TableHead, TableHeader, TableRow } from "./table";

function nav(path: string) {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><MobileBottomNav /></MemoryRouter>);
}
describe("Navegación móvil de Animate UI", () => {
  it("conserva los cinco destinos y nombres legibles", () => {
    const html = nav("/calendario");
    for (const path of ["/", "/torneos", "/equipos", "/jugadores", "/calendario"]) expect(html).toContain(`href="${path}"`);
    expect(html).toContain('aria-label="Navegación principal"');
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(1);
  });
  it("activa el padre de un detalle y no inventa selección en Ranking", () => {
    expect(nav("/equipos/pareja-demo")).toMatch(/href="\/equipos"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/equipos"/);
    expect(nav("/ranking")).not.toContain('aria-current="page"');
  });
});
describe("Tabla compartida", () => {
  it("conserva semántica, clases y definición con etiqueta abreviada", () => {
    const html = renderToStaticMarkup(<Table className="demo" aria-label="Ranking"><TableHeader><TableRow><TableHead title="Partidos jugados" className="text-end">PJ</TableHead><TableHead>Pareja</TableHead></TableRow></TableHeader></Table>);
    expect(html).toContain('<table data-slot="table"');
    expect(html).toContain('aria-label="Ranking"');
    expect(html).toContain('aria-label="PJ: Partidos jugados"');
    expect(html).toContain('type="button"');
    expect(html).not.toContain('title="Partidos jugados"');
    expect(html).toContain('text-end');
    expect(html).toContain('>Pareja</th>');
  });
});
