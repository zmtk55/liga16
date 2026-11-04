// DATOS SINTÉTICOS para capturas locales. Solo vite.screenshots.config.ts.
// Cubre: torneos, equipos/parejas, jugadores, partidos (grupos + llaves con
// final capturada) para el ranking de parejas, el individual y el palmarés.
import { buildPlayerRecords } from "@/lib/records";

const TOURNAMENTS = [
  { id: "t-1", name: "Copa Primavera 2026", slug: "copa-primavera-2026", organizer_id: "org-1", status: "finished", start_date: "2026-03-14", end_date: "2026-03-16", city: "Hermosillo", state: "Sonora", club_id: "c-1", cover_url: null, registration_deadline: "2026-03-10", modality: "pairs", format: "groups_knockout", price_cents: 60000, currency: "MXN", rules_summary: null, description: null, scoring: null, semifinal_slots: 4 },
  { id: "t-2", name: "Liga Nocturna Martes", slug: "liga-nocturna-martes", organizer_id: "org-1", status: "finished", start_date: "2026-04-07", end_date: "2026-04-09", city: "Hermosillo", state: "Sonora", club_id: "c-1", cover_url: null, registration_deadline: "2026-04-01", modality: "pairs", format: "groups_knockout", price_cents: 40000, currency: "MXN", rules_summary: null, description: null, scoring: null, semifinal_slots: 4 },
  { id: "t-3", name: "LIGA16 4TA EDICIÓN", slug: "liga16-4ta-edicion", organizer_id: null, status: "in_progress", start_date: "2026-10-12", end_date: "2026-11-30", city: "Caborca", state: "Sonora", club_id: "c-1", club_name: "caborca", cover_url: null, registration_deadline: "2026-10-05", modality: "pairs", format: "groups_knockout", price_cents: 65000, currency: "MXN", rules_summary: null, description: null, scoring: null, semifinal_slots: 4 },
  { id: "t-4", name: "Copa Diciembre 2026", slug: "copa-diciembre-2026", organizer_id: null, status: "registration_open", start_date: "2026-12-05", end_date: "2026-12-07", city: "Caborca", state: "Sonora", club_id: "c-1", cover_url: null, registration_deadline: "2026-11-28", modality: "pairs", format: "groups_knockout", price_cents: 60000, currency: "MXN", rules_summary: null, description: null, scoring: null, semifinal_slots: 4 },
];

const PLAYERS = [
  { id: "j1", display_name: "Ana Ríos", sex: "F", declared_level: 5.5, official_level: 5.5 },
  { id: "j2", display_name: "Beto Serna", sex: "M", declared_level: 5.0, official_level: null },
  { id: "j3", display_name: "Cora Vega", sex: "F", declared_level: 5.5, official_level: 5.5 },
  { id: "j4", display_name: "Dani Mora", sex: "M", declared_level: 5.0, official_level: null },
  { id: "j5", display_name: "Eli Fuentes", sex: "F", declared_level: 6.0, official_level: 6.0 },
  { id: "j6", display_name: "Fer Rojas", sex: "M", declared_level: 6.0, official_level: 6.0 },
  { id: "j7", display_name: "Gaby León", sex: "F", declared_level: 4.5, official_level: null },
  { id: "j8", display_name: "Hugo Prado", sex: "M", declared_level: 4.5, official_level: null },
].map((p) => ({
  user_id: `u-${p.id}`, username: p.display_name.toLowerCase().replace(/[^a-z]/g, ""),
  photo_url: null, city: "Hermosillo", state: "Sonora", country: "MX", birth_date: null,
  dominant_hand: "right", preferred_position: "both", bio: null, is_public: true, role: "player",
  ...p,
}));

const pair = (id: string, name: string, t: string, p1: string, p2: string, category: string) => ({
  id, name, tournament_id: t, category_id: `cat-${t}`, category_name: category,
  tournament_name: TOURNAMENTS.find((x) => x.id === t)?.name ?? null,
  created_at: "2026-03-01T00:00:00Z", player1_id: p1, player2_id: p2,
  registration_id: null, registration_status: null, payment_method: null, amount_cents: null, currency: "MXN",
});

const PAIRS = [
  pair("pa1", "Ana / Beto", "t-1", "j1", "j2", "Suma 11"),
  pair("pa2", "Cora / Dani", "t-1", "j3", "j4", "Suma 11"),
  pair("pa3", "Eli / Fer", "t-1", "j5", "j6", "Suma 12"),
  pair("pa4", "Gaby / Hugo", "t-1", "j7", "j8", "Suma 9"),
  pair("pb1", "Eli / Fer", "t-2", "j5", "j6", "Suma 12"),
  pair("pb2", "Cora / Dani", "t-2", "j3", "j4", "Suma 11"),
  pair("pb3", "Ana / Beto", "t-2", "j1", "j2", "Suma 11"),
  pair("pc1", "Ana / Beto", "t-3", "j1", "j2", "Suma 11"),
  pair("pc2", "Cora / Dani", "t-3", "j3", "j4", "Suma 11"),
];

