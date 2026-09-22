export function formatMoney(cents: number, currency = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(cents / 100);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  if (start === end) return formatDate(start);
  if (s.getMonth() === e.getMonth())
    return `${s.getDate()} – ${e.getDate()} ${new Intl.DateTimeFormat('es-MX', { month: 'short', year: 'numeric' }).format(e)}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

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

export const divisionOptions = [
  { value: "all", label: "Todas las divisiones" },
  { value: "1ra", label: "1ra División" },
  { value: "2da", label: "2da División" },
  { value: "3ra", label: "3ra División" },
  { value: "4ta", label: "4ta División" },
  { value: "5ta", label: "5ta División" },
  { value: "6ta", label: "6ta División" },
  { value: "Novatos", label: "Novatos" },
];

export const sexOptions = [
  { value: "all", label: "Todas las ramas" },
  { value: "M", label: "Varonil" },
  { value: "F", label: "Femenil" },
  { value: "X", label: "Mixto" },
];

export function sexShort(sex: string): string {
  if (sex === "M") return "Varonil";
  if (sex === "F") return "Femenil";
  return "Mixto";
}

export function sexLabel(sex: string): string {
  if (sex === "M") return "Varonil";
  if (sex === "F") return "Femenil";
  return "Mixto";
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
  }).format(new Date(iso));
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
