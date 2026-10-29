/** Supabase may return no error for an RLS-filtered write affecting zero rows. */
export function requireWrittenRow<T>(data: T[] | null, expectedId?: string): T {
  if (!data || data.length !== 1 || (expectedId && (data[0] as {id?: string}).id !== expectedId)) {
    throw new Error('No se confirmó el cambio. El registro ya no existe o cambió tu permiso; recarga antes de reintentar.');
  }
  return data[0];
}
