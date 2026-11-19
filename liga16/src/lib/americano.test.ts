import { describe, expect, it } from 'vitest';
import {
  americanoStandings,
  fullRotationRounds,
  generateAmericano,
  maxCourts,
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

  it('n=9 con 1 cancha: rotación completa en 18 rondas sin repeticiones', () => {
    const rounds = generateAmericano(9, 1, 18);
    expectValidSchedule(rounds, 9, 1);
    expect(partnershipStats(rounds)).toEqual({ covered: 36, repeats: 0 });
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
