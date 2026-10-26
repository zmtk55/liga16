// Piezas compartidas del admin en estilo bento: tarjetas redondeadas con una
// cifra grande, superficies claras y póster oscuro, y la búsqueda en pill.
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Cifra grande de tarjeta: display face, tabular, tamaño fluido. */
export const BENTO_METRIC =
  "font-display font-bold leading-[0.95] tracking-[-0.03em] tabular-nums text-[length:clamp(2.75rem,4.5vw,4.25rem)]";
export const BENTO_METRIC_MD =
  "font-display font-bold leading-[0.95] tracking-[-0.03em] tabular-nums text-[length:clamp(2rem,3vw,2.75rem)]";
export const BENTO_CARD = "relative overflow-hidden rounded-3xl p-6";
export const BENTO_LIGHT = "liga16-surface liga16-surface--light";
export const BENTO_DARK = "liga16-surface liga16-surface--poster";

/** Búsqueda en pill: la misma del Panel, controlada por quien la usa (?q=). */
export function AdminSearchPill({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="search"
      className={cn(
        "flex h-11 w-full items-center gap-2.5 rounded-full border bg-card px-4 transition-colors focus-within:border-foreground/40 sm:w-72",
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onChange("");
        }}
        placeholder={placeholder}
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpiar búsqueda"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
