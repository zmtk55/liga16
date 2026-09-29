import { describe, expect, it } from "vitest";
import { buildPlayerRecords, recordWinRate } from "./records";
import { analyzePairLocal } from "./jev";
import { qualificationFor, type StandingLike } from "./qualification";
import type { Match, Pair, PlayerProfile } from "@/types";

const players: PlayerProfile[] = [
  { id: "p-ana", display_name: "Ana" },
  { id: "p-beto", display_name: "Beto" },
  { id: "p-caro", display_name: "Caro" },
  { id: "p-diego", display_name: "Diego" },
  { id: "p-eva", display_name: "Eva" },
] as unknown as PlayerProfile[];

// Ana juega dos etapas: primero con Beto, después con Caro. Las parejas rivales
// nunca comparten jugador con ella, porque eso sería un partido imposible.
const pairs: Pair[] = [
  { id: "pr-1", player1_id: "p-ana", player2_id: "p-beto", name: "Ana / Beto" },
  { id: "pr-2", player1_id: "p-ana", player2_id: "p-caro", name: "Ana / Caro" },
  { id: "pr-3", player1_id: "p-diego", player2_id: "p-eva", name: "Diego / Eva" },
  { id: "pr-4", player1_id: "p-beto", player2_id: "p-diego", name: "Beto / Diego" },
  { id: "pr-5", player1_id: "p-caro", player2_id: "p-diego", name: "Caro / Diego" },
] as unknown as Pair[];

function played(
  id: string,
  at: string,
  a: { id: string; name: string },
  b: { id: string; name: string },
  winner: "a" | "b",
  sets: Array<{ a: number; b: number }>,
): Match {
  return {
    id,
    tournament_id: "t-1",
    round: "J1",
    court_name: "Cancha 1",
    scheduled_at: at,
    status: "finished",
    side_a: { pair_id: a.id, pair_name: a.name },
    side_b: { pair_id: b.id, pair_name: b.name },
    sets,
    winner,
  } as unknown as Match;
}

