import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminViewToggle } from "./view-toggle";

describe("Selector de vistas admin", () => {
  it("usa el orden público Tarjetas, Compacta, Tabla aunque el consumidor cambie el orden", () => {
    const html = renderToStaticMarkup(<AdminViewToggle value="tabla" onChange={() => {}} views={["tabla", "cards", "compacta"]} />);
    expect(html.indexOf('aria-label="Tarjetas"')).toBeLessThan(html.indexOf('aria-label="Compacta"'));
    expect(html.indexOf('aria-label="Compacta"')).toBeLessThan(html.indexOf('aria-label="Tabla"'));
    expect(html).toMatch(/aria-checked="true"[^>]*aria-label="Tabla"|aria-label="Tabla"[^>]*aria-checked="true"/);
  });
  it("respeta vistas disponibles sin inventar Compacta", () => {
    const html = renderToStaticMarkup(<AdminViewToggle value="cards" onChange={() => {}} views={["cards", "tabla"]} />);
    expect(html).not.toContain('aria-label="Compacta"');
    expect(html).toContain('aria-label="Tabla"');
  });
});
