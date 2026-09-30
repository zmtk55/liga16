import { describe, expect, it } from "vitest";
import { buildPlayerRecords, recordWinRate } from "./records";
import { bracketSizeFor, buildBracket, moveSeed, resolveBracket, seedOrder, type BracketEntry } from "./bracket";
import { tournamentProgress } from "./tournament-progress";
import { analyzePairLocal, analyzePlayerLocal, consistenciaFromSets, momentumFrom, rivalAdjusted } from "./jev";
import { qualificationFor, type StandingLike } from "./qualification";
import { drawGroupsByCategory, parseRound, roundRobinRounds, type DrawablePair } from "./groups";
import type { Match, Pair, PlayerCard, PlayerProfile } from "@/types";

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
      { pairId: "pr-2", played: 8, setsWon: 20 },
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
      { pairId: "pr-1", played: 8, setsWon: 22 },
      { slots: 2, pointsPerWin: 2 },
    );
    const lejos = qualificationFor(
      tabla([30, 26, 22, 18]),
      { pairId: "pr-4", played: 8, setsWon: 10 },
      { slots: 2, pointsPerWin: 2 },
    );
    expect(fuerte.semifinalProbability).toBeGreaterThan(lejos.semifinalProbability);
    expect(fuerte.semifinalProbability).toBeLessThanOrEqual(99);
    expect(lejos.semifinalProbability).toBeGreaterThanOrEqual(1);
  });

  it("no se marca confiable con muestra mínima", () => {
    const q = qualificationFor(
      tabla([10, 8, 6]),
      { pairId: "pr-2", played: 1, setsWon: 3 },
      { slots: 2, pointsPerWin: 2 },
    );
    expect(q.reliable).toBe(false);
  });
});

