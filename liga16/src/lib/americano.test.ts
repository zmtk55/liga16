import { describe, expect, it } from 'vitest';
import { PUBLISHED_DEMO_SNAPSHOT_TEXT } from './americano-demo-published.fixture';
import {
  deriveAppliedConfig,
  generateMixAmericano,
  nextMixicanoRound,
  type Genero,
  generateTeamAmericano,
  nextTeamMexicanoRound,
  pairsFromRoster,
  teamMexicanoTotalRounds,
  nextMexicanoRound,
  mexicanoRoundReady,
  mexicanoTotalRounds,
  americanoStandings,
  constrainedFullRotation,
  partnershipCoverage,
  fullRotationRounds,
  generateAmericano,
  maxConsecutiveRests,
  maxCourts,
  parseAmericanoDemo,
  playoffFinalPairs,
  proposePlayoffPairs,
  serializeAmericanoDemo,
  validateAmericanoScore,
  type AmericanoDemoSnapshot,
  type AmericanoRound,
} from './americano';

function partnershipStats(rounds: AmericanoRound[]) {
  const seen = new Set<string>();
  let repeats = 0;
  for (const round of rounds)
    for (const match of round.matches)
      for (const team of [match.teamA, match.teamB]) {
        const key = [...team].sort((x, y) => x - y).join('-');
        if (seen.has(key)) repeats++;
        else seen.add(key);
      }
  return { covered: seen.size, repeats };
}

function playedCounts(rounds: AmericanoRound[], n: number) {
  const counts = Array<number>(n).fill(0);
  for (const round of rounds)
    for (const match of round.matches)
      for (const p of [...match.teamA, ...match.teamB]) counts[p]++;
  return counts;
}

function restCounts(rounds: AmericanoRound[], n: number) {
  const counts = Array<number>(n).fill(0);
  for (const round of rounds) for (const p of round.resting) counts[p]++;
  return counts;
}

function expectValidSchedule(rounds: AmericanoRound[], n: number, courts: number) {
  for (const round of rounds) {
    expect(round.matches).toHaveLength(courts);
    const onCourt = new Set<number>();
    for (const match of round.matches) {
      const players = [...match.teamA, ...match.teamB];
      expect(new Set(players).size).toBe(4);
      players.forEach((p) => {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThan(n);
        expect(onCourt.has(p)).toBe(false);
        onCourt.add(p);
      });
    }
    expect(round.resting).toHaveLength(n - courts * 4);
    for (const p of round.resting) expect(onCourt.has(p)).toBe(false);
  }
}

describe('fullRotationRounds / maxCourts', () => {
  it('calcula las rondas de rotación completa', () => {
    expect(fullRotationRounds(7, 1)).toBe(11);
    expect(fullRotationRounds(5, 1)).toBe(5);
    expect(fullRotationRounds(8, 2)).toBe(7);
    expect(fullRotationRounds(9, 2)).toBe(9);
    expect(fullRotationRounds(4, 1)).toBe(3);
  });
  it('limita las canchas a grupos de 4', () => {
    expect(maxCourts(4)).toBe(1);
    expect(maxCourts(7)).toBe(1);
    expect(maxCourts(8)).toBe(2);
    expect(maxCourts(12)).toBe(3);
  });
});

describe('generateAmericano: rotación completa exacta (1 cancha)', () => {
  it('n=7: 11 rondas, las 21 parejas cubiertas con 1 sola repetición y juego parejo', () => {
    const rounds = generateAmericano(7, 1, 11);
    expect(rounds).toHaveLength(11);
    expectValidSchedule(rounds, 7, 1);
    const { covered, repeats } = partnershipStats(rounds);
    expect(covered).toBe(21);
    expect(repeats).toBe(1);
    const played = playedCounts(rounds, 7);
    expect(Math.max(...played) - Math.min(...played)).toBeLessThanOrEqual(1);
    const rests = restCounts(rounds, 7);
    expect(Math.max(...rests) - Math.min(...rests)).toBeLessThanOrEqual(1);
  });

  it('n=7: NADIE descansa dos rondas seguidas en toda la secuencia', () => {
    const rounds = generateAmericano(7, 1, 11);
    expect(maxConsecutiveRests(rounds, 7)).toBe(1);
    // Verificación explícita ronda a ronda, no sólo el máximo:
    for (let p = 0; p < 7; p++) {
      for (let i = 0; i + 1 < rounds.length; i++) {
        expect(rounds[i].resting.includes(p) && rounds[i + 1].resting.includes(p)).toBe(false);
      }
    }
  });

  it('n=5: todos con todos exactamente una vez', () => {
    const rounds = generateAmericano(5, 1, 5);
    expectValidSchedule(rounds, 5, 1);
    const { covered, repeats } = partnershipStats(rounds);
    expect(covered).toBe(10);
    expect(repeats).toBe(0);
  });

  it('n=4: 3 rondas, cada pareja exactamente una vez', () => {
    const rounds = generateAmericano(4, 1, 3);
    expectValidSchedule(rounds, 4, 1);
    expect(partnershipStats(rounds)).toEqual({ covered: 6, repeats: 0 });
  });

  it('n=9 con 1 cancha: rotación completa en 18 rondas sin repeticiones; descansos seguidos acotados', () => {
    const rounds = generateAmericano(9, 1, 18);
    expectValidSchedule(rounds, 9, 1);
    expect(partnershipStats(rounds)).toEqual({ covered: 36, repeats: 0 });
    // Con 5 descansos por ronda entre 9 jugadores, dos rondas seguidas SIEMPRE
    // comparten al menos un descansado (5+5>9): imposible evitarlos del todo.
    // El generador los acota a rachas cortas.
    expect(maxConsecutiveRests(rounds, 9)).toBeLessThanOrEqual(3);
  });

  it('n=5: cada quien descansa una vez, nunca seguidas', () => {
    const rounds = generateAmericano(5, 1, 5);
    expect(maxConsecutiveRests(rounds, 5)).toBeLessThanOrEqual(1);
  });
});

