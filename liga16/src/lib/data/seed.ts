// Datos semilla realistas de Liga16 (modo demo).
import type {
  Club, League, Match, NewsItem, Pair, PlayerCard, PlayerProfile,
  Sponsor, Team, Tournament, TournamentCategory,
} from '@/types';

export const clubs: Club[] = [
  { id: 'club-1', name: 'Club Pádel Reforma', slug: 'club-padel-reforma', city: 'Ciudad de México', state: 'CDMX', address: 'Av. Reforma 245, Col. Juárez', photo_url: null, phone: '+52 55 1234 0001', description: 'El único padel de Liga16. 8 canchas de cristal, vestíbulo con TV en vivo y terraza.' },
];

export const tournaments: Tournament[] = [
  { id: 't-1', slug: 'copa-liga16-apertura-2026', name: 'Copa Liga16 Apertura 2026', cover_url: null, club_id: 'club-1', club_name: 'Club Pádel Reforma', city: 'Ciudad de México', state: 'CDMX', start_date: '2026-10-09', end_date: '2026-10-11', registration_deadline: '2026-10-02', status: 'registration_open', modality: 'pairs', format: 'groups_knockout', organizer_id: 'org-1', price_cents: 80000, currency: 'MXN', semifinal_slots: 4, rules_summary: 'Grupos de 4 + eliminación directa. Mejor de 3 sets. Desempate: diferencia de sets, luego juegos, luego enfrentamiento directo.', description: 'Primer torneo oficial del padel Reforma. Puntos dobles para el ranking de temporada.' },
  { id: 't-2', slug: 'reforma-master-500', name: 'Reforma Master 500', cover_url: null, club_id: 'club-1', club_name: 'Club Pádel Reforma', city: 'Ciudad de México', state: 'CDMX', start_date: '2026-10-23', end_date: '2026-10-25', registration_deadline: '2026-10-16', status: 'registration_open', modality: 'pairs', format: 'single_elimination', organizer_id: 'org-1', price_cents: 100000, currency: 'MXN', semifinal_slots: 4, rules_summary: 'Eliminación directa con consolación. Mejor de 3 sets con super tie-break.', description: 'Categoría 500 puntos. Bolsa de premios y trofeos para campeones y finalistas.' },
  { id: 't-3', slug: 'reforma-relampago-2026', name: 'Reforma Relámpago 2026', cover_url: null, club_id: 'club-1', club_name: 'Club Pádel Reforma', city: 'Ciudad de México', state: 'CDMX', start_date: '2026-09-26', end_date: '2026-09-26', registration_deadline: '2026-09-22', status: 'in_progress', modality: 'pairs', format: 'americano', organizer_id: 'org-1', price_cents: 40000, currency: 'MXN', semifinal_slots: 4, rules_summary: 'Formato americano: todos contra todos en rondas rotativas. Gana la pareja con más puntos.', description: 'Un día, formato americano y ambiente de club. Ideal para debutar en el padel.' },
  { id: 't-4', slug: 'reforma-challenger-250', name: 'Reforma Challenger 250', cover_url: null, club_id: 'club-1', club_name: 'Club Pádel Reforma', city: 'Ciudad de México', state: 'CDMX', start_date: '2026-11-13', end_date: '2026-11-15', registration_deadline: '2026-11-06', status: 'published', modality: 'pairs', format: 'groups_knockout', organizer_id: 'org-1', price_cents: 70000, currency: 'MXN', semifinal_slots: 4, rules_summary: 'Grupos + eliminación. Categorías 4ta a 6ta y Novatos.', description: 'Primer torneo de la segunda vuelta del padel Reforma. Inscripciones abren el 1 de octubre.' },
  { id: 't-5', slug: 'copa-independencia-2026', name: 'Copa Independencia 2026', cover_url: null, club_id: 'club-1', club_name: 'Club Pádel Reforma', city: 'Ciudad de México', state: 'CDMX', start_date: '2026-09-11', end_date: '2026-09-13', registration_deadline: '2026-09-04', status: 'finished', modality: 'pairs', format: 'groups_knockout', organizer_id: 'org-1', price_cents: 80000, currency: 'MXN', semifinal_slots: 4, rules_summary: 'Grupos de 4 + eliminación directa.', description: 'Torneo inaugural de la temporada 2026-27. 48 parejas, 4 categorías.' },
];

