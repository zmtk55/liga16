/**
 * Cuánto falta para clasificar a semifinales.
 *
 * Todo se deriva de la tabla de posiciones: no hay números escritos a mano ni
 * Supongamos nada sobre el formato. La probabilidad al final es una estimación
 * transparente sobre la distancia al corte, y por eso se devuelve separada de
 * los datos duros para poder mostrarla como tal.
 */

export interface StandingLike {
  pairId: string;
  name: string;
  position: number;
  points: number;
  played: number;
}

export interface MyLine {
  /** Total de sets del jugador en la muestra (opcional para compatibilidad). */
  setsPlayed?: number;
  pairId: string;
  /** Partidos disputados. */
  played: number;
  /** Sets ganados en total. */
  setsWon: number;
}

export interface CutContext {
  /** Cuántas parejas clasifican desde esta tabla; el cupo lo define el torneo. */
  slots: number;
  /** Puntos que otorga ganar un partido, según el scoring del torneo. */
  pointsPerWin: number;
}

export interface MustBeat {
  pairId: string;
  name: string;
  position: number;
  points: number;
  /** Puntos por delante que el rival le saca. */
  lead: number;
}

export interface QualificationView {
  position: number;
  inCut: boolean;
  /** Puntos que faltan para alcanzar el corte; 0 si ya está dentro. */
  pointsNeeded: number;
  /** Partidos que habría que ganar al ritmo actual. */
  matchesNeeded: number | null;
  /** Sets que habría que ganar, al promedio del jugador. */
  setsNeeded: number | null;
  /** Promedio de sets ganados por partido. */
  setsPerMatch: number;
  /** Pares que hay que alcanzar: los que están justo por encima. */
  mustBeat: MustBeat[];
  /**
   * Estimación 0..1 de clasificar, NO un dato. Se muestra como estimación.
   */
  semifinalProbability: number;
  /** Con qué confianza se puede decir: false si la muestra es mínima. */
  reliable: boolean;
}

const MIN_SAMPLE = 3;

export function qualificationFor(
  standings: StandingLike[],
  me: MyLine,
  ctx: CutContext,
): QualificationView {
  const rows = [...standings].sort((a, b) => a.position - b.position || b.points - a.points);
  const mine = rows.find((r) => r.pairId === me.pairId);
  const position = mine?.position ?? rows.length + 1;
  const myPoints = mine?.points ?? 0;
  const inCut = position <= ctx.slots;

  // El corte lo marca la última pareja que clasifica; si clasifican más, la peor.
  const cutRow = rows[Math.max(ctx.slots - 1, 0)];
  const cutPoints = cutRow?.points ?? 0;
  const pointsNeeded = inCut ? 0 : Math.max(cutPoints - myPoints + 1, 0);

  // "Sets que necesito" se expresa en sets por PARTIDO, no por set jugado:
  // en un partido de 2 sets ganas 0, 1 o 2, nunca 0.25.
  const setsPerMatch = me.played > 0 ? me.setsWon / me.played : 0;
  const pointsPerWin = ctx.pointsPerWin > 0 ? ctx.pointsPerWin : 1;
  const matchesNeeded = inCut
    ? null
    : Math.max(1, Math.ceil(pointsNeeded / pointsPerWin));
  const setsNeeded =
    matchesNeeded !== null && setsPerMatch > 0
      ? Math.ceil(matchesNeeded * setsPerMatch)
      : null;

  // A quién hay que ganarle: los que están por encima (posición menor) y entre
  // tú y la línea de corte. "Por encima" es menor número de posición.
  const boundary = inCut ? position - 1 : ctx.slots;
  const mustBeat = rows
    .filter((r) => r.position < position && r.position >= Math.max(1, boundary))
    .slice(-3)
    .map((r) => ({
      pairId: r.pairId,
      name: r.name,
      position: r.position,
      points: r.points,
      lead: r.points - myPoints,
    }));

  // Estimación: distancia al corte normalizada por lo que se mueve la tabla.
  const allPoints = rows.map((r) => r.points).filter((p) => Number.isFinite(p));
  const median = allPoints.length
    ? [...allPoints].sort((a, b) => a - b)[Math.floor(allPoints.length / 2)]
    : 0;
  const spread = allPoints.length > 1 ? Math.max(...allPoints) - Math.min(...allPoints) : 1;
  const k = Math.max(spread / 4, 1);
  const raw = 1 / (1 + Math.exp(-(myPoints - median) / k));
  // Acota a los casos donde el corte ya se decidió: 1 dentro, 0 fuera del alcance.
  const semifinalProbability = inCut
    ? Math.min(0.99, Math.max(raw, 0.75))
    : Math.max(0.01, Math.min(raw, 0.6));

  return {
    position,
    inCut,
    pointsNeeded,
    matchesNeeded,
    setsNeeded,
    setsPerMatch: Math.round(setsPerMatch * 10) / 10,
    mustBeat,
    semifinalProbability: Math.round(semifinalProbability * 100),
    reliable: me.played >= MIN_SAMPLE && rows.length >= 4,
  };
}
