// Botón reutilizable de subida de imagen (logo de equipo o foto de jugador).
// Preview cuadrado o redondo, con opción de quitar la imagen.
//
// Dos modos:
//  - Con `bucket`: sube a Supabase Storage, reescala la imagen a máx. 512px
//    (canvas, PNG con transparencia) y devuelve la URL pública vía onChange.
//  - Sin `bucket` (legacy): devuelve el dataURL sin subir nada.
//
// El componente NO borra objetos: quien integre la URL decide cuándo borrar
// (p. ej. al guardar el formulario), para que cancelar no rompa imágenes ya
// guardadas. Usa deleteStoredImage para limpiar objetos que ya no se usan.
import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

const MAX_DIMENSION = 512;

/** Lee el archivo y lo reescala a máx. 512px por lado (PNG, conserva transparencia). */
async function fileToScaledBlob(file: File): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("El archivo no es una imagen válida"));
    el.src = dataUrl;
  });
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen"))), "image/png"),
  );
}

export default function ImageUpload({
  id,
  value,
  onChange,
  label,
  round = false,
  size = "md",
  bucket,
  path = "uploads",
  overlay = false,
}: {
  id: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  label: string;
  round?: boolean;
  size?: "md" | "lg";
  /** Bucket de Supabase Storage. Si se omite, queda en modo legacy (dataURL). */
  bucket?: string;
  /** Carpeta dentro del bucket, p. ej. el id del equipo. */
  path?: string;
  /** Botón de cámara como overlay sobre la foto (no debajo). */
  overlay?: boolean;
}) {
  const box = size === "lg" ? "h-40 w-40 md:h-48 md:w-48" : "h-24 w-24";
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | null) {
    if (!file) return;
    if (!bucket || !supabase) {
      // Modo legacy: dataURL sin storage
      const reader = new FileReader();
      reader.onload = () => onChange(String(reader.result));
      reader.readAsDataURL(file);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const blob = await fileToScaledBlob(file);
      const objPath = `${path}/${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(objPath, blob, { contentType: "image/png", upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(bucket).getPublicUrl(objPath);
      onChange(data.publicUrl);
    } catch (e) {
      setError((e as Error).message ?? "Error al subir la imagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <input
        ref={ref}
        type="file"
        id={id}
        accept="image/*"
        className="sr-only"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
      <div className="relative">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className={`flex ${box} items-center justify-center overflow-hidden ${
            round ? "rounded-full" : "rounded-xl"
          } border bg-muted/50 transition-colors hover:border-primary/60 disabled:opacity-60`}
          aria-label={label}
          title={label}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : value ? (
            <img src={value} alt="" className={`h-full w-full object-cover ${round ? "rounded-full" : "rounded-xl"}`} />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <ImagePlus className="h-6 w-6" />
              <span className="text-2xs font-medium">{label}</span>
            </div>
          )}
        </button>
        {overlay && value && !busy && (
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black/80"
            aria-label={`Cambiar ${label.toLowerCase()}`}
            title={`Cambiar ${label.toLowerCase()}`}
          >
            <ImagePlus className="h-3.5 w-3.5" /> Cambiar
          </button>
        )}
        {value && !overlay && !busy && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-white shadow"
            aria-label={`Quitar ${label.toLowerCase()}`}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {error && (
        <p className="max-w-40 text-center text-2xs leading-tight text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
