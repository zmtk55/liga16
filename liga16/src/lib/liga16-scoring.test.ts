// Tests para validar el algoritmo Liga16 contra los casos de prueba del Excel
import { describe, it, expect } from "vitest";
import {
  countSetsWonLiga16,
  determineMatchWinnerLiga16,
  computePairStatsLiga16,
  computeJerarquiaLiga16,
  computeLiga16Standings,
  type Liga16MatchSets,
  type Liga16PairStats,
} from "./liga16-scoring";

// Helper para crear Match tipo para tests
function createMockMatch(
  id: string,
  sideAId: string,
  sideBId: string,
  sets: Liga16MatchSets,
  winner: "a" | "b"
) {
  return {
    id,
    tournament_id: "test",
    tournament_name: "Test",
    category_name: "4TA",
    round: "Grupo A · J1",
    court_name: "Cancha 1",
    scheduled_at: new Date().toISOString(),
    status: "finished" as const,
    side_a: { pair_id: sideAId, pair_name: "Equipo A" },
    side_b: { pair_id: sideBId, pair_name: "Equipo B" },
    sets: [
      { a: sets.set1.a, b: sets.set1.b, tiebreak_a: sets.tiebreak?.a ?? null, tiebreak_b: sets.tiebreak?.b ?? null },
      { a: sets.set2.a, b: sets.set2.b, tiebreak_a: null, tiebreak_b: null },
      ...(sets.tiebreak ? [{ a: 0, b: 0, tiebreak_a: sets.tiebreak.a, tiebreak_b: sets.tiebreak.b }] : []),
    ],
    winner,
  } as any;
}

