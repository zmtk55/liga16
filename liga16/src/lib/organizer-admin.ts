// Acceso de organizadores: búsqueda de cuentas, alta/baja del rol organizer y
// asignación de torneos. Todas son RPC SECURITY DEFINER admin-only
// (supabase/review/organizer-admin.sql): el servidor valida el rol y el
// cliente nunca toca auth.users directamente.
import { supabase } from '@/lib/supabase';

export type AdminUserHit = { id: string; email: string; role: string | null };
export type OrganizerAccount = { id: string; email: string };

function client() {
  if (!supabase) throw new Error('Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
  return supabase;
}

/** Cuentas cuyo correo coincide (exacto primero, luego prefijo). Mínimo 3 caracteres. */
export async function findUsersByEmail(email: string): Promise<AdminUserHit[]> {
  const q = email.trim();
  if (q.length < 3) throw new Error('Escribe al menos 3 caracteres del correo');
  const { data, error } = await client().rpc('admin_find_users_by_email', { p_email: q });
  if (error) throw error;
  return (data ?? []) as AdminUserHit[];
}

/** Las cuentas que hoy tienen rol organizer. */
export async function listOrganizers(): Promise<OrganizerAccount[]> {
  const { data, error } = await client().rpc('admin_list_organizers');
  if (error) throw error;
  return (data ?? []) as OrganizerAccount[];
}

/** Da o quita el rol organizer. Devuelve el rol resultante. */
export async function setOrganizerRole(userId: string, make: boolean): Promise<string> {
  const { data, error } = await client().rpc('admin_set_organizer_role', { p_user: userId, p_make: make });
  if (error) throw error;
  return data as string;
}

/** Asigna un torneo a un organizador; con userId null lo desasigna. */
export async function setTournamentOrganizer(tournamentId: string, userId: string | null): Promise<void> {
  const { error } = await client().rpc('admin_set_tournament_organizer', { p_tournament: tournamentId, p_user: userId });
  if (error) throw error;
}
