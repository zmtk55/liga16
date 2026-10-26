import type { DataProvider } from "./data/provider";
import type { CategoryValue } from "./categories";
import { divisionFromCategory } from "./categories";
import type { Pair, Sex } from "@/types";

export interface WizardTeam {
  id?: string;
  categoryKey: string;
  name: string;
  player1: string;
  player2: string;
  logo: string | null;
  group: string | null;
  division: string;
  sex: Sex;
}

/** Validate the whole diff before any write. Never erase a scheduled match or its history. */
export async function syncWizard(
  db: DataProvider, tournamentId: string, categories: CategoryValue[], teams: WizardTeam[],
  saveTeams: boolean, price: number,
  player: (name: string, division: string) => Promise<{ id: string } | null>,
  crest: (url: string, name: string) => Promise<string | null>,
) {
  const [savedCats, savedPairs, matches] = await Promise.all([
    db.getTournamentCategories(tournamentId), db.getTournamentPairs(tournamentId), db.listMatchesByTournament(tournamentId),
  ]);
  const associated = (p: Pair) => matches.some((m) => m.side_a.pair_id === p.id || m.side_b.pair_id === p.id);
  const retained = new Set(categories.map((c) => c.persistedId));
  const removedCats = savedCats.filter((c) => !retained.has(c.id));
  for (const c of removedCats) {
    if (savedPairs.some((p) => p.category_id === c.id) || matches.some((m) => m.category_name === c.name)) {
      throw new Error(`No se puede quitar "${c.name}": tiene parejas o partidos. Reasigna las parejas primero.`);
    }
  }
  for (const t of teams) {
    if (!categories.some((c) => c.id === t.categoryKey)) throw new Error(`Elige una categoría para "${t.name}"`);
    const old = savedPairs.find((p) => p.id === t.id);
    const cat = categories.find((c) => c.id === t.categoryKey)!;
    if (saveTeams && old && associated(old)) {
      if (old.category_id !== cat.persistedId) throw new Error(`"${t.name}" tiene partidos: no se puede cambiar su categoría`);
    }
    if (t.id && !old) throw new Error(`La pareja "${t.name}" ya no existe; recarga el asistente`);
  }
  if (saveTeams) {
    for (const p of savedPairs) {
      if (!teams.some((t) => t.id === p.id) && associated(p)) throw new Error(`"${p.name}" tiene partidos: no se puede quitar del torneo`);
    }
  }
  // Resolve players before changing categories, and never swallow directory errors.
  const resolved = saveTeams ? await Promise.all(teams.map(async (t) => {
    const cat = categories.find((c) => c.id === t.categoryKey)!;
    const [a, b] = await Promise.all([player(t.player1, cat.division ?? divisionFromCategory(cat.label)), player(t.player2, cat.division ?? divisionFromCategory(cat.label))]);
    if (!a || !b) throw new Error(`Faltan jugadores en "${t.name}"`);
    if (a.id === b.id) throw new Error(`"${t.name}" repite al mismo jugador`);
    const old = savedPairs.find((p) => p.id === t.id);
    if (old && associated(old) && (old.player1_id !== a.id || old.player2_id !== b.id)) throw new Error(`"${t.name}" tiene partidos: no se pueden cambiar sus integrantes`);
    return { a, b };
  })) : [];
  for (const c of categories) {
    const old = savedCats.find((x) => x.id === c.persistedId);
    if (c.persistedId && !old) throw new Error(`La categoría "${c.label}" ya no existe; recarga`);
    if (old && (old.sex !== c.sex || (c.division && c.division !== old.category)) && savedPairs.some((p) => p.category_id === old.id && associated(p))) {
      throw new Error(`"${old.name}" tiene partidos: no se puede cambiar su rama o división`);
    }
  }
  for (const c of removedCats) await db.deleteTournamentCategory(c.id);
  for (const c of categories) {
    const old = savedCats.find((x) => x.id === c.persistedId);
    if (old) {
      const priorName = old.name;
      await db.updateTournamentCategory(old.id, { name: c.label.trim(), sex: c.sex,
        ...(c.division !== undefined ? { category: c.division } : {}),
        ...(c.max_pairs !== undefined ? { max_pairs: c.max_pairs } : {}),
      });
      // Match category labels are denormalized; a rename must keep the bracket attached.
      const pairIds = new Set(savedPairs.filter((p) => p.category_id === old.id).map((p) => p.id));
      for (const m of matches.filter((m) => m.category_name !== c.label.trim() && (m.category_name === priorName || pairIds.has(m.side_a.pair_id ?? "") || pairIds.has(m.side_b.pair_id ?? "")))) {
        await db.updateMatch(m.id, { category_name: c.label.trim() });
      }
    } else {
      const created = await db.createTournamentCategory({ tournament_id: tournamentId, name: c.label.trim(), sex: c.sex,
        category: c.division ?? divisionFromCategory(c.label), max_pairs: c.max_pairs ?? 0,
        min_level: null, max_level: null, registered_pairs: 0, price_cents: price });
      // Mutate this invocation's row immediately so a partial failure can be retried by ID.
      c.persistedId = created.id;
    }
  }
  if (saveTeams) {
    for (let i = 0; i < teams.length; i++) {
      const t = teams[i], cat = categories.find((c) => c.id === t.categoryKey)!;
      const payload = { category_id: cat.persistedId!, name: t.name.trim(), player1_id: resolved[i].a.id,
        player2_id: resolved[i].b.id, crest_url: t.logo ? await crest(t.logo, t.name) : null };
      if (t.id) await db.updatePair(t.id, payload);
      else t.id = (await db.createPair({ ...payload, tournament_id: tournamentId })).id;
    }
    for (const p of savedPairs) if (!teams.some((t) => t.id === p.id)) await db.deletePair(p.id);
  }
}
