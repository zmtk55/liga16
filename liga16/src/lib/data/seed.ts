// Datos semilla realistas de Liga16 (modo demo).
import type {
  Club, League, Match, NewsItem, Pair, PlayerCard, PlayerProfile,
  RankingEntry, RankingEvent, Sponsor, Team, Tournament, TournamentCategory,
} from '@/types';

export const clubs: Club[] = [
  { id: 'club-1', name: 'Club Pádel Reforma', slug: 'club-padel-reforma', city: 'Ciudad de México', state: 'CDMX', address: 'Av. Reforma 245, Col. Juárez', photo_url: null, phone: '+52 55 1234 0001', description: 'El único padel de Liga16. 8 canchas de cristal, vestíbulo con TV en vivo y terraza.' },
];

export const tournaments: Tournament[] = [
  { id: 't-1', slug: 'copa-liga16-apertura-2026', name: 'Copa Liga16 Apertura 2026', cover_url: null, club_id: 'club-1', club_name: 'Club Pádel Reforma', city: 'Ciudad de México', state: 'CDMX', start_date: '2026-10-09', end_date: '2026-10-11', registration_deadline: '2026-10-02', status: 'registration_open', modality: 'pairs', format: 'groups_knockout', organizer_id: 'org-1', price_cents: 80000, currency: 'MXN', rules_summary: 'Grupos de 4 + eliminación directa. Mejor de 3 sets. Desempate: diferencia de sets, luego juegos, luego enfrentamiento directo.', description: 'Primer torneo oficial del padel Reforma. Puntos dobles para el ranking de temporada.' },
  { id: 't-2', slug: 'reforma-master-500', name: 'Reforma Master 500', cover_url: null, club_id: 'club-1', club_name: 'Club Pádel Reforma', city: 'Ciudad de México', state: 'CDMX', start_date: '2026-10-23', end_date: '2026-10-25', registration_deadline: '2026-10-16', status: 'registration_open', modality: 'pairs', format: 'single_elimination', organizer_id: 'org-1', price_cents: 100000, currency: 'MXN', rules_summary: 'Eliminación directa con consolación. Mejor de 3 sets con super tie-break.', description: 'Categoría 500 puntos. Bolsa de premios y trofeos para campeones y finalistas.' },
  { id: 't-3', slug: 'reforma-relampago-2026', name: 'Reforma Relámpago 2026', cover_url: null, club_id: 'club-1', club_name: 'Club Pádel Reforma', city: 'Ciudad de México', state: 'CDMX', start_date: '2026-09-26', end_date: '2026-09-26', registration_deadline: '2026-09-22', status: 'in_progress', modality: 'pairs', format: 'americano', organizer_id: 'org-1', price_cents: 40000, currency: 'MXN', rules_summary: 'Formato americano: todos contra todos en rondas rotativas. Gana la pareja con más puntos.', description: 'Un día, formato americano y ambiente de club. Ideal para debutar en el padel.' },
  { id: 't-4', slug: 'reforma-challenger-250', name: 'Reforma Challenger 250', cover_url: null, club_id: 'club-1', club_name: 'Club Pádel Reforma', city: 'Ciudad de México', state: 'CDMX', start_date: '2026-11-13', end_date: '2026-11-15', registration_deadline: '2026-11-06', status: 'published', modality: 'pairs', format: 'groups_knockout', organizer_id: 'org-1', price_cents: 70000, currency: 'MXN', rules_summary: 'Grupos + eliminación. Categorías 4ª a 6ª.', description: 'Primer torneo de la segunda vuelta del padel Reforma. Inscripciones abren el 1 de octubre.' },
  { id: 't-5', slug: 'copa-independencia-2026', name: 'Copa Independencia 2026', cover_url: null, club_id: 'club-1', club_name: 'Club Pádel Reforma', city: 'Ciudad de México', state: 'CDMX', start_date: '2026-09-11', end_date: '2026-09-13', registration_deadline: '2026-09-04', status: 'finished', modality: 'pairs', format: 'groups_knockout', organizer_id: 'org-1', price_cents: 80000, currency: 'MXN', rules_summary: 'Grupos de 4 + eliminación directa.', description: 'Torneo inaugural de la temporada 2026-27. 48 parejas, 4 categorías.' },
];