describe('generateAmericano: voraz (varias canchas / rondas a elegir)', () => {
  it('n=8 en 2 canchas, 7 rondas: todos con todos exactamente una vez, sin descansos', () => {
    const rounds = generateAmericano(8, 2, 7);
    expect(rounds).toHaveLength(7);
    expectValidSchedule(rounds, 8, 2);
    expect(partnershipStats(rounds)).toEqual({ covered: 28, repeats: 0 });
  });

  it('n=9 en 2 canchas, 9 rondas: todos con todos exactamente una vez, 1 descanso por ronda', () => {
    const rounds = generateAmericano(9, 2, 9);
    expectValidSchedule(rounds, 9, 2);
    expect(partnershipStats(rounds)).toEqual({ covered: 36, repeats: 0 });
    expect(restCounts(rounds, 9)).toEqual(Array(9).fill(1));
  });

  it('n=6 en 1 cancha, 8 rondas: descansos parejos aunque no alcance a cubrir todo', () => {
    const rounds = generateAmericano(6, 1, 8);
    expectValidSchedule(rounds, 6, 1);
    const rests = restCounts(rounds, 6);
    expect(Math.max(...rests) - Math.min(...rests)).toBeLessThanOrEqual(1);
    expect(maxConsecutiveRests(rounds, 6)).toBeLessThanOrEqual(2);
  });

  it('n=7 en 1 cancha, 6 rondas (sesión corta): nadie descansa dos seguidas', () => {
    const rounds = generateAmericano(7, 1, 6);
    expectValidSchedule(rounds, 7, 1);
    expect(maxConsecutiveRests(rounds, 7)).toBeLessThanOrEqual(1);
  });

  it('n=12 en 3 canchas: todos juegan todas las rondas', () => {
    const rounds = generateAmericano(12, 3, 11);
    expectValidSchedule(rounds, 12, 3);
    expect(restCounts(rounds, 12)).toEqual(Array(12).fill(0));
  });

  it('es determinista con la misma semilla', () => {
    expect(generateAmericano(7, 1, 6, 3)).toEqual(generateAmericano(7, 1, 6, 3));
  });

  it('rechaza entradas inválidas', () => {
    expect(generateAmericano(3, 1, 5)).toEqual([]);
    expect(generateAmericano(7, 1, 0)).toEqual([]);
  });

  it('la sesión corta voraz de 7 mantiene la cobertura posible sin repetir compañeros', () => {
    const rounds = generateAmericano(7, 1, 6);
    expect(partnershipStats(rounds).repeats).toBe(0);
  });
});

describe('americanoStandings', () => {
  const rounds = generateAmericano(7, 1, 11);

  it('suma a cada jugador los puntos de su equipo', () => {
    const scores = { '0-0': { a: 21, b: 14 } };
    const table = americanoStandings(7, rounds, scores, 'total');
    const m = rounds[0].matches[0];
    const first = table[0];
    expect([m.teamA[0], m.teamA[1]]).toContain(first.player);
    expect(first.points).toBe(21);
    expect(first.wins).toBe(1);
    expect(first.diff).toBe(7);
    const loser = table.find((r) => r.player === m.teamB[0]);
    expect(loser?.points).toBe(14);
    expect(loser?.diff).toBe(-7);
    expect(loser?.wins).toBe(0);
  });

  it('ordena por promedio cuando se pide: nivela a quien jugó menos', () => {
    // Ronda 0: equipo A gana 21-0. Ronda 1: equipo B gana 21-0.
    // Quien jugó 2 partidos con 21 pts (10.5 prom) no debe superar a quien
    // jugó 1 con 21 (21 prom) al ordenar por promedio.
    const scores = { '0-0': { a: 21, b: 0 }, '1-0': { a: 21, b: 0 } };
    const byAvg = americanoStandings(7, rounds, scores, 'average');
    const top = byAvg[0];
    expect(top.average).toBe(21);
    expect(top.played).toBeGreaterThan(0);
    for (let i = 1; i < byAvg.length; i++) {
      const prev = byAvg[i - 1].average ?? -1;
      const cur = byAvg[i].average ?? -1;
      expect(prev).toBeGreaterThanOrEqual(cur);
    }
  });

  it('por total desempata con diferencia, victorias y orden de inscripción', () => {
    const scores = { '0-0': { a: 16, b: 16 } };
    const table = americanoStandings(7, rounds, scores, 'total');
    const m = rounds[0].matches[0];
    // empate: los 4 con 16 puntos van primero, sin victorias para nadie
    expect(table.slice(0, 4).map((r) => r.player).sort()).toEqual(
      [m.teamA[0], m.teamA[1], m.teamB[0], m.teamB[1]].sort(),
    );
    expect(table[0].wins).toBe(0);
  });
});

