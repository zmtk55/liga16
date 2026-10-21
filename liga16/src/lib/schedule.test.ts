import { describe, expect, it } from "vitest";
import {
  assignSlotsToMatches,
  buildSlotGrid,
  findScheduleIssues,
  isSlotFree,
  localDayKey,
  localTimeHHMM,
  nextFreeTimes,
  rescheduleTo,
  tournamentDays,
} from "./schedule";

/**
 * Los instantes se construyen desde la zona local de quien corre el test, y las
 * aserciones se escriben sobre PROPIEDADES (el día/hora local de un instante,
 * la ida y vuelta de una reprogramación) para que el archivo valga igual en
 * CDMX que en un runner en UTC.
 */
const atLocal = (day: string, time: string) => rescheduleTo(day, time);

/** Horas de la zona local respecto a UTC, negativas si va detrás (CDMX = -6). */
const localOffsetHours = -new Date("2026-09-26T12:00:00Z").getTimezoneOffset() / 60;

describe("tournamentDays", () => {
  it("devuelve un día por día entre inicio y fin", () => {
    expect(tournamentDays({ start_date: "2026-09-26", end_date: "2026-09-28" })).toEqual([
      "2026-09-26",
      "2026-09-27",
      "2026-09-28",
    ]);
  });
  it("un solo día si no hay fecha de fin, y nada si no hay inicio", () => {
    expect(tournamentDays({ start_date: "2026-10-09" })).toEqual(["2026-10-09"]);
    expect(tournamentDays({ start_date: null })).toEqual([]);
  });
  it("no cruza meses equivocados", () => {
    expect(tournamentDays({ start_date: "2026-09-30", end_date: "2026-10-02" })).toEqual([
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
  });
});

describe("localDayKey / localTimeHHMM", () => {
  it("el día y la hora son los locales, no los del string UTC", () => {
    const iso = atLocal("2026-09-26", "19:30");
    expect(localDayKey(iso)).toBe("2026-09-26");
    expect(localTimeHHMM(iso)).toBe("19:30");
  });
  it("un partido de las 23:00 sigue siendo del día que se agendó", () => {
    // El bug: `scheduled_at.startsWith(dia)` comparaba contra el prefijo UTC, que
    // en zonas negativas apunta al día siguiente y esconde el partido.
    const iso = atLocal("2026-09-26", "23:00");
    expect(localDayKey(iso)).toBe("2026-09-26");
  });
  it.skipIf(localOffsetHours >= 0)("en una zona detrás del UTC el prefijo sí mentiría", () => {
    const iso = atLocal("2026-09-26", "23:00");
    expect(iso.slice(0, 10)).not.toBe(localDayKey(iso));
  });
  it("deja intacta una fecha sin hora", () => {
    expect(localDayKey("2026-09-26")).toBe("2026-09-26");
  });
  it("no truena con basura", () => {
    expect(localDayKey("")).toBe("");
    expect(localDayKey("no-es-fecha")).toBe("");
    expect(localTimeHHMM("no-es-fecha")).toBe("");
  });
});

describe("rescheduleTo", () => {
  it("la ida y la vuelta: reprogramar devuelve ese día y esa hora", () => {
    const iso = rescheduleTo("2026-09-27", "19:30");
    expect(localDayKey(iso)).toBe("2026-09-27");
    expect(localTimeHHMM(iso)).toBe("19:30");
  });
  it("mover solo la hora no cambia el día", () => {
    const iso = rescheduleTo("2026-09-26", "21:15");
    expect(localDayKey(iso)).toBe("2026-09-26");
    expect(localTimeHHMM(iso)).toBe("21:15");
  });
});

describe("findScheduleIssues", () => {
  const base = [
    { id: "a", court_name: "Cancha 1", scheduled_at: atLocal("2026-09-26", "11:00") },
    { id: "b", court_name: "Cancha 1", scheduled_at: atLocal("2026-09-26", "11:00") },
    { id: "c", court_name: "Cancha 2", scheduled_at: atLocal("2026-09-26", "11:00") },
    { id: "d", court_name: null, scheduled_at: atLocal("2026-09-26", "12:00") },
  ];

  it("marca el choque de cancha y hora en los dos partidos", () => {
    const issues = findScheduleIssues(base);
    expect(issues.get("a")?.map((i) => i.kind)).toContain("choque");
    expect(issues.get("b")?.map((i) => i.kind)).toContain("choque");
    expect(issues.has("c")).toBe(false);
  });
  it("el aviso dice la hora que ve la persona, no la del UTC", () => {
    const issues = findScheduleIssues([
      { id: "a", court_name: "Cancha 1", scheduled_at: atLocal("2026-09-26", "23:00") },
      { id: "b", court_name: "Cancha 1", scheduled_at: atLocal("2026-09-26", "23:00") },
    ]);
    expect(issues.get("a")?.[0].label).toContain("23:00");
  });
  it("no confunde dos días distintos", () => {
    expect(
      findScheduleIssues([
        { id: "a", court_name: "Cancha 1", scheduled_at: atLocal("2026-09-26", "23:00") },
        { id: "b", court_name: "Cancha 1", scheduled_at: atLocal("2026-09-25", "23:00") },
      ]).size,
    ).toBe(0);
  });
  it("marca el partido sin cancha", () => {
    expect(findScheduleIssues(base).get("d")?.map((i) => i.kind)).toEqual(["sin_cancha"]);
  });
  it("nada que decir cuando todo está bien", () => {
    expect(
      findScheduleIssues([
        { id: "a", court_name: "Cancha 1", scheduled_at: atLocal("2026-09-26", "11:00") },
        { id: "b", court_name: "Cancha 1", scheduled_at: atLocal("2026-09-26", "13:00") },
      ]).size,
    ).toBe(0);
  });
});

describe("isSlotFree / nextFreeTimes", () => {
  const matches = [{ id: "a", court_name: "Cancha 1", scheduled_at: atLocal("2026-09-26", "11:00") }];

  it("ocupado cuando es el mismo día, hora y cancha", () => {
    expect(isSlotFree(matches, { day: "2026-09-26", time: "11:00", court: "Cancha 1" })).toBe(false);
  });
  it("libre en otra cancha, otra hora u otro día", () => {
    expect(isSlotFree(matches, { day: "2026-09-26", time: "11:00", court: "Cancha 2" })).toBe(true);
    expect(isSlotFree(matches, { day: "2026-09-26", time: "11:30", court: "Cancha 1" })).toBe(true);
    expect(isSlotFree(matches, { day: "2026-09-27", time: "11:00", court: "Cancha 1" })).toBe(true);
  });
  it("reprogramar sobre sí mismo no cuenta como choque", () => {
    expect(
      isSlotFree(matches, { day: "2026-09-26", time: "11:00", court: "Cancha 1", ignoreId: "a" }),
    ).toBe(true);
  });
  it("propone horas libres saltando la ocupada", () => {
    expect(nextFreeTimes(matches, { day: "2026-09-26", court: "Cancha 1" }, 10, 12, 60)).toEqual([
      "10:00",
      "12:00",
    ]);
  });
});

describe("buildSlotGrid / assignSlotsToMatches", () => {
  const cfg = {
    days: ["2026-10-06", "2026-10-07"],
    hours: [9, 11],
    courtNames: ["Cancha 1", "cancha 2"],
  };

  it("un hueco por día, hora y cancha, y todos distintos", () => {
    const grid = buildSlotGrid(cfg);
    expect(grid).toHaveLength(2 * 2 * 2);
    expect(new Set(grid.map((g) => `${g.court}|${g.at}`)).size).toBe(grid.length);
  });

  it("el hueco cae en el día y la hora que se ven en pantalla", () => {
    const grid = buildSlotGrid(cfg);
    expect(localDayKey(grid[0].at)).toBe("2026-10-06");
    expect(localTimeHHMM(grid[0].at)).toBe("09:00");
  });

  it("nadie cae en el mismo día, hora y cancha que otro", () => {
    const matches = [
      { id: "m1", jornada: 1, category: "4ta" },
      { id: "m2", jornada: 1, category: "5ta" },
      { id: "m3", jornada: 1, category: "4ta" },
      { id: "m4", jornada: 2, category: "5ta" },
    ];
    const { assignments } = assignSlotsToMatches(matches, cfg);
    const occupied = assignments.map((a) => `${a.court}|${a.at}`);
    expect(new Set(occupied).size).toBe(assignments.length);
  });

  it("la jornada 1 va antes que la jornada 2 aunque el orden de entrada sea otro", () => {
    const matches = [
      { id: "j2", jornada: 2, category: "5ta" },
      { id: "j1", jornada: 1, category: "4ta" },
    ];
    const { assignments } = assignSlotsToMatches(matches, cfg);
    expect(assignments[0].id).toBe("j1");
    expect(assignments[1].id).toBe("j2");
  });

  it("avisa cuántos partidos se quedan sin hueco en vez de amontonarlos", () => {
    const matches = Array.from({ length: 5 }, (_, i) => ({ id: `m${i}`, jornada: 1, category: "4ta" }));
    const { assignments, missing, slots } = assignSlotsToMatches(matches, {
      days: ["2026-10-06"],
      hours: [9, 11],
      courtNames: ["Cancha 1"],
    });
    expect(slots).toBe(2);
    expect(assignments).toHaveLength(2);
    expect(missing).toBe(3);
  });
});
