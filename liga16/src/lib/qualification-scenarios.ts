/**
 * Veredicto y escenarios del panel de clasificación, como funciones puras
 * (antes vivían en línea dentro del componente y no se podían probar).
 *
 * Regla de oro (bug reportado por Julian, 2026-10-26): un escenario solo puede
 * nombrar movimientos que TODAVÍA son posibles. Si al rival no le quedan
 * partidos, no puede "ganar lo suyo" ni bajarte; si tú terminaste y nadie del
 * corte tiene partidos, la tabla ya no se mueve. Los partidos restantes de
 * cada pareja llegan en `StandingLike.remaining`; undefined = no se sabe y se
 * asume que sí puede jugar (el comportamiento de antes, conservador).
 */
import type { QualificationView, StandingLike } from "./qualification";

export type ScenarioTone = "pass" | "depends" | "out";

export interface Scenario {
  tone: ScenarioTone;
  label: string;
  when: string;
  then: string;
}

export interface Verdict {
  tone: ScenarioTone;
  word: string;
  sentence: string;
}

export interface ScenarioInput {
  rows: StandingLike[];
  q: QualificationView;
  mePairId: string;
  slots: number;
  /** Partidos que le quedan a MI pareja (>= 0). */
  left: number;
}

const short = (name: string) => name.split("/")[0].trim();
const round1 = (n: number) => Math.round(n * 10) / 10;
const fmtPct = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * ¿Puede esta pareja mover todavía su porcentaje? Solo un dato explícito de 0
 * partidos restantes lo descarta; sin dato se asume que sí puede jugar.
 */
export const canStillPlay = (r: StandingLike): boolean =>
  r.remaining === undefined || r.remaining > 0;

interface Frame {
  sorted: StandingLike[];
  myPoints: number;
  lastPlacePoints: number;
  gapPct: number;
  tiedAtCut: boolean;
  rival: QualificationView["mustBeat"][number] | null;
  /** El que va justo debajo de ti (aunque ya no le queden partidos). */
  chaser: StandingLike | null;
  /** Los de abajo que TODAVÍA pueden mover su porcentaje. */
  aliveBelow: StandingLike[];
  /** El de abajo está empatado contigo y ya no puede jugar: solo desempate. */
  onlyTiebreakBelow: boolean;
  /**
   * Equipo dentro del corte cuyo porcentaje aún puede caer por debajo del
   * tuyo (el de menor porcentaje que puede jugar). null = el corte ya no baja.
   */
  dropTarget: StandingLike | null;
}

function frame(input: ScenarioInput): Frame {
  const { rows, q, mePairId, slots } = input;
  const sorted = [...rows].sort(
    (a, b) => a.position - b.position || b.points - a.points,
  );
  const myPoints = round1(sorted.find((r) => r.pairId === mePairId)?.points ?? 0);
  const lastPlace = sorted[slots - 1];
  const lastPlacePoints = round1(lastPlace?.points ?? 0);
  const gapPct = q.inCut ? 0 : Math.max(0, round1(lastPlacePoints - myPoints));
  const tiedAtCut = !q.inCut && gapPct === 0;
  const rival = q.mustBeat[q.mustBeat.length - 1] ?? null;
  const chaser =
    sorted.find((r) => r.position === q.position + 1) ?? sorted[slots] ?? null;
  const aliveBelow = sorted.filter(
    (r) => r.position > q.position && r.pairId !== mePairId && canStillPlay(r),
  );
  const onlyTiebreakBelow = !!(
    chaser &&
    round1(chaser.points) === myPoints &&
    !canStillPlay(chaser)
  );
  const dropTarget =
    [...sorted]
      .filter(
        (r) => r.position <= slots && r.pairId !== mePairId && canStillPlay(r),
      )
      .sort((a, b) => a.points - b.points)[0] ?? null;
  return {
    sorted,
    myPoints,
    lastPlacePoints,
    gapPct,
    tiedAtCut,
    rival,
    chaser,
    aliveBelow,
    onlyTiebreakBelow,
    dropTarget,
  };
}

/* ------------------------------- veredicto ------------------------------- */

