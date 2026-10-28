import { describe, it, expect } from "vitest";
import { maxSetsForMatch, isMatchDecided, isPlayedSet } from "@/lib/match-result";
import { DEFAULT_SCORING } from "@/lib/scoring";

const S = (a: number, b: number, ta: number | null = null, tb: number | null = null) => ({ a, b, tiebreak_a: ta, tiebreak_b: tb });

describe("maxSetsForMatch", () => {
  it("2 de 3: máximo 3 sets", () => {
    expect(maxSetsForMatch(DEFAULT_SCORING)).toBe(3);
  });
  it("1 set: máximo 1", () => {
    expect(maxSetsForMatch({ ...DEFAULT_SCORING, sets_to_win: 1 })).toBe(1);
  });
  it("3 de 5: máximo 5", () => {
    expect(maxSetsForMatch({ ...DEFAULT_SCORING, sets_to_win: 3 })).toBe(5);
  });
  it("sin scoring usa el default", () => {
    expect(maxSetsForMatch(null)).toBe(3);
    expect(maxSetsForMatch(undefined)).toBe(3);
  });
});

describe("isMatchDecided", () => {
  it("2-0 ya está definido: no ofrecer más sets", () => {
    expect(isMatchDecided([S(6, 4), S(6, 1)], DEFAULT_SCORING)).toBe(true);
  });
  it("2-0 con fila en blanco extra sigue definido", () => {
    expect(isMatchDecided([S(6, 4), S(6, 1), S(0, 0)], DEFAULT_SCORING)).toBe(true);
  });
  it("1-1 no está definido: el desempate sí se ofrece", () => {
    expect(isMatchDecided([S(6, 4), S(3, 6)], DEFAULT_SCORING)).toBe(false);
  });
  it("1-0 no está definido", () => {
    expect(isMatchDecided([S(6, 4)], DEFAULT_SCORING)).toBe(false);
  });
  it("1-1 con super tie-break ya está definido", () => {
    expect(isMatchDecided([S(6, 4), S(3, 6), S(10, 7)], DEFAULT_SCORING)).toBe(true);
  });
  it("7-6 sin puntos de TB cuenta como set ganado (no regresar 9755f9d)", () => {
    expect(isMatchDecided([S(7, 6), S(6, 2)], DEFAULT_SCORING)).toBe(true);
    expect(isMatchDecided([S(6, 7), S(6, 2)], DEFAULT_SCORING)).toBe(false);
  });
  it("sin sets no está definido", () => {
    expect(isMatchDecided([], DEFAULT_SCORING)).toBe(false);
  });
});

describe("isPlayedSet", () => {
  it("0-0 sin TB es hueco en blanco", () => {
    expect(isPlayedSet(S(0, 0))).toBe(false);
  });
  it("fila solo con TB capturado cuenta", () => {
    expect(isPlayedSet(S(0, 0, 10, 7))).toBe(true);
  });
});
