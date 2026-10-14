import { describe, expect, it } from "vitest";
import { deriveTeamStandings } from "./standings";
import { SUPER_TIEBREAK_POINTS, DEFAULT_SCORING, validateScoring } from "./scoring";
import type { Match, SetScore, Team } from "@/types";

const S = (a: number, b: number): SetScore => ({ a, b, tiebreak_a: null, tiebreak_b: null });

const team = (id: string, name: string, division: Team["division"], sex: Team["sex"]): Team => ({
  id,
  slug: id,
  name,
  crest_url: null,
  city: "CDMX",
  club_id: null,
  division,
  sex,
  player1: null,
  player2: null,
  position: 0,
  // Valores inventados a propósito: deriveTeamStandings tiene que pisarlos
  // todos. Si alguno sobrevive, el ranking sigue leyendo el seed.
  points: 999,
  played: 99,
  won: 99,
  lost: 99,
  sets_for: 999,
  sets_against: 999,
  titles: 0,
});

const match = (
  id: string,
  a: string,
  b: string,
  sets: SetScore[],
  winner: "a" | "b",
): Match => ({
  id,
  tournament_id: "t-1",
  round: "J1",
  court_name: null,
  scheduled_at: null,
  status: "finished",
  side_a: { pair_id: null, pair_name: a },
  side_b: { pair_id: null, pair_name: b },
  sets,
  winner,
});

describe("deriveTeamStandings", () => {
  const roster = [
    team("1", "A / A", "1ra", "M"),
    team("2", "B / B", "1ra", "M"),
    team("3", "C / C", "1ra", "M"),
  ];

  it("sobrescribe los números que traía el roster", () => {
    const out = deriveTeamStandings(
      roster.map((t) => ({ ...t })),
      [match("m1", "A / A", "B / B", [S(6, 0), S(6, 0)], "a")],
    );
    const a = out.find((t) => t.name === "A / A")!;
    expect(a.played).toBe(1);
    expect(a.won).toBe(1);
    expect(a.lost).toBe(0);
    expect(a.sets_for).toBe(2);
    expect(a.sets_against).toBe(0);
    // 12 puntos ganados de 12 jugados.
    expect(a.rendimiento_pct).toBe(100);
  });

  it("ignora partidos sin terminar", () => {
    const scheduled = { ...match("m2", "A / A", "B / B", [S(6, 0), S(6, 0)], "a"), status: "scheduled" as const };
    const out = deriveTeamStandings(roster.map((t) => ({ ...t })), [scheduled]);
    expect(out.every((t) => t.played === 0)).toBe(true);
  });

  it("ordena por % de puntos, no por victorias", () => {
    // A gana 1 partido y lo barre: 100% de puntos.
    // B gana 3 partidos, los tres por super tie-break apretado: ~52.6%.
    // El que más victorias tiene NO es el líder.
    const out = deriveTeamStandings(roster.map((t) => ({ ...t })), [
      match("m1", "A / A", "C / C", [S(6, 0), S(6, 0)], "a"),
      match("m2", "B / B", "C / C", [S(6, 4), S(4, 6), S(10, 8)], "a"),
      match("m3", "B / B", "A / A", [S(6, 4), S(4, 6), S(10, 8)], "a"),
      match("m4", "B / B", "C / C", [S(6, 4), S(4, 6), S(10, 8)], "a"),
      match("m5", "C / C", "A / A", [S(6, 4), S(4, 6), S(10, 8)], "a"),
    ]);
    const byName = Object.fromEntries(out.map((t) => [t.name, t]));
    expect(byName["A / A"].won).toBe(1);
    expect(byName["B / B"].won).toBe(3);
    // A gana 1 partido: 12/12 + 18/38 + 18/38 = 48 de 88 = 54.5%.
    // B gana 3: 20/38 + 20/38 + 20/38 = 60 de 114 = 52.6%.
    expect(byName["A / A"].rendimiento_pct).toBe(54.5);
    expect(byName["B / B"].rendimiento_pct).toBe(52.6);
    expect(byName["A / A"].position).toBe(1);
    expect(byName["B / B"].position).toBe(2);
  });

  it("empates en % de puntos comparten posición y la siguiente salta (RANK de Excel)", () => {
    // A gana sus dos 6-0 6-0 (100%). B y C ganan uno cada uno (50%): empate.
    const out = deriveTeamStandings(
      [team("1", "A / A", "1ra", "M"), team("2", "B / B", "1ra", "M"), team("3", "C / C", "1ra", "M")],
      [
        match("m1", "A / A", "B / B", [S(6, 0), S(6, 0)], "a"),
        match("m2", "A / A", "C / C", [S(6, 0), S(6, 0)], "a"),
        match("m3", "B / B", "C / C", [S(6, 0), S(6, 0)], "a"),
        match("m4", "C / C", "B / B", [S(6, 0), S(6, 0)], "a"),
      ],
    );
    const byName = Object.fromEntries(out.map((t) => [t.name, t]));
    // A gana sus dos 6-0 6-0: 24 de 24 = 100%.
    // B y C ganan uno cada uno y pierden el otro: 12 de 36 = 33.3%. Empate.
    expect(byName["A / A"].rendimiento_pct).toBe(100);
    expect(byName["B / B"].rendimiento_pct).toBe(33.3);
    expect(byName["C / C"].rendimiento_pct).toBe(33.3);
    expect(byName["A / A"].position).toBe(1);
    expect(byName["B / B"].position).toBe(2);
    expect(byName["C / C"].position).toBe(2);
  });

  it("cuenta el super tie-break como set ganado", () => {
    const out = deriveTeamStandings([team("1", "A / A", "1ra", "M"), team("2", "B / B", "1ra", "M")], [
      match("m1", "A / A", "B / B", [S(6, 4), S(2, 6), S(10, 8)], "a"),
    ]);
    const a = out.find((t) => t.name === "A / A")!;
    expect(a.won).toBe(1);
    expect(a.sets_for).toBe(2);
    expect(a.sets_against).toBe(1);
  });

  it("las parejas sin partidos quedan al final y sin posición", () => {
    const out = deriveTeamStandings(
      [team("1", "A / A", "1ra", "M"), team("2", "B / B", "1ra", "M"), team("3", "C / C", "1ra", "M")],
      [match("m1", "A / A", "B / B", [S(6, 0), S(6, 0)], "a")],
    );
    expect(out.at(-1)!.name).toBe("C / C");
    expect(out.at(-1)!.position).toBe(0);
  });

  it("no mezcla divisiones: la posición se recalcula dentro de cada grupo", () => {
    const out = deriveTeamStandings(
      [team("1", "A / A", "1ra", "M"), team("2", "B / B", "2da", "M"), team("3", "C / C", "2da", "M")],
      [
        match("m1", "A / A", "B / B", [S(6, 0), S(6, 0)], "a"),
        match("m2", "C / C", "B / B", [S(6, 0), S(6, 0)], "a"),
      ],
    );
    // Cada grupo tiene su propio #1: comparar el 1 de 1ra con el 1 de 2da no
    // significa nada.
    expect(out.find((t) => t.name === "A / A")!.position).toBe(1);
    expect(out.find((t) => t.name === "C / C")!.position).toBe(1);
    expect(out.find((t) => t.name === "B / B")!.position).toBe(2);
  });
});

