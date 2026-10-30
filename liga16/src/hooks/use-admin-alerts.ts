import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from 'react';
import { db } from '@/lib/data';
import { generateAdminAlerts, type AlertCtx } from '@/lib/alerts';
import type { AdminAlert, Match, PlayerProfile, Tournament } from '@/types';

interface Loadable {
  alerts: AdminAlert[];
  loading: boolean;
  error: string | null;
}

/**
 * Fuente única de alertas para el admin. Se usa tanto en la bandeja de entrada
 * (lista completa) como en el layout (solo el conteo del badge).
 */
export function useAdminAlerts(): Loadable & { refresh: () => void } {
  const { user } = useAuth();
  const [state, setState] = useState<Loadable>({ alerts: [], loading: true, error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    if (user?.role === "organizer") {
      return;
    }

    Promise.all([db.listTournaments(), db.listPlayers(), db.listRecentMatches()])
      .then(([tournaments, players, matches]: [Tournament[], PlayerProfile[], Match[]]) => {
        if (!active) return;
        setState({
          alerts: generateAdminAlerts({ tournaments, players, matches } satisfies AlertCtx),
          loading: false,
          error: null,
        });
      })
      .catch((e: Error) => {
        if (active) setState({ alerts: [], loading: false, error: e.message ?? 'No se pudieron cargar las alertas' });
      });

    return () => {
      active = false;
    };
  }, [version, user?.role]);

  const refresh = () => setVersion((v) => v + 1);

  return user?.role === "organizer" ? {alerts: [], loading: false, error: null, refresh} : { ...state, refresh };
}
