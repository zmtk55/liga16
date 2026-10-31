import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MedalShelf } from "./medal-shelf";
import { MEDAL_CATALOG, type MedalState } from "@/lib/medals";

const sample: MedalState[] = MEDAL_CATALOG.map((def, i) => ({
  def,
  current: i === 0 ? 2 : 0,
  tier: i === 0 ? ("bronce" as const) : null,
  nextTarget: i === 0 ? 3 : def.thresholds?.[0] ?? null,
  progress: i === 0 ? 0.5 : 0,
  detail: "dato de prueba",
}));

describe("MedalShelf", () => {
  it("nace colapsada: título y contador visibles, grid oculta", () => {
    const html = renderToStaticMarkup(<MedalShelf medals={sample} />);
    expect(html).toContain("Repisa de medallas");
    expect(html).toContain("1/9 conseguidas");
    expect(html).toContain('aria-expanded="false"');
    // La grid no se renderiza hasta abrir
    expect(html).not.toContain("mejor racha");
  });
});
