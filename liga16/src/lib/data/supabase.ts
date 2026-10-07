// Implementación Supabase del DataProvider.
// Activa cuando VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY están definidas.
// Requiere aplicar supabase/schema.sql en el proyecto (ver README.md).
import { supabase } from '@/lib/supabase';
import { divisionFromCategory } from "@/lib/categories";
import type { DataProvider, RegisterPairInput } from './provider';
import { buildPlayerRecords } from '@/lib/records';
import { DIVISION_ORDER } from '@/lib/categories';
import type { TournamentFilters } from '@/types';
import type { Team, PadelDivision, Sex, Match, Court, Sponsor, Pair, PlayerProfile, PlayerStatus, MyProfileInput, RegistrationStatus, PaymentMethod } from '@/types';

function client() {
  if (!supabase) throw new Error('Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
  return supabase;
}

// Mapea una fila de la tabla `teams` (columnas normalizadas) al tipo Team.
function slugifyName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * En qué división compite una categoría.
 *
 * El nombre es la vía normal porque así funcionan las categorías reales
 * ("4ta Masculino", "Novatos Mixto", "Suma 9"): las que existen en el circuito
 * se llaman así y se reconocen.
 *
 * Los NIVELES son el respaldo, no la fuente. Antes, cualquier categoría que el
 * nombre no reconocía caía en silencio a '4ta' —una pareja de "Suma 11", "Open"
 * o "Intermedio" quedaba rankeada dentro de 4ta, mezclada con parejas de 4ta de
 * verdad, y no había forma de enterarse—. Ahora, si el nombre no dice nada, la
 * división sale del rango de niveles del torneo y, si tampoco lo hay, del nivel
 * de los propios jugadores de la pareja.
 *
 * El orden importa: los niveles solo se miran cuando el NOMBRE falla. Así una
 * categoría que hoy funciona ("3ra Masculino" con niveles 5.0–5.9) sigue
 * saliendo por el nombre y no cambia de división por culpa de esto.
 */
export function sexFromCategory(sex: string | null | undefined, name: string | null | undefined): Sex | null {
  if (sex === 'M' || sex === 'F' || sex === 'X') return sex;
  const n = (name ?? '').toLowerCase();
  if (n.includes('femenil')) return 'F';
  if (n.includes('varonil')) return 'M';
  if (n.includes('mixto')) return 'X';
  return null;
}

interface PairRow {
  id: string;
  name: string;
  player1_id: string | null;
  player2_id: string | null;
  crest_url: string | null;
  created_at: string | null;
  tournament_categories: {
    id: string;
    name: string;
    sex: string | null;
    category: string | null;
  } | null;
  tournaments: { id: string; name: string; city: string | null } | null;
}

interface PairAcc {
  played: number;
  won: number;
  lost: number;
  sets_for: number;
  sets_against: number;
  points: number;
}

/**
 * Construye los "equipos" públicos desde `pairs` (equipos POR TORNEO).
 * Une perfiles reales (player_profiles) para niveles y links al dashboard,
 * toma división/rama/sede de la categoría y torneo, y calcula récord,
 * sets y puntos desde los partidos terminados.
 */
async function buildTeamsFromPairs(): Promise<Team[]> {
  const [pairsRes, matchesRes] = await Promise.all([
    client()
      .from('pairs')
      .select('id, name, category_id, player1_id, player2_id, crest_url, created_at, tournament_categories(id, name, sex, category), tournaments(id, name, city)')
      .order('created_at', { ascending: false }),
    client()
      .from('matches')
      .select('id, status, winner, side_a_pair_id, side_b_pair_id, side_a_name, side_b_name, sets'),
  ]);
  if (pairsRes.error) throw pairsRes.error;
  if (matchesRes.error) throw matchesRes.error;

  const rows = (pairsRes.data ?? []) as unknown as PairRow[];

  // Perfiles reales: niveles, ciudad y sexo de cada jugador
  const playerIds = Array.from(
    new Set(rows.flatMap((r) => [r.player1_id, r.player2_id]).filter(Boolean) as string[]),
  );
  const playersById = new Map<
    string,
    { display_name: string; city: string | null; sex: string | null; level: number; photo_url: string | null }
  >();
  if (playerIds.length) {
    const { data: profs, error: profErr } = await client()
      .from('player_profiles')
      .select('id, display_name, city, sex, photo_url, declared_level, official_level')
      .in('id', playerIds);
    if (profErr) throw profErr;
    for (const p of (profs ?? []) as Array<Record<string, unknown>>) {
      playersById.set(p.id as string, {
        display_name: (p.display_name as string) ?? '',
        city: (p.city as string) ?? null,
        sex: (p.sex as string) ?? null,
        photo_url: (p.photo_url as string | null) ?? null,
        level:
          typeof p.official_level === 'number'
            ? p.official_level
            : typeof p.declared_level === 'number'
              ? p.declared_level
              : 0,
      });
    }
  }

  // Récord por pareja desde partidos terminados (por pair_id, con fallback por nombre)
  const finished = ((matchesRes.data ?? []) as Array<Record<string, unknown>>).filter(
    (m) => m.status === 'finished' && m.winner,
  );
  const accFor = new Map<string, PairAcc>();
  const getAcc = (row: PairRow): PairAcc => {
    let acc = accFor.get(row.id);
    if (acc) return acc;
    acc = { played: 0, won: 0, lost: 0, sets_for: 0, sets_against: 0, points: 0 };
    accFor.set(row.id, acc);
    const myName = row.name.trim().toLowerCase();
    for (const m of finished) {
      const aId = (m.side_a_pair_id as string | null) ?? null;
      const bId = (m.side_b_pair_id as string | null) ?? null;
      const aName = String(m.side_a_name ?? '').trim().toLowerCase();
      const bName = String(m.side_b_name ?? '').trim().toLowerCase();
      const isA = aId === row.id || (!aId && aName === myName);
      const isB = bId === row.id || (!bId && bName === myName);
      if (!isA && !isB) continue;
      acc.played++;
      const won = isA ? m.winner === 'a' : m.winner === 'b';
      if (won) acc.won++;
      else acc.lost++;
      const sets = (m.sets as Array<{ a?: number; b?: number }> | null) ?? [];
      for (const s of sets) {
        const my = isA ? (s.a ?? 0) : (s.b ?? 0);
        const their = isA ? (s.b ?? 0) : (s.a ?? 0);
        // Ignora filas vacías 0-0; el super tie-break se guarda con juegos reales (ej. 10-8)
        if (my === 0 && their === 0) continue;
        if (my > their) acc.sets_for++;
        else if (their > my) acc.sets_against++;
      }
    }
    acc.points = acc.won * 3;
    return acc;
  };

  // Construir equipos; la misma pareja puede estar en varios torneos: se deduplica por slug
  const teams = new Map<string, Team>();
  for (const row of rows) {
    const slug = slugifyName(row.name);
    if (teams.has(slug)) continue;
    const acc = getAcc(row);
    const catName = row.tournament_categories?.name ?? null;
    const p1 = row.player1_id ? playersById.get(row.player1_id) : undefined;
    const p2 = row.player2_id ? playersById.get(row.player2_id) : undefined;
    const sexes = [p1?.sex, p2?.sex].filter(Boolean) as string[];
    const sex =
      sexFromCategory(row.tournament_categories?.sex, catName) ??
      (sexes.length ? (sexes.every((s) => s === sexes[0]) ? (sexes[0] as Sex) : 'X') : 'X');
    const city = row.tournaments?.city || p1?.city || p2?.city || '';
    // Nivel de la pareja: el promedio de sus jugadores, para cuando la categoría
    // no dice en qué división compite (ver `divisionFromCategory`).
    const levels = [p1?.level, p2?.level].filter((l): l is number => typeof l === 'number');
    const pairLevel = levels.length ? levels.reduce((s, l) => s + l, 0) / levels.length : null;
    const cat = row.tournament_categories?.category ?? null;
    // `category` es lo que el torneo GUARDA (columna padel_division, not null);
    // el nombre es lo que la GENTE reconoce. El bucket sale del dato y no de
    // adivinar cuántas letras tiene la palabra —"Suma 11" no es "4ta" porque
    // el regex no la conozca—.
    teams.set(slug, {
      id: row.id,
      slug,
      name: row.name,
      crest_url: row.crest_url ?? null,
      city,
      club_id: null,
      division: divisionFromCategory(catName, cat, pairLevel),
      category_name: catName,
      sex,
      player1: p1 ? { player_id: row.player1_id as string, name: p1.display_name, level: p1.level } : null,
      player2: p2 ? { player_id: row.player2_id as string, name: p2.display_name, level: p2.level } : null,
      photo1_url: p1?.photo_url ?? null,
      photo2_url: p2?.photo_url ?? null,
      position: 0,
      points: acc.points,
      played: acc.played,
      won: acc.won,
      lost: acc.lost,
      sets_for: acc.sets_for,
      sets_against: acc.sets_against,
      titles: 0,
    });
  }

  // Posición dentro de cada división+rama: puntos, desempate por diferencia de sets
  const list = [...teams.values()];
  const groups = new Map<string, Team[]>();
  for (const t of list) {
    const k = `${t.division}|${t.sex}`;
    const g = groups.get(k) ?? [];
    g.push(t);
    groups.set(k, g);
  }
  for (const g of groups.values()) {
    g.sort(
      (a, b) =>
        b.points - a.points ||
        b.sets_for - b.sets_against - (a.sets_for - a.sets_against) ||
        b.won - a.won,
    );
    // Posiciones estilo tabla de liga: los empates (mismos puntos, dif. de
    // sets y victorias) COMPARTEN posición y la siguiente salta (1, 1, 3…).
    // Sin partidos jugados no hay posición: no se ha ganado nada todavía.
    let lastPos = 0;
    let prev: Team | null = null;
    g.forEach((t) => {
      if (t.played === 0) {
        t.position = 0;
        return;
      }
      const tied =
        prev !== null &&
        prev.points === t.points &&
        prev.sets_for - prev.sets_against === t.sets_for - t.sets_against &&
        prev.won === t.won;
      t.position = tied ? lastPos : ++lastPos;
      prev = t;
    });
  }
  // Las parejas sin partidos (position 0) van al final de su grupo.
  const rankOf = (t: Team) => (t.position === 0 ? Number.MAX_SAFE_INTEGER : t.position);
  list.sort(
    (a, b) =>
      DIVISION_ORDER.indexOf(a.division) - DIVISION_ORDER.indexOf(b.division) ||
      a.sex.localeCompare(b.sex) ||
      rankOf(a) - rankOf(b),
  );
  return list;
}

function teamFromRow(row: Record<string, unknown>): Team {
  const p1Name = row.player1_name as string | null ?? null;
  const p1Level = row.player1_level as number | null ?? null;
  const p2Name = row.player2_name as string | null ?? null;
  const p2Level = row.player2_level as number | null ?? null;
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    crest_url: (row.crest_url as string | null) ?? null,
    city: row.city as string,
    club_id: (row.club_id as string | null) ?? null,
    division: (row.division as PadelDivision) || '1ra',
    sex: (row.sex as Sex) || 'M',
    player1: p1Name ? { player_id: '', name: p1Name, level: p1Level ?? 0 } : null,
    player2: p2Name ? { player_id: '', name: p2Name, level: p2Level ?? 0 } : null,
    position: (row.position as number) ?? 0,
    points: (row.points as number) ?? 0,
    played: (row.played as number) ?? 0,
    won: (row.won as number) ?? 0,
    lost: (row.lost as number) ?? 0,
    sets_for: (row.sets_for as number) ?? 0,
    sets_against: (row.sets_against as number) ?? 0,
    titles: (row.titles as number) ?? 0,
  };
}