export const categories: TournamentCategory[] = [
  { id: 'cat-1', tournament_id: 't-1', name: '4ta Varonil', sex: 'M', min_level: 4.0, max_level: 4.9, max_pairs: 16, registered_pairs: 14, price_cents: 80000 },
  { id: 'cat-2', tournament_id: 't-1', name: '5ta Varonil', sex: 'M', min_level: 3.0, max_level: 3.9, max_pairs: 16, registered_pairs: 16, price_cents: 80000 },
  { id: 'cat-3', tournament_id: 't-1', name: '4ta Femenil', sex: 'F', min_level: 4.0, max_level: 4.9, max_pairs: 12, registered_pairs: 9, price_cents: 80000 },
  { id: 'cat-4', tournament_id: 't-1', name: 'Novatos Mixto', sex: 'X', min_level: null, max_level: null, max_pairs: 12, registered_pairs: 7, price_cents: 70000 },
  { id: 'cat-5', tournament_id: 't-2', name: '3ra Varonil', sex: 'M', min_level: 5.0, max_level: 5.9, max_pairs: 16, registered_pairs: 11, price_cents: 100000 },
  { id: 'cat-6', tournament_id: 't-2', name: '4ta Varonil', sex: 'M', min_level: 4.0, max_level: 4.9, max_pairs: 24, registered_pairs: 19, price_cents: 100000 },
  { id: 'cat-7', tournament_id: 't-3', name: 'Novatos Varonil', sex: 'M', min_level: null, max_level: null, max_pairs: 24, registered_pairs: 20, price_cents: 40000 },
  { id: 'cat-8', tournament_id: 't-3', name: 'Novatos Femenil', sex: 'F', min_level: null, max_level: null, max_pairs: 16, registered_pairs: 12, price_cents: 40000 },
  { id: 'cat-9', tournament_id: 't-5', name: '4ta Varonil', sex: 'M', min_level: 4.0, max_level: 4.9, max_pairs: 16, registered_pairs: 16, price_cents: 80000 },
  { id: 'cat-10', tournament_id: 't-5', name: '5ta Varonil', sex: 'M', min_level: 3.0, max_level: 3.9, max_pairs: 16, registered_pairs: 16, price_cents: 80000 },
];