export function buildVerdict(input: ScenarioInput): Verdict {
  const f = frame(input);
  const { q, slots, left } = input;
  const n = f.sorted.length;
  const pos = `${q.position}° de ${n}`;

  if (q.inCut) {
    if (left > 0) {
      return {
        tone: "pass",
        word: "Estás dentro",
        sentence: `Vas ${pos} con ${fmtPct(f.myPoints)}% de rendimiento y pasan ${slots}. Te quedan ${left} partido${left === 1 ? "" : "s"}: ganar sube tu porcentaje y te mantiene arriba.`,
      };
    }
    if (f.onlyTiebreakBelow && f.chaser) {
      return {
        tone: "depends",
        word: "Depende del desempate",
        sentence: `Vas ${pos} con ${fmtPct(f.myPoints)}% y pasan ${slots}. Ya jugaste todo, pero ${short(f.chaser.name)} tiene el mismo porcentaje: el lugar lo define el desempate.`,
      };
    }
    if (f.aliveBelow.length === 0) {
      return {
        tone: "pass",
        word: "Estás dentro",
        sentence: `Vas ${pos} con ${fmtPct(f.myPoints)}% de rendimiento y pasan ${slots}. Ya jugaste todo y a los de abajo no les quedan partidos: tu lugar en semifinales no se mueve.`,
      };
    }
    return {
      tone: "pass",
      word: "Estás dentro",
      sentence: `Vas ${pos} con ${fmtPct(f.myPoints)}% de rendimiento y pasan ${slots}. Ya jugaste todo: si ${short(f.aliveBelow[0].name)} no gana lo que le queda, sigues en semifinales.`,
    };
  }

  if (left > 0) {
    if (f.gapPct <= 1) {
      return {
        tone: "depends",
        word: "Depende de ti",
        sentence: `Vas ${q.position}° con ${fmtPct(f.myPoints)}%: la última plaza está en ${fmtPct(f.lastPlacePoints)}%. Te queda${left === 1 ? "" : "n"} ${left} partido${left === 1 ? "" : "s"} y ganar sube tu porcentaje.`,
      };
    }
    return {
      tone: "out",
      word: "Fuera por ahora",
      sentence: `Vas ${pos} y pasan ${slots}. Te separan ${fmtPct(f.gapPct)} puntos porcentuales de la última plaza (${fmtPct(f.lastPlacePoints)}%) con ${left} partido${left === 1 ? "" : "s"} por jugar: necesitas ganar y que ${f.rival ? short(f.rival.name) : "el de arriba"} no sume.`,
    };
  }

  // Fuera del corte y sin partidos propios.
  if (f.tiedAtCut) {
    return {
      tone: "out",
      word: "Sin partidos",
      sentence: `Ya no te quedan partidos: quedaste ${pos} y pasan ${slots}. Estás empatado en ${fmtPct(f.myPoints)}% con la última plaza, así que el lugar lo decide el desempate.`,
    };
  }
  if (!f.dropTarget) {
    return {
      tone: "out",
      word: "Sin partidos",
      sentence: `Ya no te quedan partidos y nadie dentro del corte tiene partidos por jugar: quedaste ${pos}, a ${fmtPct(f.gapPct)} puntos porcentuales de la última plaza (${fmtPct(f.lastPlacePoints)}%), y la tabla ya no se mueve. Solo un ajuste del torneo te metería.`,
    };
  }
  return {
    tone: "out",
    word: "Sin partidos",
    sentence: `Ya no te quedan partidos: quedaste ${pos} y pasan ${slots}. Te separan ${fmtPct(f.gapPct)} puntos porcentuales de la última plaza (${fmtPct(f.lastPlacePoints)}%) y ya no puedes sumar: tu pase depende de que ${short(f.dropTarget.name)} baje su porcentaje en lo que le queda.`,
  };
}

/* ------------------------------- escenarios ------------------------------ */

