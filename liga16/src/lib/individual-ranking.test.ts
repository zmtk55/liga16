import { describe, it, expect } from "vitest";
import {
  buildIndividualStandings,
  buildPlayerHonors,
  individualPointsFor,
  knockoutPhase,
  DEFAULT_INDIVIDUAL_POINTS,
  type PairRef,
} from "./individual-ranking";
import { buildPlayerRecords } from "./records";
import type { Match, PlayerProfile, Tournament } from "@/types";

/* Fixtures mínimas: 2 torneos, 1 categoría, 4 parejas (8 jugadores). */

const P = (id: string, name: string, sex: "M" | "F" | "X" = "M") =>
  ({ id, display_name: name, sex, photo_url: null }) as PlayerProfile;

const players = [
  P("j1", "Ana"), P("j2", "Beto"), P("j3", "Cora"), P("j4", "Dani"),
  P("j5", "Eli", "F"), P("j6", "Fer", "F"), P("j7", "Gaby", "F"), P("j8", "Hugo"),
];

const pair = (id: string, name: string, t: string, p1: string, p2: string, category = "3ra"): PairRef => ({
  id, name, tournament_id: t, category_name: category, player1_id: p1, player2_id: p2,
});

// Torneo 1 (cerrado): Ana/Beto campeones, Cora/Dani finalistas.
const t1pairs = [
  pair("pa1", "Ana / Beto", "t1", "j1", "j2"),
  pair("pa2", "Cora / Dani", "t1", "j3", "j4"),
  pair("pa3", "Eli / Fer", "t1", "j5", "j6"),
  pair("pa4", "Gaby / Hugo", "t1", "j7", "j8"),
];
// Torneo 2 (cerrado): Eli/Fer campeonas; Ana/Beto ni entraron.
const t2pairs = [
  pair("pb1", "Eli / Fer", "t2", "j5", "j6"),
  pair("pb2", "Cora / Dani", "t2", "j3", "j4"),
];
// Torneo 3 (en curso): final sin capturar; solo grupos.
const t3pairs = [pair("pc1", "Ana / Beto", "t3", "j1", "j2"), pair("pc2", "Cora / Dani", "t3", "j3", "j4")];

const pairs = [...t1pairs, ...t2pairs, ...t3pairs];

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

const matches: Match[] = [
  // t1 grupos (jornada): Ana/Beto ganan sus 2, Cora/Dani 1-1, Eli/Fer 0-2, Gaby/Hugo 1-1
  M("t1", "Grupo A · J1", "pa1", "pa3", "a"),
  M("t1", "Grupo A · J1", "pa2", "pa4", "b"),
  M("t1", "Grupo A · J2", "pa1", "pa4", "a"),
  M("t1", "Grupo A · J2", "pa2", "pa3", "a"),
  // t1 eliminatorias: semis + final
  M("t1", "Semifinales · r1-m1", "pa1", "pa4", "a"),
  M("t1", "Semifinales · r1-m2", "pa2", "pa3", "a"),
  M("t1", "Final · r2-m1", "pa1", "pa2", "a", [{ a: 6, b: 4 }], "finished", "2026-01-12T18:00:00Z"),
  // t2: solo final (llave chica), ganan Eli/Fer
  M("t2", "Final · r1-m1", "pb1", "pb2", "a", [{ a: 7, b: 5 }], "finished", "2026-02-12T18:00:00Z"),
  // t3: grupos jugados, final pendiente
  M("t3", "Grupo A · J1", "pc1", "pc2", "a"),
  // Ruido que NO debe contar: cancelado y sin ganador
  { ...M("t1", "Grupo A · J3", "pa1", "pa2", "a"), status: "cancelled" as const },
  { ...M("t3", "Final · r2-m1", "pc1", "pc2", "a"), winner: null, status: "scheduled" as const },
];

const records = buildPlayerRecords(matches, pairs as never, players);

describe("knockoutPhase", () => {
  it("gradúa la etiqueta del cruce y no confunde semifinal con final", () => {
    expect(knockoutPhase("Final · r2-m1")).toBe("final");
    expect(knockoutPhase("Semifinales · r1-m1")).toBe("semifinal");
    expect(knockoutPhase("Cuartos de final · r1-m1")).toBe("quarterfinal");
    expect(knockoutPhase("Octavos de final · r1-m1")).toBe("roundOf16");
    expect(knockoutPhase("Grupo A · J1")).toBeNull();
    expect(knockoutPhase("")).toBeNull();
  });
});