export const players: PlayerProfile[] = [
  { id: 'p-1', user_id: 'u-1', display_name: 'Diego Fuentes', username: 'diegofuentes', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'M', declared_level: 4.5, official_level: 4.6, dominant_hand: 'right', preferred_position: 'drive', bio: 'Compitiendo en el padel Reforma desde 2024.', is_public: true, role: 'player' },
  { id: 'p-2', user_id: 'u-2', display_name: 'Martín Rojas', username: 'martinrojas', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'M', declared_level: 4.5, official_level: 4.5, dominant_hand: 'left', preferred_position: 'reves', bio: null, is_public: true, role: 'player' },
  // p-3 representa un jugador AUTORREGISTRADO y todavía sin verificar, para que la
  // cola del admin tenga un caso real que revisar. El resto llevan 'verificado'
  // explícito: son los que ya estaban antes de que existiera el autoregistro.
  { id: 'p-3', user_id: 'u-3', display_name: 'Sofía Camacho', username: 'sofiacamacho', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'F', declared_level: 5.0, official_level: 5.2, dominant_hand: 'right', preferred_position: 'reves', bio: 'Buscando pareja para la liga de otoño en Reforma.', is_public: true, role: 'player', status: 'pendiente' },
  { id: 'p-4', user_id: 'u-4', display_name: 'Andrés Valle', username: 'andresvalle', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'M', declared_level: 4.0, official_level: 4.1, dominant_hand: 'right', preferred_position: 'both', bio: null, is_public: true, role: 'player' },
  { id: 'p-5', user_id: 'u-5', display_name: 'Lucía Herrera', username: 'luciaherrera', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'F', declared_level: 4.0, official_level: 4.2, dominant_hand: 'right', preferred_position: 'drive', bio: null, is_public: true, role: 'player' },
  { id: 'p-6', user_id: 'u-6', display_name: 'Emilio Garza', username: 'emiliogarza', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'M', declared_level: 5.5, official_level: 5.4, dominant_hand: 'right', preferred_position: 'drive', bio: 'Capitán de Reforma Smash.', is_public: true, role: 'player' },
  { id: 'p-7', user_id: 'u-7', display_name: 'Valeria Montes', username: 'valeriamontes', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'F', declared_level: 3.5, official_level: 3.6, dominant_hand: 'left', preferred_position: 'reves', bio: null, is_public: true, role: 'player' },
  { id: 'p-8', user_id: 'u-8', display_name: 'Javier Quintana', username: 'javierquintana', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'M', declared_level: 4.0, official_level: 4.0, dominant_hand: 'right', preferred_position: 'drive', bio: null, is_public: true, role: 'player' },
  { id: 'p-9', user_id: 'u-9', display_name: 'Fernando Lira', username: 'fernandolira', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'M', declared_level: 5.0, official_level: 5.1, dominant_hand: 'right', preferred_position: 'reves', bio: null, is_public: true, role: 'player' },
  { id: 'p-10', user_id: 'u-10', display_name: 'Paola Suárez', username: 'paolasuarez', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'F', declared_level: 4.5, official_level: 4.7, dominant_hand: 'right', preferred_position: 'both', bio: null, is_public: true, role: 'player' },
  { id: 'p-11', user_id: 'u-11', display_name: 'Ricardo Anaya', username: 'ricardoanaya', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'M', declared_level: 3.5, official_level: 3.4, dominant_hand: 'right', preferred_position: 'drive', bio: null, is_public: true, role: 'player' },
  { id: 'p-12', user_id: 'u-12', display_name: 'Daniela Cervantes', username: 'danielacervantes', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'F', declared_level: 4.0, official_level: 4.0, dominant_hand: 'right', preferred_position: 'reves', bio: null, is_public: true, role: 'player' },
  // Parejas añadidas para que cada división + rama tenga dos equipos y el
  // ranking tenga algo que ordenar (ver `teams`).
  { id: 'p-13', user_id: 'u-13', display_name: 'Paola Rocha', username: 'paolarocha', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'F', declared_level: 4.3, official_level: 4.3, dominant_hand: 'right', preferred_position: 'drive', bio: null, is_public: true, role: 'player' },
  { id: 'p-14', user_id: 'u-14', display_name: 'Renata Vidal', username: 'renatavidal', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'F', declared_level: 4.1, official_level: 4.1, dominant_hand: 'left', preferred_position: 'reves', bio: null, is_public: true, role: 'player' },
  { id: 'p-15', user_id: 'u-15', display_name: 'Hugo Ordóñez', username: 'hugoordoñez', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'M', declared_level: 4.2, official_level: 4.2, dominant_hand: 'right', preferred_position: 'drive', bio: null, is_public: true, role: 'player' },
  { id: 'p-16', user_id: 'u-16', display_name: 'Iker Peña', username: 'ikerpena', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'M', declared_level: 4.0, official_level: 4.0, dominant_hand: 'left', preferred_position: 'both', bio: null, is_public: true, role: 'player' },
  { id: 'p-17', user_id: 'u-17', display_name: 'Camila Bautista', username: 'camilabautista', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'F', declared_level: 3.8, official_level: 3.8, dominant_hand: 'right', preferred_position: 'reves', bio: null, is_public: true, role: 'player' },
  { id: 'p-18', user_id: 'u-18', display_name: 'Ximena Lozano', username: 'ximenalozano', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'F', declared_level: 3.7, official_level: 3.7, dominant_hand: 'right', preferred_position: 'drive', bio: null, is_public: true, role: 'player' },
  { id: 'p-19', user_id: 'u-19', display_name: 'Bruno Lara', username: 'brunolara', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'M', declared_level: 3.2, official_level: 3.2, dominant_hand: 'left', preferred_position: 'drive', bio: null, is_public: true, role: 'player' },
  { id: 'p-20', user_id: 'u-20', display_name: 'Nadia Pineda', username: 'nadiapineda', photo_url: null, city: 'Ciudad de México', state: 'CDMX', country: 'México', birth_date: null, sex: 'F', declared_level: 3.3, official_level: 3.3, dominant_hand: 'right', preferred_position: 'reves', bio: null, is_public: true, role: 'player' },
];