describe('americanoStandings con empate final válido', () => {
  it('un partido empatado suma puntos y PJ a los cuatro, sin victoria para nadie', () => {
    const rounds: AmericanoRound[] = [
      { matches: [{ court: 1, teamA: [0, 1], teamB: [2, 3] }], resting: [] },
    ];
    const table = americanoStandings(4, rounds, { '0-0': { a: 2, b: 2 } }, 'total');
    for (const row of table) {
      expect(row.points).toBe(2);
      expect(row.played).toBe(1);
      expect(row.wins).toBe(0);
      expect(row.diff).toBe(0);
    }
  });
});

describe('validateAmericanoScore (regla ajustada por Julian 18-nov: captura libre, empate válido)', () => {
  it('acepta cualquier marcador de enteros no negativos, sin obligar a llegar a N', () => {
    expect(validateAmericanoScore(4, 2)).toEqual({ ok: true, score: { a: 4, b: 2 } });
    expect(validateAmericanoScore(3, 2)).toEqual({ ok: true, score: { a: 3, b: 2 } });
    expect(validateAmericanoScore(13, 8)).toEqual({ ok: true, score: { a: 13, b: 8 } });
    expect(validateAmericanoScore(21, 20)).toEqual({ ok: true, score: { a: 21, b: 20 } });
  });
  it('acepta empates como resultado final (2-2 también puede ser final)', () => {
    expect(validateAmericanoScore(2, 2)).toEqual({ ok: true, score: { a: 2, b: 2 } });
    expect(validateAmericanoScore(4, 4)).toEqual({ ok: true, score: { a: 4, b: 4 } });
  });
  it('rechaza valores no numéricos o fuera de rango', () => {
    expect(validateAmericanoScore(-1, 2).ok).toBe(false);
    expect(validateAmericanoScore(1.5, 1).ok).toBe(false);
    expect(validateAmericanoScore(100, 0).ok).toBe(false);
  });
});

