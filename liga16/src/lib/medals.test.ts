import { describe, it, expect } from "vitest";
import { buildPlayerMedals, MEDAL_CATALOG, EFFECTIVENESS_MIN_MATCHES } from "./medals";
import type { PairRef } from "./individual-ranking";
import { buildPlayerRecords } from "./records";
import type { Match, PlayerProfile, Tournament } from "@/types";

/* Mismas fixtures mínimas que individual-ranking.test.ts: 3 torneos, 8 jugadores. */

const P = (id: string, name: string, sex: "M" | "F" | "X" = "M") =>
  ({ id, display_name: name, sex, photo_url: null }) as PlayerProfile;

const players = [
  P("j1", "Ana"), P("j2", "Beto"), P("j3", "Cora"), P("j4", "Dani"),
  P("j5", "Eli", "F"), P("j6", "Fer", "F"), P("j7", "Gaby", "F"), P("j8", "Hugo"),
];

const pair = (id: string, name: string, t: string, p1: string, p2: string): PairRef => ({
  id, name, tournament_id: t, category_name: "3ra", player1_id: p1, player2_id: p2,
});

const pairs = [
  pair("pa1", "Ana / Beto", "t1", "j1", "j2"),
  pair("pa2", "Cora / Dani", "t1", "j3", "j4"),
  pair("pa3", "Eli / Fer", "t1", "j5", "j6"),
  pair("pa4", "Gaby / Hugo", "t1", "j7", "j8"),
  pair("pb1", "Eli / Fer", "t2", "j5", "j6"),
  pair("pb2", "Cora / Dani", "t2", "j3", "j4"),
  pair("pc1", "Ana / Beto", "t3", "j1", "j2"),
  pair("pc2", "Cora / Dani", "t3", "j3", "j4"),
];

const tournaments = [
  { id: "t1", name: "Copa Uno", slug: "copa-uno", start_date: "2026-01-10", end_date: "2026-01-12" },
  { id: "t2", name: "Copa Dos", slug: "copa-dos", start_date: "2026-02-10", end_date: "2026-02-12" },
  { id: "t3", name: "Copa Tres", slug: "copa-tres", start_date: "2026-03-10", end_date: "2026-03-12" },
] as Tournament[];

let mid = 0;
const M = (
  t: string, round: string, a: string, b: string, winner: "a" | "b",
  sets: Array<{ a: number; b: number }> = [{ a: 6, b: 3 }],
  status: Match["status"] = "finished",
  scheduled = "2026-01-11T10:00:00Z",
): Match => ({
  id: `m${++mid}`, tournament_id: t, round, status, winner, sets,
  court_name: null, scheduled_at: scheduled,
  side_a: { pair_id: a, pair_name: pairs.find((p) => p.id === a)?.name ?? a },
  side_b: { pair_id: b, pair_name: pairs.find((p) => p.id === b)?.name ?? b },
});

const baseMatches: Match[] = [
  // t1 grupos: Ana/Beto 2-0 · Cora/Dani 1-1 · Eli/Fer 0-2 · Gaby/Hugo 1-1
  M("t1", "Grupo A · J1", "pa1", "pa3", "a"),
  M("t1", "Grupo A · J1", "pa2", "pa4", "b"),
  M("t1", "Grupo A · J2", "pa1", "pa4", "a"),
  M("t1", "Grupo A · J2", "pa2", "pa3", "a"),
  // t1 llave: semis + final (campeones Ana/Beto, invictos)
  M("t1", "Semifinales · r1-m1", "pa1", "pa4", "a"),
  M("t1", "Semifinales · r1-m2", "pa2", "pa3", "a"),
  M("t1", "Final · r2-m1", "pa1", "pa2", "a", [{ a: 6, b: 4 }], "finished", "2026-01-12T18:00:00Z"),
  // t2: solo final, campeonas Eli/Fer sin jugar grupos
  M("t2", "Final · r1-m1", "pb1", "pb2", "a", [{ a: 7, b: 5 }], "finished", "2026-02-12T18:00:00Z"),
  // t3 en curso: solo grupos
  M("t3", "Grupo A · J1", "pc1", "pc2", "a"),
  // Ruido que no cuenta
  { ...M("t1", "Grupo A · J3", "pa1", "pa2", "a"), status: "cancelled" as const },
  { ...M("t3", "Final · r2-m1", "pc1", "pc2", "a"), winner: null, status: "scheduled" as const },
];

function medalsFor(playerId: string, matches: Match[] = baseMatches) {
  const records = buildPlayerRecords(matches, pairs as never, players);
  const medals = buildPlayerMedals(playerId, matches, pairs, players, tournaments, records);
  return new Map(medals.map((m) => [m.def.id, m]));
}

