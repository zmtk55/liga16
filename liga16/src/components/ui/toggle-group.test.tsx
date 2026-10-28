import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

const html = (props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    <ToggleGroup type="single" value="b" variant="outline" size="sm" {...props}>
      <ToggleGroupItem value="a">A</ToggleGroupItem>
      <ToggleGroupItem value="b">B</ToggleGroupItem>
      <ToggleGroupItem value="c" disabled>C</ToggleGroupItem>
    </ToggleGroup>,
  );

describe("ToggleGroup con primitiva de Animate UI", () => {
  it("marca solo el valor seleccionado (selección única)", () => {
    const out = html();
    expect(out).toContain('role="radiogroup"');
    expect((out.match(/data-state="on"/g) ?? []).length).toBe(1);
  });
  it("conserva variante y tamaño en root e items", () => {
    const out = html();
    expect(out).toContain('data-variant="outline"');
    expect(out).toContain('data-size="sm"');
    expect(out).toContain('data-slot="toggle-group-item"');
  });
  it("conserva disabled en el item", () => {
    const out = html();
    const c = out.match(/<button[^>]*>C<\/button>/)?.[0] ?? "";
    expect(c).toContain("disabled");
  });
});