/**
 * La ficha de presentación. NO lleva estadísticas: `played`/`won`/`trend`/
 * `recent_results` son 0/`[]` a propósito, porque en producción los deja así el
 * trigger de creación y nadie los vuelve a escribir. El desempeño real sale del
 * récord derivado (`buildPlayerRecords`). Ver la nota de ranking en
 * `provider.ts`: estos campos se veían como si fueran datos y no lo eran.
 */
export const playerCards: Record<string, PlayerCard> = Object.fromEntries(
  players.map((p, i) => [
    p.id,
    {
      player_id: p.id,
      slug: p.username,
      titles: [3, 2, 5, 1, 1, 4, 0, 0, 2, 2, 0, 1][i] ?? 0,
      played: 0,
      won: 0,
      partner: i % 2 === 0 ? players[(i + 1) % players.length].display_name : null,
      recent_results: [],
      trend: [],
    },
  ]),
);

// Equipos de padel: parejas de 2 jugadores por división.
export const teams: Team[] = [
  { id: 'team-1', slug: 'fuentes-rojas', name: 'Fuentes / Rojas', crest_url: null, city: 'Ciudad de México', club_id: 'club-1',
    division: '1ra', sex: 'M',
    player1: { player_id: 'p-1', name: 'Diego Fuentes', level: 4.6 },
    player2: { player_id: 'p-2', name: 'Martín Rojas', level: 4.5 },
    position: 1, points: 24, played: 8, won: 7, lost: 1, sets_for: 42, sets_against: 18, titles: 2 },
  { id: 'team-2', slug: 'lira-valle', name: 'Lira / Valle', crest_url: null, city: 'Ciudad de México', club_id: 'club-1',
    division: '1ra', sex: 'M',
    player1: { player_id: 'p-9', name: 'Fernando Lira', level: 5.1 },
    player2: { player_id: 'p-4', name: 'Andrés Valle', level: 4.1 },
    position: 2, points: 21, played: 8, won: 6, lost: 2, sets_for: 36, sets_against: 22, titles: 1 },
  { id: 'team-3', slug: 'camacho-suarez', name: 'Camacho / Suárez', crest_url: null, city: 'Ciudad de México', club_id: 'club-1',
    division: '2da', sex: 'F',
    player1: { player_id: 'p-3', name: 'Sofía Camacho', level: 5.2 },
    player2: { player_id: 'p-10', name: 'Paola Suárez', level: 4.7 },
    position: 1, points: 18, played: 8, won: 5, lost: 3, sets_for: 30, sets_against: 24, titles: 0 },
  { id: 'team-4', slug: 'garza-quintana', name: 'Garza / Quintana', crest_url: null, city: 'Ciudad de México', club_id: 'club-1',
    division: '2da', sex: 'M',
    player1: { player_id: 'p-6', name: 'Emilio Garza', level: 5.4 },
    player2: { player_id: 'p-8', name: 'Javier Quintana', level: 4.0 },
    position: 2, points: 16, played: 8, won: 4, lost: 4, sets_for: 28, sets_against: 28, titles: 0 },
  { id: 'team-5', slug: 'herrera-montes', name: 'Herrera / Montes', crest_url: null, city: 'Ciudad de México', club_id: 'club-1',
    division: '3ra', sex: 'F',
    player1: { player_id: 'p-5', name: 'Lucía Herrera', level: 4.2 },
    player2: { player_id: 'p-7', name: 'Valeria Montes', level: 3.6 },
    position: 1, points: 14, played: 7, won: 4, lost: 3, sets_for: 25, sets_against: 20, titles: 0 },
  { id: 'team-6', slug: 'anaya-cervantes', name: 'Anaya / Cervantes', crest_url: null, city: 'Ciudad de México', club_id: 'club-1',
    division: 'Novatos', sex: 'X',
    player1: { player_id: 'p-11', name: 'Ricardo Anaya', level: 3.4 },
    player2: { player_id: 'p-12', name: 'Daniela Cervantes', level: 4.0 },
    position: 1, points: 12, played: 6, won: 3, lost: 3, sets_for: 20, sets_against: 19, titles: 0 },
  // Cada división + rama necesita AL MENOS dos parejas para que exista un
  // ranking que demostrar: la posición se calcula dentro del grupo, así que
  // una pareja sola se queda siempre en "—" y el admin no tiene nada que
  // capturar. Estas cuatro se añadieron con ese motivo.
  { id: 'team-7', slug: 'rocha-vidal', name: 'Rocha / Vidal', crest_url: null, city: 'Ciudad de México', club_id: 'club-1',
    division: '2da', sex: 'F',
    player1: { player_id: 'p-13', name: 'Paola Rocha', level: 4.3 },
    player2: { player_id: 'p-14', name: 'Renata Vidal', level: 4.1 },
    position: 1, points: 12, played: 6, won: 3, lost: 3, sets_for: 22, sets_against: 21, titles: 0 },
  { id: 'team-8', slug: 'ordoñez-pena', name: 'Ordóñez / Peña', crest_url: null, city: 'Ciudad de México', club_id: 'club-1',
    division: '2da', sex: 'M',
    player1: { player_id: 'p-15', name: 'Hugo Ordóñez', level: 4.2 },
    player2: { player_id: 'p-16', name: 'Iker Peña', level: 4.0 },
    position: 1, points: 12, played: 6, won: 3, lost: 3, sets_for: 21, sets_against: 22, titles: 0 },
  { id: 'team-9', slug: 'bautista-lozano', name: 'Bautista / Lozano', crest_url: null, city: 'Ciudad de México', club_id: 'club-1',
    division: '3ra', sex: 'F',
    player1: { player_id: 'p-17', name: 'Camila Bautista', level: 3.8 },
    player2: { player_id: 'p-18', name: 'Ximena Lozano', level: 3.7 },
    position: 1, points: 10, played: 5, won: 2, lost: 3, sets_for: 18, sets_against: 20, titles: 0 },
  { id: 'team-10', slug: 'lara-pineda', name: 'Lara / Pineda', crest_url: null, city: 'Ciudad de México', club_id: 'club-1',
    division: 'Novatos', sex: 'X',
    player1: { player_id: 'p-19', name: 'Bruno Lara', level: 3.2 },
    player2: { player_id: 'p-20', name: 'Nadia Pineda', level: 3.3 },
    position: 1, points: 9, played: 5, won: 2, lost: 3, sets_for: 17, sets_against: 21, titles: 0 },
];

