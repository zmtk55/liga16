import { describe, expect, it } from "vitest";
import { qualificationFor } from "./qualification";
import type { StandingLike } from "./qualification";
import { buildScenarios, buildVerdict, canStillPlay } from "./qualification-scenarios";
import { answerQualification } from "./qualification-answer";

/**
 * Bug de Julian (2026-10-26): con el rol terminado el panel decía "el de abajo
 * gana lo suyo y te puede bajar", aunque NADIE tuviera partidos por jugar.
 * Los escenarios solo pueden nombrar movimientos que todavía son posibles:
 * por eso cada pareja trae `remaining` (partidos que le quedan).
 */

const team = (
  pairId: string,
  name: string,
  position: number,
  points: number,
  remaining?: number,
): StandingLike => ({ pairId, name, position, points, played: 6, remaining });

const SLOTS = 4;
const ctx = { slots: SLOTS, pointsPerWin: 3 };
const me = { pairId: "me", played: 6, setsWon: 8 };

/** Rol terminado: yo 3° y nadie tiene partidos por jugar. */
const frozenRows = [
  team("a", "Ana / Bea", 1, 80, 0),
  team("b", "Carla / Dana", 2, 72, 0),
  team("me", "Julian / Pedro", 3, 65, 0),
  team("d", "Elena / Fabi", 4, 60, 0),
  team("e", "Gaby / Hugo", 5, 55, 0),
  team("f", "Ivan / Jorge", 6, 40, 0),
];

const inputFor = (rows: StandingLike[], left = 0) => ({
  rows,
  q: qualificationFor(rows, me, ctx),
  mePairId: me.pairId,
  slots: SLOTS,
  left,
});

const text = (scenarios: ReturnType<typeof buildScenarios>) =>
  scenarios.map((s) => `${s.when} ${s.then}`).join(" ");

describe("canStillPlay", () => {
  it("solo un 0 explícito descarta; sin dato se asume que puede jugar", () => {
    expect(canStillPlay(team("x", "X / Y", 1, 50, 0))).toBe(false);
    expect(canStillPlay(team("x", "X / Y", 1, 50, 2))).toBe(true);
    expect(canStillPlay(team("x", "X / Y", 1, 50))).toBe(true);
  });
});

describe("escenarios con el rol terminado (el bug de Julian)", () => {
  it("dentro del corte y sin partidos de nadie: ningún escenario te puede bajar", () => {
    const scenarios = buildScenarios(inputFor(frozenRows));
    const all = text(scenarios);
    expect(all).not.toMatch(/gana lo suyo/);
    expect(all).not.toMatch(/te puede alcanzar/);
    expect(all).not.toMatch(/Puedes caer/);
    expect(scenarios[0]).toMatchObject({ tone: "pass", label: "Pasas", when: "La tabla no se mueve" });
    expect(all).toContain("juegas semifinales");
  });

  it("el veredicto dice que tu lugar no se mueve, no que 'alguien puede subir'", () => {
    const verdict = buildVerdict(inputFor(frozenRows));
    expect(verdict.word).toBe("Estás dentro");
    expect(verdict.sentence).toContain("a los de abajo no les quedan partidos");
    expect(verdict.sentence).not.toContain("si nadie sube por debajo");
  });

  it("si el de abajo SÍ tiene partidos, el escenario de que te alcance se queda", () => {
    const rows = frozenRows.map((r) => (r.pairId === "d" ? { ...r, remaining: 2 } : r));
    const all = text(buildScenarios(inputFor(rows)));
    expect(all).toContain("Elena / Fabi gana lo suyo");
    expect(all).toContain("te puede alcanzar");
  });

  it("en la última plaza con uno abajo con partidos: el riesgo de caer fuera es real", () => {
    const rows = [
      team("a", "Ana / Bea", 1, 80, 0),
      team("b", "Carla / Dana", 2, 72, 0),
      team("c", "Elena / Fabi", 3, 68, 0),
      team("me", "Julian / Pedro", 4, 65, 0),
      team("e", "Gaby / Hugo", 5, 64, 1),
    ];
    const all = text(buildScenarios(inputFor(rows)));
    expect(all).toContain(`Puedes caer al ${SLOTS + 1}° y quedar fuera de semifinales`);
  });

  it("si no hay suficientes vivos abajo para sacarte, el riesgo lo dice: sigues dentro", () => {
    const rows = frozenRows.map((r) => (r.pairId === "d" ? { ...r, remaining: 1 } : r));
    const all = text(buildScenarios(inputFor(rows)));
    expect(all).not.toContain("quedar fuera de semifinales");
    expect(all).toContain("pero sigues dentro de semifinales");
  });

  it("empatado abajo y sin partidos: todo queda en el desempate", () => {
    const rows = frozenRows.map((r) => (r.pairId === "d" ? { ...r, points: 65 } : r));
    const scenarios = buildScenarios(inputFor(rows));
    expect(scenarios.map((s) => s.when)).toEqual([
      "El desempate te favorece",
      "El desempate te deja abajo",
    ]);
    const verdict = buildVerdict(inputFor(rows));
    expect(verdict.word).toBe("Depende del desempate");
  });

  it("fuera del corte sin partidos y sin empate: ya no promete desempate ni empates inventados", () => {
    const rows = [
      team("a", "Ana / Bea", 1, 80, 0),
      team("b", "Carla / Dana", 2, 72, 0),
      team("c", "Elena / Fabi", 3, 68, 0),
      team("d", "Gaby / Hugo", 4, 60, 0),
      team("me", "Julian / Pedro", 5, 58, 0),
      team("e", "Ivan / Jorge", 6, 55, 0),
    ];
    const scenarios = buildScenarios(inputFor(rows));
    const all = text(scenarios);
    expect(all).not.toContain("El desempate te favorece");
    expect(all).not.toContain("Estás empatado");
    expect(scenarios[0].label).toBe("Fuera");
    expect(all).toContain("La tabla no se mueve");
    const verdict = buildVerdict(inputFor(rows));
    expect(verdict.sentence).toContain("la tabla ya no se mueve");
  });

  it("fuera del corte sin partidos: si la última plaza aún juega, la vía real es que baje su rendimiento", () => {
    const rows = [
      team("a", "Ana / Bea", 1, 80, 0),
      team("b", "Carla / Dana", 2, 72, 0),
      team("c", "Elena / Fabi", 3, 68, 0),
      team("d", "Gaby / Hugo", 4, 60, 1),
      team("me", "Julian / Pedro", 5, 58, 0),
      team("e", "Ivan / Jorge", 6, 55, 0),
    ];
    const scenarios = buildScenarios(inputFor(rows));
    expect(scenarios[0]).toMatchObject({ tone: "pass", label: "Pasas" });
    expect(scenarios[0].when).toContain("baja su rendimiento");
    expect(scenarios[0].when).toContain("Gaby");
    const verdict = buildVerdict(inputFor(rows));
    expect(verdict.sentence).toContain("tu pase depende de que Gaby baje su porcentaje");
  });

  it("empatado con la última plaza sin partidos propios: desempate; el riesgo del rival solo si él sí juega", () => {
    const base = [
      team("a", "Ana / Bea", 1, 80, 0),
      team("b", "Carla / Dana", 2, 72, 0),
      team("c", "Elena / Fabi", 3, 68, 0),
      team("d", "Gaby / Hugo", 4, 60, 0),
      team("me", "Julian / Pedro", 5, 60, 0),
    ];
    const frozen = buildScenarios(inputFor(base));
    expect(frozen).toHaveLength(2);
    expect(text(frozen)).toContain("El desempate te favorece");
    expect(text(frozen)).not.toContain("gana lo que le queda");

    const live = buildScenarios(
      inputFor(base.map((r) => (r.pairId === "d" ? { ...r, remaining: 1 } : r))),
    );
    expect(live).toHaveLength(3);
    expect(text(live)).toContain("Gaby / Hugo gana lo que le queda");
  });

  it("sin dato de `remaining` conserva el comportamiento anterior (conservador)", () => {
    const rows = frozenRows.map(({ remaining: _r, ...rest }) => rest);
    const all = text(buildScenarios(inputFor(rows)));
    expect(all).toContain("gana lo suyo");
    expect(all).toContain("te puede alcanzar");
  });
});

