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
