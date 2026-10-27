import { describe, it, expect } from "vitest";
import { determineMatchWinner, determineSetWinner, DEFAULT_SCORING } from "@/lib/scoring";

describe("determineSetWinner: sets decididos en tie-break (7-6)", () => {
  it("7-6 sin puntos de TB capturados: gana quien tiene 7", () => {
    expect(determineSetWinner({ a: 7, b: 6, tiebreak_a: null, tiebreak_b: null }, DEFAULT_SCORING)).toBe("a");
    expect(determineSetWinner({ a: 6, b: 7, tiebreak_a: null, tiebreak_b: null }, DEFAULT_SCORING)).toBe("b");
  });
  it("7-6 con puntos de TB capturados: también lo gana quien tiene 7", () => {
    expect(determineSetWinner({ a: 7, b: 6, tiebreak_a: 7, tiebreak_b: 5 }, DEFAULT_SCORING)).toBe("a");
  });
});

describe("determineMatchWinner: el caso reportado (6-2, 7-6)", () => {
  it("cierra el partido 2-0 aunque el segundo set sea 7-6 sin TB", () => {
    const sets = [
      { a: 6, b: 2, tiebreak_a: null, tiebreak_b: null },
      { a: 7, b: 6, tiebreak_a: null, tiebreak_b: null },
    ];
    expect(determineMatchWinner(sets, DEFAULT_SCORING)).toBe("a");
  });
  it("un set 6-5 sigue sin ganador (no está ganado)", () => {
    expect(determineSetWinner({ a: 6, b: 5, tiebreak_a: null, tiebreak_b: null }, DEFAULT_SCORING)).toBeNull();
  });
});
