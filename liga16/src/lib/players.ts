// Registro perezoso de jugadores: busca por nombre y crea el perfil si no existe.
import { db } from "@/lib/data";
import type { PlayerProfile } from "@/types";

export async function ensurePlayer(name: string, division?: string): Promise<PlayerProfile | null> {
  const clean = name.trim();
  if (!clean) return null;

  const existing = await db.listPlayers().catch(() => [] as PlayerProfile[]);
  const found = existing.find(
    (p) => p.display_name.trim().toLowerCase() === clean.toLowerCase(),
  );
  if (found) return found;

  // Perfil nuevo: username generado, nivel inferido de la categoría si viene
  const levelByDivision: Record<string, number> = {
    "1ra": 6.5, "2da": 5.8, "3ra": 5.2, "4ta": 4.7, "5ta": 4.2, "6ta": 3.7,
  };
  const base = division && levelByDivision[division] ? levelByDivision[division] : 3.0;

  const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 14) || `jugador${Date.now().toString(36).slice(-4)}`;
  const created = await db.createPlayer({
    display_name: clean,
    username: slug,
    photo_url: null,
    city: null,
    state: null,
    country: "México",
    birth_date: null,
    sex: "X",
    declared_level: base,
    official_level: null,
    dominant_hand: "right",
    preferred_position: "both",
    bio: null,
    is_public: true,
    role: "player",
  } as unknown as Omit<PlayerProfile, "id" | "user_id">);
  return created;
}
