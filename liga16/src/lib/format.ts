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
