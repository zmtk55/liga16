import { describe, it, expect } from "vitest";
import { crossAnswer, ownAnswer, orderText, type SimContext } from "./qualification-sim";
import type { Match } from "@/types";

const R = [{ id: "A", name: "A" }, { id: "B", name: "B" }, { id: "C", name: "C" }];
const done = (a: string, b: string, w: "a" | "b") =>
  ({ id: a + b, status: "finished", winner: w, round: "Grupo A · J1", side_a: { pair_id: a, pair_name: a }, side_b: { pair_id: b, pair_name: b }, sets: [{ a: 6, b: 2 }, { a: 6, b: 2 }] }) as unknown as Match;
const todo = (a: string, b: string) =>
  ({ id: a + b + "p", status: "scheduled", winner: null, round: "Grupo A · J2", side_a: { pair_id: a, pair_name: a }, side_b: { pair_id: b, pair_name: b }, sets: [] }) as unknown as Match;
const fmt = { sets_to_win: 2, games_per_set: 6, tie_break_at: 6, tie_break_points: 7, win_by_two_tiebreak: true };
const ctx = (matches: Match[], slots: number | null = 2): SimContext => ({ tournamentName: "T", roster: R, matches, scoring: fmt, slots });

describe("crossAnswer", () => {
  it("simula un partido real pendiente, con orden y límites", () => {
    const s = crossAnswer({ sim: ctx([done("B", "C", "a"), todo("A", "B")]), winnerId: "A", loserId: "B", meId: "A" });
    expect(s.startsWith("Si A le gana a B:")).toBe(true);
    expect(s).toContain("Orden de T:");
    expect(s).toContain("Muestra limitada");
    expect(s).toContain("no todos los posibles");
  });
  it("no inventa revancha: explica que ya jugaron", () => {
    const s = crossAnswer({ sim: ctx([done("A", "B", "a")]), winnerId: "A", loserId: "B", meId: "A" });
    expect(s).toContain("ya jugaron");
    expect(s).not.toContain("Revisé");
  });
  it("sin partido entre ellos lo dice", () => {
    const s = crossAnswer({ sim: ctx([done("B", "C", "a")]), winnerId: "A", loserId: "B", meId: "B" });
    expect(s).toContain("no hay un partido pendiente");
  });
  it("sin cupos definidos no dice si pasas", () => {
    const s = crossAnswer({ sim: ctx([done("B", "C", "a"), todo("A", "B")], null), winnerId: "A", loserId: "B", meId: "A" });
    expect(s).toContain("no define cuántos pasan");
    expect(s).not.toContain("que pasan");
  });
});

describe("ownAnswer", () => {
  it("lista tus pendientes ganando y perdiendo", () => {
    const s = ownAnswer({ sim: ctx([done("B", "C", "a"), todo("A", "B")]), meId: "A", mode: "both" });
    expect(s).toContain("si ganas");
    expect(s).toContain("si pierdes");
  });
  it("sin pendientes propios lo dice", () => {
    const s = ownAnswer({ sim: ctx([done("B", "C", "a")]), meId: "A", mode: "both" });
    expect(s).toContain("No tienes partidos pendientes");
  });
});

describe("orderText", () => {
  it("estándar y personalizado", () => {
    expect(orderText()).toContain("% de puntos");
    expect(orderText(["matches_won", "head_to_head"])).toBe("partidos ganados > dominio (enfrentamiento directo)");
  });
});

import { answerQualification } from "./qualification-answer";
import { qualificationFor, type StandingLike } from "./qualification";
describe("answerQualification con torneo", () => {
  const rows: StandingLike[] = [
    { pairId: "J1", name: "Julian Arocha / Luis", position: 1, points: 50, played: 1, remaining: 0 },
    { pairId: "J2", name: "Julian Piri / Jesus", position: 2, points: 40, played: 1, remaining: 1 },
    { pairId: "V", name: "Victor Armando / Victor Orozco", position: 3, points: 30, played: 1, remaining: 1 },
  ];
  const sim: SimContext = { tournamentName: "T", roster: [{ id: "J1", name: rows[0].name }, { id: "J2", name: rows[1].name }, { id: "V", name: rows[2].name }], matches: [], slots: 2 };
  const q = qualificationFor(rows, { pairId: "J1", played: 1, setsWon: 2 }, { slots: 2, pointsPerWin: 3 });
  it("no adivina una pareja por una palabra suelta", () => {
    const s = answerQualification({ prompt: "Julian le gana a Victor Orozco", rows, me: { pairId: "J1" }, q, slots: 2, remainingMatches: 0, sim });
    expect(s).toContain("No identifiqué con seguridad");
  });
  it("con nombres completos usa el cruce y no el texto de %", () => {
    const s = answerQualification({ prompt: "Julian Piri le gana a Victor Orozco", rows, me: { pairId: "J1" }, q, slots: 2, remainingMatches: 0, sim });
    expect(s).toContain("no hay un partido pendiente");
    expect(s).not.toContain("rendimiento");
  });
});
