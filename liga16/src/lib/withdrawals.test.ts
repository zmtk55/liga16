import { describe, it, expect } from "vitest";
import { isWithdrawn, skipWithdrawn, withdrawalWalkovers } from "./withdrawals";

const pairs = [{ id: "A" }, { id: "B", status: "withdrawn" }, { id: "C" }, { id: "D" }, { id: "E" }] as never;
describe("bajas antes de eliminatorias", () => {
  it("la baja se salta y entra la siguiente (sin borrar la fila de la tabla)", () => {
    const table = ["A", "B", "C", "D", "E"].map((pairId) => ({ pairId }));
    expect(skipWithdrawn(table, pairs).slice(0, 4).map((r) => r.pairId)).toEqual(["A", "C", "D", "E"]);
    expect(table).toHaveLength(5);
    expect(isWithdrawn((pairs as never as Array<{ status?: string }>)[1] as never)).toBe(true);
  });
});
describe("baja con la llave empezada", () => {
  const m = (id: string, round: string, a: string, b: string, status = "scheduled", winner: "a" | "b" | null = null) =>
    ({ id, round, status, winner, side_a: { pair_id: a }, side_b: { pair_id: b } }) as never;
  it("el rival gana por walkover solo los cruces pendientes de la pareja", () => {
    const ms = [
      m("1", "Semifinal · r1-m1", "A", "B"),
      m("2", "Semifinal · r1-m2", "C", "D"),
      m("3", "Cuartos · r0-m1", "B", "E", "finished", "a"),
      m("4", "Jornada 1 · Suma 9", "B", "C"),
    ];
    const r = withdrawalWalkovers("B", ms);
    expect(r).toEqual([{ matchId: "1", status: "walkover", winner: "a", winnerPairId: "A" }]);
  });
  it("sin rival definido no inventa uno", () => {
    expect(withdrawalWalkovers("B", [{ id: "9", round: "Final · r2-m1", status: "scheduled", winner: null, side_a: { pair_id: "B" }, side_b: {} } as never])).toEqual([]);
  });
});

