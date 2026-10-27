import { describe, it, expect } from "vitest";
import { computeJerarquiaLiga16, DEFAULT_RANK_ORDER, type Liga16PairStats } from "./liga16-scoring";

const mk = (id: string, PJ: number, PG: number, pct: number, sf: number, sc: number): Liga16PairStats => ({
  pairId: id, pairNumber: 1, pairName: id, PJ, PG, RENDIMIENTO_PG: PJ ? PG / PJ : null,
  PUNTOS_A_FAVOR: 0, PUNTOS_TOTALES: 0, RENDIMIENTO_PTS: pct, SETS_FAVOR: sf, SETS_CONTRA: sc, JERARQUIA: 0,
});

describe("orden configurable", () => {
  const stats = () => [mk("alto-pct", 3, 1, 0.6, 3, 4), mk("mas-ganados", 3, 3, 0.55, 6, 1)];
  it("por defecto manda el % de puntos (orden actual)", () => {
    expect(DEFAULT_RANK_ORDER[0]).toBe("points_pct");
    expect(computeJerarquiaLiga16(stats())[0].pairId).toBe("alto-pct");
  });
  it("con partidos ganados primero cambia el orden", () => {
    const r = computeJerarquiaLiga16(stats(), ["matches_won", "points_pct"]);
    expect(r[0].pairId).toBe("mas-ganados");
    expect(r[0].JERARQUIA).toBe(1);
  });
});

describe("dominio (enfrentamiento directo)", () => {
  const m = (a: string, b: string, winner: "a" | "b") =>
    ({ status: "finished", winner, side_a: { pair_id: a }, side_b: { pair_id: b }, sets: [] }) as never;
  const base = () => [mk("X", 3, 2, 0.7, 4, 2), mk("Y", 3, 2, 0.5, 4, 2)];
  it("con ganados empatados, quien ganó el directo va arriba aunque tenga menos puntos", () => {
    const r = computeJerarquiaLiga16(base(), ["matches_won", "head_to_head", "points_pct"], [m("X", "Y", "b")]);
    expect(r.map((s) => s.pairId)).toEqual(["Y", "X"]);
  });
  it("sin directo cae a puntos", () => {
    const r = computeJerarquiaLiga16(base(), ["matches_won", "head_to_head", "points_pct"], []);
    expect(r[0].pairId).toBe("X");
  });
  it("ciclo de 3: la mini-liga empata y decide el siguiente criterio", () => {
    const s = [mk("A", 3, 2, 0.5, 1, 1), mk("B", 3, 2, 0.6, 1, 1), mk("C", 3, 2, 0.4, 1, 1)];
    const ms = [m("A", "B", "a"), m("B", "C", "a"), m("C", "A", "a")];
    const r = computeJerarquiaLiga16(s, ["matches_won", "head_to_head", "points_pct"], ms);
    expect(r.map((x) => x.pairId)).toEqual(["B", "A", "C"]);
  });
});

describe("sets_won", () => {
  it("ordena por sets ganados totales", () => {
    const r = computeJerarquiaLiga16([mk("p", 2, 1, 0.5, 2, 2), mk("q", 2, 1, 0.5, 3, 1)], ["sets_won"]);
    expect(r[0].pairId).toBe("q");
  });
});

import { computeStandings } from "./groups";
describe("computeStandings con rank_order", () => {
  const ms = [
    { status: "finished", winner: "b", side_a: { pair_id: "X", pair_name: "X" }, side_b: { pair_id: "Y", pair_name: "Y" }, sets: [{ a: 6, b: 5 }, { a: 7, b: 5 }] },
  ] as never;
  const sc = { sets_to_win: 2, games_per_set: 6, tie_break_at: 6, tie_break_points: 7 };
  it("sin rank_order no cambia nada", () => {
    const r = computeStandings(["X", "Y"], ms, { X: "X", Y: "Y" }, sc);
    expect(r).toHaveLength(2);
  });
  it("acepta rank_order", () => {
    const r = computeStandings(["X", "Y"], ms, { X: "X", Y: "Y" }, { ...sc, rank_order: ["matches_won", "head_to_head"] });
    expect(r).toHaveLength(2);
  });
});

describe("orden pedido: partidos ganados > dominio > puntos (configuración de prueba explícita)", () => {
  const mm = (a: string, b: string, winner: "a" | "b", sets: Array<{ a: number; b: number }>) =>
    ({ status: "finished", winner, side_a: { pair_id: a, pair_name: a }, side_b: { pair_id: b, pair_name: b }, sets }) as never;
  const ms = [
    mm("P", "Q", "a", [{ a: 6, b: 4 }, { a: 6, b: 4 }]),
    mm("Q", "R", "a", [{ a: 6, b: 0 }, { a: 6, b: 0 }]),
    mm("Q", "S", "a", [{ a: 6, b: 0 }, { a: 6, b: 0 }]),
    mm("P", "S", "a", [{ a: 6, b: 4 }, { a: 6, b: 4 }]),
    mm("R", "P", "a", [{ a: 6, b: 4 }, { a: 6, b: 4 }]),
  ];
  const names = { P: "P", Q: "Q", R: "R", S: "S" };
  const sc = { sets_to_win: 2, games_per_set: 6, tie_break_at: 6, tie_break_points: 7 };
  const order = (rank_order?: never) =>
    computeStandings(["P", "Q", "R", "S"], ms, names, { ...sc, ...(rank_order ? { rank_order } : {}) })
      .slice()
      .sort((x, y) => (x.jerarquia || 99) - (y.jerarquia || 99))
      .map((r) => r.pairId);
  it("P y Q empatan en partidos ganados; P le ganó a Q, así que P va arriba aunque Q tenga más % de puntos", () => {
    expect(order(["matches_won", "head_to_head", "points_pct"] as never).slice(0, 2)).toEqual(["P", "Q"]);
  });
  it("con el orden estándar (sin configurar) Q va arriba por % de puntos: el torneo actual no cambia", () => {
    expect(order().slice(0, 2)).toEqual(["Q", "P"]);
  });
});