const nameOf = (id: string) => PAIRS.find((p) => p.id === id)?.name ?? id;
let mid = 0;
const M = (
  t: string, round: string, a: string, b: string, winner: "a" | "b",
  sets: Array<{ a: number; b: number }> = [{ a: 6, b: 3 }, { a: 6, b: 4 }],
  when = "2026-03-15T18:00:00Z",
) => ({
  id: `m-${++mid}`, tournament_id: t, tournament_name: TOURNAMENTS.find((x) => x.id === t)?.name,
  category_name: PAIRS.find((p) => p.id === a)?.category_name,
  round, court_name: "Cancha 1", scheduled_at: when, status: "finished", winner, sets,
  side_a: { pair_id: a, pair_name: nameOf(a) },
  side_b: { pair_id: b, pair_name: nameOf(b) },
});

const MATCHES = [
  // t-1 grupos: Ana/Beto 2-0 · Cora/Dani 1-1 · Eli/Fer 1-1 · Gaby/Hugo 0-2
  M("t-1", "Grupo A · J1", "pa1", "pa3", "a"),
  M("t-1", "Grupo A · J1", "pa2", "pa4", "a"),
  M("t-1", "Grupo A · J2", "pa1", "pa4", "a"),
  M("t-1", "Grupo A · J2", "pa2", "pa3", "b", [{ a: 4, b: 6 }, { a: 6, b: 3 }, { a: 5, b: 7 }]),
  M("t-1", "Grupo A · J3", "pa3", "pa4", "a"),
  M("t-1", "Grupo A · J3", "pa1", "pa2", "b", [{ a: 6, b: 2 }, { a: 3, b: 6 }, { a: 4, b: 6 }]),
  // t-1 llave: semis + final (campeón Eli/Fer)
  M("t-1", "Semifinales · r1-m1", "pa1", "pa3", "b", [{ a: 3, b: 6 }, { a: 4, b: 6 }], "2026-03-16T12:00:00Z"),
  M("t-1", "Semifinales · r1-m2", "pa2", "pa4", "a", undefined as never, "2026-03-16T12:00:00Z"),
  M("t-1", "Final · r2-m1", "pa3", "pa2", "a", [{ a: 6, b: 4 }, { a: 3, b: 6 }, { a: 7, b: 5 }], "2026-03-16T18:00:00Z"),
  // t-2: final directa (llave chica), campeón Eli/Fer otra vez
  M("t-2", "Semifinales · r1-m1", "pb1", "pb3", "a", undefined as never, "2026-04-09T12:00:00Z"),
  M("t-2", "Semifinales · r1-m2", "pb2", "pb3", "a", undefined as never, "2026-04-09T12:30:00Z"),
  M("t-2", "Final · r2-m1", "pb1", "pb2", "a", [{ a: 6, b: 1 }, { a: 6, b: 2 }], "2026-04-09T18:00:00Z"),
  // t-3 (en curso): grupos; uno en vivo ahora y uno programado a futuro
  M("t-3", "Grupo A · J1", "pc1", "pc2", "a", undefined as never, "2026-10-20T01:00:00Z"),
  {
    id: "m-live-1", tournament_id: "t-3", tournament_name: "LIGA16 4TA EDICIÓN",
    category_name: "Suma 11", round: "Grupo A · J4", court_name: "Cancha 1",
    scheduled_at: "2026-11-04T01:00:00Z", status: "live", winner: null,
    sets: [{ a: 4, b: 2 }],
    side_a: { pair_id: "pc1", pair_name: nameOf("pc1") },
    side_b: { pair_id: "pc2", pair_name: nameOf("pc2") },
  },
];

// Teams (vista de parejas): una por nombre de pareja, con entries por torneo.
function teamOf(name: string, p1: string, p2: string, division: string, sex: string, entries: Array<{ pair_id: string; tournament_id: string }>, stats: { position: number; points: number; played: number; won: number } = { position: 0, points: 0, played: 0, won: 0 }) {
  const pl1 = PLAYERS.find((p) => p.id === p1)!;
  const pl2 = PLAYERS.find((p) => p.id === p2)!;
  return {
    id: entries[entries.length - 1].pair_id, slug: name.toLowerCase().replace(/[^a-z]+/g, "-"),
    name, crest_url: null, city: "Hermosillo", club_id: "c-1", division, category_name: division, sex,
    player1: { player_id: p1, name: pl1.display_name, level: pl1.official_level ?? pl1.declared_level },
    player2: { player_id: p2, name: pl2.display_name, level: pl2.official_level ?? pl2.declared_level },
    position: stats.position, points: stats.points, played: stats.played, won: stats.won, lost: stats.played - stats.won, sets_for: 0, sets_against: 0, titles: 0,
    entries: entries.map((e) => ({
      pair_id: e.pair_id, tournament_id: e.tournament_id,
      tournament_name: TOURNAMENTS.find((t) => t.id === e.tournament_id)?.name ?? "",
      scoring: null, semifinal_slots: 4,
    })),
  };
}