describe("regresión: con partidos propios nada cambia", () => {
  it("dentro del corte con 2 partidos: mismos escenarios de siempre", () => {
    const scenarios = buildScenarios(inputFor(frozenRows, 2));
    expect(scenarios.map((s) => s.label)).toEqual(["Pasas", "Depende", "Riesgo"]);
    expect(scenarios[0].when).toBe("Ganas 1 de los 2");
    expect(scenarios[1].when).toBe("Pierdes y Elena / Fabi gana");
  });
});

describe("respuestas de IA con el rol terminado", () => {
  const answer = (prompt: string, rows: StandingLike[], left = 0) =>
    answerQualification({
      prompt,
      rows,
      me,
      q: qualificationFor(rows, me, ctx),
      slots: SLOTS,
      remainingMatches: left,
      reading: null,
    });

  it("posibilidades dentro del corte sin partidos de nadie: el lugar ya está escrito", () => {
    const a = answer("¿Qué posibilidades tengo de pasar?", frozenRows);
    expect(a).toContain("ya está escrito");
    expect(a).not.toContain("te puede alcanzar");
  });

  it("posibilidades dentro del corte con un vivo abajo: lo advierte con nombre", () => {
    const rows = frozenRows.map((r) => (r.pairId === "d" ? { ...r, remaining: 2 } : r));
    const a = answer("¿Qué posibilidades tengo de pasar?", rows);
    expect(a).toContain("Elena");
    expect(a).toContain("te puede alcanzar");
  });

  it("mi rival ya no tiene partidos: no puede alcanzarte", () => {
    const a = answer("¿Qué necesito para que mi rival no pase?", frozenRows);
    expect(a).toContain("ya jugó todo");
    expect(a).toContain("no te puede alcanzar");
  });

  it("fuera del corte y tabla congelada: no hay vía", () => {
    const rows = [
      team("a", "Ana / Bea", 1, 80, 0),
      team("b", "Carla / Dana", 2, 72, 0),
      team("c", "Elena / Fabi", 3, 68, 0),
      team("d", "Gaby / Hugo", 4, 60, 0),
      team("me", "Julian / Pedro", 5, 58, 0),
      team("e", "Ivan / Jorge", 6, 55, 0),
    ];
    const a = answer("¿Qué posibilidades tengo de pasar?", rows);
    expect(a).toContain("la tabla ya no se mueve");
  });

  it("'ya no tengo partidos' con un vivo abajo: advierte que sí te pueden alcanzar", () => {
    const rows = frozenRows.map((r) => (r.pairId === "d" ? { ...r, remaining: 1 } : r));
    const a = answer("¿Ya no tengo más partidos: estoy adentro o fuera?", rows);
    expect(a).toContain("Elena");
    expect(a).toContain("te puede alcanzar");
  });
});