describe("Liga16 Scoring Algorithm", () => {
  describe("countSetsWonLiga16 (Paso 1)", () => {
    it("cuenta sets ganados correctamente con tiebreak", () => {
      const sets: Liga16MatchSets = {
        set1: { a: 7, b: 6 },
        set2: { a: 4, b: 6 },
        tiebreak: { a: 9, b: 11 },
      };
      const result = countSetsWonLiga16(sets);
      // set1: a gana (7>6), set2: b gana (6>4), tiebreak: b gana (11>9)
      expect(result).toEqual({ a: 1, b: 2 });
    });

    it("cuenta sets ganados correctamente sin tiebreak (2-0)", () => {
      const sets: Liga16MatchSets = {
        set1: { a: 6, b: 3 },
        set2: { a: 6, b: 0 },
        tiebreak: null,
      };
      const result = countSetsWonLiga16(sets);
      expect(result).toEqual({ a: 2, b: 0 });
    });

    it("cuenta sets ganados correctamente 1-1 con tiebreak", () => {
      const sets: Liga16MatchSets = {
        set1: { a: 6, b: 3 },
        set2: { a: 3, b: 6 },
        tiebreak: { a: 3, b: 10 },
      };
      const result = countSetsWonLiga16(sets);
      expect(result).toEqual({ a: 1, b: 2 });
    });
  });

  describe("determineMatchWinnerLiga16 (Paso 2)", () => {
    it("determina ganador por sets", () => {
      const sets: Liga16MatchSets = {
        set1: { a: 7, b: 6 },
        set2: { a: 4, b: 6 },
        tiebreak: { a: 9, b: 11 },
      };
      expect(determineMatchWinnerLiga16(sets)).toBe("b");
    });

    it("determina ganador 2-0", () => {
      const sets: Liga16MatchSets = {
        set1: { a: 6, b: 3 },
        set2: { a: 6, b: 0 },
        tiebreak: null,
      };
      expect(determineMatchWinnerLiga16(sets)).toBe("a");
    });
  });

  describe("computePairStatsLiga16 (Paso 3) - Casos de prueba del Excel", () => {
    it("Caso 4TA: Equipo 2 vs 3 (7-6, 4-6, 9-11)", () => {
      const match = createMockMatch("m1", "eq2", "eq3", {
        set1: { a: 7, b: 6 },
        set2: { a: 4, b: 6 },
        tiebreak: { a: 9, b: 11 },
      }, "b");

      // Stats para equipo 2 (lado A, perdió)
      const stats2 = computePairStatsLiga16("eq2", 2, "Equipo 2", [match]);
      expect(stats2.PJ).toBe(1);
      expect(stats2.PG).toBe(0);
      expect(stats2.RENDIMIENTO_PG).toBe(0);
      // Puntos: set1(7+4=11), set2(4+6=10), tb(9+11=20) -> total 41
      // A favor: 7+4+9 = 20
      // 20/41 = 0.4878... pero el Excel dice 0.4651
      // Revisar: set1: 7-6 (a=7,b=6), set2: 4-6 (a=4,b=6), tb: 9-11 (a=9,b=11)
      // Para equipo 2 (lado A): pts_favor = 7+4+9 = 20, pts_total = (7+6)+(4+6)+(9+11) = 13+10+20 = 43
      // 20/43 = 0.465116... ✓
      expect(stats2.RENDIMIENTO_PTS).toBeCloseTo(0.46511627906976744, 10);

      // Stats para equipo 3 (lado B, ganó)
      const stats3 = computePairStatsLiga16("eq3", 3, "Equipo 3", [match]);
      expect(stats3.PJ).toBe(1);
      expect(stats3.PG).toBe(1);
      expect(stats3.RENDIMIENTO_PG).toBe(1);
      // Para equipo 3 (lado B): pts_favor = 6+6+11 = 23, pts_total = 43
      // 23/43 = 0.534883... ✓
      expect(stats3.RENDIMIENTO_PTS).toBeCloseTo(0.5348837209302325, 10);
    });

    it("Caso 5TA: Equipo 3 vs 5 (6-3, 3-6, 3-10)", () => {
      const match = createMockMatch("m1", "eq3", "eq5", {
        set1: { a: 6, b: 3 },
        set2: { a: 3, b: 6 },
        tiebreak: { a: 3, b: 10 },
      }, "b");

      const stats3 = computePairStatsLiga16("eq3", 3, "Equipo 3", [match]);
      expect(stats3.PJ).toBe(1);
      expect(stats3.PG).toBe(0);
      expect(stats3.RENDIMIENTO_PG).toBe(0);
      // Equipo 3 (lado A): pts_favor = 6+3+3 = 12, pts_total = (6+3)+(3+6)+(3+10) = 9+9+13 = 31
      // 12/31 = 0.387096... ✓
      expect(stats3.RENDIMIENTO_PTS).toBeCloseTo(0.3870967741935484, 10);

      const stats5 = computePairStatsLiga16("eq5", 5, "Equipo 5", [match]);
      expect(stats5.PJ).toBe(1);
      expect(stats5.PG).toBe(1);
      expect(stats5.RENDIMIENTO_PG).toBe(1);
      // Equipo 5 (lado B): pts_favor = 3+6+10 = 19, pts_total = 31
      // 19/31 = 0.612903... ✓
      expect(stats5.RENDIMIENTO_PTS).toBeCloseTo(0.6129032258064516, 10);
    });

    it("Caso 6TA: Equipo 4 vs 5 (6-3, 6-0) sin tiebreak", () => {
      const match = createMockMatch("m1", "eq4", "eq5", {
        set1: { a: 6, b: 3 },
        set2: { a: 6, b: 0 },
        tiebreak: null,
      }, "a");

      const stats4 = computePairStatsLiga16("eq4", 4, "Equipo 4", [match]);
      expect(stats4.PJ).toBe(1);
      expect(stats4.PG).toBe(1);
      expect(stats4.RENDIMIENTO_PG).toBe(1);
      // Equipo 4 (lado A): pts_favor = 6+6 = 12, pts_total = (6+3)+(6+0) = 9+6 = 15
      // 12/15 = 0.8 ✓
      expect(stats4.RENDIMIENTO_PTS).toBeCloseTo(0.8, 10);

      const stats5 = computePairStatsLiga16("eq5", 5, "Equipo 5", [match]);
      expect(stats5.PJ).toBe(1);
      expect(stats5.PG).toBe(0);
      expect(stats5.RENDIMIENTO_PG).toBe(0);
      // Equipo 5 (lado B): pts_favor = 3+0 = 3, pts_total = 15
      // 3/15 = 0.2 ✓
      expect(stats5.RENDIMIENTO_PTS).toBeCloseTo(0.2, 10);
    });

    it("Equipo sin partidos: PJ=0, PG=0, RENDIMIENTO=null, JERARQUIA=0", () => {
      const stats = computePairStatsLiga16("eq1", 1, "Equipo 1", []);
      expect(stats.PJ).toBe(0);
      expect(stats.PG).toBe(0);
      expect(stats.RENDIMIENTO_PG).toBeNull();
      expect(stats.RENDIMIENTO_PTS).toBeNull();
      expect(stats.JERARQUIA).toBe(0);
    });
  });

  describe("computeJerarquiaLiga16 (Paso 4) - Ranking estilo Excel RANK", () => {
    it("ordena descendente por RENDIMIENTO_PTS y asigna ranks estilo Excel", () => {
      const stats: Liga16PairStats[] = [
        { pairId: "a", pairNumber: 1, pairName: "A", PJ: 1, PG: 1, RENDIMIENTO_PG: 1, PUNTOS_A_FAVOR: 23, PUNTOS_TOTALES: 43, RENDIMIENTO_PTS: 0.5348, JERARQUIA: 0 },
        { pairId: "b", pairNumber: 2, pairName: "B", PJ: 1, PG: 0, RENDIMIENTO_PG: 0, PUNTOS_A_FAVOR: 20, PUNTOS_TOTALES: 43, RENDIMIENTO_PTS: 0.4651, JERARQUIA: 0 },
        { pairId: "c", pairNumber: 3, pairName: "C", PJ: 0, PG: 0, RENDIMIENTO_PG: null, PUNTOS_A_FAVOR: 0, PUNTOS_TOTALES: 0, RENDIMIENTO_PTS: null, JERARQUIA: 0 },
      ];

      const ranked = computeJerarquiaLiga16(stats);

      // A tiene mayor % -> rank 1
      expect(ranked[0].pairId).toBe("a");
      expect(ranked[0].JERARQUIA).toBe(1);

      // B tiene menor % -> rank 2
      expect(ranked[1].pairId).toBe("b");
      expect(ranked[1].JERARQUIA).toBe(2);

      // C sin partidos -> JERARQUIA = 0 (al final)
      expect(ranked[2].pairId).toBe("c");
      expect(ranked[2].JERARQUIA).toBe(0);
    });

    it("maneja empates: mismo rank, salta el siguiente (1, 1, 3)", () => {
      const stats: Liga16PairStats[] = [
        { pairId: "a", pairNumber: 1, pairName: "A", PJ: 1, PG: 1, RENDIMIENTO_PG: 1, PUNTOS_A_FAVOR: 10, PUNTOS_TOTALES: 20, RENDIMIENTO_PTS: 0.5, JERARQUIA: 0 },
        { pairId: "b", pairNumber: 2, pairName: "B", PJ: 1, PG: 1, RENDIMIENTO_PG: 1, PUNTOS_A_FAVOR: 10, PUNTOS_TOTALES: 20, RENDIMIENTO_PTS: 0.5, JERARQUIA: 0 },
        { pairId: "c", pairNumber: 3, pairName: "C", PJ: 1, PG: 0, RENDIMIENTO_PG: 0, PUNTOS_A_FAVOR: 5, PUNTOS_TOTALES: 20, RENDIMIENTO_PTS: 0.25, JERARQUIA: 0 },
      ];

      const ranked = computeJerarquiaLiga16(stats);

      // A y B empatados en 0.5 -> ambos rank 1
      expect(ranked[0].JERARQUIA).toBe(1);
      expect(ranked[1].JERARQUIA).toBe(1);

      // C con 0.25 -> rank 3 (salta 2)
      expect(ranked[2].JERARQUIA).toBe(3);
    });
  });

  describe("computeLiga16Standings - Integración completa", () => {
    it("Caso 4TA completo: 6 equipos, 1 partido jugado", () => {
      const pairs = [
        { id: "eq1", number: 1, name: "Equipo 1" },
        { id: "eq2", number: 2, name: "Equipo 2" },
        { id: "eq3", number: 3, name: "Equipo 3" },
        { id: "eq4", number: 4, name: "Equipo 4" },
        { id: "eq5", number: 5, name: "Equipo 5" },
        { id: "eq6", number: 6, name: "Equipo 6" },
      ];

      const match = createMockMatch("m1", "eq2", "eq3", {
        set1: { a: 7, b: 6 },
        set2: { a: 4, b: 6 },
        tiebreak: { a: 9, b: 11 },
      }, "b");

      const result = computeLiga16Standings(pairs, [match], "4TA");

      // Verificar standings
      const eq2 = result.standings.find((s) => s.pairId === "eq2")!;
      const eq3 = result.standings.find((s) => s.pairId === "eq3")!;
      const eq1 = result.standings.find((s) => s.pairId === "eq1")!;

      expect(eq2.JERARQUIA).toBe(2);
      expect(eq3.JERARQUIA).toBe(1);
      expect(eq1.JERARQUIA).toBe(0); // Sin partidos

      // Verificar jornada summary
      expect(result.jornada.JUEGOS_JUGADOS).toBe(1); // 2 PJ total / 2 = 1 partido
      expect(result.jornada.TOTAL_JUEGOS).toBe(15); // 4TA con 6 parejas -> 15
    });
  });
});