export const categories: TournamentCategory[] = [
  { id: 'cat-1', tournament_id: 't-1', name: '4ª Masculino', sex: 'M', min_level: 4.0, max_level: 4.9, max_pairs: 16, registered_pairs: 14, price_cents: 80000 },
  { id: 'cat-2', tournament_id: 't-1', name: '5ª Masculino', sex: 'M', min_level: 3.0, max_level: 3.9, max_pairs: 16, registered_pairs: 16, price_cents: 80000 },
  { id: 'cat-3', tournament_id: 't-1', name: '4ª Femenino', sex: 'F', min_level: 4.0, max_level: 4.9, max_pairs: 12, registered_pairs: 9, price_cents: 80000 },
  { id: 'cat-4', tournament_id: 't-1', name: 'Mixto Open', sex: 'X', min_level: null, max_level: null, max_pairs: 12, registered_pairs: 7, price_cents: 70000 },
  { id: 'cat-5', tournament_id: 't-2', name: '3ª Masculino', sex: 'M', min_level: 5.0, max_level: 5.9, max_pairs: 16, registered_pairs: 11, price_cents: 100000 },
  { id: 'cat-6', tournament_id: 't-2', name: '4ª Masculino', sex: 'M', min_level: 4.0, max_level: 4.9, max_pairs: 24, registered_pairs: 19, price_cents: 100000 },
  { id: 'cat-7', tournament_id: 't-3', name: 'Open Masculino', sex: 'M', min_level: null, max_level: null, max_pairs: 24, registered_pairs: 20, price_cents: 40000 },
  { id: 'cat-8', tournament_id: 't-3', name: 'Open Femenino', sex: 'F', min_level: null, max_level: null, max_pairs: 16, registered_pairs: 12, price_cents: 40000 },
  { id: 'cat-9', tournament_id: 't-5', name: '4ª Masculino', sex: 'M', min_level: 4.0, max_level: 4.9, max_pairs: 16, registered_pairs: 16, price_cents: 80000 },
  { id: 'cat-10', tournament_id: 't-5', name: '5ª Masculino', sex: 'M', min_level: 3.0, max_level: 3.9, max_pairs: 16, registered_pairs: 16, price_cents: 80000 },
];

export const players: PlayerProfile[] = [
  { id: 'p-1', user_id: 'u-1', display_name: 'Diego Fuentes', username: 'diegofuentes', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'M', declared_level: 4.5, official_level: 4.6, dominant_hand: 'right', preferred_position: 'drive', bio: 'Compitiendo en el padel Reforma desde 2024.', is_public: true, role: 'player' },
  { id: 'p-2', user_id: 'u-2', display_name: 'Martín Rojas', username: 'martinrojas', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'M', declared_level: 4.5, official_level: 4.5, dominant_hand: 'left', preferred_position: 'reves', bio: null, is_public: true, role: 'player' },
  { id: 'p-3', user_id: 'u-3', display_name: 'Sofía Camacho', username: 'sofiacamacho', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'F', declared_level: 5.0, official_level: 5.2, dominant_hand: 'right', preferred_position: 'reves', bio: 'Buscando pareja para la liga de otoño en Reforma.', is_public: true, role: 'player' },
  { id: 'p-4', user_id: 'u-4', display_name: 'Andrés Valle', username: 'andresvalle', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'M', declared_level: 4.0, official_level: 4.1, dominant_hand: 'right', preferred_position: 'both', bio: null, is_public: true, role: 'player' },
  { id: 'p-5', user_id: 'u-5', display_name: 'Lucía Herrera', username: 'luciaherrera', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'F', declared_level: 4.0, official_level: 4.2, dominant_hand: 'right', preferred_position: 'drive', bio: null, is_public: true, role: 'player' },
  { id: 'p-6', user_id: 'u-6', display_name: 'Emilio Garza', username: 'emiliogarza', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'M', declared_level: 5.5, official_level: 5.4, dominant_hand: 'right', preferred_position: 'drive', bio: 'Capitán de Reforma Smash.', is_public: true, role: 'player' },
  { id: 'p-7', user_id: 'u-7', display_name: 'Valeria Montes', username: 'valeriamontes', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'F', declared_level: 3.5, official_level: 3.6, dominant_hand: 'left', preferred_position: 'reves', bio: null, is_public: true, role: 'player' },
  { id: 'p-8', user_id: 'u-8', display_name: 'Javier Quintana', username: 'javierquintana', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'M', declared_level: 4.0, official_level: 4.0, dominant_hand: 'right', preferred_position: 'drive', bio: null, is_public: true, role: 'player' },
  { id: 'p-9', user_id: 'u-9', display_name: 'Fernando Lira', username: 'fernandolira', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'M', declared_level: 5.0, official_level: 5.1, dominant_hand: 'right', preferred_position: 'reves', bio: null, is_public: true, role: 'player' },
  { id: 'p-10', user_id: 'u-10', display_name: 'Paola Suárez', username: 'paolasuarez', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'F', declared_level: 4.5, official_level: 4.7, dominant_hand: 'right', preferred_position: 'both', bio: null, is_public: true, role: 'player' },
  { id: 'p-11', user_id: 'u-11', display_name: 'Ricardo Anaya', username: 'ricardoanaya', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'M', declared_level: 3.5, official_level: 3.4, dominant_hand: 'right', preferred_position: 'drive', bio: null, is_public: true, role: 'player' },
  { id: 'p-12', user_id: 'u-12', display_name: 'Daniela Cervantes', username: 'danielacervantes', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'F', declared_level: 4.0, official_level: 4.0, dominant_hand: 'right', preferred_position: 'reves', bio: null, is_public: true, role: 'player' },
];

