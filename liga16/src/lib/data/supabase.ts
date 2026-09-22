// Implementación Supabase del DataProvider.
// Activa cuando VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY están definidas.
// Requiere aplicar supabase/schema.sql en el proyecto (ver README.md).
import { supabase } from '@/lib/supabase';
import type { DataProvider, RegisterPairInput } from './provider';
import type { TournamentFilters } from '@/types';

function client() {
  if (!supabase) throw new Error('Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
  return supabase;
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
    const { data: result, error } = await client()
      .from('tournaments').insert(data as Record<string, unknown>).select().single();
    if (error) throw error;
    return result as never;
  },

  async updateTournament(slug: string, data: Partial<import('@/types').Tournament>) {
    const { data: result, error } = await client()
      .from('tournaments').update(data as Record<string, unknown>).eq('slug', slug).select().single();
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
    return (data ?? []).map((r: Record<string, unknown>, i: number) => ({ ...r, position: i + 1 })) as never;
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

    const { data: result, error } = await client()
      .from('player_profiles').insert({
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

  async getPlayerCard(playerId: string) {
    const { data, error } = await client()
      .from('player_cards').select('*').eq('player_id', playerId).maybeSingle();
    if (error) throw error;
    return data as never;
  },

  // Equipos
  async listTeams() {
    const { data, error } = await client().from('teams').select('*');
    if (error) throw error;
    return (data ?? []) as never;
  },

  async getTeam(slug: string) {
    const { data, error } = await client().from('teams').select('*').eq('slug', slug).maybeSingle();
    if (error) throw error;
    return data as never;
  },

  async createTeam(data: Omit<import('@/types').Team, 'id' | 'slug'>) {
    const { data: result, error } = await client()
      .from('teams').insert(data as Record<string, unknown>).select().single();
    if (error) throw error;
    return result as never;
  },

  async updateTeam(slug: string, data: Partial<import('@/types').Team>) {
    const { data: result, error } = await client()
      .from('teams').update(data as Record<string, unknown>).eq('slug', slug).select().single();
    if (error) throw error;
    return result as never;
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
    return (data ?? []).sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const sa = orderKeys.indexOf(a.status as string);
      const sb = orderKeys.indexOf(b.status as string);
      return sa - sb || String(a.scheduled_at ?? '').localeCompare(String(b.scheduled_at ?? ''));
    });
  },

  async updateMatch(id: string, updates: Partial<import('@/types').Match>) {
    const { data: result, error } = await client()
      .from('matches').update(updates as Record<string, unknown>).eq('id', id).select().single();
    if (error) throw error;
    return result as never;
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
