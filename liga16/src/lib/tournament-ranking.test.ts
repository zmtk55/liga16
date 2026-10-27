import { describe, it, expect } from "vitest";
import { tournamentTeams, tournamentOptions } from "./tournament-ranking";
import type { Match, Team } from "@/types";

const T = "t1";
const mk = (id: string, name: string, order?: string[], withdrawn = false) =>
  ({ id: "team-" + id, name, division: "Suma 9", sex: "male", category_name: "Suma 9",
     entries: [{ pair_id: id, tournament_id: T, tournament_name: "Copa", semifinal_slots: 4, withdrawn,
       scoring: order ? { rank_order: order } : null }] }) as unknown as Team;
const m = (a: string, b: string, winner: "a" | "b", sets: [number, number][], round = "Grupo A · J1") =>
  ({ id: a + b, tournament_id: T, round, status: "finished", winner, side_a: { pair_id: a, pair_name: a }, side_b: { pair_id: b, pair_name: b },
     sets: sets.map(([x, y]) => ({ a: x, b: y })) }) as unknown as Match;

describe("ranking por torneo", () => {
  // A y B: 1 victoria cada una. B le ganó a A (dominio), pero A tiene mejor % de puntos.
  const matches = [m("A", "C", "a", [[6, 0], [6, 0]]), m("B", "D", "a", [[7, 5], [7, 5]]), m("B", "A", "a", [[7, 6], [7, 6]])];
  const pos = (ts: Team[]) => Object.fromEntries(ts.map((t) => [t.name, t.position]));
  it("usa el orden del torneo: PG > dominio > puntos", () => {
    const teams = ["A", "B", "C", "D"].map((n) => mk(n, n, ["matches_won", "head_to_head", "points_pct"]));
    const p = pos(tournamentTeams(teams, matches, T));
    expect(p.B).toBeLessThan(p.A);
  });
  it("sin orden definido usa el estándar (los puntos pesan antes)", () => {
    const teams = ["A", "B", "C", "D"].map((n) => mk(n, n));
    const p = pos(tournamentTeams(teams, matches, T));
    expect(p.A).toBeLessThan(p.B);
  });
  it("las bajas no aparecen ni ocupan posición, y sus partidos cuentan", () => {
    const teams = [mk("A", "A", undefined), mk("B", "B", undefined, true), mk("C", "C"), mk("D", "D")];
    const out = tournamentTeams(teams, matches, T);
    expect(out.find((t) => t.name === "B")).toBeUndefined();
    expect(Math.max(...out.map((t) => t.position))).toBeLessThanOrEqual(3);
    expect(out.find((t) => t.name === "A")!.played).toBe(2);
  });
  it("opciones: cuenta solo parejas que siguen", () => {
    const o = tournamentOptions([mk("A", "A"), mk("B", "B", undefined, true)]);
    expect(o).toEqual([{ id: T, name: "Copa", n: 1 }]);
  });
  it("torneo ajeno: vacío", () => {
    expect(tournamentTeams([mk("A", "A")], matches, "otro")).toEqual([]);
  });
});

import { categoryRoster } from "./tournament-ranking";
describe("Equipos: solo la categoría de la pareja", () => {
  const cat = (id: string, name: string, c: string, w = false) => {
    const t = mk(id, name, undefined, w) as unknown as Record<string, unknown>;
    t.category_name = c; t.division = c;
    return t as unknown as Team;
  };
  const teams = [cat("A", "A", "Suma 9"), cat("B", "B", "Suma 9", true), cat("C", "C", "Suma 7"), cat("D", "D", "Suma 7")];
  it("no mezcla categorías en el roster", () => {
    const r = categoryRoster(teams, T, teams[0]);
    expect(r.roster.map((x) => x.id)).toEqual(["A", "B"]);
    expect([...r.withdrawn]).toEqual(["B"]);
  });
  it("coincide con la tabla de /ranking para la misma pareja", () => {
    const ms = [m("A", "B", "a", [[6, 0], [6, 0]]), m("C", "D", "b", [[0, 6], [0, 6]])];
    const rank = tournamentTeams(teams, ms, T);
    const c = categoryRoster(teams, T, teams[2]);
    expect(c.roster.map((x) => x.id)).toEqual(["C", "D"]);
    expect(rank.find((t) => t.name === "D")!.position).toBe(1);
    expect(rank.find((t) => t.name === "A")!.position).toBe(1);
  });
});