export const rankings: RankingEntry[] = [
  { position: 1, player_id: 'p-3', player_name: 'Sofía Camacho', city: 'Ciudad de México', sex: 'F', level: 5.2, points: 4120, delta: 1, played: 34, won: 27 },
  { position: 2, player_id: 'p-6', player_name: 'Emilio Garza', city: 'Ciudad de México', sex: 'M', level: 5.4, points: 3985, delta: -1, played: 31, won: 24 },
  { position: 3, player_id: 'p-9', player_name: 'Fernando Lira', city: 'Ciudad de México', sex: 'M', level: 5.1, points: 3740, delta: 2, played: 29, won: 22 },
  { position: 4, player_id: 'p-1', player_name: 'Diego Fuentes', city: 'Ciudad de México', sex: 'M', level: 4.6, points: 3410, delta: 0, played: 33, won: 22 },
  { position: 5, player_id: 'p-10', player_name: 'Paola Suárez', city: 'Ciudad de México', sex: 'F', level: 4.7, points: 3260, delta: 3, played: 26, won: 19 },
  { position: 6, player_id: 'p-2', player_name: 'Martín Rojas', city: 'Ciudad de México', sex: 'M', level: 4.5, points: 3120, delta: -2, played: 30, won: 19 },
  { position: 7, player_id: 'p-5', player_name: 'Lucía Herrera', city: 'Ciudad de México', sex: 'F', level: 4.2, points: 2890, delta: 1, played: 24, won: 15 },
  { position: 8, player_id: 'p-4', player_name: 'Andrés Valle', city: 'Ciudad de México', sex: 'M', level: 4.1, points: 2735, delta: -1, played: 27, won: 14 },
  { position: 9, player_id: 'p-12', player_name: 'Daniela Cervantes', city: 'Ciudad de México', sex: 'F', level: 4.0, points: 2510, delta: 4, played: 20, won: 13 },
  { position: 10, player_id: 'p-8', player_name: 'Javier Quintana', city: 'Ciudad de México', sex: 'M', level: 4.0, points: 2400, delta: 0, played: 22, won: 12 },
  { position: 11, player_id: 'p-11', player_name: 'Ricardo Anaya', city: 'Ciudad de México', sex: 'M', level: 3.4, points: 1980, delta: -3, played: 21, won: 9 },
  { position: 12, player_id: 'p-7', player_name: 'Valeria Montes', city: 'Ciudad de México', sex: 'F', level: 3.6, points: 1875, delta: 2, played: 18, won: 9 },
];

export const rankingEvents: RankingEvent[] = [
  { id: 're-1', player_id: 'p-1', tournament_id: 't-5', points: 250, reason: 'Campeón 4ª Masculino — Copa Independencia 2026', created_at: '2026-09-13T20:00:00Z' },
  { id: 're-2', player_id: 'p-2', tournament_id: 't-5', points: 250, reason: 'Campeón 4ª Masculino — Copa Independencia 2026', created_at: '2026-09-13T20:00:00Z' },
  { id: 're-3', player_id: 'p-9', tournament_id: 't-5', points: 150, reason: 'Finalista 4ª Masculino — Copa Independencia 2026', created_at: '2026-09-13T20:00:00Z' },
];

export const playerCards: Record<string, PlayerCard> = Object.fromEntries(
  players.map((p, i) => [
    p.id,
    {
      player_id: p.id,
      slug: p.username,
      titles: [3, 2, 5, 1, 1, 4, 0, 0, 2, 2, 0, 1][i] ?? 0,
      record: { played: rankings[i]?.played ?? 12, won: rankings[i]?.won ?? 6 },
      frequent_partner: i % 2 === 0 ? players[(i + 1) % players.length].display_name : null,
      recent_results: ['G 6-4 6-3', 'P 4-6 6-7', 'G 6-2 6-1'],
      trend: [3, 1, 2, 0, -1, 1, 2].map((v) => v + (i % 3)),
    },
  ]),
);

