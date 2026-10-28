import { describe, it, expect } from "vitest";
import { historicTieBreakNote, captureRowToSet, maxSetsForMatch, isMatchDecided, isPlayedSet, isSuperTieBreakRow, setToCaptureRow, tieBreakDirectNotation } from "@/lib/match-result";
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

describe("isSuperTieBreakRow", () => {
  it("en un 2 de 3 solo la tercera fila es super tie-break", () => {
    expect(isSuperTieBreakRow(0, null)).toBe(false);
    expect(isSuperTieBreakRow(1, null)).toBe(false);
    expect(isSuperTieBreakRow(2, null)).toBe(true);
  });

  it("un partido a 1 set no tiene fila de super tie-break", () => {
    const scoring = { ...DEFAULT_SCORING, sets_to_win: 1 };
    expect(isSuperTieBreakRow(0, scoring)).toBe(false);
  });
});

describe("setToCaptureRow (captura estilo Excel)", () => {
  it("un set normal se muestra tal cual", () => {
    expect(setToCaptureRow({ a: 6, b: 4 }, false)).toEqual({ a: "6", b: "4" });
  });

  it("un 6-6 con tie-break se muestra como 7-6 directo", () => {
    expect(setToCaptureRow({ a: 6, b: 6, tiebreak_a: 7, tiebreak_b: 5 }, false)).toEqual({ a: "7", b: "6" });
    expect(setToCaptureRow({ a: 6, b: 6, tiebreak_a: 3, tiebreak_b: 7 }, false)).toEqual({ a: "6", b: "7" });
  });

  it("un super tie-break guardado como juegos muestra los puntos", () => {
    expect(setToCaptureRow({ a: 10, b: 8 }, true)).toEqual({ a: "10", b: "8" });
  });

  it("un super tie-break en formato viejo (puntos en tiebreak_a/b) muestra los puntos", () => {
    expect(setToCaptureRow({ a: 0, b: 0, tiebreak_a: 10, tiebreak_b: 8 }, true)).toEqual({ a: "10", b: "8" });
  });

  it("fila de super tie-break vacía queda en blanco", () => {
    expect(setToCaptureRow({ a: 0, b: 0 }, true)).toEqual({ a: "", b: "" });
  });
});

describe("captureRowToSet", () => {
  it("fila sin cambios conserva un tie-break parcial guardado", () => {
    expect(captureRowToSet({ a: "6", b: "6" }, { a: 6, b: 6, tiebreak_a: 7, tiebreak_b: null }))
      .toEqual({ a: 6, b: 6, tiebreak_a: 7, tiebreak_b: null });
  });

  it("fila sin cambios conserva el tie-break completo tal cual", () => {
    expect(captureRowToSet({ a: "6", b: "6" }, { a: 6, b: 6, tiebreak_a: 7, tiebreak_b: 5 }))
      .toEqual({ a: 6, b: 6, tiebreak_a: 7, tiebreak_b: 5 });
  });

  it("fila editada escribe tie-breaks en null", () => {
    expect(captureRowToSet({ a: "7", b: "6" }, { a: 6, b: 6, tiebreak_a: 7, tiebreak_b: 5 }))
      .toEqual({ a: 7, b: 6, tiebreak_a: null, tiebreak_b: null });
  });

  it("fila nueva sin original escribe tie-breaks en null", () => {
    expect(captureRowToSet({ a: "6", b: "4" })).toEqual({ a: 6, b: 4, tiebreak_a: null, tiebreak_b: null });
  });

  it("super tie-break viejo (puntos en tiebreak) se normaliza a juegos", () => {
    expect(captureRowToSet({ a: "10", b: "8" }, { a: 0, b: 0, tiebreak_a: 10, tiebreak_b: 8 }))
      .toEqual({ a: 10, b: 8, tiebreak_a: null, tiebreak_b: null });
  });
});

describe("tieBreakDirectNotation", () => {
  it("deriva la notación directa del formato", () => {
    expect(tieBreakDirectNotation(DEFAULT_SCORING)).toBe("7-6");
    expect(tieBreakDirectNotation({ ...DEFAULT_SCORING, games_per_set: 4, tie_break_at: 4 })).toBe("5-4");
    expect(tieBreakDirectNotation({ ...DEFAULT_SCORING, games_per_set: 9, tie_break_at: 9 })).toBe("10-9");
    expect(tieBreakDirectNotation({ ...DEFAULT_SCORING, no_tie_break: true })).toBeNull();
    expect(tieBreakDirectNotation({ ...DEFAULT_SCORING, tie_break_at: 99 })).toBeNull();
    expect(tieBreakDirectNotation(null)).toBe("7-6");
  });
});

describe("ida y vuelta de la captura con tie-break histórico", () => {
  it("6-6 con TB parcial sin tocar: se muestra 6-6 y al guardar conserva los puntos de TB", () => {
    const orig = S(6, 6, 7, null);
    const row = setToCaptureRow(orig, false);
    expect(row).toEqual({ a: "6", b: "6" });
    expect(captureRowToSet(row, orig)).toEqual(orig);
  });
  it("6-6 con TB 7-5: el campo muestra 7-6 (normalización de PR21) y guarda 7-6", () => {
    const orig = S(6, 6, 7, 5);
    const row = setToCaptureRow(orig, false);
    expect(row).toEqual({ a: "7", b: "6" });
    expect(captureRowToSet(row, orig)).toEqual(S(7, 6));
  });
  it("set 7-6 ya normalizado sin tocar se conserva igual", () => {
    const orig = S(7, 6);
    expect(captureRowToSet(setToCaptureRow(orig, false), orig)).toEqual(orig);
  });
});

describe("historicTieBreakNote", () => {
  it("6-6 con TB 7-5 sin tocar: nota TB 7-5", () => {
    const o = S(6, 6, 7, 5);
    expect(historicTieBreakNote(o, setToCaptureRow(o, false), false)).toBe("TB 7-5");
  });
  it("TB parcial: muestra guion en el faltante", () => {
    const o = S(6, 6, 7, null);
    expect(historicTieBreakNote(o, setToCaptureRow(o, false), false)).toBe("TB 7-–");
  });
  it("si el set se edita, la nota desaparece", () => {
    const o = S(6, 6, 7, 5);
    expect(historicTieBreakNote(o, { a: "6", b: "4" }, false)).toBeNull();
  });
  it("sin TB, super tie-break o sin set original: sin nota", () => {
    expect(historicTieBreakNote(S(6, 4), { a: "6", b: "4" }, false)).toBeNull();
    expect(historicTieBreakNote(S(0, 0, 10, 8), { a: "10", b: "8" }, true)).toBeNull();
    expect(historicTieBreakNote(undefined, { a: "6", b: "4" }, false)).toBeNull();
  });
});
