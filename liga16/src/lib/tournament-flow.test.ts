import { describe, expect, it, vi } from "vitest";
import type { Match, Pair } from "@/types";
import { drawGroupsByCategory, isKnockoutRound } from "./groups";
import { groupsFromPairs, groupMatchDrafts, hasMatchActivity, knockoutDrafts, reconcileMatches, resolvedKnockout } from "./tournament-flow";
import { assignSlotsToMatches } from "./schedule";
const pairs: Pair[] = ["a", "b", "c", "d"].map((id) => ({ id, name: id, tournament_id: "t", category_id: "cat", player1_id: id+"1", player2_id: id+"2", seed: null, group_name: "Grupo A" }));
const names = new Map([["cat", "4ta"]]);
const entries = pairs.map((p, i) => ({ pairId: p.id, name: p.name, seed: i+1, points: 0 }));
const stored = (m: Omit<Match, "id">, i = 0): Match => ({ ...m, id: `m${i}` });
const win = (m: Match, side: "a" | "b" = "a"): Match => ({ ...m, status: "finished", winner: side, sets: [{ a: 6, b: 2, tiebreak_a: null, tiebreak_b: null }, { a: 6, b: 3, tiebreak_a: null, tiebreak_b: null }] });
describe("sorteo real y persistencia", () => {
 it("carga desde parejas, vaciar no reconstruye partidos viejos", () => {
  expect(groupsFromPairs(pairs)[0].pairIds).toHaveLength(4);
  expect(groupsFromPairs(pairs.map((p) => ({ ...p, group_name: null })))).toEqual([]);
 });
 it("round robin genera IDs, categoría, jornadas y sin duplicados", () => {
  const ms = groupMatchDrafts(groupsFromPairs(pairs), pairs, "t", names);
  expect(ms).toHaveLength(6); expect(ms.every((m) => m.category_name === "4ta" && m.side_a.pair_id && m.side_b.pair_id)).toBe(true);
  expect(new Set(ms.map((m) => [m.side_a.pair_id, m.side_b.pair_id].sort().join())).size).toBe(6);
 });
 it("no mezcla categorías aunque tengan el mismo nombre", () => {
  const g = drawGroupsByCategory([...pairs.map((p) => ({ id: p.id, category_id: p.category_id, categoryName: "4ta" })), { id: "e", category_id: "other", categoryName: "4ta" }]);
  expect(g.flatMap((x) => x.pairIds)).toHaveLength(5);
  expect(g.some((x) => x.pairIds.includes("e") && x.pairIds.length > 1)).toBe(false);
 });
 it("resortear ignora asignaciones anteriores y no pierde parejas renombradas", () => {
  const input = pairs.map((p) => ({ id: p.id, category_id: p.category_id, categoryName: "4ta", groupName: "Renombrado" }));
  vi.spyOn(Math, "random").mockReturnValue(0);
  expect(drawGroupsByCategory(input, () => 2, false).flatMap((g) => g.pairIds).sort()).toEqual(["a", "b", "c", "d"]);
  expect(drawGroupsByCategory(input, () => 2, true).flatMap((g) => g.pairIds)).toHaveLength(4);
  vi.restoreAllMocks();
 });
 it("regenerar repetido es idempotente y preserva resultados existentes", () => {
  const drafts = groupMatchDrafts(groupsFromPairs(pairs), pairs, "t", names);
  const current = drafts.map(stored); current[0] = win(current[0]);
  expect(reconcileMatches(current, drafts)).toEqual({ create: [], remove: [] });
  expect(() => reconcileMatches(current, [])).toThrow("resultados");
  expect(() => reconcileMatches([{ ...current[1], sets: [{ a: 1, b: 0, tiebreak_a: null, tiebreak_b: null }] }], [])).toThrow();
  expect(hasMatchActivity({ ...current[1], status: "live" })).toBe(true);
 });
 it("no permite un grupo de dos categorías", () => {
  expect(() => groupMatchDrafts(groupsFromPairs(pairs), pairs.map((p, i) => i === 0 ? { ...p, category_id: "other" } : p), "t", names)).toThrow("categorías");
 });
});
describe("eliminatorias completas", () => {
 it("semis, final y campeón; grupo no resuelve nada", () => {
  const first = knockoutDrafts(entries, [], "t", "4ta");
  expect(first).toHaveLength(2); expect(first.every((m) => isKnockoutRound(m.round))).toBe(true);
  const semis = first.map(stored).map((m) => win(m));
  const next = knockoutDrafts(entries, semis, "t", "4ta");
  expect(next).toHaveLength(3); expect(next[2].round).toBe("Final · r2-m1");
  const all = [...semis, win(stored(next[2], 2))];
  expect(resolvedKnockout(entries, all).matches.at(-1)?.winnerId).toBe("a");
  expect(resolvedKnockout(entries, semis.map((m) => ({ ...m, round: "Grupo A · J1" }))).matches.every((m) => !m.winnerId)).toBe(true);
  expect(reconcileMatches(all, knockoutDrafts(entries, all, "t", "4ta")).create).toEqual([]);
 });
 it("3 equipos: bye y final sin partido falso", () => {
  const e = entries.slice(0, 3); const first = knockoutDrafts(e, [], "t", "4ta");
  expect(first).toHaveLength(1);
  const next = knockoutDrafts(e, [win(stored(first[0]))], "t", "4ta");
  expect(next).toHaveLength(2); expect(next[1].side_a.pair_id).toBe("a");
 });
 it("8 clasificados: cuartos y avance por nodo exacto", () => {
  const e = Array.from({ length: 8 }, (_, i) => ({ pairId: String(i), name: String(i), seed: i+1, points: 0 }));
  const d = knockoutDrafts(e, [], "t", "4ta"); expect(d).toHaveLength(4); expect(d.every((m) => m.round.startsWith("Cuartos"))).toBe(true);
  const ms = d.map(stored).map((m) => win(m)); expect(knockoutDrafts(e, ms, "t", "4ta")).toHaveLength(6);
  expect(resolvedKnockout(e, ms.map((m) => ({ ...m, round: "Final · r3-m1" }))).matches.some((m) => m.played)).toBe(false);
 });
 it("corregir una semifinal no borra una final capturada", () => {
  const semis = knockoutDrafts(entries, [], "t", "4ta").map(stored).map((m) => win(m));
  const final = win(stored(knockoutDrafts(entries, semis, "t", "4ta")[2], 2));
  const changed = [win(semis[0], "b"), semis[1], final];
  expect(() => reconcileMatches(changed, knockoutDrafts(entries, changed, "t", "4ta"))).toThrow("resultados");
  expect(resolvedKnockout(entries, changed).matches.at(-1)?.winnerId).toBeNull();
 });
 it("reserva horarios existentes al repartir", () => {
  const cfg = { days: ["2026-11-01"], hours: [9, 10], courtNames: ["Cancha 1"] };
  const first = assignSlotsToMatches([{ id: "a", jornada: 1 }], cfg).assignments[0];
  const next = assignSlotsToMatches([{ id: "b", jornada: 1 }], cfg, [{ scheduled_at: first.at, court_name: first.court }]);
  expect(next.assignments[0].at).not.toBe(first.at);
 });
});