export const teams: Team[] = [
  { id: 'team-1', slug: 'reforma-smash', name: 'Reforma Smash', crest_url: null, city: 'Ciudad de México', captain_name: 'Emilio Garza',
    members: [
      { player_id: 'p-6', name: 'Emilio Garza', level: 5.4 },
      { player_id: 'p-3', name: 'Sofía Camacho', level: 5.2 },
      { player_id: 'p-10', name: 'Paola Suárez', level: 4.7 },
    ],
    category: 'Primera División', record: { played: 8, won: 7, lost: 1 }, position: 1, titles: 2 },
  { id: 'team-2', slug: 'reforma-femenino', name: 'Reforma Femenino', crest_url: null, city: 'Ciudad de México', captain_name: 'Paola Suárez',
    members: [
      { player_id: 'p-5', name: 'Lucía Herrera', level: 4.2 },
      { player_id: 'p-7', name: 'Valeria Montes', level: 3.6 },
      { player_id: 'p-12', name: 'Daniela Cervantes', level: 4.0 },
    ],
    category: 'Primera División', record: { played: 8, won: 6, lost: 2 }, position: 2, titles: 1 },
  { id: 'team-3', slug: 'reforma-junior', name: 'Reforma Junior', crest_url: null, city: 'Ciudad de México', captain_name: 'Diego Fuentes',
    members: [
      { player_id: 'p-1', name: 'Diego Fuentes', level: 4.6 },
      { player_id: 'p-2', name: 'Martín Rojas', level: 4.5 },
      { player_id: 'p-11', name: 'Ricardo Anaya', level: 3.4 },
    ],
    category: 'Segunda División', record: { played: 8, won: 5, lost: 3 }, position: 1, titles: 0 },
  { id: 'team-4', slug: 'reforma-abierta', name: 'Reforma Abierta', crest_url: null, city: 'Ciudad de México', captain_name: 'Fernando Lira',
    members: [
      { player_id: 'p-9', name: 'Fernando Lira', level: 5.1 },
      { player_id: 'p-4', name: 'Andrés Valle', level: 4.1 },
      { player_id: 'p-8', name: 'Javier Quintana', level: 4.0 },
    ],
    category: 'Segunda División', record: { played: 8, won: 4, lost: 4 }, position: 2, titles: 0 },
];

export const leagues: League[] = [
  { id: 'lg-1', slug: 'liga-reforma-2026-27', name: 'Liga Reforma 2026-27', season: 'Temporada 2026-27', city: 'Ciudad de México', format: 'round_robin', status: 'active',
    divisions: [
      { name: 'Primera División', teams: 8 },
      { name: 'Segunda División', teams: 10 },
    ],
    rules_summary: 'Todos contra todos por jornada en el padel Reforma. 2 puntos por victoria. Ascienden 2, descienden 2.' },
];

export const pairs: Pair[] = [
  { id: 'pair-1', tournament_id: 't-3', category_id: 'cat-7', name: 'Fuentes / Rojas', player1_id: 'p-1', player2_id: 'p-2', seed: 1 },
  { id: 'pair-2', tournament_id: 't-3', category_id: 'cat-7', name: 'Lira / Valle', player1_id: 'p-9', player2_id: 'p-4', seed: 2 },
  { id: 'pair-3', tournament_id: 't-3', category_id: 'cat-7', name: 'Garza / Anaya', player1_id: 'p-6', player2_id: 'p-11', seed: 3 },
  { id: 'pair-4', tournament_id: 't-3', category_id: 'cat-7', name: 'Quintana / Cervantes', player1_id: 'p-8', player2_id: 'p-12', seed: 4 },
  { id: 'pair-5', tournament_id: 't-3', category_id: 'cat-8', name: 'Camacho / Suárez', player1_id: 'p-3', player2_id: 'p-10', seed: 1 },
  { id: 'pair-6', tournament_id: 't-3', category_id: 'cat-8', name: 'Herrera / Montes', player1_id: 'p-5', player2_id: 'p-7', seed: 2 },
  { id: 'pair-7', tournament_id: 't-1', category_id: 'cat-1', name: 'Fuentes / Rojas', player1_id: 'p-1', player2_id: 'p-2', seed: null },
  { id: 'pair-8', tournament_id: 't-1', category_id: 'cat-1', name: 'Lira / Valle', player1_id: 'p-9', player2_id: 'p-4', seed: null },
];

