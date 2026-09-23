// Botón reutilizable de subida de imagen (logo de equipo o foto de jugador).
// Preview cuadrado o redondo, con opción de quitar la imagen.
import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";

export default function ImageUpload({
  id,
  value,
  onChange,
  label,
  round = false,
  size = "md",
}: {
  id: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  label: string;
  round?: boolean;
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "h-20 w-20" : "h-16 w-16";
  const ref = useRef<HTMLInputElement>(null);

  function pick(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.readAsDataURL(file);
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
          className={`flex ${box} items-center justify-center overflow-hidden ${
            round ? "rounded-full" : "rounded-lg"
          } border bg-muted/50 transition-colors hover:border-primary/60`}
          aria-label={label}
          title={label}
        >
          {value ? (
            <img src={value} alt="" className={`h-full w-full object-cover ${round ? "rounded-full" : "object-contain p-1"}`} />
          ) : (
            <ImagePlus className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
        {value && (
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
    </div>
  );
}
