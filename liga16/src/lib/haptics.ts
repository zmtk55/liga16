/**
 * Vibración háptica (Web Vibration API) para micro-interacciones clave.
 * En iOS Safari la API no existe y se ignora en silencio; en Android da un
 * "tap" físico que refuerza la respuesta táctil de la nav inferior, el menú
 * y las selecciones importantes. Nunca debe romper la UI.
 */
export type BuzzPattern = "tap" | "select" | "success";

const PATTERNS: Record<BuzzPattern, number | number[]> = {
  tap: 8, // tick corto: navegación, abrir/cerrar menú
  select: [10, 30, 14], // doble pulso: selección importante (comparador)
  success: [12, 40, 12, 40, 18], // fanfarria corta: acción completada
};

export function buzz(pattern: BuzzPattern = "tap") {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    /* silencio */
  }
}
