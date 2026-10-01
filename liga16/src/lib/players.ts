// Registro perezoso de jugadores: busca por nombre y crea el perfil si no existe.
import { db } from "@/lib/data";
import type { PlayerProfile } from "@/types";

/**
 * Normaliza un nombre para deduplicación: minúsculas, sin acentos y con
 * espacios colapsados. "Julián  Piri" y "julian piri" son la misma persona.
 */
export function normalizePlayerName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export async function ensurePlayer(name: string, division?: string): Promise<PlayerProfile | null> {
  const clean = name.trim();
  if (!clean) return null;
  const key = normalizePlayerName(clean);

  // Nivel inferido de la categoría SOLO como bandera "por confirmar": si el
  // jugador ya tiene perfil, su nivel no se toca jamás.
  const levelByDivision: Record<string, number> = {
    "1ra": 6.5, "2da": 5.8, "3ra": 5.2, "4ta": 4.7, "5ta": 4.2, "6ta": 3.7,
  };
  const base = division && levelByDivision[division] ? levelByDivision[division] : 3.0;

  // Un fallo de red NUNCA debe crear un duplicado: si no podemos leer el
  // directorio, no podemos saber si el jugador ya existe.
  let existing: PlayerProfile[] = [];
  try {
    existing = await db.listPlayers();
  } catch {
    throw new Error("No se pudo verificar el directorio de jugadores; reintenta.");
  }

  const found = existing.find((p) => normalizePlayerName(p.display_name) === key);
  if (found) {
    // Adopta el nivel declarado si el existente venía sin nivel y ahora la
    // categoría lo sugiere; nunca baja ni sobreescribe un nivel ya puesto.
    if (found.declared_level == null && division) {
      await db
        .updatePlayer(found.id, { declared_level: base } as never)
        .catch(() => undefined);
      return { ...found, declared_level: base };
    }
    return found;
  }

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