describe("analyzePlayerLocal (señales JEV)", () => {
  const player = {
    display_name: "Ana",
    preferred_position: "drive",
    dominant_hand: "right",
    official_level: 5,
  } as unknown as PlayerProfile;

  it("la distribución de forma suma 1 (bug: se dividía sin guardar)", () => {
    const jev = analyzePlayerLocal(player, null, null, {
      played: 8,
      won: 7,
      form: ["G", "G", "G"],
    });
    const total = Object.values(jev.forma.distribution).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it("sin partidos no afirma que el jugador está mal", () => {
    const jev = analyzePlayerLocal(player, null, null, { played: 0, won: 0, form: [] });
    expect(jev.forma.label).toBe("Aún no hay partidos");
    expect(jev.forma.confidence).toBe(0);
    expect(jev.consistencia.label).toBe("Sin datos");
  });

  it("la consistencia usa la dispersión de sets, no solo el porcentaje", () => {
    const parejo = analyzePlayerLocal(player, null, null, {
      played: 4,
      won: 2,
      form: ["G", "P"],
      setsPorPartida: [6, 6, 3, 7],
    });
    const irregular = analyzePlayerLocal(player, null, null, {
      played: 4,
      won: 2,
      form: ["G", "P"],
      setsPorPartida: [6, 0, 6, 0],
    });
    // Mismo 50% de victorias, distinta consistencia.
    expect(parejo.consistencia.score).toBeGreaterThan(irregular.consistencia.score);
  });

  it("usa el récord derivado cuando viene, no la card vieja", () => {
    // Card vieja dice 2/2 (100%), el récord real dice 1/10 (10%).
    const cardVieja = { won: 2, played: 2, recent_results: ["G", "G"], trend: [6, 6] } as unknown as PlayerCard;
    const conCard = analyzePlayerLocal(player, cardVieja, null);
    const conDerivado = analyzePlayerLocal(player, cardVieja, null, {
      played: 10,
      won: 1,
      form: ["P", "P"],
    });
    expect(conCard.forma.score).toBeGreaterThan(conDerivado.forma.score);
    expect(conDerivado.forma.label).toBe("Le cuesta marcar diferencias");
  });
});

describe("analyzePairLocal (desempeño derivado de resultados)", () => {
  it("marca pico competitivo con muchos ganados y últimos 3 en verde", () => {
    const perf = analyzePairLocal({ played: 10, won: 8, form: ["G", "G", "G"] });
    expect(perf.forma).toBe(5);
    expect(perf.winRate).toBe(80);
    expect(perf.racha.label).toBe("sube");
  });

  it("marca bache cuando los últimos 3 fueron perdidos", () => {
    const perf = analyzePairLocal({ played: 10, won: 5, form: ["G", "P", "P", "P"] });
    expect(perf.racha.label).toBe("le cuesta");
    expect(perf.racha.lost).toBe(3);
  });

  it("sin historial no inventa una racha", () => {
    const perf = analyzePairLocal({ played: 0, won: 0 });
    expect(perf.racha.label).toBe("sin datos");
    expect(perf.winRate).toBe(0);
  });

  it("no usa palabras que un jugador no entiende", () => {
    const ficha = { preferred_position: "drive", dominant_hand: "right", official_level: 5 } as unknown as PlayerProfile;
    const perf = analyzePairLocal({ played: 10, won: 1, form: ["P"] });
    const jev = analyzePlayerLocal(ficha, null, null, { played: 10, won: 1, form: ["P"] });
    const todo = [perf.formaLabel, perf.racha.label, jev.forma.label, jev.consistencia.label, jev.racha.label].join(" ");
    for (const palabra of ["Deja vu", "déjà", "engranado", "bache", "Noul"]) {
      expect(todo).not.toContain(palabra);
    }
  });
});

describe("consistenciaFromSets (qué tan parejo rinde)", () => {
  it("distingue a dos jugadores con el mismo 50%", () => {
    // 2-2 en ambos casos, pero uno gana parejo y el otro sube y baja.
    const parejo = consistenciaFromSets([6, 6, 3, 7]);
    const irregular = consistenciaFromSets([6, 0, 6, 0]);
    expect(parejo.reliable).toBe(true);
    expect(irregular.reliable).toBe(true);
    expect(parejo.score).toBeGreaterThan(irregular.score);
    expect(parejo.variacion).toBeLessThan(irregular.variacion);
  });

  it("con menos de 3 partidos no inventa consistencia", () => {
    const r = consistenciaFromSets([6, 6]);
    expect(r.reliable).toBe(false);
    expect(r.label).toBe("Sin datos");
    expect(r.score).toBe(0);
  });

  it("el mismo promedio con distinta dispersión da distinta consistencia", () => {
    // Ambos promedian 3 sets por partido.
    const a = consistenciaFromSets([3, 3, 3, 3]);
    const b = consistenciaFromSets([6, 6, 0, 0]);
    expect(a.score).toBeGreaterThan(b.score);
    expect(a.desviacion).toBe(0);
  });
});

describe("bracket (siembra clásica)", () => {
  const equipos = (n: number): BracketEntry[] =>
    Array.from({ length: n }, (_, i) => ({
      seed: i + 1,
      name: `Pareja ${i + 1}`,
      points: 100 - i,
      pairId: `pr-${i + 1}`,
    }));

  it("siembra clásica: el 1 queda arriba y el último cae contra él", () => {
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("los dos primeros quedan en mitades opuestas", () => {
    for (const size of [4, 8, 16] as const) {
      const order = seedOrder(size);
      const mitad = order.length / 2;
      expect(order.slice(0, mitad)).toContain(1);
      expect(order.slice(mitad)).toContain(2);
    }
  });

  it("el bracket crece a potencia de dos y avisa de los byes", () => {
    expect(bracketSizeFor(3)).toBe(4);
    expect(bracketSizeFor(5)).toBe(8);
    const b = buildBracket(equipos(3));
    expect(b.size).toBe(4);
    expect(b.byes).toHaveLength(1);
    // La primera ronda tiene size/2 partidos.
    expect(b.matches.filter((m) => m.round === 1)).toHaveLength(2);
  });

  it("el primero se planta y el último es su rival en primera ronda", () => {
    const b = buildBracket(equipos(8));
    const primera = b.matches.filter((m) => m.round === 1);
    expect(primera[0].a?.seed).toBe(1);
    expect(primera[0].b?.seed).toBe(8);
  });

  it("mover una siembra rehace el bracket sin romper la estructura", () => {
    const movido = moveSeed(equipos(4), 1, 4);
    expect(movido.find((q) => q.pairId === "pr-1")?.seed).toBe(4);
    const b = buildBracket(movido);
    const primera = b.matches.filter((m) => m.round === 1);
    // El que era 1 ahora aparece en la posición del 4.
    expect(primera.flatMap((m) => [m.a?.pairId, m.b?.pairId]).filter(Boolean)).toContain("pr-1");
  });
it("el ganador de una semi pasa a la final", () => {
    const b = buildBracket(equipos(4));
    // La primera pareja gana su semi contra la cuarta.
    const avanzado = resolveBracket(b, (a) => (a.seed === 1 ? a.pairId : null));
    const semis = avanzado.filter((m) => m.round === 1);
    const final = avanzado.find((m) => m.round === 2);
    expect(semis[0].played).toBe(true);
    expect(final?.a?.pairId).toBe("pr-1");
    expect(final?.b).toBeNull(); // la otra semi todavía no se juega
  });

  it("sin resultado capturado el cruce no avanza", () => {
    const b = buildBracket(equipos(4));
    const avanzado = resolveBracket(b, () => null);
    expect(avanzado.filter((m) => m.round === 1).every((m) => m.played === false)).toBe(true);
    expect(avanzado.find((m) => m.round === 2)?.a).toBeNull();
  });

  it("las dos semis definidas llevan a la final", () => {
    const b = buildBracket(equipos(4));
    // Gana la impar de cada semi: 1 vs 4 gana la 1, 2 vs 3 gana la 3.
    const avanzado = resolveBracket(b, (a, rival) => (a.seed % 2 === 1 ? a.pairId : rival.pairId));
    const final = avanzado.find((m) => m.round === 2);
    expect(final?.a?.pairId).toBe("pr-1");
    expect(final?.b?.pairId).toBe("pr-3");
    expect(final?.played).toBe(true);
  });
});

describe("tournamentProgress (cómo va el torneo)", () => {
  const e = (n: number): BracketEntry[] =>
    Array.from({ length: n }, (_, i) => ({ seed: i + 1, name: `P${i + 1}`, points: 0, pairId: `p${i + 1}` }));

  it("sin resultados está en la primera ronda con todos pendientes", () => {
    const b = buildBracket(e(4));
    const r = resolveBracket(b, () => null);
    const p = tournamentProgress({ matches: r, rounds: b.rounds, played: 0, total: 3 })!;
    expect(p.currentRound).toBe(1);
    expect(p.pendingInRound).toBe(2);
    expect(p.champion).toBeNull();
    expect(p.finished).toBe(false);
  });

  it("con una semi resuelta muestra a los dos finalistas", () => {
    const b = buildBracket(e(4));
    const r = resolveBracket(b, (a) => (a.seed === 1 ? a.pairId : null));
    const p = tournamentProgress({ matches: r, rounds: b.rounds, played: 1, total: 3 })!;
    expect(p.finalists[0]?.pairId).toBe("p1");
    expect(p.finalists[1]).toBeNull();
    expect(p.currentRound).toBe(1);
  });

  it("con el final decidido declara campeón", () => {
    const b = buildBracket(e(4));
    const r = resolveBracket(b, (a, rival) => (a.seed % 2 === 1 ? a.pairId : rival.pairId));
    const p = tournamentProgress({ matches: r, rounds: b.rounds, played: 3, total: 3 })!;
    expect(p.champion?.pairId).toBe("p1");
    expect(p.finished).toBe(true);
  });

  it("sin parejas no inventa progreso", () => {
    expect(tournamentProgress({ matches: [], rounds: 0, played: 0, total: 0 })).toBeNull();
  });
});

describe("momentumFrom (viene ganando AHORA, no antes)", () => {
  it("las victorias recientes pesan más que las viejas", () => {
    // Mismo récord (4-2) en seis partidos, orden opuesto.
    const recientes = momentumFrom(["P", "P", "G", "G", "G", "G"]);
    const downturn = momentumFrom(["G", "G", "P", "P", "P", "P"]);
    expect(recientes.score).toBeGreaterThan(downturn.score);
    expect(recientes.label).toBe("Viene ganando");
    expect(downturn.label).toBe("Viene perdiendo");
  });

  it("cuenta la racha sin ponderar", () => {
    expect(momentumFrom(["P", "G", "G", "G"]).racha).toBe(3);
    expect(momentumFrom(["G", "G", "P", "P"]).racha).toBe(0);
  });

  it("con menos de 3 partidos no dice nada", () => {
    const m = momentumFrom(["G", "G"]);
    expect(m.reliable).toBe(false);
    expect(m.label).toBe("Sin datos");
    expect(m.score).toBe(0);
  });

  it("ganar y perder parejo queda a la par", () => {
    const m = momentumFrom(["G", "P", "G", "P"]);
    expect(m.label).toBe("A la par");
  });
});

describe("rivalAdjusted (cuenta contra quién se ganó)", () => {
  it("reconoce a quien le gana a los mejores", () => {
    // Gana a dos de 5 y pierde contra un 2.5: el rival no explica la victoria.
    const contraDebiles = rivalAdjusted({
      opponents: [
        { won: true, opponentLevel: 5.5 },
        { won: true, opponentLevel: 5.2 },
        { won: false, opponentLevel: 2.4 },
      ],
      myLevel: 4,
      played: 3,
      won: 2,
    });
    // Mismo récord, pero las victorias son contra gente de 2.
    const contraFuertes = rivalAdjusted({
      opponents: [
        { won: true, opponentLevel: 2.5 },
        { won: true, opponentLevel: 2.2 },
        { won: false, opponentLevel: 5.4 },
      ],
      myLevel: 4,
      played: 3,
      won: 2,
    });
    expect(contraDebiles.score).toBeGreaterThan(contraFuertes.score);
    expect(contraDebiles.label).toBe("Rinde de más");
    expect(contraFuertes.label).toBe("Le cuestan los mejores");
  });

  it("no se marca confiable con menos de 3 rivales conocidos", () => {
    const r = rivalAdjusted({
      opponents: [{ won: true, opponentLevel: 5 }],
      myLevel: 4,
      played: 1,
      won: 1,
    });
    expect(r.reliable).toBe(false);
    expect(r.sample).toBe(1);
  });

  it("sin nivel de rival conocido devuelve sin datos, no un número inventado", () => {
    const r = rivalAdjusted({
      opponents: [{ won: true, opponentLevel: null }],
      myLevel: 4,
      played: 1,
      won: 1,
    });
    expect(r.label).toBe("Sin datos");
    expect(r.score).toBe(0);
  });
});

describe("una categoría es una competencia cerrada", () => {
  // 4 parejas de 4ta y 4 de 5ta, el caso que se revolvía: antes compartían
  // bracket y hasta se enfrentaban en la primera ronda del round-robin.
  const cat4: DrawablePair[] = Array.from({ length: 4 }, (_, i) => ({
    id: `4ta-${i}`,
    category_id: "c-4ta",
    categoryName: "4ta Masculino",
  }));
  const cat5: DrawablePair[] = Array.from({ length: 4 }, (_, i) => ({
    id: `5ta-${i}`,
    category_id: "c-5ta",
    categoryName: "5ta Masculino",
  }));
  const todas = [...cat4, ...cat5];
  const categoriaDe = new Map(todas.map((p) => [p.id, p.categoryName]));

  it("el sorteo nunca junta 4tas con 5tas en un mismo grupo", () => {
    for (const g of drawGroupsByCategory(todas)) {
      const cats = new Set(g.pairIds.map((id) => categoriaDe.get(id)));
      expect(cats.size).toBeLessThanOrEqual(1);
    }
  });

  it("con varias categorías el nombre del grupo dice cuál es", () => {
    const names = drawGroupsByCategory(todas).map((g) => g.name);
    expect(names.some((n) => n.startsWith("4ta Masculino · "))).toBe(true);
    expect(names.some((n) => n.startsWith("5ta Masculino · "))).toBe(true);
  });

  it("con una sola categoría los grupos se llaman como siempre", () => {
    expect(drawGroupsByCategory(cat4).every((g) => g.name.startsWith("Grupo "))).toBe(true);
  });

  it("no se pierde ninguna pareja en el sorteo", () => {
    const sorteadas = drawGroupsByCategory(todas).flatMap((g) => g.pairIds).sort();
    expect(sorteadas).toEqual(todas.map((p) => p.id).sort());
  });

  it("el round-robin de un grupo solo enfrenta parejas de esa categoría", () => {
    for (const g of drawGroupsByCategory(todas)) {
      for (const ronda of roundRobinRounds(g.pairIds)) {
        for (const [a, b] of ronda) {
          expect(categoriaDe.get(a)).toBe(categoriaDe.get(b));
        }
      }
    }
  });

  it("el nombre del grupo con categoría se separa bien de la jornada", () => {
    expect(parseRound("4ta Masculino · Grupo A · J2")).toEqual({
      group: "4ta Masculino · Grupo A",
      jornada: 2,
    });
    expect(parseRound("Grupo A · J1")).toEqual({ group: "Grupo A", jornada: 1 });
    // Sin etiqueta de jornada no inventa una.
    expect(parseRound("Grupo A")).toEqual({ group: "Grupo A", jornada: null });
  });
});