describe("buildPlayerRecords", () => {
  it("acumula el récord de un jugador a través de sus distintas parejas", () => {
    const matches = [
      played("m-1", "2026-01-10", { id: "pr-1", name: "Ana / Beto" }, { id: "pr-3", name: "Diego / Eva" }, "a", [{ a: 6, b: 2 }]),
      played("m-2", "2026-02-10", { id: "pr-2", name: "Ana / Caro" }, { id: "pr-4", name: "Beto / Diego" }, "b", [{ a: 3, b: 6 }]),
      played("m-3", "2026-03-10", { id: "pr-1", name: "Ana / Beto" }, { id: "pr-5", name: "Caro / Diego" }, "a", [{ a: 6, b: 4 }]),
    ];

    const records = buildPlayerRecords(matches, pairs, players);
    const ana = records.get("p-ana");

    // Ana jugó los 3 partidos: 2 con Beto, 1 con Caro.
    expect(ana?.played).toBe(3);
    expect(ana?.won).toBe(2);
    expect(ana?.lost).toBe(1);
    expect(ana?.form).toEqual(["G", "P", "G"]);
  });

  it("guarda el historial de parejas, de la más reciente a la más antigua", () => {
    const matches = [
      played("m-1", "2026-01-10", { id: "pr-1", name: "Ana / Beto" }, { id: "pr-3", name: "Diego / Eva" }, "a", [{ a: 6, b: 2 }]),
      played("m-2", "2026-02-10", { id: "pr-2", name: "Ana / Caro" }, { id: "pr-4", name: "Beto / Diego" }, "b", [{ a: 3, b: 6 }]),
    ];

    const ana = buildPlayerRecords(matches, pairs, players).get("p-ana");

    expect(ana?.partners.map((p) => p.partnerName)).toEqual(["Caro", "Beto"]);
    // Ana no pierde su récord anterior al cambiar de pareja.
    expect(ana?.partners[1]).toMatchObject({ partnerName: "Beto", played: 1, won: 1 });
  });

  it("describe los últimos partidos con rival y marcador, sin datos escritos a mano", () => {
    const matches = [
      played("m-1", "2026-01-10", { id: "pr-1", name: "Ana / Beto" }, { id: "pr-3", name: "Diego / Eva" }, "a", [{ a: 6, b: 2 }, { a: 4, b: 6 }]),
      played("m-2", "2026-02-10", { id: "pr-1", name: "Ana / Beto" }, { id: "pr-5", name: "Caro / Diego" }, "b", [{ a: 3, b: 6 }]),
    ];

    const ana = buildPlayerRecords(matches, pairs, players).get("p-ana");

    // Del más reciente al más antiguo, y el marcador desde su punto de vista.
    expect(ana?.recentMatches.map((m) => m.opponentName)).toEqual([
      "Caro / Diego",
      "Diego / Eva",
    ]);
    expect(ana?.recentMatches[0]).toMatchObject({ won: false, score: "3-6" });
    expect(ana?.recentMatches[1]).toMatchObject({ won: true, score: "6-2 4-6" });
  });

  it("no inventa nivel de rival si no está en el directorio", () => {
    const sinNiveles = [{ id: "p-ana", display_name: "Ana" }] as unknown as PlayerProfile[];
    const ghost = {
      ...played("m-1", "2026-01-10", { id: "pr-1", name: "Ana / Beto" }, { id: "pr-3", name: "Diego / Eva" }, "a", [{ a: 6, b: 2 }]),
      side_b: { pair_id: null, pair_name: "Fantasma / Nadie" },
    } as unknown as Match;

    const ana = buildPlayerRecords([ghost], pairs, sinNiveles).get("p-ana");

    expect(ana?.recentMatches[0].opponentLevel).toBeNull();
    expect(ana?.recentMatches[0].opponentName).toBe("Fantasma / Nadie");
  });

  it("acumula los games ganados de cada pareja en el mismo total personal", () => {
    const matches = [
      played("m-1", "2026-01-10", { id: "pr-1", name: "Ana / Beto" }, { id: "pr-3", name: "Diego / Eva" }, "a", [{ a: 6, b: 2 }, { a: 6, b: 4 }]),
      played("m-2", "2026-02-10", { id: "pr-2", name: "Ana / Caro" }, { id: "pr-4", name: "Beto / Diego" }, "b", [{ a: 2, b: 6 }]),
    ];

    const ana = buildPlayerRecords(matches, pairs, players).get("p-ana");

    expect(ana?.setsFor).toBe(14); // 6+6 con Beto, 2 con Caro
    expect(ana?.setsAgainst).toBe(12); // 2+4 con Beto, 6 con Caro
  });

  it("resuelve el lado por nombre cuando el partido no trae pair_id", () => {
    const legacy = {
      ...played("m-9", "2026-01-05", { id: "pr-1", name: "Ana / Beto" }, { id: "pr-3", name: "Diego / Eva" }, "a", [{ a: 6, b: 0 }]),
      side_a: { pair_id: null, pair_name: "ana / beto" },
    } as unknown as Match;

    const records = buildPlayerRecords([legacy], pairs, players);

    expect(records.get("p-ana")?.won).toBe(1);
  });

  it("cuenta el lado conocido aunque el rival no esté registrado", () => {
    // El rival viene solo con texto y no existe en `pairs`: el jugador sigue
    // jugando ese partido y su récord no puede depender de que el rival esté dado de alta.
    const withGhost = {
      ...played("m-g", "2026-01-07", { id: "pr-1", name: "Ana / Beto" }, { id: "pr-9", name: "Fantasma / Nadie" }, "a", [{ a: 6, b: 3 }]),
      side_b: { pair_id: null, pair_name: "Fantasma / Nadie" },
    } as unknown as Match;

    const records = buildPlayerRecords([withGhost], pairs, players);

    expect(records.get("p-ana")?.played).toBe(1);
    expect(records.get("p-ana")?.won).toBe(1);
  });

  it("descarta el partido si el mismo jugador aparece en los dos lados", () => {
    // Ana en las dos parejas: dato corrupto, no debe contar doble.
    const corrupt = played("m-x", "2026-01-10", { id: "pr-1", name: "Ana / Beto" }, { id: "pr-2", name: "Ana / Caro" }, "a", [{ a: 6, b: 2 }]);

    expect(buildPlayerRecords([corrupt], pairs, players).size).toBe(0);
  });

  it("ignora partidos no terminados o sin ganador", () => {
    const scheduled = { ...played("m-1", "2026-01-10", { id: "pr-1", name: "Ana / Beto" }, { id: "pr-3", name: "Diego / Eva" }, "a", [{ a: 6, b: 2 }]), status: "scheduled", winner: null } as unknown as Match;

    expect(buildPlayerRecords([scheduled], pairs, players).size).toBe(0);
  });

  it("no cuenta un partido de una pareja consigo misma", () => {
    const mirror = played("m-1", "2026-01-10", { id: "pr-1", name: "Ana / Beto" }, { id: "pr-1", name: "Ana / Beto" }, "a", [{ a: 6, b: 2 }]);

    expect(buildPlayerRecords([mirror], pairs, players).size).toBe(0);
  });

  it("recordWinRate devuelve 0 sin partidos", () => {
    expect(recordWinRate({ won: 0, played: 0 })).toBe(0);
    expect(recordWinRate({ won: 7, played: 8 })).toBe(88);
  });
});

