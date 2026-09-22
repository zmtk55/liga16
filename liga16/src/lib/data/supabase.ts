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

  async getTournamentCategories(tournamentId: string) {
    const { data, error } = await client()
      .from('tournament_categories').select('*').eq('tournament_id', tournamentId);
    if (error) throw error;
    return (data ?? []) as never;
  },

  async getTournamentPairs(tournamentId: string) {
    const { data, error } = await client()
      .from('pairs').select('*').eq('tournament_id', tournamentId);
    if (error) throw error;
    return (data ?? []) as never;
  },

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

  async listRankings(scope?: { sex?: string }) {
    let q = client().from('ranking_view').select('*').order('points', { ascending: false });
    if (scope?.sex && scope.sex !== 'all') q = q.eq('sex', scope.sex);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>, i: number) => ({ ...r, position: i + 1 })) as never;
  },

  async getPlayerRankingEvents(playerId: string) {
    const { data, error } = await client()
      .from('ranking_events').select('*').eq('player_id', playerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as never;
  },

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

  async getPlayerCard(playerId: string) {
    const { data, error } = await client()
      .from('player_cards').select('*').eq('slug', playerId).maybeSingle();
    if (error) throw error;
    return data as never;
  },

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

  async listRecentMatches() {
    const { data, error } = await client()
      .from('matches').select('*').order('scheduled_at', { ascending: false }).limit(30);
    if (error) throw error;
    return (data ?? []) as never;
  },

  async listNews() {
    const { data, error } = await client()
      .from('news').select('*').order('published_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as never;
  },

  async listSponsors() {
    const { data, error } = await client().from('sponsors').select('*');
    if (error) throw error;
    return (data ?? []) as never;
  },

  async registerPair(input: RegisterPairInput) {
    const { data: { user } } = await client().auth.getUser();
    if (!user) throw new Error("No hay sesión activa. Inicia sesión para inscribirte.");

    const { data: pair, error: pairErr } = await client()
      .from('pairs')
      .insert({
        tournament_id: input.tournament_id,
        category_id: input.category_id,
        name: input.pair_name,
      })
      .select().single();
    if (pairErr) throw pairErr;
    const { data: registration, error: regErr } = await client()
      .from('registrations')
      .insert({
        tournament_id: input.tournament_id,
        category_id: input.category_id,
        pair_id: pair.id,
        user_id: user.id,
        status: input.payment_method === 'transfer' ? 'payment_review' : 'payment_pending',
        rules_accepted_at: new Date().toISOString(),
      })
      .select().single();
    if (regErr) throw regErr;
    return { registration: registration as never };
  },
};
