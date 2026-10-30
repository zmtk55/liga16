import type { Tournament, UserRole } from '@/types';

const roles: readonly UserRole[] = ['player', 'captain', 'organizer', 'club', 'admin', 'sponsor'];

/** UI hint only. Never trust editable user_metadata for privileged roles. RLS owns access. */
export function sessionRole(appMetadata?: Record<string, unknown>): UserRole {
  const role = appMetadata?.role;
  return typeof role === 'string' && roles.includes(role as UserRole) ? role as UserRole : 'player';
}

/** Public visibility does not imply management rights. NULL is legacy admin-only. */
export function canManageTournament(
  user: { id: string; role: UserRole } | null,
  tournament: Pick<Tournament, 'organizer_id'>,
): boolean {
  return !!user && (user.role === 'admin' ||
    (user.role === 'organizer' && tournament.organizer_id === user.id));
}