describe('proposePlayoffPairs (PROPUESTA reversible de la demo, no regla confirmada)', () => {
  it('con menos de 4 en la tabla no propone eliminatoria', () => {
    expect(proposePlayoffPairs([])).toBeNull();
    expect(proposePlayoffPairs([2, 0, 1])).toBeNull();
  });
  it('con 4 a 7 clasifica a los 4 primeros a final directa balanceada (1º+4º vs 2º+3º)', () => {
    const plan = proposePlayoffPairs([3, 1, 4, 2, 0])!;
    expect(plan.mode).toBe('final');
    expect(plan.qualifiers).toEqual([3, 1, 4, 2]);
    expect(plan.finalPairs).toEqual([
      [3, 2],
      [1, 4],
    ]);
    const plan7 = proposePlayoffPairs([6, 5, 4, 3, 2, 1, 0])!;
    expect(plan7.mode).toBe('final');
    expect(plan7.finalPairs).toEqual([
      [6, 3],
      [5, 4],
    ]);
  });
  it('final directa con la convención impares vs pares de Julian (1º+3º vs 2º+4º)', () => {
    const plan = proposePlayoffPairs([3, 1, 4, 2, 0], 'odds-evens')!;
    expect(plan.mode).toBe('final');
    expect(plan.qualifiers).toEqual([3, 1, 4, 2]);
    expect(plan.finalPairs).toEqual([
      [3, 4],
      [1, 2],
    ]);
  });
  it('la convención impares/pares no cambia las semifinales con 8+ (elección pendiente ahí)', () => {
    const a = proposePlayoffPairs([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 'odds-evens')!;
    const b = proposePlayoffPairs([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])!;
    expect(a.semifinals).toEqual(b.semifinals);
  });
  it('con 8 o más arma semifinales cruzadas balanceadas con los 8 primeros', () => {
    const plan = proposePlayoffPairs([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])!;
    expect(plan.mode).toBe('semifinals');
    expect(plan.qualifiers).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(plan.semifinals).toEqual([
      { label: 'Semifinal 1', teamA: [0, 7], teamB: [3, 4] },
      { label: 'Semifinal 2', teamA: [1, 6], teamB: [2, 5] },
    ]);
    expect(plan.finalPairs).toBeNull();
  });

  it('corte determinista con empate total: manda el orden de inscripción', () => {
    // Sin partidos todos empatan a 0: la tabla queda en orden de inscripción
    // y los clasificados de la eliminatoria son siempre los mismos.
    const table = americanoStandings(5, [], {}, 'total');
    expect(table.map((r) => r.player)).toEqual([0, 1, 2, 3, 4]);
    const plan = proposePlayoffPairs(table.map((r) => r.player))!;
    expect(plan.finalPairs).toEqual([
      [0, 3],
      [1, 2],
    ]);
  });
});

describe('playoffFinalPairs (cada pareja ganadora de semi avanza junta)', () => {
  const plan = proposePlayoffPairs([0, 1, 2, 3, 4, 5, 6, 7])!;
  it('arma la final con las parejas ganadoras de cada semi', () => {
    expect(
      playoffFinalPairs(plan, [
        { a: 4, b: 1 },
        { a: 2, b: 4 },
      ]),
    ).toEqual([
      [0, 7],
      [2, 5],
    ]);
  });
  it('sin los dos marcadores no hay final todavía', () => {
    expect(playoffFinalPairs(plan, [null, null])).toBeNull();
    expect(playoffFinalPairs(plan, [{ a: 4, b: 1 }, null])).toBeNull();
  });
  it('una semifinal empatada NO inventa ganador: la final queda pendiente', () => {
    expect(
      playoffFinalPairs(plan, [
        { a: 2, b: 2 },
        { a: 4, b: 1 },
      ]),
    ).toBeNull();
  });
  it('en final directa devuelve las parejas del plan sin mirar marcadores', () => {
    const direct = proposePlayoffPairs([1, 0, 2, 3])!;
    expect(playoffFinalPairs(direct, [null, null])).toEqual([
      [1, 3],
      [0, 2],
    ]);
  });
});


describe('persistencia local de la demo (refresco accidental)', () => {
  const snapshot: AmericanoDemoSnapshot = {
    version: 1,
    savedAt: '2026-11-18T00:00:00.000Z',
    inscritos: ['Ana', 'Beto', 'Carla', 'Diego'],
    courts: 1,
    pointsPerMatch: 4,
    roundMode: 'full',
    seed: 3,
    names: ['Ana', 'Beto', 'Carla', 'Diego'],
    rounds: generateAmericano(4, 1, 3, 3),
    drafts: { '0-0': { a: '4', b: '2', done: true }, '0-1': { a: '2', b: '2' } },
    sortMode: 'average',
    currentRound: 1,
    configOpen: false,
    view: 'playoff',
    playoffDrafts: { 'po-final': { a: '4', b: '1', done: true } },
    playoffKeys: { 'po-final': 'po-final-0-3-1-2' },
  };

  it('ida y vuelta: serializar y parsear conserva el estado completo', () => {
    const parsed = parseAmericanoDemo(serializeAmericanoDemo(snapshot));
    expect(parsed).toEqual(snapshot);
  });

  it('la convención de parejas de la eliminatoria viaja en el guardado', () => {
    const conImpares = { ...snapshot, poPairing: 'odds-evens' as const };
    expect(parseAmericanoDemo(serializeAmericanoDemo(conImpares))).toEqual(conImpares);
    // Guardados anteriores sin el campo siguen siendo válidos (la balanceada es el default).
    expect(parseAmericanoDemo(serializeAmericanoDemo(snapshot))).toEqual(snapshot);
    // Un valor desconocido se descarta con el resto de la forma inválida.
    expect(parseAmericanoDemo(JSON.stringify({ ...snapshot, poPairing: 'x' }))).toBeNull();
  });

  it('JSON corrupto devuelve null en vez de tronar', () => {
    expect(parseAmericanoDemo('{no es json')).toBeNull();
    expect(parseAmericanoDemo('')).toBeNull();
  });

  it('una version distinta se descarta (no se restaura a medias)', () => {
    expect(parseAmericanoDemo(JSON.stringify({ ...snapshot, version: 2 }))).toBeNull();
  });

  it('datos con forma incompleta o invalida se descartan', () => {
    expect(parseAmericanoDemo(JSON.stringify({ ...snapshot, rounds: 'x' }))).toBeNull();
    expect(parseAmericanoDemo(JSON.stringify({ ...snapshot, inscritos: ['Ana', 5] }))).toBeNull();
    expect(
      parseAmericanoDemo(JSON.stringify({ ...snapshot, drafts: { k: { a: 1, b: '2' } } })),
    ).toBeNull();
    expect(
      parseAmericanoDemo(JSON.stringify({ ...snapshot, sortMode: 'puntos' })),
    ).toBeNull();
    expect(parseAmericanoDemo(JSON.stringify({ nombre: 'algo' }))).toBeNull();
  });
});

describe('rotación completa: cobertura y descansos en TODAS las configuraciones (4-12 × canchas, varias semillas)', () => {
  // Piso de descansos seguidos por configuración, demostrado o alcanzado:
  // - sin descansos (n % 4 === 0, canchas = n/4): 0
  // - 8j/1c: 2 es el ÓPTIMO con cobertura completa (densidad exacta 7 = 14/2:
  //   racha ≤1 obligaría a dos grupos fijos que solo se emparejan internamente,
  //   máx. 12 < 28 parejas)
  // - 12j/1c: 3 es el ÓPTIMO con cobertura completa (densidad exacta 22 = 66/3:
  //   racha ≤2 obligaría a tres grupos fijos, máx. 18 < 66 parejas)
  // - 11j/1c: 3 alcanzado; 2 intentado con búsqueda exhaustiva acotada
  //   (DFS 1M+ nodos, recocido y matrices de descanso) sin éxito — la densidad
  //   apenas deja holgura (quien descansa 18 veces debe estrenar compañero en
  //   cada una de sus 10 rondas jugadas); no demostrado imposible
  const restBound: Record<string, number> = {
    '4-1': 0, '5-1': 1, '6-1': 1, '7-1': 1, '8-1': 2, '8-2': 0,
    '9-1': 2, '9-2': 1, '10-1': 2, '10-2': 1, '11-1': 3, '11-2': 1,
    '12-1': 3, '12-2': 1, '12-3': 0,
  };
  for (let n = 4; n <= 12; n++) {
    for (let c = 1; c <= maxCourts(n); c++) {
      it(`n=${n}, canchas=${c}: todos con todos, descansos parejos y racha <= ${restBound[`${n}-${c}`]}`, () => {
        const total = (n * (n - 1)) / 2;
        for (const seed of [1, 7, 42]) {
          const rounds = generateAmericano(n, c, fullRotationRounds(n, c), seed);
          expect(rounds).toHaveLength(fullRotationRounds(n, c));
          expectValidSchedule(rounds, n, c);
          expect(partnershipStats(rounds).covered).toBe(total); // cobertura real 100%
          const rests = restCounts(rounds, n);
          expect(Math.max(...rests) - Math.min(...rests)).toBeLessThanOrEqual(1);
          expect(maxConsecutiveRests(rounds, n)).toBeLessThanOrEqual(restBound[`${n}-${c}`]);
        }
      });
    }
  }
});

describe('rotación completa 16 jugadores / 4 canchas (tope del selector, pedido de Julian 19-nov)', () => {
  // Única configuración de 4 canchas posible (MAX_PLAYERS=16 → maxCourts=4):
  // sin descansos (b=0), 15 rondas, cobertura completa demostrada por semilla.
  it('n=16, canchas=4: todos con todos en 15 rondas, sin descansos', () => {
    for (const seed of [1, 7, 42]) {
      const rounds = generateAmericano(16, 4, fullRotationRounds(16, 4), seed);
      expect(rounds).toHaveLength(15);
      expectValidSchedule(rounds, 16, 4);
      expect(partnershipCoverage(rounds, 16).covered).toBe(120);
      for (const round of rounds) expect(round.resting).toHaveLength(0);
    }
  });
  it('maxCourts: 16 jugadores permiten 4 canchas', () => {
    expect(maxCourts(16)).toBe(4);
    expect(maxCourts(15)).toBe(3);
  });
});

describe('rotación completa 16 jugadores / 1-3 canchas (tandas del círculo; el DFS no escala a este tamaño)', () => {
  it.each([1, 2, 3])('n=16, canchas=%i: cobertura completa y estructura válida', (c) => {
    const rounds = generateAmericano(16, c, fullRotationRounds(16, c), 1);
    expect(rounds).toHaveLength(fullRotationRounds(16, c));
    expectValidSchedule(rounds, 16, c);
    expect(partnershipCoverage(rounds, 16).covered).toBe(120);
  });
  it('descansos seguidos dentro de la barra vigente (piso+1, como 12j/1c)', () => {
    // Pisos teóricos: 1 cancha 3, 2 canchas 1, 3 canchas 0; la barra que ya se
    // entrega en producción es piso+1 (12j/1c entrega 3 con piso 2).
    expect(maxConsecutiveRests(generateAmericano(16, 1, fullRotationRounds(16, 1), 1), 16)).toBeLessThanOrEqual(4);
    expect(maxConsecutiveRests(generateAmericano(16, 2, fullRotationRounds(16, 2), 1), 16)).toBeLessThanOrEqual(2);
    expect(maxConsecutiveRests(generateAmericano(16, 3, fullRotationRounds(16, 3), 1), 16)).toBeLessThanOrEqual(1);
  });
  it('determinista: mismos argumentos, mismas rondas', () => {
    for (const c of [1, 2, 3]) {
      expect(generateAmericano(16, c, fullRotationRounds(16, c), 1)).toEqual(
        generateAmericano(16, c, fullRotationRounds(16, c), 1),
      );
    }
  });
});

describe('garantía de cobertura y ruta de presupuesto agotado', () => {
  it('partnershipCoverage reporta 100% en todas las configuraciones soportadas', () => {
    for (let n = 4; n <= 12; n++) {
      for (let c = 1; c <= maxCourts(n); c++) {
        const rounds = generateAmericano(n, c, fullRotationRounds(n, c), 1);
        const cov = partnershipCoverage(rounds, n);
        expect(cov.covered).toBe(cov.total);
      }
    }
  });
  it('el DFS con presupuesto 0 devuelve null (nunca una rotación incompleta silenciosa)', () => {
    expect(constrainedFullRotation(7, 1, 1, 0)).toBeNull();
    expect(constrainedFullRotation(11, 2, 1, 0)).toBeNull();
  });
  it('una rotación incompleta se DETECTA como tal (la UI puede avisar en vez de prometer)', () => {
    // rotación parcial: una ronda menos de la completa
    const rounds = generateAmericano(7, 1, fullRotationRounds(7, 1) - 1, 1);
    const cov = partnershipCoverage(rounds, 7);
    expect(cov.covered).toBeLessThan(cov.total);
  });
  it('las invariantes se mantienen bajo re-etiquetado de jugadores (permutaciones de ids)', () => {
    for (const n of [7, 9, 12]) {
      const rounds = generateAmericano(n, 1, fullRotationRounds(n, 1), 1);
      for (const shift of [1, 3]) {
        const perm = (p: number) => (p + shift) % n;
        const relabeled: AmericanoRound[] = rounds.map((r) => ({
          matches: r.matches.map((m) => ({
            court: m.court,
            teamA: [perm(m.teamA[0]), perm(m.teamA[1])] as [number, number],
            teamB: [perm(m.teamB[0]), perm(m.teamB[1])] as [number, number],
          })),
          resting: r.resting.map(perm),
        }));
        expectValidSchedule(relabeled, n, 1);
        expect(partnershipCoverage(relabeled, n).covered).toBe((n * (n - 1)) / 2);
        expect(maxConsecutiveRests(relabeled, n)).toBe(maxConsecutiveRests(rounds, n));
      }
    }
  });
});

describe('partida guardada por la versión publicada (regresión)', () => {
  const saved = parseAmericanoDemo(PUBLISHED_DEMO_SNAPSHOT_TEXT);

  it('sigue cargando con nombres, rondas y marcadores intactos', () => {
    expect(saved).not.toBeNull();
    if (!saved) return;
    expect(saved.names).toEqual(['Ana', 'Beto', 'Carla', 'Diego', 'Elena', 'Fede', 'Gaby']);
    expect(saved.rounds).toHaveLength(11);
    expect(Object.keys(saved.drafts)).toHaveLength(4);
    expect(Object.values(saved.drafts).every((d) => d.done === true)).toBe(true);
  });

  it('recarga mantiene todo tras un ciclo de guardado', () => {
    if (!saved) throw new Error('fixture inválido');
    expect(parseAmericanoDemo(serializeAmericanoDemo(saved))).toEqual(saved);
  });

  it('un guardado de Americano con 16 jugadores y 4 canchas sigue siendo válido', () => {
    if (!saved) throw new Error('fixture inválido');
    // Antes del selector de 4 canchas el validador capaba names en 12 y un
    // respaldo de 16 jugadores se descartaba entero al recargar.
    const mas = ['Hugo', 'Iris', 'Juan', 'Karla', 'Luis', 'Mona', 'Nico', 'Olga', 'Paco'];
    const diezSeis = {
      ...saved,
      inscritos: [...saved.inscritos, ...mas],
      names: [...saved.names, ...mas],
      courts: 4,
      rounds: generateAmericano(16, 4, fullRotationRounds(16, 4), 1),
      drafts: {},
      currentRound: 0,
    };
    expect(parseAmericanoDemo(serializeAmericanoDemo(diezSeis))).not.toBeNull();
  });

  it('editar sin aplicar no cambia la partida: la configuración aplicada sale de las rondas', () => {
    if (!saved) throw new Error('fixture inválido');
    // Respaldo a mitad de una edición: lista con un jugador más, 2 canchas y modo corto sin aplicar.
    const enEdicion = {
      ...saved,
      configOpen: true,
      inscritos: [...saved.inscritos, 'Irene'],
      courts: 2,
      roundMode: 'short' as const,
    };
    const recargado = parseAmericanoDemo(serializeAmericanoDemo(enEdicion));
    expect(recargado).not.toBeNull();
    if (!recargado) return;
    expect(recargado.names).toEqual(saved.names);
    expect(recargado.rounds).toEqual(saved.rounds);
    expect(recargado.drafts).toEqual(saved.drafts);
    expect(
      deriveAppliedConfig(recargado.rounds, recargado.names.length, { courts: 2, mode: 'short' }),
    ).toEqual({ courts: 1, mode: 'full' });
  });
});

describe("Mexicano", () => {
  const sc = (pairs: Array<[string, number, number]>) => {
    const m: Record<string, { a: number; b: number }> = {};
    for (const [k, a, b] of pairs) m[k] = { a, b };
    return m;
  };

  it("ronda 1: sorteo con semilla, todos distintos, descansan los sobrantes", () => {
    const r = nextMexicanoRound(7, 1, [], {}, 5);
    expect(r).toEqual(nextMexicanoRound(7, 1, [], {}, 5));
    const used = [...r.matches[0].teamA, ...r.matches[0].teamB, ...r.resting];
    expect(new Set(used).size).toBe(7);
    expect(r.resting).toHaveLength(3);
  });

  it("ronda 2 sale de la tabla: 1º+4º contra 2º+3º, cuarteto de arriba en cancha 1", () => {
    const r1 = nextMexicanoRound(8, 2, [], {}, 3);
    // cancha 1 gana 6-2, cancha 2 gana 5-3
    const scores = sc([
      ["0-0", 6, 2],
      ["0-1", 5, 3],
    ]);
    const r2 = nextMexicanoRound(8, 2, [r1], scores, 3);
    const rank = americanoStandings(8, [r1], scores, "total").map((x) => x.player);
    expect(r2.matches[0].teamA).toEqual([rank[0], rank[3]]);
    expect(r2.matches[0].teamB).toEqual([rank[1], rank[2]]);
    expect(r2.matches[1].teamA).toEqual([rank[4], rank[7]]);
    expect(r2.matches[1].teamB).toEqual([rank[5], rank[6]]);
    expect(r2.matches.map((m) => m.court)).toEqual([1, 2]);
  });

  it("empate total en la tabla: resultado determinista", () => {
    const r1 = nextMexicanoRound(4, 1, [], {}, 9);
    const scores = sc([["0-0", 4, 4]]);
    const a = nextMexicanoRound(4, 1, [r1], scores, 9);
    const b = nextMexicanoRound(4, 1, [r1], scores, 9);
    expect(a).toEqual(b);
    expect(new Set([...a.matches[0].teamA, ...a.matches[0].teamB]).size).toBe(4);
  });

  it("descansos parejos: con 7 jugadores y 1 cancha nadie descansa 2 veces más que otro", () => {
    const rounds = [nextMexicanoRound(7, 1, [], {}, 2)];
    const scores: Record<string, { a: number; b: number }> = {};
    for (let i = 0; i < mexicanoTotalRounds(7) - 1; i++) {
      scores[`${i}-0`] = { a: 3 + (i % 3), b: 2 };
      rounds.push(nextMexicanoRound(7, 1, rounds, scores, 2));
    }
    expect(rounds).toHaveLength(6);
    const rests = new Array(7).fill(0);
    for (const r of rounds) for (const p of r.resting) rests[p]++;
    expect(Math.max(...rests) - Math.min(...rests)).toBeLessThanOrEqual(1);
  });

  it("corregir un marcador viejo NO cambia rondas ya armadas ni muta la entrada", () => {
    const r1 = nextMexicanoRound(8, 2, [], {}, 4);
    const s1 = sc([
      ["0-0", 6, 2],
      ["0-1", 5, 3],
    ]);
    const r2 = nextMexicanoRound(8, 2, [r1], s1, 4);
    const rounds = [r1, r2];
    const frozen = JSON.stringify(rounds);
    const corregido = { ...s1, "0-0": { a: 1, b: 7 } };
    const r2b = nextMexicanoRound(8, 2, [r1], corregido, 4);
    expect(JSON.stringify(rounds)).toBe(frozen); // lo ya armado queda igual
    expect(JSON.stringify(r2b)).not.toBe(JSON.stringify(r2)); // solo una ronda NUEVA usaría la tabla corregida
  });

  it("la ronda siguiente solo está lista con todos los partidos cerrados", () => {
    const r1 = nextMexicanoRound(8, 2, [], {}, 1);
    expect(mexicanoRoundReady([r1], {})).toBe(false);
    expect(mexicanoRoundReady([r1], sc([["0-0", 3, 4]]))).toBe(false);
    expect(
      mexicanoRoundReady(
        [r1],
        sc([
          ["0-0", 3, 4],
          ["0-1", 4, 4],
        ]),
      ),
    ).toBe(true);
  });

  it("deriveAppliedConfig: Mexicano no deduce la duración del conteo de rondas", () => {
    const r1 = nextMexicanoRound(7, 1, [], {}, 1);
    expect(deriveAppliedConfig([r1], 7, { courts: 1, mode: "full" }, "mexicano")).toEqual({
      courts: 1,
      mode: "full",
    });
  });

  it("guardado sin modalidad (versión publicada) sigue siendo válido", () => {
    expect(parseAmericanoDemo(PUBLISHED_DEMO_SNAPSHOT_TEXT)).not.toBeNull();
  });
});

describe("Team (parejas fijas)", () => {
  const sc = (pairs: Array<[string, number, number]>) => {
    const m: Record<string, { a: number; b: number }> = {};
    for (const [k, a, b] of pairs) m[k] = { a, b };
    return m;
  };
  const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

  it("pairsFromRoster: parejas por orden de la lista", () => {
    expect(pairsFromRoster(8)).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
      [6, 7],
    ]);
  });

  it("Team Americano: cada pareja juega contra todas una vez (8 jugadores, 2 canchas)", () => {
    const rounds = generateTeamAmericano(8, 2);
    expect(rounds).toHaveLength(3);
    const vs = new Set<string>();
    for (const r of rounds)
      for (const m of r.matches) vs.add(pairKey(m.teamA[0] / 2 | 0, m.teamB[0] / 2 | 0));
    expect(vs.size).toBe(6); // C(4,2)
    for (const r of rounds) {
      expect(r.resting).toHaveLength(0);
      expect(r.matches.map((m) => m.court)).toEqual([1, 2]);
    }
  });

  it("Team Americano: 3 parejas con 1 cancha, 3 rondas y cobertura completa", () => {
    const rounds = generateTeamAmericano(6, 1);
    expect(rounds).toHaveLength(3);
    const vs = new Set<string>();
    for (const r of rounds) for (const m of r.matches) vs.add(pairKey(m.teamA[0], m.teamB[0]));
    expect(vs.size).toBe(3);
    // cada ronda descansan los 2 de la pareja que no juega
    for (const r of rounds) expect(r.resting).toHaveLength(2);
  });

  it("Team Mexicano: ronda 1 sorteada; con más parejas que canchas juegan las que menos han jugado", () => {
    const r1 = nextTeamMexicanoRound(8, 1, [], {}, 7);
    expect(r1).toEqual(nextTeamMexicanoRound(8, 1, [], {}, 7));
    expect(r1.matches).toHaveLength(1);
    expect(r1.resting).toHaveLength(4);
    const scores = sc([["0-0", 5, 2]]);
    const r2 = nextTeamMexicanoRound(8, 1, [r1], scores, 7);
    // los que descansaron en la 1ª juegan la 2ª
    expect(r2.resting.sort()).toEqual(
      [r1.matches[0].teamA[0], r1.matches[0].teamA[1], r1.matches[0].teamB[0], r1.matches[0].teamB[1]].sort(),
    );
  });

  it("Team Mexicano: ronda 2 empareja parejas por tabla (1ª vs 2ª), sin tocar rondas armadas", () => {
    const r1 = nextTeamMexicanoRound(8, 2, [], {}, 3);
    const scores = sc([
      ["0-0", 6, 2],
      ["0-1", 5, 3],
    ]);
    const r2 = nextTeamMexicanoRound(8, 2, [r1], scores, 3);
    const st = americanoStandings(8, [r1], scores, "total");
    const rankPairs = st.map((r) => (r.player / 2) | 0).filter((v, i, a) => a.indexOf(v) === i);
    const top = rankPairs[0];
    const second = rankPairs[1];
    const m = r2.matches[0];
    expect(new Set([(m.teamA[0] / 2) | 0, (m.teamB[0] / 2) | 0])).toEqual(new Set([top, second]));
    // corregir marcador no cambia la ronda ya armada
    const frozen = JSON.stringify(r2);
    nextTeamMexicanoRound(8, 2, [r1], { ...scores, "0-0": { a: 1, b: 7 } }, 3);
    expect(JSON.stringify(r2)).toBe(frozen);
  });

  it("teamMexicanoTotalRounds: una menos que parejas", () => {
    expect(teamMexicanoTotalRounds(8)).toBe(3);
    expect(teamMexicanoTotalRounds(6)).toBe(2);
  });
});