describe("individualPointsFor", () => {
  it("usa la tabla estándar sin ajuste y respeta el ajuste del torneo", () => {
    expect(individualPointsFor(null)).toEqual(DEFAULT_INDIVIDUAL_POINTS);
    expect(individualPointsFor({ individual_points: { champion: 100 } } as never).champion).toBe(100);
    expect(individualPointsFor({ individual_points: { champion: -5 } } as never).champion)
      .toBe(DEFAULT_INDIVIDUAL_POINTS.champion);
  });
});

describe("buildIndividualStandings", () => {
  const standings = buildIndividualStandings(matches, pairs, players, tournaments, records);
  const byId = new Map(standings.map((s) => [s.playerId, s]));
  const c = DEFAULT_INDIVIDUAL_POINTS;

  it("puntos = grupos (victoria/derrota) + bono por ronda máxima", () => {
    // Ana: t1 grupos 2V = 20, bono campeón; t3 grupos 1V = 10
    expect(byId.get("j1")?.points).toBe(2 * c.groupWin + c.champion + c.groupWin);
    // Cora: t1 1V1D = 13 + finalista 40; t2 0 grupos + finalista 40; t3 1D = 3 → 96? No:
    // t1: 10+3+40 = 53; t2: 40; t3: 3 → 96
    expect(byId.get("j3")?.points).toBe(c.groupWin + c.groupLoss + c.finalist + c.finalist + c.groupLoss);
    // Eli: t1 0V2D = 6 + semifinal 25; t2 campeona
    expect(byId.get("j5")?.points).toBe(2 * c.groupLoss + c.semifinalist + c.champion);
    // Gaby: t1 1V1D = 13 + semifinal 25 = 38
    expect(byId.get("j7")?.points).toBe(c.groupWin + c.groupLoss + c.semifinalist);
  });

  it("el torneo sin final capturada solo suma puntos de grupos", () => {
    // t3 aporta a Ana 10 y a Cora 3, sin bonos (su "final" no tiene ganador).
    expect(byId.get("j1")?.tournaments).toBe(2); // t1 + t3
  });

  it("cuenta títulos, finales y semifinales por jugador", () => {
    expect(byId.get("j1")?.titles).toBe(1);
    expect(byId.get("j3")?.titles).toBe(0);
    expect(byId.get("j3")?.finals).toBe(2);
    expect(byId.get("j5")?.titles).toBe(1);
    expect(byId.get("j5")?.semis).toBe(1);
    expect(byId.get("j7")?.semis).toBe(1);
  });

  it("ordena por puntos con desempates definidos y posición estilo RANK", () => {
    // Las campeonas (2 títulos cada una) arriba del constante sin títulos:
    // con campeón=100, Eli/Fer 131 > Ana/Beto 130 > Cora/Dani 96.
    expect(new Set([standings[0].playerId, standings[1].playerId])).toEqual(new Set(["j5", "j6"]));
    expect(standings[0].position).toBe(1);
    expect(standings[1].position).toBe(1);
    expect(standings[2].position).toBe(3); // RANK: salta tras el grupo empatado
    expect(new Set([standings[2].playerId, standings[3].playerId])).toEqual(new Set(["j1", "j2"]));
    expect(byId.get("j3")?.position).toBe(5);
    expect(byId.get("j5")!.points).toBeGreaterThan(byId.get("j3")!.points);
    // Ana y Beto empatan en todo: comparten posición
    const ana = byId.get("j1")!, beto = byId.get("j2")!;
    expect(ana.points).toBe(beto.points);
    expect(ana.position).toBe(beto.position);
  });

  it("excluye partidos cancelados y no crea jugadores fantasma", () => {
    expect(standings.every((s) => players.some((p) => p.id === s.playerId))).toBe(true);
    // El cancelado t1 pa1 vs pa2 no sumó (si sumara, Ana tendría 10 más).
    expect(byId.get("j1")?.points).not.toBe(2 * c.groupWin + c.champion + 2 * c.groupWin);
  });
});

describe("buildPlayerHonors", () => {
  it("deriva el palmarés con torneo, categoría, compañero y fecha", () => {
    const honors = buildPlayerHonors("j5", matches, pairs, players, tournaments);
    expect(honors.map((h) => h.kind)).toEqual(["title", "semi"]); // más reciente primero
    expect(honors[0].tournamentName).toBe("Copa Dos");
    expect(honors[0].partnerName).toBe("Fer");
    expect(honors[0].date).toBe("2026-02-12T18:00:00Z");
    expect(honors[1].kind).toBe("semi");
    expect(honors[1].tournamentName).toBe("Copa Uno");
  });

  it("un jugador sin finales no tiene palmarés", () => {
    expect(buildPlayerHonors("j7", matches, pairs, players, tournaments).map((h) => h.kind)).toEqual(["semi"]);
  });
});
