/**
 * Fechas de partidos: la BD guarda ISO con zona (UTC), los campos de edición
 * (`DateTimePicker`) trabajan con hora LOCAL sin zona ("YYYY-MM-DDTHH:mm").
 * Recortar el ISO con `slice(0, 16)` mostraba la hora UTC como si fuera local y,
 * al guardar, la corría por el desfase de la zona (+7 h en Hermosillo).
 */

const LOCAL_INPUT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO (o valor local sin zona) -> "YYYY-MM-DDTHH:mm" en hora local. "" si no hay fecha válida. */
export function isoToLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  if (LOCAL_INPUT.test(value)) return value.slice(0, 16);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Valor local del campo -> ISO con zona. `null` si está vacío o es inválido (así se puede limpiar la fecha). */
export function localInputToIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