describe("catálogo de medallas", () => {
  it("tiene ids únicos y umbrales coherentes", () => {
    const ids = MEDAL_CATALOG.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MEDAL_CATALOG) {
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.rule.length).toBeGreaterThan(0);
      if (m.thresholds && !m.descending) {
        expect(m.thresholds[0]).toBeLessThan(m.thresholds[1]);
        expect(m.thresholds[1]).toBeLessThan(m.thresholds[2]);
      }
      if (m.thresholds && m.descending) {
        expect(m.thresholds[0]).toBeGreaterThan(m.thresholds[1]);
        expect(m.thresholds[1]).toBeGreaterThan(m.thresholds[2]);
      }
    }
  });
});

describe("buildPlayerMedals", () => {
  it("campeón invicto: Ana gana t1 sin perder y encadena 5 victorias", () => {
    const m = medalsFor("j1");
    expect(m.get("campeon")).toMatchObject({ current: 1, tier: "bronce", nextTarget: 3, progress: 0 });
    expect(m.get("invicto")).toMatchObject({ current: 1, tier: "oro", nextTarget: null, progress: 1 });
    expect(m.get("racha")).toMatchObject({ current: 5, tier: "plata", nextTarget: 8 });
    expect(m.get("lider")).toMatchObject({ current: 3, tier: "plata" }); // Eli/Fer van #1 por un punto
    expect(m.get("puntos")).toMatchObject({ current: 130, tier: "bronce", nextTarget: 250 });
    expect(m.get("finalista")?.tier).toBeNull();
    expect(m.get("de-gira")).toMatchObject({ current: 2, tier: null, nextTarget: 3 });
  });

  it("efectividad exige un mínimo de partidos aunque el porcentaje sea alto", () => {
    const m = medalsFor("j1"); // 5-0 = 100%, pero 5 partidos < mínimo
    const ef = m.get("efectividad")!;
    expect(ef.tier).toBeNull();
    expect(ef.progress).toBe(0);
    expect(ef.detail).toContain(`${EFFECTIVENESS_MIN_MATCHES} partidos mínimos`);
  });

  it("campeón de llave chica también puede ser invicto", () => {
    const m = medalsFor("j5"); // Eli: t2 ganó su único partido (la final)
    expect(m.get("campeon")).toMatchObject({ current: 1, tier: "bronce" });
    expect(m.get("invicto")).toMatchObject({ current: 1, tier: "oro" });
    expect(m.get("de-llave")).toMatchObject({ current: 1, tier: "bronce" }); // semifinalista en t1
    expect(m.get("racha")).toMatchObject({ current: 1, tier: null });
  });

  it("finalista acumula finales sin título", () => {
    const m = medalsFor("j3"); // Cora: 2 finales perdidas, 0 títulos
    expect(m.get("finalista")).toMatchObject({ current: 2, tier: "bronce", nextTarget: 3, progress: 0.5 });
    expect(m.get("campeon")?.tier).toBeNull();
  });

  it("jugador nuevo: casi todo bloqueado, con progreso visible", () => {
    const m = medalsFor("j7"); // Gaby: 38 pts, #7, 1 semifinal
    expect(m.get("de-llave")).toMatchObject({ current: 1, tier: "bronce" });
    expect(m.get("lider")).toMatchObject({ current: 7, tier: "bronce" }); // top 10
    expect(m.get("campeon")?.tier).toBeNull();
    expect(m.get("invicto")?.tier).toBeNull();
    expect(m.get("puntos")).toMatchObject({ current: 38, tier: null, nextTarget: 100 });
    expect(m.get("puntos")!.progress).toBeCloseTo(0.38, 2);
  });

  it("las medallas se recalculan solas si se corrige un resultado", () => {
    // Se corrige la final de t1: ganan Cora/Dani, no Ana/Beto.
    const fixed = baseMatches.map((m) =>
      m.round.startsWith("Final") && m.tournament_id === "t1" ? { ...m, winner: "b" as const } : m,
    );
    const ana = medalsFor("j1", fixed);
    expect(ana.get("campeon")?.tier).toBeNull();
    expect(ana.get("invicto")?.tier).toBeNull();
    expect(ana.get("finalista")).toMatchObject({ current: 1, tier: "bronce" });
    const cora = medalsFor("j3", fixed);
    expect(cora.get("campeon")).toMatchObject({ current: 1, tier: "bronce" });
    expect(cora.get("finalista")).toMatchObject({ current: 1, tier: "bronce" }); // solo la de t2
  });
});