/** Con partidos propios: los textos de siempre (no tocados por este bug). */
function liveScenarios(input: ScenarioInput, f: Frame): Scenario[] {
  const { q, slots, left } = input;
  if (q.inCut) {
    return [
      {
        tone: "pass",
        label: "Pasas",
        when: `Ganas 1 de los ${left}`,
        then: `Tu ${fmtPct(f.myPoints)}% sube y sigues entre los ${slots} que van a semifinales.`,
      },
      {
        tone: "depends",
        label: "Depende",
        when: f.chaser ? `Pierdes y ${f.chaser.name} gana` : "Pierdes y alguien de abajo suma",
        then: f.chaser
          ? `Caes a ${q.position + 1}° y ${f.chaser.name} te puede empatar con su ${fmtPct(round1(f.chaser.points))}%: decide el desempate.`
          : `Caes a ${q.position + 1}° y se te acercan: decide el desempate.`,
      },
      {
        tone: "out",
        label: "Riesgo",
        when:
          left > 1
            ? `Pierdes 2 seguidos y ${f.chaser?.name ?? "el de abajo"} gana`
            : `Pierdes y ${f.chaser?.name ?? "el de abajo"} gana`,
        then: `${f.chaser ? `Quedas ${q.position + 2}° y ${f.chaser.name} sube al ${q.position}°.` : `Quedas ${q.position + 2}° y quedas fuera de semifinales.`} Aun así, si EL RIVAL PIERDE, te mantienes.`,
      },
    ];
  }
  return [
    {
      tone: "pass",
      label: "Pasas",
      when: `Ganas tus ${left} partido${left === 1 ? "" : "s"} y ${f.rival?.name ?? "el rival"} no suma`,
      then: `Tu ${fmtPct(f.myPoints)}% sube con cada victoria y ${f.rival ? short(f.rival.name) : "el de arriba"} se queda con el suyo: recortas los ${fmtPct(f.gapPct)} puntos porcentuales.`,
    },
    {
      tone: "depends",
      label: "Depende",
      when: "Ganas 1 y el rival no gana",
      then: f.rival
        ? `${f.rival.name} se queda en ${fmtPct(round1(f.rival.points))}% y tú acercas tu ${fmtPct(f.myPoints)}%: cuánto recortas depende de los juegos de tu partido.`
        : `Te acercas a la última plaza (${fmtPct(f.lastPlacePoints)}%).`,
    },
    {
      tone: "out",
      label: "Riesgo",
      when: "Pierdes",
      then: `No sumas y te quedas con ${fmtPct(f.myPoints)}%, así que bajas a ${q.position + 1}°. ${
        left > 1
          ? `Todavía te quedaría${left === 2 ? "" : "n"} ${left - 1} partido${left - 1 === 1 ? "" : "s"} para recuperar.`
          : "Sería el último partido del rol."
      }`,
    },
  ];
}

/** Sin partidos propios y dentro del corte. */
function frozenInScenarios(input: ScenarioInput, f: Frame): Scenario[] {
  const { q, slots } = input;

  // Nadie debajo de ti puede jugar: nada te baja por resultados.
  if (f.aliveBelow.length === 0) {
    if (f.onlyTiebreakBelow && f.chaser) {
      return [
        {
          tone: "pass",
          label: "Pasas",
          when: "El desempate te favorece",
          then: `Empataste en ${fmtPct(f.myPoints)}% con ${f.chaser.name} y a ninguno de los dos le quedan partidos: si el desempate te deja arriba, terminas ${q.position}°.`,
        },
        {
          tone: "out",
          label: "Riesgo",
          when: "El desempate te deja abajo",
          then: `Quedas ${q.position + 1}°${q.position + 1 > slots ? " y fuera de semifinales" : ", aún dentro"} sin que se juegue un partido más.`,
        },
      ];
    }
    return [
      {
        tone: "pass",
        label: "Pasas",
        when: "La tabla no se mueve",
        then: `Ya jugaste todo y a los de abajo no les quedan partidos: terminas ${q.position}° con ${fmtPct(f.myPoints)}% y juegas semifinales.`,
      },
      {
        tone: "depends",
        label: "Depende",
        when: "Solo un ajuste del torneo",
        then: "Ningún resultado puede bajarte; lo único que te mueve es que el torneo ajuste la tabla (walkover o sanción).",
      },
    ];
  }

  // Al menos uno de abajo sí puede moverse: ese es el único peligro real.
  const c = f.aliveBelow[0];
  const tied = round1(c.points) === f.myPoints;
  const scenarios: Scenario[] = [
    {
      tone: "pass",
      label: "Pasas",
      when: `${short(c.name)} no gana lo que le queda`,
      then: `Si no sube su ${fmtPct(round1(c.points))}%, terminas ${q.position}° con ${fmtPct(f.myPoints)}% y entras a semifinales.`,
    },
    {
      tone: "depends",
      label: "Depende",
      when: `${c.name} gana lo suyo`,
      then: tied
        ? `${c.name} gana lo que le queda y te pasa; si no suma, quedan empatados en ${fmtPct(f.myPoints)}% y decide el desempate.`
        : `${c.name} sube su ${fmtPct(round1(c.points))}% y te puede alcanzar: el lugar queda en manos del desempate.`,
    },
  ];

  // Para sacarte del corte hacen falta `needed` parejas de abajo que te pasen.
  const needed = slots - q.position + 1;
  if (f.aliveBelow.length >= needed) {
    scenarios.push({
      tone: "out",
      label: "Riesgo",
      when: needed === 1 ? `${short(c.name)} te alcanza` : `${needed} de abajo suman`,
      then: `Puedes caer al ${slots + 1}° y quedar fuera de semifinales.`,
    });
  } else {
    scenarios.push({
      tone: "out",
      label: "Riesgo",
      when: "Los de abajo ganan lo suyo",
      then: `Puedes caer hasta ${q.position + f.aliveBelow.length}°, pero sigues dentro de semifinales: solo ${
        f.aliveBelow.length === 1
          ? "una pareja tiene"
          : `${f.aliveBelow.length} parejas tienen`
      } partidos por jugar.`,
    });
  }
  return scenarios;
}

