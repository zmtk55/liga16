// Implementación demo del DataProvider — datos semilla en memoria mutable.
import type { DataProvider, RegisterPairInput } from './provider';
import {
  categories, clubs, leagues, matches, news, pairs, playerCards, players,
  rankingEvents, rankings, sponsors, teams, tournaments,
} from './seed';
import type { Club, League, Match, NewsItem, PlayerProfile, RankingEntry, RankingEvent, Registration, Team, Tournament, TournamentCategory, TournamentFilters } from '@/types';

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

// Almacén mutable para demo
const store = {
  players: [...players] as PlayerProfile[],
  rankings: [...rankings] as RankingEntry[],
  teams: [...teams] as Team[],
  tournaments: [...tournaments] as Tournament[],
  categories: [...categories] as TournamentCategory[],
  pairs: [...pairs] as import('@/types').Pair[],
  matches: [...matches] as Match[],
  news: [...news] as NewsItem[],
  clubs: [...clubs] as Club[],
  leagues: [...leagues] as League[],
  rankingEvents: [...rankingEvents] as RankingEvent[],
  sponsors: [...sponsors] as import('@/types').Sponsor[],
};

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
    return store.tournaments.find((t) => t.slug === slug) ?? null;
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

  async createPair(data: { tournament_id: string; category_id?: string | null; name: string; seed?: number | null }) {
    await delay();
    const pair = {
      id: `pair-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tournament_id: data.tournament_id,
      category_id: data.category_id ?? "",
      name: data.name,
      player1_id: "",
      player2_id: "",
      seed: data.seed ?? null,
    };
    store.pairs.push(pair);
    return pair;
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

  // Rankings
  async listRankings(scope?: { sex?: string }) {
    await delay();
    let list = [...store.rankings];
    if (scope?.sex && scope.sex !== 'all') list = list.filter((r) => r.sex === scope.sex);
    return list.sort((a, b) => a.position - b.position).map((r, i) => ({ ...r, position: i + 1 }));
  },

  async updateRanking(playerId: string, updates: Partial<RankingEntry>) {
    await delay();
    const idx = store.rankings.findIndex((r) => r.player_id === playerId);
    if (idx === -1) return null;
    store.rankings[idx] = { ...store.rankings[idx], ...updates } as RankingEntry;
    return store.rankings[idx];
  },

  async getPlayerRankingEvents(playerId: string) {
    await delay();
    return store.rankingEvents.filter((e) => e.player_id === playerId);
  },

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

  async getPlayerCard(playerId: string) {
    await delay();
    const player = store.players.find((p) => p.id === playerId || p.username === playerId);
    if (!player) return null;
    return playerCards[player.id] ?? null;
  },

  // Equipos
  async listTeams() {
    await delay();
    return [...store.teams];
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
    return [...store.matches].sort(
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

  // Registro
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
