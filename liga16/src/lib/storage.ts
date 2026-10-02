// Utilidades de Supabase Storage compartidas por las pantallas de admin.
//
// Viven aparte del componente ImageUpload porque se usan desde varios sitios:
// cuando el organizador borra o reemplaza una foto, el objeto viejo queda
// huérfano en el bucket y hay que limpiarlo.
import { supabase } from "@/lib/supabase";

/** Ruta del objeto dentro del bucket, a partir de su URL pública. */
export function objectPathFromUrl(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  try {
    return decodeURIComponent(url.slice(idx + marker.length));
  } catch {
    return url.slice(idx + marker.length);
  }
}

/** Borra un objeto de storage a partir de su URL pública (best-effort, ignora errores). */
export async function deleteStoredImage(url: string | null | undefined, bucket: string): Promise<void> {
  if (!url || !supabase) return;
  const objPath = objectPathFromUrl(url, bucket);
  if (!objPath) return;
  await supabase.storage.from(bucket).remove([objPath]).catch(() => {});
}
