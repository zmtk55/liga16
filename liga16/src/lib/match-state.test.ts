import { describe, expect, it } from "vitest";
import { matchBucket, matchState, matchStatusKey, matchWinner } from "./match-state";
import type { Match, MatchStatus, SetScore } from "@/types";

const S = (a: number, b: number): SetScore => ({ a, b, tiebreak_a: null, tiebreak_b: null });

const partido = (over: Partial<Match> = {}): Match => ({
  id: "m1",
  tournament_id: "t-1",
  tournament_name: "LIGA16",
  category_name: "Cuarta femenil",
  round: "J1",
  court_name: null,
  scheduled_at: "2026-10-11T17:26:00Z",
  status: "scheduled",
  side_a: { pair_id: null, pair_name: "A / B" },
  side_b: { pair_id: null, pair_name: "C / D" },
  sets: [],
  winner: null,
  ...over,
});

describe("matchState", () => {
  it("sin sets es un partido por jugar", () => {
    expect(matchState(partido())).toBe("pending");
  });

  it("con marcador a medias está en curso", () => {
    expect(matchState(partido({ sets: [S(6, 3)] }))).toBe("playing");
  });

  it("con dos sets ganados está terminado", () => {
    expect(matchState(partido({ sets: [S(6, 3), S(4, 6)] }))).toBe("playing");
    expect(matchState(partido({ sets: [S(6, 3), S(6, 4)] }))).toBe("finished");
  });

  it("el super tie-break cuenta como el set que decide", () => {
    // 6-3, 4-6, 10-8: dos sets para A, el partido estáfinished.
    expect(matchState(partido({ sets: [S(6, 3), S(4, 6), S(10, 8)] }))).toBe("finished");
  });

  it("un 6-7 sin puntos de tie-break también decide el set", () => {
    // La regla oficial no puede resolverlo (necesita los puntos del
    // tie-break, que casi nunca se capturan), pero el set está ganado.
    expect(matchState(partido({ sets: [S(6, 7), S(6, 1), S(5, 10)] }))).toBe("finished");
  });

  it("el estado guardado manda cuando dice 'finished'", () => {
    expect(matchState(partido({ status: "finished" }))).toBe("finished");
  });

  it("en vivo manda sobre todo lo demás", () => {
    expect(matchState(partido({ status: "live" }))).toBe("live");
    expect(matchState(partido({ status: "live", sets: [S(6, 3), S(6, 3)] }))).toBe("live");
  });
});

describe("matchWinner", () => {
  it("el ganador guardado manda", () => {
    expect(matchWinner(partido({ winner: "b" }))).toBe("b");
  });

  it("si falta, se deduce del marcador", () => {
    expect(matchWinner(partido({ sets: [S(6, 3), S(6, 3)] }))).toBe("a");
    expect(matchWinner(partido({ sets: [S(6, 7), S(6, 1), S(5, 10)] }))).toBe("b");
  });

  it("un partido a medias no tiene ganador: el trofeo sería mentira", () => {
    expect(matchWinner(partido({ sets: [S(6, 3)] }))).toBeNull();
    expect(matchWinner(partido({ sets: [S(6, 3), S(3, 6)] }))).toBeNull();
  });
});

describe("matchBucket", () => {
  it("separa lo que nunca se capturó de lo que quedó a medias", () => {
    expect(matchBucket(partido())).toBe("pending");
    expect(matchBucket(partido({ sets: [S(6, 3)] }))).toBe("playing");
    expect(matchBucket(partido({ sets: [S(6, 3), S(6, 3)] }))).toBe("finished");
    expect(matchBucket(partido({ status: "live" }))).toBe("live");
  });

  it("los estados sin marcador se quedan como están", () => {
    const exoticos: MatchStatus[] = ["disputed", "walkover", "cancelled"];
    for (const s of exoticos) {
      expect(matchBucket(partido({ status: s }))).toBe(s);
    }
  });
});

describe("matchStatusKey", () => {
  it("aplana 'a medias' en 'scheduled': para saber si está terminado basta", () => {
    expect(matchStatusKey(partido())).toBe("scheduled");
    expect(matchStatusKey(partido({ sets: [S(6, 3)] }))).toBe("scheduled");
    expect(matchStatusKey(partido({ sets: [S(6, 3), S(6, 3)] }))).toBe("finished");
    expect(matchStatusKey(partido({ status: "live" }))).toBe("live");
  });
});