// Mapea una fila de `matches` (columnas side_a_pair_id/side_b_pair_id) al tipo Match.
function matchFromRow(row: Record<string, unknown>): Match {
  return {
    id: row.id as string,
    tournament_id: row.tournament_id as string,
    tournament_name: (row.tournament_name as string) ?? undefined,
    category_name: (row.category_name as string) ?? undefined,
    round: (row.round as string) ?? '',
    court_name: (row.court_name as string) ?? null,
    scheduled_at: (row.scheduled_at as string) ?? null,
    status: row.status as Match['status'],
    side_a: { pair_id: (row.side_a_pair_id as string) ?? null, pair_name: (row.side_a_name as string) ?? '' },
    side_b: { pair_id: (row.side_b_pair_id as string) ?? null, pair_name: (row.side_b_name as string) ?? '' },
    sets: ((row.sets as { a: number; b: number; tiebreak_a?: number | null; tiebreak_b?: number | null }[]) ?? []).map((s) => ({
      a: s.a,
      b: s.b,
      tiebreak_a: s.tiebreak_a ?? null,
      tiebreak_b: s.tiebreak_b ?? null,
    })),
    // Normaliza winner: en BD puede venir '' (string vacío) de guardados antiguos
    winner: row.winner === 'a' || row.winner === 'b' ? (row.winner as 'a' | 'b') : null,
  };
}