export const matches: Match[] = [
  { id: 'm-1', tournament_id: 't-3', tournament_name: 'Reforma Relámpago 2026', category_name: 'Open Masculino',
    round: 'Ronda 3', court_name: 'Cancha 1', scheduled_at: '2026-09-26T18:00:00Z', status: 'live',
    side_a: { pair_id: 'pair-1', pair_name: 'Fuentes / Rojas' },
    side_b: { pair_id: 'pair-2', pair_name: 'Lira / Valle' },
    sets: [{ a: 6, b: 4 }, { a: 3, b: 4 }], winner: null },
  { id: 'm-2', tournament_id: 't-3', tournament_name: 'Reforma Relámpago 2026', category_name: 'Open Femenino',
    round: 'Ronda 3', court_name: 'Cancha 2', scheduled_at: '2026-09-26T18:00:00Z', status: 'live',
    side_a: { pair_id: 'pair-5', pair_name: 'Camacho / Suárez' },
    side_b: { pair_id: 'pair-6', pair_name: 'Herrera / Montes' },
    sets: [{ a: 7, b: 5 }], winner: null },
  { id: 'm-3', tournament_id: 't-5', tournament_name: 'Copa Independencia 2026', category_name: '4ª Masculino',
    round: 'Final', court_name: 'Cancha Central', scheduled_at: '2026-09-13T19:00:00Z', status: 'finished',
    side_a: { pair_id: 'pair-1', pair_name: 'Fuentes / Rojas' },
    side_b: { pair_id: null, pair_name: 'Lira / Osuna' },
    sets: [{ a: 6, b: 3 }, { a: 4, b: 6 }, { a: 7, b: 6 }], winner: 'a' },
  { id: 'm-4', tournament_id: 't-5', tournament_name: 'Copa Independencia 2026', category_name: '5ª Masculino',
    round: 'Final', court_name: 'Cancha 2', scheduled_at: '2026-09-13T17:00:00Z', status: 'finished',
    side_a: { pair_id: null, pair_name: 'Cortés / Ibarra' },
    side_b: { pair_id: null, pair_name: 'Vega / Saldivar' },
    sets: [{ a: 2, b: 6 }, { a: 3, b: 6 }], winner: 'b' },
  { id: 'm-5', tournament_id: 't-3', tournament_name: 'Reforma Relámpago 2026', category_name: 'Open Masculino',
    round: 'Ronda 4', court_name: 'Cancha 1', scheduled_at: '2026-09-26T19:30:00Z', status: 'scheduled',
    side_a: { pair_id: 'pair-3', pair_name: 'Garza / Anaya' },
    side_b: { pair_id: 'pair-4', pair_name: 'Quintana / Cervantes' },
    sets: [], winner: null },
  { id: 'm-6', tournament_id: 't-3', tournament_name: 'Reforma Relámpago 2026', category_name: 'Open Femenino',
    round: 'Ronda 4', court_name: 'Cancha 3', scheduled_at: '2026-09-26T19:30:00Z', status: 'scheduled',
    side_a: { pair_id: 'pair-5', pair_name: 'Camacho / Suárez' },
    side_b: { pair_id: null, pair_name: 'Cervantes / Robles' },
    sets: [], winner: null },
];

export const news: NewsItem[] = [
  { id: 'n-1', title: 'Fuentes y Rojas levantan la Copa Independencia', excerpt: 'La dupla del Reforma remontó el tercer set 7-6 ante Lira/Osuna y se llevó 250 puntos de ranking.', image_url: null, published_at: '2026-09-14', tag: 'Resultados' },
  { id: 'n-2', title: 'La Liga Reforma ya tiene calendario completo', excerpt: 'Primera y Segunda División jugarán 14 jornadas entre octubre y mayo en el padel Reforma.', image_url: null, published_at: '2026-09-18', tag: 'Ligas' },
  { id: 'n-3', title: 'Reforma Challenger 250 abre inscripciones', excerpt: 'El torneo de noviembre será la segunda cita de la temporada en el único padel de Liga16.', image_url: null, published_at: '2026-09-20', tag: 'Torneos' },
];

export const sponsors: Sponsor[] = [
  { id: 's-1', name: 'Volt Padel', logo_url: null, website: 'https://example.com', tier: 'principal' },
  { id: 's-2', name: 'Aqua Natura', logo_url: null, website: 'https://example.com', tier: 'oro' },
  { id: 's-3', name: 'Kinesio Sport', logo_url: null, website: 'https://example.com', tier: 'plata' },
  { id: 's-4', name: 'Taco Tour', logo_url: null, website: 'https://example.com', tier: 'bronce' },
];
