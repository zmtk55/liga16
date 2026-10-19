// Implementación demo del DataProvider — datos semilla en memoria mutable.
import type { DataProvider, RegisterPairInput } from './provider';
import { buildPlayerRecords } from '@/lib/records';
import { deriveTeamStandings } from '@/lib/standings';
import { divisionFromCategory } from '@/lib/categories';
import { sexFromCategory } from './supabase';
import {
  categories, clubs, leagues, matches, news, pairs, playerCards, players,
  sponsors, teams, tournaments,
} from './seed';
import type { Club, League, Match, NewsItem, Pair, PlayerProfile, PlayerStatus, RegistrationStatus, RegistrationWithPayment, PaymentMethod, Sex, Sponsor, Team, Tournament, TournamentCategory, TournamentFilters } from '@/types';

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

/** Nombre de categoría de una pareja a partir de su category_id (la BD trae la
 * relación, en demo no). Devuelve null si no hay categoría. */
function catNameOf(categoryId: string | null): string | null {
  if (!categoryId) return null;
  return store.categories.find((c) => c.id === categoryId)?.name ?? null;
}

/** En demo, "mi cuenta" es este jugador: permite recorrer el autoregistro sin Supabase. */
const DEMO_ME_ID = 'p-3';

// Almacén mutable para demo
const store = {
  players: [...players] as PlayerProfile[],
  teams: [...teams] as Team[],
  tournaments: [...tournaments] as Tournament[],
  categories: [...categories] as TournamentCategory[],
  pairs: [...pairs] as import('@/types').Pair[],
  matches: [...matches] as Match[],
  news: [...news] as NewsItem[],
  clubs: [...clubs] as Club[],
  leagues: [...leagues] as League[],
  sponsors: [...sponsors] as import('@/types').Sponsor[],
  /** Registros de inscripción (flujo público). En demo vivían en un objeto
   * separado que nunca se leía, así que las parejas del público nunca
   * llegaban a la vista de participantes. Ahora comparte el store. */
  registrations: [] as RegistrationWithPayment[],
};

  /**
 * Equipos derivados de `pairs`, como en Supabase.
 *
 * La tabla global `teams` quedó obsoleta y en demo `listTeams()` seguía leyendo
 * ella: dabas de alta una pareja en Equipos o Participantes y el ranking y el
 * panel seguían mostrando el seed, y capturar resultados no movía nada.
 */
