// Implementación demo del DataProvider — datos semilla en memoria.
import type { DataProvider, RegisterPairInput } from './provider';
import {
  categories, clubs, leagues, matches, news, pairs, playerCards, players,
  rankingEvents, rankings, sponsors, teams, tournaments,
} from './seed';
import type { Registration, TournamentFilters } from '@/types';

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

export const demoProvider: DataProvider = {
  async listTournaments(filters?: Omit<TournamentFilters, 'city'>) {
    await delay();
    let list = [...tournaments];
    if (filters?.status && filters.status !== 'all') list = list.filter((t) => t.status === filters.status);
    if (filters?.format && filters.format !== 'all') list = list.filter((t) => t.format === filters.format);
    if (filters?.category) {
      const tIds = categories.filter((c) => c.name.includes(filters.category!)).map((c) => c.tournament_id);
      list = list.filter((t) => tIds.includes(t.id));
    }
    return list.sort((a, b) => a.start_date.localeCompare(b.start_date));
  },

  async getTournament(slug: string) {
    await delay();
    return tournaments.find((t) => t.slug === slug) ?? null;
  },

  async getTournamentCategories(tournamentId: string) {
    await delay();
    return categories.filter((c) => c.tournament_id === tournamentId);
  },

  async getTournamentPairs(tournamentId: string) {
    await delay();
    return pairs.filter((p) => p.tournament_id === tournamentId);
  },

  async listLeagues() {
    await delay();
    return leagues;
  },

  async getLeague(slug: string) {
    await delay();
    return leagues.find((l) => l.slug === slug) ?? null;
  },

  async listRankings(scope?: { sex?: string }) {
    await delay();
    let list = [...rankings];
    if (scope?.sex && scope.sex !== 'all') list = list.filter((r) => r.sex === scope.sex);
    return list.sort((a, b) => a.position - b.position).map((r, i) => ({ ...r, position: i + 1 }));
  },

  async getPlayerRankingEvents(playerId: string) {
    await delay();
    return rankingEvents.filter((e) => e.player_id === playerId);
  },

  async listPlayers(query?: string) {
    await delay();
    const q = query?.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      (p) => p.display_name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q),
    );
  },

  async getPlayer(id: string) {
    await delay();
    return players.find((p) => p.id === id || p.username === id) ?? null;
  },

  async getPlayerCard(playerId: string) {
    await delay();
    const player = players.find((p) => p.id === playerId || p.username === playerId);
    if (!player) return null;
    return playerCards[player.id] ?? null;
  },

  async listTeams() {
    await delay();
    return teams;
  },

  async getTeam(slug: string) {
    await delay();
    return teams.find((t) => t.slug === slug) ?? null;
  },

  async listClubs() {
    await delay();
    return clubs;
  },

  async getClub(slug: string) {
    await delay();
    return clubs.find((c) => c.slug === slug) ?? null;
  },

  async listRecentMatches() {
    await delay();
    const order = { live: 0, scheduled: 1, disputed: 2, finished: 3, walkover: 4, cancelled: 5 };
    return [...matches].sort(
      (a, b) => order[a.status] - order[b.status] || (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''),
    );
  },

  async listNews() {
    await delay();
    return [...news].sort((a, b) => b.published_at.localeCompare(a.published_at));
  },

  async listSponsors() {
    await delay();
    return sponsors;
  },

  async registerPair(input: RegisterPairInput) {
    await delay(300);
    const registration: Registration = {
      id: `reg-${Date.now()}`,
      tournament_id: input.tournament_id,
      category_id: input.category_id,
      pair_id: `pair-${Date.now()}`,
      status: input.payment_method === 'transfer' ? 'payment_review' : 'payment_pending',
      created_at: new Date().toISOString(),
    };
    return { registration };
  },
};
