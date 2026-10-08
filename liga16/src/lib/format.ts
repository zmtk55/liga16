import type { Sex } from '@/types';

/**
 * La moneda se exige: el torneo la trae (`Tournament.currency`) y las dos
 * pantallas que muestran precio ya la pasan. Con default a 'MXN', un tercer
 * llamador se olvidaría del campo y mostraría pesos a un torneo en otra moneda
 * sin que nada se quejara.
 */
export function formatMoney(cents: number, currency: string): string {
     return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(cents / 100);
}

/**
 * Una fecha "YYYY-MM-DD" es calendario, no un instante: `new Date()` la interpreta
 * como UTC midnight y en zonas negativas (CDMX es UTC-7) se muestra del día anterior.
 * Las fechas con hora sí son instantes y se respetan tal cual.
 */
function parseDate(iso: string): Date {
     return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
}

export function formatDate(iso: string): string {
     return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(parseDate(iso));
}

export function formatDateRange(start: string, end: string): string {
     const s = parseDate(start);
     const e = parseDate(end);
     if (start === end) return formatDate(start);
     if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear())
          return `${s.getDate()} – ${e.getDate()} ${new Intl.DateTimeFormat('es-MX', { month: 'short', year: 'numeric' }).format(e)}`;
     return `${formatDate(start)} – ${formatDate(end)}`;
}

/**
 * Sin categoría: texto que aparece en cinco lugares de admin (placeholder,
 * opción vacía, celda sin valor). Estaba escrito cinco veces; cambiarlo obliga
 * a cazarlo en todas.
 */
export const SIN_CATEGORIA = 'Sin categoría';

export const tournamentStatusLabel: Record<string, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  registration_open: 'Inscripciones abiertas',
  registration_closed: 'Inscripciones cerradas',
  in_progress: 'En juego',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
};

export const formatLabel: Record<string, string> = {
  single_elimination: 'Eliminación directa',
  round_robin: 'Round robin',
  groups_knockout: 'Grupos + eliminación',
  americano: 'Americano',
  mexicano: 'Mexicano',
  ladder: 'Ladder',
  custom: 'Personalizado',
};

export const matchStatusLabel: Record<string, string> = {
  scheduled: 'Programado',
  live: 'En vivo',
  finished: 'Finalizado',
  walkover: 'Walkover',
  disputed: 'En disputa',
  cancelled: 'Cancelado',
};

export const registrationStatusLabel: Record<string, string> = {
  started: 'Iniciada',
  payment_pending: 'Pago pendiente',
  payment_review: 'Pago en revisión',
  paid: 'Pagado',
  refunded: 'Reembolsado',
  cancelled: 'Cancelado',
  no_show: 'No presentado',
};

export const tierLabel: Record<string, string> = {
  principal: 'Principal',
  oro: 'Oro',
  plata: 'Plata',
  bronce: 'Bronce',
};

/**
 * Las divisiones se muestran con la abreviatura del circuito, tal cual: "5ta",
 * "4ta", "Novatos". Antes el label decía "5ta División" y dos componentes
 * (`GroupFilterBar` y `SectionControl`) lo recortaban con un
 * `.replace(" División", "")`: dos parches para la misma etiqueta es la señal
 * de que la etiqueta estaba mal. El valor y el label coinciden a propósito.
 */
export const divisionOptions = [
  { value: "all", label: "Todas" },
  { value: "1ra", label: "1ra" },
  { value: "2da", label: "2da" },
  { value: "3ra", label: "3ra" },
  { value: "4ta", label: "4ta" },
  { value: "5ta", label: "5ta" },
  { value: "6ta", label: "6ta" },
  { value: "Novatos", label: "Novatos" },
];

/**
 * Las tres ramas del circuito. Esta es LA lista: `sexOptions` y `sexLabel` se
 * derivan de acá. Estaba escrita a mano en otros cuatro archivos
 * (`category-matrix`, `admin/players`, `players/detail`, `my-profile`), y con
 * cinco copias cambiar una palabra era trabajo de cinco lados.
 */
export const SEX_BRANCHES: { value: Sex; label: string }[] = [
  { value: "M", label: "Varonil" },
  { value: "F", label: "Femenil" },
  { value: "X", label: "Mixto" },
];

/** Lo mismo más la entrada "todas", para los filtros que ofrecen limpiar. */
export const sexOptions = [
  { value: "all", label: "Todos los géneros" },
  ...SEX_BRANCHES,
];

export function sexLabel(sex: string): string {
  return SEX_BRANCHES.find((b) => b.value === sex)?.label ?? "Mixto";
}

export function winRate(played: number, won: number): number {
  return played ? Math.round((won / played) * 100) : 0;
}

export function formatMatchDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parseDate(iso));
}

/** Hora del partido en 24h: "19:30". La app usa 24h en todas partes (el
 * generador de calendario lista "08:00…22:00"), así que la card y la agenda no
 * pueden seguir con "7:30 pm". */
export function formatMatchTime(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parseDate(iso));
}

/** Día del mes para el chip de fecha de la agenda: "12". */
export function formatMatchDay(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric" }).format(parseDate(iso));
}

/** Mes corto para el chip de fecha de la agenda: "oct". */
export function formatMatchMonth(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { month: "short" })
    .format(parseDate(iso))
    .replace(".", "");
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
