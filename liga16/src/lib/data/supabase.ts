// Implementación Supabase del DataProvider.
// Activa cuando VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY están definidas.
// Requiere aplicar supabase/schema.sql en el proyecto (ver README.md).
import { supabase } from '@/lib/supabase';
import type { DataProvider, RegisterPairInput } from './provider';
import type { TournamentFilters } from '@/types';
import type { Team, PadelDivision, Sex, Match } from '@/types';

function client() {
  if (!supabase) throw new Error('Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
  return supabase;
}

// Mapea una fila de la tabla `teams` (columnas normalizadas) al tipo Team.
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
    winner: (row.winner as 'a' | 'b' | null) ?? null,
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
    const { data, error } = await client()
      .from('tournaments').select('*, clubs(name)').eq('slug', slug).maybeSingle();
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
    const { data: result, error } = await client()
      .from('tournament_categories').insert(data as Record<string, unknown>).select().single();
    if (error) throw error;
    return result as never;
  },

  async getTournamentPairs(tournamentId: string) {
    const { data, error } = await client().from('pairs').select('*').eq('tournament_id', tournamentId);
    if (error) throw error;
    return (data ?? []) as never;
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
    // Crear usuario en auth y perfil en player_profiles
    // Guardar role en raw_user_meta_data temporalmente.
    // Un trigger en SQL lo sincroniza a raw_app_meta_data (ver schema.sql).
    const { data: authData, error: authErr } = await client().auth.signUp({
      email: `${data.username}@liga16.example`,
      password: 'Liga162026!',
      options: {
        data: {
          display_name: data.display_name,
          username: data.username,
          role: data.role ?? 'player',
        },
      },
    });
    if (authErr || !authData.user) throw new Error(authErr?.message ?? 'Error creando usuario');

    // El trigger handle_auth_user_created ya creó un perfil mínimo al hacer signup.
    // Usamos upsert sobre user_id para actualizarlo con los datos completos (evita conflicto unique).
    const { data: result, error } = await client()
      .from('player_profiles').upsert({
        user_id: authData.user.id,
        display_name: data.display_name,
        username: data.username,
        city: data.city,
        state: data.state,
        country: data.country,
        sex: data.sex,
        declared_level: data.declared_level,
        dominant_hand: data.dominant_hand,
        preferred_position: data.preferred_position,
        bio: data.bio,
        is_public: data.is_public,
      } as Record<string, unknown>, { onConflict: 'user_id' }).select().single();
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

  async getPlayerCard(playerId: string) {
    const { data, error } = await client()
      .from('player_cards').select('*').eq('player_id', playerId).maybeSingle();
    if (error) throw error;
    return data as never;
  },

  // Equipos: en padel, un equipo es una pareja de 2 jugadores.
  // La DB usa columnas normalizadas (player1_name/player1_level/player2_name/player2_level).
  async listTeams() {
    const { data, error } = await client().from('teams').select('*');
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => teamFromRow(r)) as never;
  },

  async getTeam(slug: string) {
    const { data, error } = await client().from('teams').select('*').eq('slug', slug).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return teamFromRow(data as Record<string, unknown>) as never;
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
