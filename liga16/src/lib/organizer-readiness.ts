/** Deployment review gate, not a server capability claim or an authorization check. */
export const organizerRelease = { available: true };
export async function requireOrganizerBackend(role: string | undefined, release = organizerRelease) {
  if (role !== 'organizer') return;
  if (!release.available) {
    throw new Error('La administración independiente aún no está habilitada. No se guardó este paso; falta completar la revisión del servidor.');
  }
}
