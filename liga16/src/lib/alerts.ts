// Derivación de alertas de la bandeja de entrada a partir de datos ya existentes.
// No hay tabla `alerts`: las alertas son una proyección 100% derivada de
// players / matches / tournaments, por lo que desaparecen al resolverse (p. ej.
// un jugador pendiente deja de aparecer al verificarse).
import type { ComponentType } from 'react';
import { Calendar, Clock, Radio, ShieldCheck, Trophy } from 'lucide-react';
import type { AlertSeverity, AlertType, AdminAlert, Match, PlayerProfile, Tournament } from '@/types';

export const alertTypeMeta: Record<AlertType, { label: string; icon: ComponentType<{ className?: string }> }> = {
  player_pending: { label: 'Verificación', icon: ShieldCheck },
  tournament_starting: { label: 'Torneo', icon: Trophy },
  match_live: { label: 'En vivo', icon: Radio },
  match_disputed: { label: 'Disputa', icon: Clock },
  registration_closing_soon: { label: 'Inscripciones', icon: Calendar },
};

const DAY_MS = 86_400_000;
const START_SOON_DAYS = 7;
const REG_CLOSE_SOON_DAYS = 3;

export interface AlertCtx {
  tournaments: Tournament[];
  players: PlayerProfile[];
  matches: Match[];
  /** Epoch ms; permite que las pruebas sean deterministas. */
  now?: number;
}

/**
 * Construye la lista de alertas del admin a partir de los datos actuales.
 * Ordena: críticas primero, luego por timestamp descendente (más reciente/evento
 * próximo antes).
 */
export function generateAdminAlerts(ctx: AlertCtx): AdminAlert[] {
  const now = ctx.now ?? Date.now();
  const nowDate = new Date(now);
  // Comparación por día natural en UTC: evita sesgos por zona horaria y por
  // la hora exacta del día (un torneo que arranca "hoy" debe ser crítico, no "mañana").
  const today = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());

  const daysFromToday = (iso: string | null | undefined): number | null => {
    if (!iso) return null;
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00Z`) : new Date(iso);
    return Math.floor((d.getTime() - today) / DAY_MS);
  };

  const sDay = (n: number) => `en ${n} día${n === 1 ? '' : 's'}`;
  const alerts: AdminAlert[] = [];

  // 1. Jugadores pendientes de verificación (agrupado).
  const pending = ctx.players.filter((p) => (p.status ?? 'verificado') === 'pendiente');
  if (pending.length > 0) {
    alerts.push({
      id: 'player_pending',
      type: 'player_pending',
      severity: 'warning',
      title: 'Verificación de jugadores',
      description: `${pending.length} ${pending.length === 1 ? 'jugador' : 'jugadores'} con perfil pendiente`,
      href: '/admin/jugadores',
      timestamp: nowDate.toISOString(),
      count: pending.length,
    });
  }

  for (const t of ctx.tournaments) {
    if (t.status === 'finished' || t.status === 'cancelled') continue;

    // Torneo ya en juego.
    if (t.status === 'in_progress') {
      alerts.push({
        id: `tournament_in_progress:${t.id}`,
        type: 'tournament_starting',
        severity: 'info',
        title: 'Torneo en juego',
        description: `${t.name} está en curso`,
        href: `/admin/torneos/${t.slug}`,
        timestamp: t.start_date,
      });
      continue;
    }

    const startDiff = daysFromToday(t.start_date);
    if (startDiff !== null && startDiff >= 0 && startDiff <= START_SOON_DAYS) {
      const sev: AlertSeverity = startDiff <= 0 ? 'critical' : startDiff <= REG_CLOSE_SOON_DAYS ? 'warning' : 'info';
      alerts.push({
        id: `tournament_starting:${t.id}`,
        type: 'tournament_starting',
        severity: sev,
        title: 'Torneo próximo',
        description: `${t.name} comienza ${startDiff <= 0 ? 'hoy' : sDay(startDiff)}`,
        href: `/admin/torneos/${t.slug}`,
        timestamp: t.start_date,
      });
    }

    // Cierre de inscripciones próximo.
    if (t.status === 'registration_open') {
      const closeDiff = daysFromToday(t.registration_deadline);
      if (closeDiff !== null && closeDiff >= 0 && closeDiff <= REG_CLOSE_SOON_DAYS) {
        alerts.push({
          id: `registration_closing:${t.id}`,
          type: 'registration_closing_soon',
          severity: closeDiff <= 1 ? 'warning' : 'info',
          title: 'Cierre de inscripciones',
          description: `${t.name} cierra inscripciones ${closeDiff <= 1 ? 'hoy' : sDay(closeDiff)}`,
          href: `/admin/torneos/${t.slug}`,
          timestamp: t.registration_deadline,
        });
      }
    }
  }

  for (const m of ctx.matches) {
    if (m.status === 'live') {
      alerts.push({
        id: `match_live:${m.id}`,
        type: 'match_live',
        severity: 'critical',
        title: 'Partido en vivo',
        description: `${m.side_a.pair_name} vs ${m.side_b.pair_name}`,
        href: '/admin/resultados',
        timestamp: m.scheduled_at ?? nowDate.toISOString(),
      });
    }
  }

  for (const m of ctx.matches) {
    if (m.status === 'disputed') {
      alerts.push({
        id: `match_disputed:${m.id}`,
        type: 'match_disputed',
        severity: 'warning',
        title: 'Partido en disputa',
        description: `${m.side_a.pair_name} vs ${m.side_b.pair_name}`,
        href: '/admin/resultados',
        timestamp: m.scheduled_at ?? nowDate.toISOString(),
      });
    }
  }

  const sevRank: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => {
    const s = sevRank[a.severity] - sevRank[b.severity];
    if (s !== 0) return s;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}
