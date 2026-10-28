import { describe, it, expect } from "vitest";
import { determineMatchWinner, determineSetWinner, validateScoring, normalizeScoring, DEFAULT_SCORING } from "@/lib/scoring";
import type { SetScore, TournamentScoring } from "@/types";

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

describe("validateScoring: el decisivo según el formato", () => {
  const S = (a: number, b: number): SetScore => ({ a, b, tiebreak_a: null, tiebreak_b: null });

  it("2 de 3: el tercer set debe ser super tie-break a 10", () => {
    expect(validateScoring([S(6, 4), S(4, 6), S(10, 8)], DEFAULT_SCORING)).toBeNull();
    expect(validateScoring([S(6, 4), S(4, 6), S(6, 3)], DEFAULT_SCORING)).toMatch(/desempate/);
  });

  it("3 de 5: el quinto set es el decisivo y debe ser super tie-break a 10", () => {
    const b5 = { ...DEFAULT_SCORING, sets_to_win: 3 };
    expect(validateScoring([S(6, 4), S(4, 6), S(6, 4), S(4, 6), S(10, 8)], b5)).toBeNull();
    expect(validateScoring([S(6, 4), S(4, 6), S(6, 4), S(4, 6), S(6, 3)], b5)).toMatch(/desempate/);
  });

  it("3 de 5: el cuarto set NO es decisivo si el partido va 3-1", () => {
    const b5 = { ...DEFAULT_SCORING, sets_to_win: 3 };
    expect(validateScoring([S(6, 4), S(4, 6), S(6, 4), S(6, 3)], b5)).toBeNull();
  });

  it("a 1 set: el único set es un set normal, no se exige super tie-break", () => {
    const single = { ...DEFAULT_SCORING, sets_to_win: 1 };
    expect(validateScoring([S(6, 4)], single)).toBeNull();
  });
});

describe("determineSetWinner: sets sin tie-break (no_tie_break, ventaja)", () => {
  const ventaja = { ...DEFAULT_SCORING, no_tie_break: true };
  const S = (a: number, b: number): SetScore => ({ a, b, tiebreak_a: null, tiebreak_b: null });

  it("el set se gana por 2 juegos sin tope: 8-6 y 9-7 sí, 7-6 y 6-6 no", () => {
    expect(determineSetWinner(S(8, 6), ventaja)).toBe("a");
    expect(determineSetWinner(S(7, 9), ventaja)).toBe("b");
    expect(determineSetWinner(S(7, 5), ventaja)).toBe("a");
    expect(determineSetWinner(S(7, 6), ventaja)).toBeNull();
    expect(determineSetWinner(S(6, 6), ventaja)).toBeNull();
  });

  it("sin tope real: 99-99 y 100-99 no cierran, 101-99 sí", () => {
    expect(determineSetWinner(S(99, 99), ventaja)).toBeNull();
    expect(determineSetWinner(S(100, 99), ventaja)).toBeNull();
    expect(determineSetWinner(S(101, 99), ventaja)).toBe("a");
  });

  it("el super tie-break del partido sigue cerrando por la regla general", () => {
    expect(determineSetWinner(S(10, 8), ventaja)).toBe("a");
  });
});

describe("compatibilidad: tie_break_at 99 SIN la bandera sigue siendo TB en 99-99", () => {
  it("no reinterpreta configuraciones personalizadas viejas", () => {
    const viejo = { ...DEFAULT_SCORING, tie_break_at: 99 };
    expect(determineSetWinner({ a: 99, b: 99, tiebreak_a: 7, tiebreak_b: 5 }, viejo)).toBe("a");
    expect(determineSetWinner({ a: 99, b: 99, tiebreak_a: 5, tiebreak_b: 5 }, viejo)).toBeNull();
  });
});

describe("validateScoring: no_tie_break rechaza puntos de tie-break en sets", () => {
  it("avisa que el formato no usa tie-break", () => {
    const ventaja = { ...DEFAULT_SCORING, no_tie_break: true };
    const sets: SetScore[] = [{ a: 8, b: 6, tiebreak_a: 7, tiebreak_b: 5 }];
    expect(validateScoring(sets, ventaja)).toMatch(/no usa tie-break/);
    expect(validateScoring([{ a: 8, b: 6, tiebreak_a: null, tiebreak_b: null }], ventaja)).toBeNull();
  });
});

describe("validateScoring: el mensaje de tie-break usa el formato, no un 6-6 fijo", () => {
  it("con sets de 4 juegos menciona 4-4 y 5-4", () => {
    const cortos = { ...DEFAULT_SCORING, games_per_set: 4, tie_break_at: 4 };
    const sets: SetScore[] = [{ a: 5, b: 2, tiebreak_a: 7, tiebreak_b: 5 }];
    expect(validateScoring(sets, cortos)).toMatch(/4-4 ni 5-4/);
  });
});

describe("persistencia de no_tie_break", () => {
  it("sobrevive un roundtrip JSON (guardar -> cargar -> normalizar -> guardar)", () => {
    const saved = { ...DEFAULT_SCORING, no_tie_break: true };
    const loaded = JSON.parse(JSON.stringify(saved));
    const normalized = normalizeScoring(loaded);
    expect(normalized.no_tie_break).toBe(true);
    const resaved = JSON.parse(JSON.stringify(normalized));
    expect(resaved.no_tie_break).toBe(true);
    expect(determineSetWinner({ a: 7, b: 6, tiebreak_a: null, tiebreak_b: null }, normalizeScoring(resaved))).toBeNull();
  });

  it("dato viejo sin la bandera: false, sin reinterpretar", () => {
    const legacy = JSON.parse(JSON.stringify({ ...DEFAULT_SCORING })) as Record<string, unknown>;
    delete legacy.no_tie_break;
    expect(normalizeScoring(legacy as unknown as TournamentScoring).no_tie_break).toBe(false);
  });
});
