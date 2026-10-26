import { describe, expect, it } from "vitest";
import { isoToLocalInput, localInputToIso } from "./datetime";
import { checkFinishedMatch } from "./match-result";
import { isKnockoutRound, roundRobinRounds, scheduleRounds, turnsUsed } from "./groups";
import { buildBracket, resolveBracket, type BracketEntry } from "./bracket";

const set = (a: number, b: number) => ({ a, b, tiebreak_a: null, tiebreak_b: null });

describe("fechas locales", () => {
  it("ida y vuelta conserva el instante", () => {
    const iso = "2026-10-26T02:00:00.000Z";
    expect(localInputToIso(isoToLocalInput(iso))).toBe(iso);
  });
  it("vacío limpia la fecha", () => {
    expect(localInputToIso("")).toBeNull();
    expect(isoToLocalInput(null)).toBe("");
  });
  it("valor local sin zona se respeta", () => {
    expect(isoToLocalInput("2026-10-26T09:30")).toBe("2026-10-26T09:30");
  });
});

describe("cierre de partido", () => {
  it("un set 1-0 no cierra", () => {
    expect(checkFinishedMatch([set(1, 0)]).ok).toBe(false);
  });
  it("sin marcador no cierra", () => {
    expect(checkFinishedMatch([]).ok).toBe(false);
  });
  it("6-3 6-4 cierra con ganador a", () => {
    const r = checkFinishedMatch([set(6, 3), set(6, 4)]);
    expect(r.ok && r.winner).toBe("a");
  });
  it("sets negativos se rechazan", () => {
    expect(checkFinishedMatch([set(-1, 6), set(6, 3)]).ok).toBe(false);
  });
});

describe("rondas de eliminatoria", () => {
  it("grupos no son eliminatoria", () => {
    expect(isKnockoutRound("Grupo A · J1")).toBe(false);
    expect(isKnockoutRound("4ta Varonil · Grupo A · J2")).toBe(false);
    expect(isKnockoutRound("")).toBe(false);
  });
  it("semifinal y final sí", () => {
    expect(isKnockoutRound("Semifinal 1")).toBe(true);
    expect(isKnockoutRound("4ta Varonil · Final")).toBe(true);
  });
  it("un resultado de grupos no resuelve el bracket", () => {
    const entries: BracketEntry[] = ["A", "B", "C", "D"].map((id, i) => ({ pairId: id, name: id, seed: i + 1, points: 0 }));
    const base = buildBracket(entries);
    const groupMatches = [
      { round: "Grupo A · J1", a: "A", b: "D" },
      { round: "Grupo A · J1", a: "B", b: "C" },
      { round: "Grupo A · J1", a: "A", b: "B" },
    ];
    const resolved = resolveBracket(base, (x, y) => {
      const m = groupMatches.find((g) => isKnockoutRound(g.round) && ((g.a === x.pairId && g.b === y.pairId) || (g.a === y.pairId && g.b === x.pairId)));
      return m ? m.a : null;
    });
    expect(resolved.every((m) => !m.winnerId)).toBe(true);
  });
});

describe("calendario por grupos", () => {
  it("el segundo grupo arranca después del primero", () => {
    const g1 = scheduleRounds(["a", "b", "c", "d"], 2, "2026-11-01", 60, 9);
    const g2 = scheduleRounds(["e", "f", "g", "h"], 2, "2026-11-01", 60, 9, turnsUsed(g1, 2));
    expect(new Date(g2[0][0].scheduled_at).getTime()).toBeGreaterThan(new Date(g1[g1.length - 1][0].scheduled_at).getTime() - 1);
    expect(roundRobinRounds(["a", "b", "c", "d"]).length).toBe(3);
  });
});
