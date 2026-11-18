import { describe, expect, it } from "vitest";
import { qualifiersFrom, toggleChoice } from "./qualifier-choice";

const t = ["a", "b", "c", "d", "e"].map((pairId) => ({ pairId }));
describe("qualifiersFrom", () => {
  it("sin elección toma las primeras del cupo", () => {
    expect(qualifiersFrom(t, 4, null).map((r) => r.pairId)).toEqual(["a", "b", "c", "d"]);
  });
  it("con elección respeta quién eligió el admin y el orden de la tabla", () => {
    expect(qualifiersFrom(t, 4, ["e", "a", "c", "d"]).map((r) => r.pairId)).toEqual(["a", "c", "d", "e"]);
  });
  it("ignora ids que ya no están en la tabla (p. ej. baja)", () => {
    expect(qualifiersFrom(t, 4, ["a", "zz"]).map((r) => r.pairId)).toEqual(["a"]);
  });
});
describe("toggleChoice", () => {
  it("quita y agrega, sin pasar del cupo", () => {
    expect(toggleChoice(["a", "b"], "a", 2)).toEqual(["b"]);
    expect(toggleChoice(["a"], "b", 2)).toEqual(["a", "b"]);
    expect(toggleChoice(["a", "b"], "c", 2)).toBeNull();
  });
});