/** Sin partidos propios y fuera del corte. */
function frozenOutScenarios(input: ScenarioInput, f: Frame): Scenario[] {
  const { q } = input;
  const n = f.sorted.length;

  if (f.tiedAtCut) {
    const scenarios: Scenario[] = [
      {
        tone: "pass",
        label: "Pasas",
        when: "El desempate te favorece",
        then: f.rival
          ? `Estás empatado en ${fmtPct(f.myPoints)}% con ${f.rival.name}: si el desempate te deja arriba, entras.`
          : "Solo si el desempate te deja arriba.",
      },
      {
        tone: "depends",
        label: "Depende",
        when: "El desempate te deja abajo",
        then: `Con el mismo ${fmtPct(f.myPoints)}% quedas ${q.position}°: fuera, salvo que el torneo ajuste la tabla.`,
      },
    ];
    const rivalRow = f.rival
      ? f.sorted.find((r) => r.pairId === f.rival!.pairId)
      : undefined;
    if (rivalRow && canStillPlay(rivalRow) && f.rival) {
      scenarios.push({
        tone: "out",
        label: "Riesgo",
        when: `${f.rival.name} gana lo que le queda`,
        then: `${short(f.rival.name)} gana y su ${fmtPct(round1(f.rival.points))}% sube: la diferencia ya no se remonta.`,
      });
    }
    return scenarios;
  }

  // Sin empate: tu porcentaje ya no sube; solo entras si alguien del corte
  // baja el suyo, y eso solo puede pasar si le quedan partidos.
  if (f.dropTarget) {
    const d = f.dropTarget;
    return [
      {
        tone: "pass",
        label: "Pasas",
        when: `${short(d.name)} baja su rendimiento`,
        then: `Si a ${d.name} le va mal en lo que le queda, su ${fmtPct(round1(d.points))}% puede caer por debajo de tu ${fmtPct(f.myPoints)}% y entras sin jugar.`,
      },
      {
        tone: "depends",
        label: "Depende",
        when: `${short(d.name)} mantiene su porcentaje`,
        then: `Si no baja de ${fmtPct(round1(d.points))}%, quedas ${q.position}°: te faltan ${fmtPct(f.gapPct)} puntos porcentuales.`,
      },
      {
        tone: "out",
        label: "Riesgo",
        when: "Nadie del corte baja",
        then: `Quedas ${q.position}° de ${n}, fuera de semifinales, con tu torneo ya cerrado.`,
      },
    ];
  }
  return [
    {
      tone: "out",
      label: "Fuera",
      when: "La tabla no se mueve",
      then: `Ya no te quedan partidos y nadie dentro del corte tiene partidos por jugar: quedas ${q.position}° de ${n}, fuera de semifinales.`,
    },
    {
      tone: "depends",
      label: "Depende",
      when: "Solo un ajuste del torneo",
      then: "Por resultados ya no hay forma; lo único que te movería es que el torneo ajuste la tabla (walkover o sanción).",
    },
  ];
}

export function buildScenarios(input: ScenarioInput): Scenario[] {
  const f = frame(input);
  if (input.left === 0) {
    return input.q.inCut
      ? frozenInScenarios(input, f)
      : frozenOutScenarios(input, f);
  }
  return liveScenarios(input, f);
}
