// DATOS SINTÉTICOS para capturas locales. Solo los usa vite.screenshots.config.ts;
// nunca entran al build de producción.
export type AdminUserHit = { id: string; email: string; role: string | null };
export type OrganizerAccount = { id: string; email: string };

const ORGANIZERS: OrganizerAccount[] = [
  { id: "org-1", email: "memo.ruiz@liga16.test" },
  { id: "org-2", email: "laura.promotora@liga16.test" },
];

const HITS: AdminUserHit[] = [
  { id: "u-1", email: "ana.beltran@liga16.test", role: "player" },
  { id: "u-2", email: "ana.garcia@liga16.test", role: null },
  { id: "u-3", email: "analu.capitan@liga16.test", role: "captain" },
];

export async function findUsersByEmail(email: string): Promise<AdminUserHit[]> {
  const q = email.trim().toLowerCase();
  if (q.length < 3) throw new Error("Escribe al menos 3 caracteres del correo");
  await new Promise((r) => setTimeout(r, 120));
  return HITS.filter((h) => h.email.toLowerCase().startsWith(q) || q.length >= 3);
}

export async function listOrganizers(): Promise<OrganizerAccount[]> {
  await new Promise((r) => setTimeout(r, 120));
  return ORGANIZERS;
}

export async function setOrganizerRole(_userId: string, make: boolean): Promise<string> {
  await new Promise((r) => setTimeout(r, 120));
  return make ? "organizer" : "player";
}

export async function setTournamentOrganizer(_tournamentId: string, _userId: string | null): Promise<void> {
  await new Promise((r) => setTimeout(r, 120));
}