export const leagues: League[] = [
  { id: 'lg-1', slug: 'liga-reforma-2026-27', name: 'Liga Reforma 2026-27', season: 'Temporada 2026-27', city: 'Ciudad de México', format: 'round_robin', status: 'active',
    divisions: [
      { name: '1ra División', teams: 8 },
      { name: '2da División', teams: 10 },
      { name: '3ra División', teams: 10 },
      { name: 'Novatos', teams: 8 },
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

// Los partidos usan SIEMPRE nombres de parejas de `teams` (o `pair_id` de
// `pairs`), porque así es como se reconocen al derivar el ranking: por id de
// lado y, si no hay, por nombre. Con nombres sueltos que no corresponden a
// ninguna pareja del directorio, capturar un resultado no movía nada.
// Cada grupo tiene al menos un partido terminado (para ver la tabla) y uno
// scheduled (para capturar y ver la tabla moverse).
export const matches: Match[] = [
  // 1ra · Masculino
  { id: 'm-1', tournament_id: 't-3', tournament_name: 'Reforma Relámpago 2026', category_name: 'Novatos Varonil',
    round: 'Ronda 3', court_name: 'Cancha 1', scheduled_at: '2026-09-26T18:00:00Z', status: 'finished',
    side_a: { pair_id: null, pair_name: 'Fuentes / Rojas' },
    side_b: { pair_id: null, pair_name: 'Lira / Valle' },
    sets: [{ a: 6, b: 4 }, { a: 6, b: 3 }], winner: 'a' },
  // Desempate: 1-1 y el tercero va a 10 con diferencia 2. Antes se guardaba
  // como 7-6, que es un set normal y no un super tie-break.
  { id: 'm-2', tournament_id: 't-3', tournament_name: 'Reforma Relámpago 2026', category_name: 'Novatos Varonil',
    round: 'Ronda 4', court_name: 'Cancha 1', scheduled_at: '2026-09-26T19:30:00Z', status: 'finished',
    side_a: { pair_id: null, pair_name: 'Lira / Valle' },
    side_b: { pair_id: null, pair_name: 'Fuentes / Rojas' },
    sets: [{ a: 4, b: 6 }, { a: 6, b: 2 }, { a: 10, b: 8 }], winner: 'a' },
  { id: 'm-3', tournament_id: 't-3', tournament_name: 'Reforma Relámpago 2026', category_name: 'Novatos Varonil',
    round: 'Ronda 5', court_name: 'Cancha 1', scheduled_at: '2026-09-26T21:00:00Z', status: 'scheduled',
    side_a: { pair_id: null, pair_name: 'Fuentes / Rojas' },
    side_b: { pair_id: null, pair_name: 'Lira / Valle' },
    sets: [], winner: null },

  // 2da · Femenino
  { id: 'm-4', tournament_id: 't-3', tournament_name: 'Reforma Relámpago 2026', category_name: 'Novatos Femenil',
    round: 'Ronda 3', court_name: 'Cancha 2', scheduled_at: '2026-09-26T18:00:00Z', status: 'finished',
    side_a: { pair_id: null, pair_name: 'Camacho / Suárez' },
    side_b: { pair_id: null, pair_name: 'Rocha / Vidal' },
    sets: [{ a: 6, b: 2 }, { a: 6, b: 4 }], winner: 'a' },
  { id: 'm-5', tournament_id: 't-3', tournament_name: 'Reforma Relámpago 2026', category_name: 'Novatos Femenil',
    round: 'Ronda 4', court_name: 'Cancha 3', scheduled_at: '2026-09-26T19:30:00Z', status: 'scheduled',
    side_a: { pair_id: null, pair_name: 'Rocha / Vidal' },
    side_b: { pair_id: null, pair_name: 'Camacho / Suárez' },
    sets: [], winner: null },

  // 2da · Masculino
  { id: 'm-6', tournament_id: 't-3', tournament_name: 'Reforma Relámpago 2026', category_name: 'Novatos Varonil',
    round: 'Ronda 4', court_name: 'Cancha 4', scheduled_at: '2026-09-26T19:30:00Z', status: 'finished',
    side_a: { pair_id: null, pair_name: 'Garza / Quintana' },
    side_b: { pair_id: null, pair_name: 'Ordóñez / Peña' },
    sets: [{ a: 4, b: 6 }, { a: 6, b: 3 }], winner: 'a' },
  { id: 'm-7', tournament_id: 't-3', tournament_name: 'Reforma Relámpago 2026', category_name: 'Novatos Varonil',
    round: 'Ronda 5', court_name: 'Cancha 4', scheduled_at: '2026-09-26T21:00:00Z', status: 'scheduled',
    side_a: { pair_id: null, pair_name: 'Ordóñez / Peña' },
    side_b: { pair_id: null, pair_name: 'Garza / Quintana' },
    sets: [], winner: null },

  // 3ra · Femenino
  { id: 'm-8', tournament_id: 't-1', tournament_name: 'Copa Liga16 Apertura 2026', category_name: '3ta Femenil',
    round: '3ta Femenil · Grupo A · J1', court_name: 'Cancha 1', scheduled_at: '2026-10-09T23:00:00Z', status: 'finished',
    side_a: { pair_id: null, pair_name: 'Herrera / Montes' },
    side_b: { pair_id: null, pair_name: 'Bautista / Lozano' },
    sets: [{ a: 6, b: 4 }, { a: 4, b: 6 }, { a: 10, b: 6 }], winner: 'a' },
  { id: 'm-9', tournament_id: 't-1', tournament_name: 'Copa Liga16 Apertura 2026', category_name: '3ta Femenil',
    round: '3ta Femenil · Grupo A · J2', court_name: 'Cancha 2', scheduled_at: '2026-10-10T00:30:00Z', status: 'scheduled',
    side_a: { pair_id: null, pair_name: 'Bautista / Lozano' },
    side_b: { pair_id: null, pair_name: 'Herrera / Montes' },
    sets: [], winner: null },

  // Novatos · Mixto
  { id: 'm-10', tournament_id: 't-2', tournament_name: 'Reforma Master 500', category_name: '4ta Varonil',
    round: '4ta Varonil · J1', court_name: 'Cancha 2', scheduled_at: '2026-10-23T22:00:00Z', status: 'finished',
    side_a: { pair_id: null, pair_name: 'Anaya / Cervantes' },
    side_b: { pair_id: null, pair_name: 'Lara / Pineda' },
    sets: [{ a: 6, b: 3 }, { a: 4, b: 6 }, { a: 11, b: 9 }], winner: 'a' },
  { id: 'm-11', tournament_id: 't-2', tournament_name: 'Reforma Master 500', category_name: '4ta Varonil',
    round: '4ta Varonil · J2', court_name: 'Cancha 3', scheduled_at: '2026-10-23T23:30:00Z', status: 'scheduled',
    side_a: { pair_id: null, pair_name: 'Lara / Pineda' },
    side_b: { pair_id: null, pair_name: 'Anaya / Cervantes' },
    sets: [], winner: null },

  // Sin parejas registradas: sale en la agenda y el panel como partido suelto.
  { id: 'm-12', tournament_id: 't-1', tournament_name: 'Copa Liga16 Apertura 2026', category_name: '5ta Varonil',
    round: '5ta Varonil · Grupo A · J1', court_name: 'Cancha 3', scheduled_at: '2026-10-10T00:30:00Z', status: 'scheduled',
    side_a: { pair_id: null, pair_name: 'Montoya / Palau' },
    side_b: { pair_id: null, pair_name: 'Rivas / Ong' },
    sets: [], winner: null },
];

export const news: NewsItem[] = [
  { id: 'n-1', title: 'Fuentes y Rojas levantan la Copa Independencia', excerpt: 'La dupla del Reforma remontó el super tie-break 10-8 ante Lira/Valle y se llevó 250 puntos de ranking.', image_url: null, published_at: '2026-09-14', tag: 'Resultados' },
  { id: 'n-2', title: 'La Liga Reforma ya tiene calendario completo', excerpt: '1ra, 2da, 3ra y Novatos jugarán 14 jornadas entre octubre y mayo en el padel Reforma.', image_url: null, published_at: '2026-09-18', tag: 'Ligas' },
  { id: 'n-3', title: 'Reforma Challenger 250 abre inscripciones', excerpt: 'El torneo de noviembre será la segunda cita de la temporada en el único padel de Liga16.', image_url: null, published_at: '2026-09-20', tag: 'Torneos' },
];

export const sponsors: Sponsor[] = [
  { id: 's-1', name: 'Volt Padel', logo_url: null, website: 'https://example.com', tier: 'principal' },
  { id: 's-2', name: 'Aqua Natura', logo_url: null, website: 'https://example.com', tier: 'oro' },
  { id: 's-3', name: 'Kinesio Sport', logo_url: null, website: 'https://example.com', tier: 'plata' },
  { id: 's-4', name: 'Taco Tour', logo_url: null, website: 'https://example.com', tier: 'bronce' },
];