function buildTeamsFromPairsDemo(): Team[] {
  const playerById = new Map(store.players.map((p) => [p.id, p]));
  const catById = new Map(store.categories.map((c) => [c.id, c]));
  const tourById = new Map(store.tournaments.map((t) => [t.id, t]));

  const bySlug = new Map<string, Team>();
  // `store.pairs` viene en orden de inserción; el seed pone primero las viejas,
  // así que una pareja repetida conserva su fila más antigua, como en Supabase.
  for (const pair of store.pairs) {
    const slug = slugify(pair.name);
    if (bySlug.has(slug)) continue;
    const cat = pair.category_id ? catById.get(pair.category_id) : undefined;
    const catName = cat?.name ?? null;
    const p1 = pair.player1_id ? playerById.get(pair.player1_id) : undefined;
    const p2 = pair.player2_id ? playerById.get(pair.player2_id) : undefined;
const sexes = [p1?.sex, p2?.sex].filter(Boolean) as string[];
    const sex =
      sexFromCategory(cat?.sex, catName) ??
      (sexes.length ? (sexes.every((s) => s === sexes[0]) ? (sexes[0] as Sex) : 'X') : 'X');
    const levelOf = (p: PlayerProfile | undefined) =>
      p ? (p.official_level ?? p.declared_level) : null;
    const levels = [levelOf(p1), levelOf(p2)].filter((l): l is number => typeof l === 'number');
    // `crest_url` y la columna `category` (padel_division) existen en la BD pero
    // no en los tipos de `Pair`/`TournamentCategory`, que quedaron atrasados.
    const crest = (pair as Pair & { crest_url?: string | null }).crest_url ?? null;
    const savedDivision =
      (cat as (TournamentCategory & { category?: string | null }) | undefined)?.category ?? null;
    bySlug.set(slug, {
      id: pair.id,
      slug,
      name: pair.name,
      crest_url: crest,
      city: tourById.get(pair.tournament_id ?? '')?.city || p1?.city || p2?.city || '',
      club_id: null,
      division: divisionFromCategory(catName, savedDivision, levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : null),
      category_name: catName,
      sex,
      player1: p1 ? { player_id: p1.id, name: p1.display_name, level: levelOf(p1)! } : null,
      player2: p2 ? { player_id: p2.id, name: p2.display_name, level: levelOf(p2)! } : null,
      photo1_url: p1?.photo_url ?? null,
      photo2_url: p2?.photo_url ?? null,
      position: 0,
      points: 0,
      played: 0,
      won: 0,
      lost: 0,
      sets_for: 0,
      sets_against: 0,
      rendimiento_pct: null,
    } as Team);
  }
  return [...bySlug.values()];
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const demoProvider: DataProvider = {
  // Torneos
  async listTournaments(filters?: Omit<TournamentFilters, 'city'>) {
    await delay();
    let list = [...store.tournaments];
    if (filters?.status && filters.status !== 'all') list = list.filter((t) => t.status === filters.status);
    if (filters?.format && filters.format !== 'all') list = list.filter((t) => t.format === filters.format);
    if (filters?.category) {
      const tIds = store.categories.filter((c) => c.name.includes(filters.category!)).map((c) => c.tournament_id);
      list = list.filter((t) => tIds.includes(t.id));
    }
    return list.sort((a, b) => a.start_date.localeCompare(b.start_date));
  },


async getTournament(slug: string) {
    await delay();
    // Acepta slug o id, como el provider de Supabase: el wizard navega por id al
    // terminar, y en demo eso se traducía en una pantalla que no cargaba nunca.
    return (
      store.tournaments.find((t) => t.slug === slug) ??
      store.tournaments.find((t) => t.id === slug) ??
      null
    );
  },

  async createTournament(data: Omit<Tournament, 'id' | 'slug'>) {
    await delay();
    const id = `t-${Date.now()}`;
    const slug = (data.name ?? 'torneo-nuevo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const tournament: Tournament = { ...data, id, slug } as Tournament;
    store.tournaments.unshift(tournament);
    return tournament;
  },

  async updateTournament(slug: string, data: Partial<Tournament>) {
    await delay();
    const idx = store.tournaments.findIndex((t) => t.slug === slug);
    if (idx === -1) return null;
    store.tournaments[idx] = { ...store.tournaments[idx], ...data } as Tournament;
    return store.tournaments[idx];
  },

  async deleteTournament(slug: string) {
    await delay();
    const idx = store.tournaments.findIndex((t) => t.slug === slug);
    if (idx === -1) return false;
    store.tournaments.splice(idx, 1);
    return true;
  },

  async getTournamentCategories(tournamentId: string) {
    await delay();
    return store.categories.filter((c) => c.tournament_id === tournamentId);
  },

  async createTournamentCategory(data: Omit<TournamentCategory, 'id'>) {
    await delay();
    const id = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const category: TournamentCategory = { ...data, id } as TournamentCategory;
    store.categories.push(category);
    return category;
  },

  async deleteTournamentCategory(id: string) {
    await delay();
    store.categories = store.categories.filter((c) => c.id !== id);
  },

  async getTournamentPairs(tournamentId: string) {
    await delay();
    return store.pairs.filter((p) => p.tournament_id === tournamentId);
  },

  async listAllPairs() {
    await delay();
    const regById = new Map<string, RegistrationWithPayment>();
    for (const r of store.registrations) regById.set(r.pair_id, r);
    return store.pairs.map((p) => {
      const reg = regById.get(p.id);
      return {
        id: p.id,
        name: p.name,
        category_id: p.category_id ?? null,
        category_name: catNameOf(p.category_id),
        tournament_id: p.tournament_id,
        tournament_name: store.tournaments.find((t) => t.id === p.tournament_id)?.name ?? null,
        created_at: null,
        player1_id: p.player1_id || null,
        player2_id: p.player2_id || null,
        registration_id: reg?.id ?? null,
        registration_status: reg?.status ?? null,
        payment_method: reg?.payment_method ?? null,
        amount_cents: reg?.amount_cents ?? null,
      };
    });
  },

  async updateRegistrationPayment(
    registrationId: string,
    data: { status?: RegistrationStatus; payment_method?: PaymentMethod; amount_cents?: number | null; paid_at?: string | null },
  ) {
    await delay();
    const idx = store.registrations.findIndex((r) => r.id === registrationId);
    if (idx === -1) throw new Error('Inscripción no encontrada');
    store.registrations[idx] = {
      ...store.registrations[idx],
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.payment_method !== undefined ? { payment_method: data.payment_method } : {}),
      ...(data.amount_cents !== undefined ? { amount_cents: data.amount_cents } : {}),
      ...(data.paid_at !== undefined ? { paid_at: data.paid_at } : {}),
    };
  },

  async createPair(data: { tournament_id: string; category_id?: string | null; name: string; seed?: number | null; player1_id?: string | null; player2_id?: string | null }) {
    await delay();
    const pair = {
      id: `pair-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tournament_id: data.tournament_id,
      category_id: data.category_id ?? null,
      name: data.name,
      player1_id: data.player1_id ?? "",
      player2_id: data.player2_id ?? "",
      seed: data.seed ?? null,
    } as unknown as Pair;
    store.pairs.push(pair);
    return pair;
  },

  async updatePair(id: string, data: { name?: string; category_id?: string | null; seed?: number | null; tournament_id?: string }) {
    await delay();
    const idx = store.pairs.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Pareja no encontrada");
    const viejoNombre = store.pairs[idx].name;
    store.pairs[idx] = { ...store.pairs[idx], ...data } as unknown as Pair;
    // Al cambiar el nombre, los partidos que la mencionan quedan con el viejo
    // nombre y el buscador de resultados no la encuentra. Se actualizan por
    // pair_id y, de respaldo, por nombre (partidos del seed sin id).
    if (data.name && data.name !== viejoNombre) {
      for (const m of store.matches) {
        if (m.side_a.pair_id === id) m.side_a.pair_name = data.name;
        if (m.side_b.pair_id === id) m.side_b.pair_name = data.name;
        if (!m.side_a.pair_id && m.side_a.pair_name === viejoNombre) m.side_a.pair_name = data.name;
        if (!m.side_b.pair_id && m.side_b.pair_name === viejoNombre) m.side_b.pair_name = data.name;
      }
    }
    return store.pairs[idx];
  },

  async deletePair(id: string) {
    await delay();
    store.pairs = store.pairs.filter((p) => p.id !== id);
    return true;
  },

  async listMatchesByTournament(tournamentId: string) {
    await delay();
    return store.matches.filter((m) => m.tournament_id === tournamentId);
  },

  async createMatches(list: Array<Omit<Match, "id">>) {
    await delay();
    const created = list.map((m, i) => ({ ...m, id: `m-${Date.now()}-${i}` }) as Match);
    store.matches.push(...created);
    return created;
  },

  async deleteMatchesByTournament(tournamentId: string) {
    await delay();
    store.matches = store.matches.filter((m) => m.tournament_id !== tournamentId);
    return true;
  },

  async listCourts() {
    await delay();
    return [
      { id: "c-1", club_id: store.clubs[0]?.id ?? null, name: "Cancha 1", surface: "Césped sintético", indoor: false },
      { id: "c-2", club_id: store.clubs[0]?.id ?? null, name: "Cancha 2", surface: "Césped sintético", indoor: false },
    ];
  },

  async createCourt(data: Omit<import("@/types").Court, "id">) {
    await delay();
    const court = { ...data, id: `c-${Date.now()}` };
    return court;
  },

  async deleteCourt() {
    await delay();
    return true;
  },

  // Ligas
  async listLeagues() {
    await delay();
    return [...store.leagues];
  },

  async getLeague(slug: string) {
    await delay();
    return store.leagues.find((l: League) => l.slug === slug) ?? null;
  },

  // Ranking: no existe por jugador. Ver la nota en `provider.ts`.

  // Jugadores
  async listPlayers(query?: string) {
    await delay();
    const q = query?.trim().toLowerCase();
    if (!q) return [...store.players];
    return store.players.filter(
      (p) => p.display_name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q),
    );
  },

  async getPlayer(id: string) {
    await delay();
    return store.players.find((p) => p.id === id || p.username === id) ?? null;
  },

  async createPlayer(data: Omit<PlayerProfile, 'id' | 'user_id'>) {
    await delay();
    const id = `p-${Date.now()}`;
    const user_id = `u-${Date.now()}`;
    const player: PlayerProfile = { ...data, id, user_id } as PlayerProfile;
    store.players.push(player);
    return player;
  },

  async updatePlayer(id: string, data: Partial<PlayerProfile>) {
    await delay();
    const idx = store.players.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    store.players[idx] = { ...store.players[idx], ...data } as PlayerProfile;
    return store.players[idx];
  },

  async deletePlayer(id: string) {
    await delay();
    const idx = store.players.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    store.players.splice(idx, 1);
    return true;
  },

  // ── Autoregistro (opción A) ───────────────────────────────────────────────
  // En demo no hay auth real: la "cuenta" es un perfil sembrado, para poder
  // recorrer la pantalla sin Supabase.
  async getMyProfile() {
    await delay();
    return store.players.find((p) => p.id === DEMO_ME_ID) ?? null;
  },

  async createMyProfile(data) {
    await delay();
    const created = {
      ...data,
      id: `p-${Date.now()}`,
      user_id: DEMO_ME_ID,
      role: 'player' as const,
      status: 'pendiente' as const,
    } as PlayerProfile;
    store.players.push(created);
    return created;
  },

  async updateMyProfile(id: string, data: Partial<PlayerProfile>) {
    await delay();
    const idx = store.players.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Perfil no encontrado');
    // El jugador no decide estos tres: los deja como estaban.
    const current = store.players[idx];
    store.players[idx] = {
      ...current,
      ...data,
      status: current.status ?? 'verificado',
      official_level: current.official_level,
      role: current.role,
    } as PlayerProfile;
    return store.players[idx];
  },

  async setPlayerStatus(id: string, status: PlayerStatus) {
    await delay();
    const idx = store.players.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Perfil no encontrado');
    store.players[idx] = { ...store.players[idx], status } as PlayerProfile;
    return store.players[idx];
  },

  async getPlayerCard(playerId: string) {
    await delay();
    const player = store.players.find((p) => p.id === playerId || p.username === playerId);
    if (!player) return null;
    return playerCards[player.id] ?? null;
  },

  async listPlayerDivisions() {
    await delay();
    const map: Record<string, string> = {};
    for (const t of store.teams ?? []) {
      if (!t.division) continue;
      for (const pid of [t.player1?.player_id, t.player2?.player_id]) {
        if (pid && !map[pid]) map[pid] = t.division;
      }
    }
    return map;
  },

  async getPlayerRecord(playerId: string) {
    await delay();
    const player = store.players.find((p) => p.id === playerId || p.username === playerId);
    if (!player) return null;
    const records = buildPlayerRecords(store.matches, store.pairs, store.players);
    return records.get(player.id) ?? null;
  },

  // Equipos
  // El récord y la posición se DERIVAN de store.matches en cada llamada: antes
  // se devolvía `store.teams` tal cual, con puntos y posiciones escritos a mano
  // en el seed, así que capturar un resultado no movía el ranking. Es la misma
  // función que usa el provider de Supabase, para que demo y producción
  // ordenen igual.
  async listTeams() {
    await delay();
    // Igual que en Supabase: los equipos se derivan de `pairs`, no de la tabla
    // global `teams` (que quedó obsoleta). Con `store.teams` el ranking y el
    // panel seguían mostrando el seed aunque dieras de alta parejas nuevas, y
    // capturar resultados no movía nada.
    return deriveTeamStandings(buildTeamsFromPairsDemo(), store.matches);
  },

  async getTeam(slug: string) {
    await delay();
    return store.teams.find((t) => t.slug === slug) ?? null;
  },

  async createTeam(data: Omit<Team, 'id' | 'slug'>) {
    await delay();
    const id = `team-${Date.now()}`;
    const slug = (data.name ?? 'equipo-nuevo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const team: Team = {
      ...data,
      id,
      slug,
      crest_url: data.crest_url ?? null,
      club_id: data.club_id ?? null,
      position: data.position ?? 0,
      points: data.points ?? 0,
      played: data.played ?? 0,
      won: data.won ?? 0,
      lost: data.lost ?? 0,
      sets_for: data.sets_for ?? 0,
      sets_against: data.sets_against ?? 0,
      titles: data.titles ?? 0,
    } as Team;
    store.teams.push(team);
    return team;
  },

  async updateTeam(slug: string, data: Partial<Team>) {
    await delay();
    const idx = store.teams.findIndex((t) => t.slug === slug);
    if (idx === -1) return null;
    store.teams[idx] = { ...store.teams[idx], ...data } as Team;
    return store.teams[idx];
  },

  async deleteTeam(slug: string) {
    await delay();
    const idx = store.teams.findIndex((t) => t.slug === slug);
    if (idx === -1) return false;
    store.teams.splice(idx, 1);
    return true;
  },

  // Club
  async listClubs() {
    await delay();
    return [...store.clubs];
  },

  async getClub(slug: string) {
    await delay();
    return store.clubs.find((c) => c.slug === slug) ?? null;
  },

  async updateClub(slug: string, data: Partial<Club>) {
    await delay();
    const idx = store.clubs.findIndex((c) => c.slug === slug);
    if (idx === -1) return null;
    store.clubs[idx] = { ...store.clubs[idx], ...data } as Club;
    return store.clubs[idx];
  },

  // Resultados
  async listRecentMatches() {
    await delay();
    const order = { live: 0, scheduled: 1, disputed: 2, finished: 3, walkover: 4, cancelled: 5 };
    // Los nombres de los lados se resuelven contra `pairs` ACTUAL: un partido
    // guarda un snapshot del nombre y, al renombrar la pareja, el buscador de
    // resultados no encontraba el nuevo nombre. Con el lookup siempre sale el
    // nombre de hoy, por pair_id y, de respaldo, por nombre (partidos sin id).
    const pairNameById = new Map(store.pairs.map((p) => [p.id, p.name]));
    const pairByName = new Map(store.pairs.map((p) => [p.name.trim().toLowerCase(), p.name]));
    const resolveName = (side: Match["side_a"]) => {
      if (side.pair_id && pairNameById.has(side.pair_id)) return pairNameById.get(side.pair_id)!;
      const byName = pairByName.get((side.pair_name ?? "").trim().toLowerCase());
      return byName ?? side.pair_name;
    };
    return [...store.matches]
      .map((m) => ({
        ...m,
        side_a: { ...m.side_a, pair_name: resolveName(m.side_a) },
        side_b: { ...m.side_b, pair_name: resolveName(m.side_b) },
      }))
      .sort(
        (a, b) => order[a.status] - order[b.status] || (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''),
      );
  },

  async updateMatch(id: string, updates: Partial<Match>) {
    await delay();
    const idx = store.matches.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    store.matches[idx] = { ...store.matches[idx], ...updates } as Match;
    return store.matches[idx];
  },

  // Noticias
  async listNews() {
    await delay();
    return [...store.news].sort((a, b) => b.published_at.localeCompare(a.published_at));
  },

  async createNews(data: Omit<NewsItem, 'id'>) {
    await delay();
    const id = `n-${Date.now()}`;
    const item: NewsItem = { ...data, id } as NewsItem;
    store.news.unshift(item);
    return item;
  },

  async updateNews(id: string, data: Partial<NewsItem>) {
    await delay();
    const idx = store.news.findIndex((n) => n.id === id);
    if (idx === -1) return null;
    store.news[idx] = { ...store.news[idx], ...data } as NewsItem;
    return store.news[idx];
  },

  async deleteNews(id: string) {
    await delay();
    const idx = store.news.findIndex((n) => n.id === id);
    if (idx === -1) return false;
    store.news.splice(idx, 1);
    return true;
  },

  // Sponsors
  async listSponsors() {
    await delay();
    return [...store.sponsors];
  },

  async createSponsor(data: Omit<Sponsor, 'id'>) {
    await delay(300);
    const sponsor: Sponsor = { ...data, id: `sponsor-${Date.now()}` };
    store.sponsors.push(sponsor);
    return sponsor;
  },

  async updateSponsor(id: string, data: Partial<Sponsor>) {
    await delay(300);
    const idx = store.sponsors.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    store.sponsors[idx] = { ...store.sponsors[idx], ...data };
    return store.sponsors[idx];
  },

  async deleteSponsor(id: string) {
    await delay(300);
    const idx = store.sponsors.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    store.sponsors.splice(idx, 1);
    return true;
  },

  // Registro
  async registerPair(input: RegisterPairInput) {
    await delay(300);
    // Antes esto creaba un objeto `registration` aislado que nunca se leía:
    // el jugador se inscribía y su pareja no aparecia en /admin/participantes.
    // Ahora la pareja entra en el store principal y el registro lleva el estado
    // de pago para que el admin pueda verlo y aprobarlo.
    const pairId = `pair-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const pair: Pair = {
      id: pairId,
      tournament_id: input.tournament_id,
      category_id: input.category_id,
      name: input.pair_name,
      player1_id: null,
      player2_id: null,
      seed: null,
    } as unknown as Pair;
    store.pairs.push(pair);

    const regStatus = input.payment_method === 'transfer' ? 'payment_review' : 'payment_pending';
    const registration: RegistrationWithPayment = {
      id: `reg-${Date.now()}`,
      tournament_id: input.tournament_id,
      category_id: input.category_id,
      pair_id: pairId,
      status: regStatus,
      created_at: new Date().toISOString(),
      payment_method: input.payment_method,
      amount_cents: null,
      paid_at: null,
    };
    store.registrations.push(registration);
    return { registration };
  },
};
