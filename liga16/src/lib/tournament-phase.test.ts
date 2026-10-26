import { describe, expect, it } from "vitest";
import { tournamentPhase } from "./tournament-phase";

const now = new Date(2026, 9, 26, 12, 0, 0); // 26 oct 2026, hora local
const t = (o: Record<string, string>) =>
  ({ status: "published", start_date: "2026-09-29", end_date: "2026-11-28", registration_deadline: "2026-09-29", ...o }) as never;

describe("tournamentPhase", () => {
  it("published pero dentro de sus fechas = en curso (el caso real)", () => {
    expect(tournamentPhase(t({}), now)).toBe("running");
  });
  it("in_progress siempre es en curso", () => {
    expect(tournamentPhase(t({ status: "in_progress", start_date: "2027-01-01", end_date: "2027-01-02" }), now)).toBe("running");
  });
  it("terminados, cancelados y borradores nunca cuentan", () => {
    for (const status of ["finished", "cancelled", "draft"]) expect(tournamentPhase(t({ status }), now)).toBe("other");
  });
  it("publicado, futuro y con cierre pendiente = inscripciones abiertas", () => {
    expect(tournamentPhase(t({ start_date: "2026-11-05", end_date: "2026-11-07", registration_deadline: "2026-10-29" }), now)).toBe("signup");
  });
  it("registration_open con cierre vencido ya no es abierto", () => {
    expect(tournamentPhase(t({ status: "registration_open", start_date: "2026-12-01", end_date: "2026-12-02", registration_deadline: "2026-10-01" }), now)).toBe("other");
  });
  it("los extremos del rango cuentan", () => {
    expect(tournamentPhase(t({ end_date: "2026-10-26" }), now)).toBe("running");
  });
});