export const supabaseProvider: DataProvider = {
  // Torneos
  async listTournaments(filters?: Omit<TournamentFilters, 'city'>) {
    let q = client().from('tournaments').select('*, clubs(name)').order('start_date');
    if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
    if (filters?.format && filters.format !== 'all') q = q.eq('format', filters.format);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((t: Record<string, unknown>) => ({
      ...t,
      club_name: (t.clubs as { name?: string } | null)?.name ?? null,
    })) as never;
  },

  async getTournament(slug: string) {
    // Acepta slug o id (solo se filtra por id si el valor es un UUID válido)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
    const { data, error } = await client()
      .from('tournaments').select('*, clubs(name)')
      .eq(isUuid ? 'id' : 'slug', slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { ...data, club_name: (data.clubs as { name?: string } | null)?.name ?? null } as never;
  },

  async createTournament(data: Omit<import('@/types').Tournament, 'id' | 'slug'>) {
    const slug = (data.name ?? 'torneo-nuevo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const row: Record<string, unknown> = { ...data, slug };
    if (data.scoring) row.scoring = data.scoring;
    const { data: result, error } = await client()
      .from('tournaments').insert(row).select().single();
    if (error) throw error;
    return result as never;
  },

  async updateTournament(slug: string, data: Partial<import('@/types').Tournament>) {
    const row: Record<string, unknown> = { ...data };
    if (data.scoring) row.scoring = data.scoring;
    const { data: result, error } = await client()
      .from('tournaments').update(row).eq('slug', slug).select().single();
    if (error) throw error;
    return result as never;
  },

  async deleteTournament(slug: string) {
    const { error } = await client().from('tournaments').delete().eq('slug', slug);
    if (error) throw error;
    return true;
  },

  async getTournamentCategories(tournamentId: string) {
    const { data, error } = await client()
      .from('tournament_categories').select('*').eq('tournament_id', tournamentId);
    if (error) throw error;
    return (data ?? []) as never;
  },

  async createTournamentCategory(data: Omit<import('@/types').TournamentCategory, 'id'>) {
    // La tabla real usa (tournament_id, name, category, sex, price_cents).
    // Mapear desde el tipo interno: max_pairs vive en el select de UI, no en la BD.
    const row: Record<string, unknown> = {
      tournament_id: (data as { tournament_id?: string }).tournament_id,
      name: data.name,
      category: (data as unknown as { division?: string }).division ?? '4ta',
      sex: data.sex,
      price_cents: data.price_cents,
    };
    const { data: result, error } = await client()
      .from('tournament_categories').insert(row).select().single();
    if (error) throw error;
    return result as never;
  },

  async deleteTournamentCategory(id: string) {
    const { error } = await client()
      .from('tournament_categories').delete().eq('id', id);
    if (error) throw error;
  },

  async getTournamentPairs(tournamentId: string) {
    const { data, error } = await client().from('pairs').select('*').eq('tournament_id', tournamentId).order('seed', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return (data ?? []) as never;
  },

  async createPair(data: { tournament_id: string; category_id?: string | null; name: string; seed?: number | null; player1_id?: string | null; player2_id?: string | null; crest_url?: string | null }) {
    const { data: result, error } = await client()
      .from('pairs')
      .insert({ tournament_id: data.tournament_id, category_id: data.category_id ?? null, name: data.name, seed: data.seed ?? null, status: 'confirmed', player1_id: data.player1_id ?? null, player2_id: data.player2_id ?? null, crest_url: data.crest_url ?? null })
      .select()
      .single();
    if (error) throw error;
    return result as never;
  },

  async updatePair(id: string, data: { name?: string; category_id?: string | null; seed?: number | null; tournament_id?: string; crest_url?: string | null }) {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.category_id !== undefined) patch.category_id = data.category_id;
    if (data.seed !== undefined) patch.seed = data.seed;
    if (data.tournament_id !== undefined) patch.tournament_id = data.tournament_id;
    if (data.crest_url !== undefined) patch.crest_url = data.crest_url;
    const { data: result, error } = await client()
      .from('pairs').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return result as never;
  },

  async deletePair(id: string) {
    const { error } = await client().from('pairs').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async setRegistrationStatus(registrationId: string, status: RegistrationStatus) {
    const { error } = await client()
      .from('registrations')
      .update({ status, paid_at: status === 'paid' ? new Date().toISOString() : null })
      .eq('id', registrationId);
    if (error) throw error;
  },

  async listMatchesByTournament(tournamentId: string) {
    const { data, error } = await client()
      .from('matches').select('*').eq('tournament_id', tournamentId);
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => matchFromRow(r)) as never;
  },

  async createMatches(list: Array<Omit<Match, 'id'>>) {
    const rows = list.map((m) => ({
      tournament_id: m.tournament_id,
      tournament_name: m.tournament_name ?? null,
      category_name: m.category_name ?? null,
      round: m.round,
      court_name: m.court_name ?? null,
      scheduled_at: m.scheduled_at ?? null,
      status: m.status,
      side_a_pair_id: m.side_a.pair_id ?? null,
      side_b_pair_id: m.side_b.pair_id ?? null,
      side_a_name: m.side_a.pair_name,
      side_b_name: m.side_b.pair_name,
      winner: null,
      sets: [],
    }));
    const { data, error } = await client().from('matches').insert(rows).select();
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => matchFromRow(r)) as never;
  },

  async deleteMatchesByTournament(tournamentId: string) {
    const { error } = await client().from('matches').delete().eq('tournament_id', tournamentId);
    if (error) throw error;
    return true;
  },

  // Canchas
  async listCourts() {
    const { data, error } = await client().from('courts').select('*').order('name');
    if (error) {
      // La tabla puede no existir todavía (migración pendiente)
      if ((error as unknown as { code?: string }).code === 'PGRST205' || /relation.*courts/.test(error.message)) return [];
      throw error;
    }
    return (data ?? []) as never;
  },

  async createCourt(data: Omit<Court, 'id'>) {
    const { data: result, error } = await client()
      .from('courts').insert(data as Record<string, unknown>).select().single();
    if (error) throw error;
    return result as never;
  },

  async deleteCourt(id: string) {
    const { error } = await client().from('courts').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // Ligas
  async listLeagues() {
    const { data, error } = await client().from('leagues').select('*');
    if (error) throw error;
    return (data ?? []) as never;
  },

  async getLeague(slug: string) {
    const { data, error } = await client().from('leagues').select('*').eq('slug', slug).maybeSingle();
    if (error) throw error;
    return data as never;
  },

  // Rankings
  async listRankings(scope?: { sex?: string }) {
    let q = client().from('ranking_view').select('*').order('points', { ascending: false });
    if (scope?.sex && scope.sex !== 'all') q = q.eq('sex', scope.sex);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>, i: number) => ({
      ...r,
      position: i + 1,
      delta: 0,
      level: typeof r.level === 'number' ? r.level : parseFloat(String(r.level ?? 0)),
      points: typeof r.points === 'number' ? r.points : parseFloat(String(r.points ?? 0)),
      played: typeof r.played === 'number' ? r.played : (r.played ?? 0),
      won: typeof r.won === 'number' ? r.won : (r.won ?? 0),
    })) as never;
  },

  async updateRanking(playerId: string, updates: Partial<import('@/types').RankingEntry>) {
    // ranking_view es una vista; crear un ranking_event para ajustar puntos
    if (updates.points !== undefined || updates.delta !== undefined) {
      const points = updates.points ?? 0;
      const { error } = await client()
        .from('ranking_events').insert({ player_id: playerId, points, reason: 'Actualización manual admin' })
        .select().single();
      if (error) throw error;
    }
    return { ...updates, player_id: playerId } as never;
  },

  async getPlayerRankingEvents(playerId: string) {
    const { data, error } = await client()
      .from('ranking_events').select('*').eq('player_id', playerId).order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as never;
  },

  // Jugadores
  async listPlayers(query?: string) {
    let q = client().from('player_profiles').select('*').eq('is_public', true);
    if (query?.trim()) q = q.or(`display_name.ilike.%${query}%,username.ilike.%${query}%`);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as never;
  },

  async getPlayer(id: string) {
    const { data, error } = await client()
      .from('player_profiles').select('*').or(`id.eq.${id},username.eq.${id}`).maybeSingle();
    if (error) throw error;
    return data as never;
  },

  async createPlayer(data: Omit<import('@/types').PlayerProfile, 'id' | 'user_id'>) {
    // Perfil de jugador sin cuenta: NO crea usuarios en auth (evita rate limit
    // de emails y registros falsos). Cuando el jugador real se registre con su
    // email, se vincula su user_id a este perfil.
    const { data: result, error } = await client()
      .from('player_profiles').insert({
        display_name: data.display_name,
        username: data.username,
        photo_url: data.photo_url ?? null,
        city: data.city,
        state: data.state,
        country: data.country,
        sex: data.sex,
        declared_level: data.declared_level,
        dominant_hand: data.dominant_hand,
        preferred_position: data.preferred_position,
        bio: data.bio,
        is_public: data.is_public,
        role: 'player',
      } as Record<string, unknown>).select().single();
    if (error) throw error;
    return result as never;
  },

  async updatePlayer(id: string, data: Partial<import('@/types').PlayerProfile>) {
    const { data: result, error } = await client()
      .from('player_profiles').update(data as Record<string, unknown>).eq('id', id).select().single();
    if (error) throw error;
    return result as never;
  },

  async deletePlayer(id: string) {
    const { error } = await client().from('player_profiles').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // ── Autoregistro (opción A) ───────────────────────────────────────────────
  // El perfil lo controla el jugador; la elegibilidad para competir, el admin.
  async getMyProfile() {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await client()
      .from('player_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    return (data as PlayerProfile | null) ?? null;
  },

  async createMyProfile(data: MyProfileInput) {
    if (!supabase) throw new Error('Supabase no está configurado.');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Inicia sesión para crear tu perfil.');
    const { data: row, error } = await client()
      .from('player_profiles')
      .insert({
        ...data,
        user_id: user.id,
        role: 'player',
        // El trigger pone 'pendiente'; si el jugador crea el perfil a mano
        // (p. ej. el trigger falló), se registra igual como pendiente.
        status: 'pendiente',
      })
      .select('*')
      .single();
    if (error) throw error;
    return row as PlayerProfile;
  },

  async updateMyProfile(id: string, data: MyProfileInput) {
    // El trigger guard_player_self_update restaura status/official_level/role.
    const { data: row, error } = await client()
      .from('player_profiles')
      .update(data as Record<string, unknown>)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return row as PlayerProfile;
  },

  async setPlayerStatus(id: string, status: PlayerStatus) {
    const { data, error } = await client()
      .from('player_profiles')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as PlayerProfile;
  },

  async getPlayerCard(playerId: string) {
    const { data, error } = await client()
      .from('player_cards').select('*').eq('player_id', playerId).maybeSingle();
    if (error) throw error;
    return data as never;
  },

  /** Categoría REAL por jugador: división de la pareja con la que compite (1 query para todo el directorio). */
  async listPlayerDivisions(): Promise<Record<string, string>> {
    const { data, error } = await client()
      .from('pairs')
      .select('player1_id, player2_id, tournament_categories(name)')
      .order('created_at', { ascending: false });
    const map: Record<string, string> = {};
    if (error) return map;
    for (const row of data as unknown as { player1_id: string; player2_id: string; tournament_categories?: { name?: string } | null }[]) {
      if (!row.tournament_categories?.name) continue;
      const div = divisionFromCategory(row.tournament_categories.name);
      for (const pid of [row.player1_id, row.player2_id]) {
        if (pid && !map[pid]) map[pid] = div; // la pareja más reciente gana
      }
    }
    return map;
  },

  /**
   * Récord personal derivado de todos los partidos del jugador, no de una sola
   * pareja. Cambiar de pareja no borra lo que ya jugó.
   */
  async getPlayerRecord(playerId: string) {
    const [pairsRes, matchesRes, namesRes] = await Promise.all([
      client()
        .from('pairs')
        .select('id, name, player1_id, player2_id')
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`),
      client()
        .from('matches')
        .select('id, status, winner, scheduled_at, side_a_pair_id, side_b_pair_id, side_a_name, side_b_name, sets'),
      client().from('player_profiles').select('id, display_name'),
    ]);
    if (pairsRes.error) throw pairsRes.error;
    if (matchesRes.error) throw matchesRes.error;

    const pairs = ((pairsRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      name: (r.name as string) ?? '',
      player1_id: (r.player1_id as string) ?? '',
      player2_id: (r.player2_id as string) ?? '',
    })) as unknown as Pair[];

    const matches = ((matchesRes.data ?? []) as Array<Record<string, unknown>>).map((m) => ({
      id: m.id as string,
      tournament_id: '',
      round: '',
      court_name: null,
      scheduled_at: (m.scheduled_at as string) ?? null,
      status: m.status as Match['status'],
      winner: (m.winner as Match['winner']) ?? null,
      side_a: { pair_id: (m.side_a_pair_id as string) ?? null, pair_name: (m.side_a_name as string) ?? '' },
      side_b: { pair_id: (m.side_b_pair_id as string) ?? null, pair_name: (m.side_b_name as string) ?? '' },
      sets: (m.sets as Match['sets']) ?? [],
    })) as unknown as Match[];

    const names = ((namesRes.data ?? []) as Array<Record<string, unknown>>).map((p) => ({
      id: p.id as string,
      display_name: (p.display_name as string) ?? '',
    }));

    return buildPlayerRecords(matches, pairs, names).get(playerId) ?? null;
  },

  // Equipos: leen de `pairs` (equipos POR TORNEO). La tabla global `teams` quedó obsoleta.
  // slug se deriva del nombre; player1_id/player2_id de pairs ligan al perfil real.
  async listAllPairs() {
    const { data, error } = await client()
      .from('pairs')
      // `registrations` se embebe por su FK pair_id: una pareja del flujo
      // público trae su inscripción; una creada desde el admin, ninguna.
      .select('id, name, tournament_id, category_id, player1_id, player2_id, created_at, tournament_categories(name), tournaments(id, name), registrations(id, status, payment_method, amount_cents, created_at)')
      .order('created_at', { ascending: false });
    if (error) throw error;

    type RegRow = { id: string; status: RegistrationStatus; payment_method: PaymentMethod; amount_cents: number | null; created_at: string };
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    return rows.map((r) => {
      // Si hubiera varias (una por jugador inscrito), cuenta la más reciente.
      const reg = ((r.registrations as RegRow[] | null) ?? [])
        .slice()
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      return {
        id: r.id as string,
        name: r.name as string,
        category_id: (r.category_id as string) ?? null,
        category_name: (r.tournament_categories as { name: string } | null)?.name ?? null,
        tournament_id: (r.tournament_id as string) ?? ((r.tournaments as { id: string } | null)?.id ?? null),
        tournament_name: (r.tournaments as { name: string } | null)?.name ?? null,
        created_at: (r.created_at as string) ?? null,
        player1_id: (r.player1_id as string | null) ?? null,
        player2_id: (r.player2_id as string | null) ?? null,
        registration_id: reg?.id ?? null,
        registration_status: reg?.status ?? null,
        payment_method: reg?.payment_method ?? null,
        amount_cents: reg?.amount_cents ?? null,
      };
    });
  },

  async listTeams() {
    return (await buildTeamsFromPairs()) as never;
  },

  async getTeam(slug: string) {
    const teams = await buildTeamsFromPairs();
    return (teams.find((t) => t.slug === slug) ?? null) as never;
  },

  async createTeam(data: Omit<import('@/types').Team, 'id' | 'slug'>) {
    const slug = (data.name ?? 'pareja-nueva').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const row: Record<string, unknown> = {
      slug,
      name: data.name,
      crest_url: data.crest_url,
      city: data.city,
      club_id: data.club_id,
      division: data.division,
      sex: data.sex,
      player1_name: data.player1?.name ?? null,
      player1_level: data.player1?.level ?? null,
      player2_name: data.player2?.name ?? null,
      player2_level: data.player2?.level ?? null,
      position: data.position ?? 0,
      points: data.points ?? 0,
      played: data.played ?? 0,
      won: data.won ?? 0,
      lost: data.lost ?? 0,
      sets_for: data.sets_for ?? 0,
      sets_against: data.sets_against ?? 0,
      titles: data.titles ?? 0,
    };
    const { data: result, error } = await client()
      .from('teams').insert(row).select().single();
    if (error) throw error;
    return teamFromRow(result as Record<string, unknown>) as never;
  },

  async updateTeam(slug: string, data: Partial<import('@/types').Team>) {
    const row: Record<string, unknown> = {};
    if (data.name !== undefined) row.name = data.name;
    if (data.crest_url !== undefined) row.crest_url = data.crest_url;
    if (data.city !== undefined) row.city = data.city;
    if (data.club_id !== undefined) row.club_id = data.club_id;
    if (data.division !== undefined) row.division = data.division;
    if (data.sex !== undefined) row.sex = data.sex;
    if (data.player1 !== undefined) { row.player1_name = data.player1?.name ?? null; row.player1_level = data.player1?.level ?? null; }
    if (data.player2 !== undefined) { row.player2_name = data.player2?.name ?? null; row.player2_level = data.player2?.level ?? null; }
    if (data.position !== undefined) row.position = data.position;
    if (data.points !== undefined) row.points = data.points;
    if (data.played !== undefined) row.played = data.played;
    if (data.won !== undefined) row.won = data.won;
    if (data.lost !== undefined) row.lost = data.lost;
    if (data.sets_for !== undefined) row.sets_for = data.sets_for;
    if (data.sets_against !== undefined) row.sets_against = data.sets_against;
    if (data.titles !== undefined) row.titles = data.titles;
    const { data: result, error } = await client()
      .from('teams').update(row).eq('slug', slug).select().single();
    if (error) throw error;
    return teamFromRow(result as Record<string, unknown>) as never;
  },

  async deleteTeam(slug: string) {
    const { error } = await client().from('teams').delete().eq('slug', slug);
    if (error) throw error;
    return true;
  },

  // Club
  async listClubs() {
    const { data, error } = await client().from('clubs').select('*');
    if (error) throw error;
    return (data ?? []) as never;
  },

  async getClub(slug: string) {
    const { data, error } = await client().from('clubs').select('*').eq('slug', slug).maybeSingle();
    if (error) throw error;
    return data as never;
  },

  async updateClub(slug: string, data: Partial<import('@/types').Club>) {
    const { data: result, error } = await client()
      .from('clubs').update(data as Record<string, unknown>).eq('slug', slug).select().single();
    if (error) throw error;
    return result as never;
  },

  // Resultados
  async listRecentMatches() {
    const { data, error } = await client()
      .from('matches').select('*');
    if (error) throw error;
    const orderKeys: string[] = ['live', 'scheduled', 'disputed', 'finished', 'walkover', 'cancelled'];
    const rows = (data ?? []).map((r: Record<string, unknown>) => matchFromRow(r));
    return rows.sort((a, b) => {
      const sa = orderKeys.indexOf(a.status);
      const sb = orderKeys.indexOf(b.status);
      return sa - sb || String(a.scheduled_at ?? '').localeCompare(String(b.scheduled_at ?? ''));
    });
  },

  async updateMatch(id: string, updates: Partial<import('@/types').Match>) {
    const row: Record<string, unknown> = {};
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.winner !== undefined) row.winner = updates.winner;
    if (updates.sets !== undefined) row.sets = updates.sets;
    if (updates.side_a !== undefined) { row.side_a_pair_id = updates.side_a.pair_id; row.side_a_name = updates.side_a.pair_name; }
    if (updates.side_b !== undefined) { row.side_b_pair_id = updates.side_b.pair_id; row.side_b_name = updates.side_b.pair_name; }
    if (updates.scheduled_at !== undefined) row.scheduled_at = updates.scheduled_at;
    if (updates.court_name !== undefined) row.court_name = updates.court_name;
    const { data: result, error } = await client()
      .from('matches').update(row).eq('id', id).select().single();
    if (error) throw error;
    return matchFromRow(result as Record<string, unknown>) as never;
  },

  // Noticias
  async listNews() {
    const { data, error } = await client()
      .from('news').select('*').order('published_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as never;
  },

  async createNews(data: Omit<import('@/types').NewsItem, 'id'>) {
    const { data: result, error } = await client()
      .from('news').insert(data as Record<string, unknown>).select().single();
    if (error) throw error;
    return result as never;
  },

  async updateNews(id: string, data: Partial<import('@/types').NewsItem>) {
    const { data: result, error } = await client()
      .from('news').update(data as Record<string, unknown>).eq('id', id).select().single();
    if (error) throw error;
    return result as never;
  },

  async deleteNews(id: string) {
    const { error } = await client().from('news').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // Sponsors
  async listSponsors() {
    const { data, error } = await client().from('sponsors').select('*');
    if (error) throw error;
    return (data ?? []) as never;
  },

  async createSponsor(data: Omit<Sponsor, 'id'>) {
    const { data: result, error } = await client().from('sponsors').insert(data).select().single();
    if (error) throw error;
    return result as never;
  },

  async updateSponsor(id: string, data: Partial<Sponsor>) {
    const { data: result, error } = await client().from('sponsors').update(data).eq('id', id).select().single();
    if (error) throw error;
    return result as never;
  },

  async deleteSponsor(id: string) {
    const { error } = await client().from('sponsors').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // Registro
  async registerPair(input: RegisterPairInput) {
    const { data: { user } } = await client().auth.getUser();
    if (!user) throw new Error('No hay sesión activa. Inicia sesión para inscribirte.');

    const { data: pair, error: pairErr } = await client()
      .from('pairs').insert({
        tournament_id: input.tournament_id,
        category_id: input.category_id,
        name: input.pair_name,
      }).select().single();
    if (pairErr) throw pairErr;
    const { data: registration, error: regErr } = await client()
      .from('registrations').insert({
        tournament_id: input.tournament_id,
        category_id: input.category_id,
        pair_id: pair.id,
        user_id: user.id,
        status: input.payment_method === 'transfer' ? 'payment_review' : 'payment_pending',
        payment_method: input.payment_method,
        rules_accepted_at: new Date().toISOString(),
      }).select().single();
    if (regErr) throw regErr;
    return { registration: registration as never };
  },
};
