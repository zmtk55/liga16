/**
 * Quién pasa a eliminatorias. Por defecto, las primeras `slots` de la tabla
 * (sin bajas). El admin puede elegir explícitamente otras: por lesión una pareja
 * clasificada puede no jugar, y quién la reemplaza lo decide él, no la tabla.
 * Las elegidas conservan el orden de la tabla como siembra inicial.
 */
export function qualifiersFrom<T extends { pairId: string }>(
  table: T[],
  slots: number,
  chosenIds: string[] | null,
): T[] {
  if (!chosenIds) return table.slice(0, slots);
  const chosen = new Set(chosenIds);
  return table.filter((r) => chosen.has(r.pairId)).slice(0, slots);
}

/** Alterna una pareja respetando el cupo. Devuelve null si no cabe (primero hay que quitar otra). */
export function toggleChoice(current: string[], pairId: string, slots: number): string[] | null {
  if (current.includes(pairId)) return current.filter((id) => id !== pairId);
  if (current.length >= slots) return null;
  return [...current, pairId];
}
