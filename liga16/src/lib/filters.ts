// Utilidades de filtrado del admin.

/**
 * Cuántos filtros de faceta hay activos.
 *
 * Las barras de faceta (FilterNav) viven fuera del `FilterBar`, así que el
 * `FilterBar` no las ve: sin este número, el botón "Limpiar" no aparecería
 * con un filtro de categoría activo y el filtro quedaría sin salida visible.
 */
export function countActive(...values: string[]): number {
  return values.filter((v) => v && v !== "all").length;
}