describe("validateScoring — super tie-break", () => {
  const cfg = DEFAULT_SCORING;
  const tres = (a: number, b: number): SetScore[] => [S(6, 4), S(4, 6), S(a, b)];

  it(`acepta un desempate a ${SUPER_TIEBREAK_POINTS} con diferencia 2`, () => {
    expect(validateScoring(tres(10, 8), cfg)).toBeNull();
    expect(validateScoring(tres(11, 9), cfg)).toBeNull();
    expect(validateScoring(tres(10, 6), cfg)).toBeNull();
  });

  it("rechaza un desempate que no llega a 10", () => {
    expect(validateScoring(tres(9, 7), cfg)).toMatch(/desempate/i);
    expect(validateScoring(tres(7, 5), cfg)).toMatch(/desempate/i);
  });

  it("rechaza un tercer set normal (6-x / 7-5)", () => {
    expect(validateScoring(tres(6, 3), cfg)).toMatch(/desempate/i);
    expect(validateScoring(tres(7, 5), cfg)).toMatch(/desempate/i);
  });

  it("rechaza un desempate ganado por 1", () => {
    expect(validateScoring(tres(10, 9), cfg)).toMatch(/diferencia 2|por 2/i);
  });

  it("no exige desempate si el partido ya se ganó en 2 sets", () => {
    expect(validateScoring([S(6, 0), S(6, 3)], cfg)).toBeNull();
    // Y una tercera fila vacía (la que siempre pinta el diálogo) no molesta.
    expect(validateScoring([S(6, 0), S(6, 3), S(0, 0)], cfg)).toBeNull();
  });
});