describe("qualificationFor (camino a semifinales)", () => {
  const tabla = (pts: number[]): StandingLike[] =>
    pts.map((p, i) => ({
      pairId: `pr-${i + 1}`,
      name: `Pareja ${i + 1}`,
      position: i + 1,
      points: p,
      played: 8,
    }));

  it("una pareja dentro del cupo no necesita puntos", () => {
    const q = qualificationFor(
      tabla([30, 26, 22, 18]),
      { pairId: "pr-2", played: 8, setsWon: 20, setsPlayed: 48 },
      { slots: 2, pointsPerWin: 2 },
    );
    expect(q.inCut).toBe(true);
    expect(q.position).toBe(2);
    expect(q.pointsNeeded).toBe(0);
    expect(q.matchesNeeded).toBeNull();
  });

  it("traduce los puntos que faltan a partidos y a sets reales", () => {
    // 3er lugar, corte en 26: necesita 26-22+1 = 5 puntos.
    const q = qualificationFor(
      tabla([30, 26, 22, 18]),
      { pairId: "pr-3", played: 8, setsWon: 20 },
      { slots: 2, pointsPerWin: 2 },
    );
    expect(q.inCut).toBe(false);
    expect(q.pointsNeeded).toBe(5);
    // 5 puntos a 2 por victoria = 3 partidos; a 2.5 sets por partido = 8 sets.
    expect(q.matchesNeeded).toBe(3);
    expect(q.setsPerMatch).toBe(2.5);
    expect(q.setsNeeded).toBe(8);
  });

  it("dice a quién tiene que ganarle", () => {
    const q = qualificationFor(
      tabla([30, 26, 22, 18]),
      { pairId: "pr-3", played: 8, setsWon: 20 },
      { slots: 2, pointsPerWin: 2 },
    );
    expect(q.mustBeat.map((m) => m.name)).toEqual(["Pareja 2"]);
    expect(q.mustBeat[0].lead).toBe(4);
  });

  it("la probabilidad es una estimación acotada, no un dato", () => {
    const fuerte = qualificationFor(
      tabla([30, 26, 22, 18]),
      { pairId: "pr-1", played: 8, setsWon: 22, setsPlayed: 48 },
      { slots: 2, pointsPerWin: 2 },
    );
    const lejos = qualificationFor(
      tabla([30, 26, 22, 18]),
      { pairId: "pr-4", played: 8, setsWon: 10, setsPlayed: 48 },
      { slots: 2, pointsPerWin: 2 },
    );
    expect(fuerte.semifinalProbability).toBeGreaterThan(lejos.semifinalProbability);
    expect(fuerte.semifinalProbability).toBeLessThanOrEqual(99);
    expect(lejos.semifinalProbability).toBeGreaterThanOrEqual(1);
  });

  it("no se marca confiable con muestra mínima", () => {
    const q = qualificationFor(
      tabla([10, 8, 6]),
      { pairId: "pr-2", played: 1, setsWon: 3, setsPlayed: 6 },
      { slots: 2, pointsPerWin: 2 },
    );
    expect(q.reliable).toBe(false);
  });
});

describe("analyzePairLocal (desempeño derivado de resultados)", () => {
  it("marca pico competitivo con muchos ganados y últimos 3 en verde", () => {
    const perf = analyzePairLocal({ played: 10, won: 8, form: ["G", "G", "G"] });
    expect(perf.forma).toBe(5);
    expect(perf.winRate).toBe(80);
    expect(perf.racha.label).toBe("en racha");
  });

  it("marca bache cuando los últimos 3 fueron perdidos", () => {
    const perf = analyzePairLocal({ played: 10, won: 5, form: ["G", "P", "P", "P"] });
    expect(perf.racha.label).toBe("bache");
    expect(perf.racha.lost).toBe(3);
  });

  it("no inventa racha cuando la pareja no tiene historial", () => {
    const perf = analyzePairLocal({ played: 0, won: 0 });
    // El contrato de JEV usa "sin racha" cuando no hay historial.
    expect(perf.racha.label).toBe("sin racha");
    expect(perf.winRate).toBe(0);
  });
});
