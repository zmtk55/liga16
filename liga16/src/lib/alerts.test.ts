// Tests para la derivación de alertas de la bandeja de entrada.
import { describe, it, expect } from 'vitest';
import { generateAdminAlerts } from './alerts';
import type { Match, PlayerProfile, Tournament } from '@/types';

function player(over: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    id: 'p-1', display_name: 'Test', username: 'test', photo_url: null, city: 'CDMX',
    state: 'CDMX', country: 'MX', birth_date: null, sex: 'M', declared_level: 3.0,
    official_level: null, dominant_hand: 'right', preferred_position: 'both',
    bio: null, is_public: true, role: 'player',
    ...over,
  } as PlayerProfile;
}
function tournament(over: Partial<Tournament> = {}): Tournament {
  return {
    id: 't-1', slug: 't-1', name: 'Test', cover_url: null, club_id: null, city: 'CDMX',
    state: 'CDMX', start_date: '2026-10-09', end_date: '2026-10-11', registration_deadline: '2026-10-02',
    status: 'registration_open', modality: 'pairs', format: 'single_elimination',
    organizer_id: null, price_cents: 0, currency: 'MXN', rules_summary: null, description: null, scoring: null,
    ...over,
  } as Tournament;
}
function match(over: Partial<Match> = {}): Match {
  return {
    id: 'm-1', tournament_id: 't-1', round: 'R1', court_name: null, scheduled_at: '2026-09-26T18:00:00Z',
    status: 'scheduled', side_a: { pair_id: null, pair_name: 'A' }, side_b: { pair_id: null, pair_name: 'B' },
    sets: [], winner: null,
    ...over,
  } as Match;
}

const NOW = new Date('2026-09-30T12:00:00Z').getTime(); // miércoles

describe('generateAdminAlerts', () => {
  it('devuelve vacío sin datos', () => {
    expect(generateAdminAlerts({ tournaments: [], players: [], matches: [], now: NOW })).toEqual([]);
  });

  it('agrupa jugadores pendientes en una sola alerta', () => {
    const players = [player({ id: 'p-1', status: 'pendiente' }), player({ id: 'p-2', status: 'pendiente' }), player({ id: 'p-3', status: 'verificado' })];
    const alerts = generateAdminAlerts({ tournaments: [], players, matches: [], now: NOW });
    const pending = alerts.find((a) => a.type === 'player_pending');
    expect(pending).toBeDefined();
    expect(pending!.count).toBe(2);
    expect(pending!.severity).toBe('warning');
    expect(pending!.href).toBe('/admin/jugadores');
  });

  it('marca partidos en vivo como críticos', () => {
    const matches = [match({ id: 'm-1', status: 'live' }), match({ id: 'm-2', status: 'scheduled' })];
    const alerts = generateAdminAlerts({ tournaments: [], players: [], matches, now: NOW });
    const live = alerts.filter((a) => a.type === 'match_live');
    expect(live.length).toBe(1);
    expect(live[0].severity).toBe('critical');
  });

  it('escalona la severidad de torneos por proximidad', () => {
    const ts = [
      tournament({ id: 'today', start_date: '2026-09-30', status: 'registration_open' }),          // hoy → crítico
      tournament({ id: 'in3', start_date: '2026-10-02', status: 'registration_open' }),            // 2 días → warning
      tournament({ id: 'in6', start_date: '2026-10-05', status: 'registration_open' }),            // 5 días → info
      tournament({ id: 'far', start_date: '2026-11-13', status: 'registration_open' }),             // fuera → no alerta
    ];
    const alerts = generateAdminAlerts({ tournaments: ts, players: [], matches: [], now: NOW });
    const byId = new Map(alerts.map((a) => [a.id, a]));
    expect(byId.get('tournament_in_progress:today')).toBeUndefined(); // no en juego aún
    const todayAlert = alerts.find((a) => a.id === 'tournament_starting:today');
    const in3 = alerts.find((a) => a.id === 'tournament_starting:in3');
    const in6 = alerts.find((a) => a.id === 'tournament_starting:in6');
    expect(todayAlert?.severity).toBe('critical');
    expect(in3?.severity).toBe('warning');
    expect(in6?.severity).toBe('info');
    expect(alerts.find((a) => a.id === 'tournament_starting:far')).toBeUndefined();
  });

  it('avisa cierre de inscripciones pronto', () => {
    const ts = [tournament({ id: 't-1', registration_deadline: '2026-10-02', status: 'registration_open' })]; // vence en 2 días
    const alerts = generateAdminAlerts({ tournaments: ts, players: [], matches: [], now: NOW });
    const closing = alerts.find((a) => a.type === 'registration_closing_soon');
    expect(closing).toBeDefined();
  });

  it('ordena críticas antes que warnings y info', () => {
    const matches = [match({ id: 'm-live', status: 'live' })];
    const players = [player({ status: 'pendiente' })];
    // start dentro de 7 días (info) y deadline vencido (no dispara registration_closing)
    const ts = [tournament({ id: 't-info', start_date: '2026-10-05', registration_deadline: '2026-09-28', status: 'registration_open' })];
    const alerts = generateAdminAlerts({ tournaments: ts, players, matches, now: NOW });
    const order = alerts.map((a) => a.severity);
    expect(order).toEqual(['critical', 'warning', 'info']);
  });

  it('marca torneo en juego como info (no crítico)', () => {
    const ts = [tournament({ id: 'ig', start_date: '2026-09-26', status: 'in_progress' })];
    const alerts = generateAdminAlerts({ tournaments: ts, players: [], matches: [], now: NOW });
    const inProgress = alerts.find((a) => a.id === 'tournament_in_progress:ig');
    expect(inProgress).toBeDefined();
    expect(inProgress!.severity).toBe('info');
  });
});