const TEAMS = [
  teamOf("Ana / Beto", "j1", "j2", "3ra", "X", [{ pair_id: "pa1", tournament_id: "t-1" }, { pair_id: "pb3", tournament_id: "t-2" }, { pair_id: "pc1", tournament_id: "t-3" }], { position: 1, points: 80.0, played: 5, won: 4 }),
  teamOf("Cora / Dani", "j3", "j4", "3ra", "X", [{ pair_id: "pa2", tournament_id: "t-1" }, { pair_id: "pb2", tournament_id: "t-2" }, { pair_id: "pc2", tournament_id: "t-3" }], { position: 2, points: 63.9, played: 5, won: 3 }),
  teamOf("Eli / Fer", "j5", "j6", "2da", "X", [{ pair_id: "pa3", tournament_id: "t-1" }, { pair_id: "pb1", tournament_id: "t-2" }], { position: 1, points: 73.8, played: 4, won: 3 }),
  teamOf("Gaby / Hugo", "j7", "j8", "4ta", "X", [{ pair_id: "pa4", tournament_id: "t-1" }], { position: 1, points: 61.3, played: 4, won: 2 }),
];

function recordOf(playerId: string) {
  const recs = buildPlayerRecords(MATCHES as never, PAIRS as never, PLAYERS as never);
  return recs.get(playerId) ?? null;
}

const real: Record<string, unknown> = {
  async listTournaments() {
    await new Promise((r) => setTimeout(r, 60));
    return TOURNAMENTS;
  },
  async listTeams() { return TEAMS; },
  async listPlayers() { return PLAYERS; },
  async listAllPairs() { return PAIRS; },
  async listRecentMatches() { return MATCHES; },
  async listNews() {
    return [
      { id: "n-1", tag: "Resultados", title: "Ana y Beto se llevan la tercera fecha en Caborca", excerpt: "La pareja líder de Suma 11 ganó sus dos partidos del fin de semana y estira la ventaja en la tabla.", image_url: null, published_at: "2026-10-28T15:00:00Z" },
      { id: "n-2", tag: "Convocatoria", title: "Copa Diciembre: inscripciones abiertas", excerpt: "El último torneo del año se juega del 5 al 7 de diciembre. Cierran inscripciones el 28 de noviembre.", image_url: null, published_at: "2026-10-25T15:00:00Z" },
      { id: "n-3", tag: "Circuito", title: "Nueva sede confirmada para enero", excerpt: "El circuito suma una segunda ciudad para la temporada 2027. Detalles en la próxima asamblea.", image_url: null, published_at: "2026-10-20T15:00:00Z" },
    ];
  },
  async getTournament(slug: string) { return TOURNAMENTS.find(t=>t.slug===slug) ?? null; },
  async getTournamentPairs(id: string) {return PAIRS.filter(p=>p.tournament_id===id);},
  async getTournamentMatches(id: string) {return MATCHES.filter(m=>m.tournament_id===id);},
  async getTournamentCategories(id: string) {return [{id:`cat-${id}`,tournament_id:id,name:"Suma 11",sex:"X",division:"3ra"}];},
  async getTeam(slug: string) {return TEAMS.find(t=>t.slug===slug)??null;},
  async listClubs(){return [{id:"c-1",name:"Caborca Pádel",city:"Caborca",state:"Sonora",address:"Sede de prueba",description:"Club de prueba",photo_url:null,phone:null}];},
  async listCourts(){return [{id:"court-1",club_id:"c-1",name:"Cancha 1",surface:"Sintética",is_active:true}];},
  async listSponsors() { return []; },
  async listPlayerDivisions() {
    return Object.fromEntries(PLAYERS.map((p) => [p.id, TEAMS.find((t) => t.player1.player_id === p.id || t.player2.player_id === p.id)?.division ?? "3ra"]));
  },
  async getPlayer(id: string) { return PLAYERS.find((p) => p.id === id) ?? null; },
  async getPlayerCard(id: string) {
    const p = PLAYERS.find((x) => x.id === id);
    if (!p) return null;
    const r = recordOf(id);
    return {
      player_id: id, slug: p.username, titles: 0,
      played: r?.played ?? 0, won: r?.won ?? 0,
      partner: null, recent_results: r?.form ?? [], trend: r?.trend ?? [],
      division: TEAMS.find((t) => t.player1.player_id === id || t.player2.player_id === id)?.division ?? null,
    };
  },
  async getPlayerRecord(id: string) { return recordOf(id); },
};

// El layout admin consulta otros datos (alertas, etc.): cualquier método no
// simulado responde una lista vacía en vez de tronar.
export const db = new Proxy(real, {
  get(target, prop) {
    if (prop in target) return target[prop as string];
    return async () => [];
  },
});