describe("Mixtos", () => {
  for (const n of [2, 3, 4, 5, 6]) for (const courts of [1, 2, 3]) {
    it(`Mix Americano: ${n}+${n}, ${courts} cancha(s), cobertura completa y partidos válidos`, () => {
      const genders: Genero[] = [...Array<Genero>(n).fill("f"), ...Array<Genero>(n).fill("m")];
      for (const seed of [1, 2, 7]) {
        const rounds = generateMixAmericano(genders, courts, seed);
        const counts = new Map<string, number>();
        expect(rounds.length).toBeGreaterThan(0);
        for (const round of rounds) {
          expect(round.matches.length).toBeLessThanOrEqual(courts);
          const used: number[] = [];
          for (const match of round.matches) {
            for (const pair of [match.teamA, match.teamB]) {
              expect(genders[pair[0]]).not.toBe(genders[pair[1]]);
              const key = [...pair].sort((a,b)=>a-b).join("-");
              counts.set(key, (counts.get(key) ?? 0) + 1);
              used.push(...pair);
            }
          }
          expect(new Set([...used, ...round.resting]).size).toBe(n*2);
          expect(used.length + round.resting.length).toBe(n*2);
        }
        expect(counts.size).toBe(n*n);
        expect([...counts.values()].reduce((a,b)=>a+b,0)).toBe(n*n + n%2);
        expect(Math.max(...counts.values())).toBe(n%2 ? 2 : 1);
      }
    });
  }
  it("Mix Americano rechaza grupos desiguales o de menos de 2", () => {
    expect(generateMixAmericano(["f", "f", "m", "m", "m"], 1, 1)).toEqual([]);
    expect(generateMixAmericano(["f", "m"], 1, 1)).toEqual([]);
  });
  it("Mixicano: parejas mixtas, descanso parejo por género, determinista y sin mutar", () => {
    const genders: Genero[] = ["f","f","f","m","m","m"];
    const rounds = [nextMixicanoRound(genders,1,[],{},3)];
    const scores: Record<string,{a:number;b:number}> = {};
    for(let i=0;i<5;i++) {
      scores[`${i}-0`]={a:5,b:3};
      const before=JSON.stringify(rounds);
      const next=nextMixicanoRound(genders,1,rounds,scores,3);
      expect(JSON.stringify(rounds)).toBe(before);
      expect(next).toEqual(nextMixicanoRound(genders,1,rounds,scores,3));
      for(const mt of next.matches) for(const pair of [mt.teamA,mt.teamB]) expect(genders[pair[0]]).not.toBe(genders[pair[1]]);
      rounds.push(next);
    }
    const rests=Array<number>(6).fill(0);
    for(const r of rounds) for(const p of r.resting) rests[p]++;
    expect(Math.max(...rests)-Math.min(...rests)).toBeLessThanOrEqual(1);
  });
  it("guardados mixtos necesitan géneros válidos; el guardado publicado no los requiere", () => {
    const old=parseAmericanoDemo(PUBLISHED_DEMO_SNAPSHOT_TEXT)!;
    expect(parseAmericanoDemo(serializeAmericanoDemo(old))).not.toBeNull();
    expect(parseAmericanoDemo(serializeAmericanoDemo({...old,modalidad:"mixicano"}))).toBeNull();
    const names=["Ana","Bea","Caro","Dani","Eli","Fede"];
    const generos: Genero[]=["f","f","f","m","m","m"];
    const snap={...old,names,inscritos:names,generos,modalidad:"mixicano" as const,rounds:[nextMixicanoRound(generos,1,[],{},1)],drafts:{}};
    expect(parseAmericanoDemo(serializeAmericanoDemo(snap))).not.toBeNull();
  });
});
