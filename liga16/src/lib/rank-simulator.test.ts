import { describe, it, expect } from "vitest";
import { enumerateScores, simulateResult, rankPositions } from "./rank-simulator";
import type { Match } from "@/types";

const R = [{ id: "A", name: "A" }, { id: "B", name: "B" }, { id: "C", name: "C" }];
const played = (a: string, b: string, winner: "a" | "b", s: [number, number][]) =>
  ({ id: a + b, status: "finished", winner, side_a: { pair_id: a, pair_name: a }, side_b: { pair_id: b, pair_name: b },
     sets: s.map(([x, y]) => ({ a: x, b: y })) }) as unknown as Match;

describe("simulador", () => {
  it("enumera marcadores válidos con ese ganador", () => {
    const s = enumerateScores("a");
    expect(s.length).toBeGreaterThan(10);
    expect(s.some((p) => p.sets[0].a === 6 && p.sets[0].b === 0)).toBe(true);
  });
  it("recalcula posiciones: el orden depende del criterio", () => {
    // B ganó a C; A solo jugó. Simulamos A gana a B.
    const ms = [played("B", "C", "a", [[6, 4], [6, 4]])];
    const r = simulateResult({ roster: R, matches: ms, a: R[0], b: R[1], winnerSide: "a" });
    expect(r.exhaustive).toBe(false);
    expect(r.positions.get("A")![0]).toBeLessThanOrEqual(2);
    expect(rankPositions(R, ms).get("C")).toBe(2);
  });
  it("con matches_won primero, ganar siempre deja a A arriba de B", () => {
    const ms = [played("B", "C", "a", [[6, 0], [6, 0]])];
    const r = simulateResult({ roster: R, matches: ms, a: R[0], b: R[1], winnerSide: "a", order: ["matches_won", "head_to_head", "points_pct"] });
    // A y B tienen 1 ganado; el directo lo gana A en cualquier marcador
    expect(r.positions.get("A")).toEqual([1]);
    expect(r.positions.get("B")).toEqual([2]);
  });
});

import { enumerateScoresForFormat } from "./rank-simulator";
describe("formato configurado", () => {
  const base = { sets_to_win: 1, games_per_set: 6, tie_break_at: 6, tie_break_points: 7, win_by_two_tiebreak: true };
  it("a 1 set todos los marcadores tienen un solo set", () => {
    const p = enumerateScoresForFormat("a", base);
    expect(p.length).toBeGreaterThan(3);
    expect(p.every((x) => x.sets.length === 1)).toBe(true);
  });
  it("a 2 de 3 hay marcadores de 2 y de 3 sets", () => {
    const p = enumerateScoresForFormat("a", { ...base, sets_to_win: 2 });
    const lens = new Set(p.map((x) => x.sets.length));
    expect(lens.has(2) && lens.has(3)).toBe(true);
  });
  it("simulateResult usa el formato", () => {
    const r = simulateResult({ roster: R, matches: [], a: R[0], b: R[1], winnerSide: "a", scoring: base });
    expect(r.positions.get("A")).toEqual([1]);
  });
});

describe("bajas: no ocupan cupo pero sus resultados cuentan", () => {
  // B (baja) le ganó a A y a C. C le ganó a A.
  const ms = [played("B", "A", "a", [[6, 0], [6, 0]]), played("B", "C", "a", [[6, 0], [6, 0]]), played("C", "A", "a", [[6, 4], [6, 4]])];
  it("sin marcar baja, B es 1º", () => {
    expect(rankPositions(R, ms).get("B")).toBe(1);
  });
  it("con B de baja: sale del mapa, C pasa a 1º y A a 2º", () => {
    const pos = rankPositions(R, ms, undefined, new Set(["B"]));
    expect(pos.has("B")).toBe(false);
    expect(pos.get("C")).toBe(1);
    expect(pos.get("A")).toBe(2);
  });
  it("sus partidos siguen en las estadísticas: la derrota de A ante B sigue contando", () => {
    const withB = rankPositions(R, ms, ["matches_won", "points_pct"], new Set(["B"]));
    const withoutBMatches = rankPositions([R[0], R[2]], [ms[2]], ["matches_won", "points_pct"]);
    expect(withB.get("C")).toBe(withoutBMatches.get("C"));
    // A con 0 de 2 jugados, C con 1 de 2: la baja no cambia el orden entre ellos pero sí cuenta PJ
    expect(withB.get("A")).toBe(2);
  });
  it("la simulación no deja a una baja en ningún cupo", () => {
    const r = simulateResult({ roster: R, matches: [ms[0]], a: R[0], b: R[2], winnerSide: "a", withdrawn: new Set(["B"]) });
    expect(r.positions.get("B")).toEqual([]);
    for (const [id, ps] of r.positions) if (id !== "B") expect(Math.max(...ps)).toBeLessThanOrEqual(2);
  });
});
