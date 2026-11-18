import { describe, expect, it } from "vitest";
import type { Match } from "@/types";
import { finishInfo, finishWarning } from "./tournament-finish";

const m = (status: Match["status"], winner: Match["winner"] = null): Match => ({
  id: Math.random().toString(), tournament_id: "t", category_name: "c", round: "Final · r1-m1",
  side_a: { pair_id: "a", pair_name: "A" }, side_b: { pair_id: "b", pair_name: "B" },
  court_name: null, scheduled_at: null, status, sets: [], winner,
} as Match);

describe("finishInfo", () => {
  it("permite finalizar un torneo jugado entero aunque siga publicado", () => {
    expect(finishInfo("published", [m("finished", "a"), m("walkover", "b"), m("cancelled")]).canFinish).toBe(true);
  });
  it("no lo permite desde publicado si falta un partido o no hay partidos", () => {
    expect(finishInfo("published", [m("finished", "a"), m("scheduled")]).canFinish).toBe(false);
    expect(finishInfo("registration_open", []).canFinish).toBe(false);
  });
  it("en juego siempre, con aviso si falta alguno", () => {
    const i = finishInfo("in_progress", [m("finished", "a"), m("scheduled")]);
    expect(i.canFinish).toBe(true);
    expect(finishWarning(i)).toContain("1 partido");
    expect(finishWarning(finishInfo("in_progress", [m("finished", "a")]))).toBeNull();
  });
  it("nunca desde borrador, cancelado o ya finalizado", () => {
    for (const s of ["draft", "cancelled", "finished"] as const) expect(finishInfo(s, [m("finished", "a")]).canFinish).toBe(false);
  });
});
