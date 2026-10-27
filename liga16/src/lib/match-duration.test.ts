import { describe, expect, it } from "vitest";
import { effectiveDurationMinutes } from "./match-duration";
import { scheduleRounds } from "./groups";
import { startsFor } from "../components/kokonutui/slot-picker";

// Un día 9:00-21:00 con un partido registrado de 10:00 a 11:00.
const day = {
  date: "2026-10-28",
  open: [9 * 60, 21 * 60] as [number, number],
  busy: [[10 * 60, 11 * 60]] as [number, number][],
};

describe("cruces del calendario con duración de 60 y 90 min", () => {
  it("un hueco de 60 cabe a las 9:00 junto a un partido a las 10:00, pero uno de 90 choca", () => {
    expect(startsFor(day, 60)).toContain(9 * 60);
    expect(startsFor(day, 90)).not.toContain(9 * 60);
  });

  it("tampoco cabe un bloque de 90 a las 9:15/9:30/9:45: terminarían en medio del partido", () => {
    for (const t of [9 * 60 + 15, 9 * 60 + 30, 9 * 60 + 45]) {
      expect(startsFor(day, 90)).not.toContain(t);
    }
  });

  it("ambos caben a las 11:00, cuando termina el partido", () => {
    expect(startsFor(day, 60)).toContain(11 * 60);
    expect(startsFor(day, 90)).toContain(11 * 60);
  });

  it("el bloque de 90 respeta el cierre: el último inicio termina a las 21:00", () => {
    expect(startsFor(day, 90)).toContain(21 * 60 - 90);
    expect(startsFor(day, 90)).not.toContain(21 * 60 - 90 + 15);
  });
});

describe("effectiveDurationMinutes", () => {
  it("usa la duración registrada cuando existe", () => {
    expect(effectiveDurationMinutes({ duration_minutes: 90 }, 60)).toBe(90);
    expect(effectiveDurationMinutes({ duration_minutes: 60 }, 90)).toBe(60);
  });

  it("cae al default del torneo cuando no hay duración registrada (sin inventar 60 histórico)", () => {
    expect(effectiveDurationMinutes({ duration_minutes: null }, 90)).toBe(90);
    expect(effectiveDurationMinutes({}, 60)).toBe(60);
    expect(effectiveDurationMinutes({ duration_minutes: 0 }, 60)).toBe(60);
  });
});

describe("scheduleRounds con duración del torneo", () => {
  it("con 90 min los turnos de una misma jornada quedan a 90 minutos (no 60)", () => {
    // 4 parejas, 1 cancha: la jornada tiene 2 partidos en turnos seguidos.
    const rounds = scheduleRounds(["a", "b", "c", "d"], 1, "2026-11-01", 90, 9);
    const [m1, m2] = rounds[0];
    const t1 = new Date(m1.scheduled_at).getTime();
    const t2 = new Date(m2.scheduled_at).getTime();
    expect((t2 - t1) / 60000).toBe(90);
  });
});
