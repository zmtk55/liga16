import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ScoreRow = { a: string; b: string };

/**
 * Captura de marcador en una sola tabla: una fila por pareja, una columna por
 * set. Reemplaza una tarjeta por set con dos campos apilados y texto de ayuda.
 */
export function ScoreGrid({
  sideA,
  sideB,
  rows,
  superTbIndex,
  superTbTo,
  hint,
  notes,
  onChange,
  onRemove,
  onAdd,
  addLabel,
  canAdd,
}: {
  sideA: string;
  sideB: string;
  rows: ScoreRow[];
  /** Índice de la columna que es super tie-break (puntos), si aplica. */
  superTbIndex: (i: number) => boolean;
  superTbTo: number;
  /** Una sola línea de ayuda para toda la tabla. */
  hint?: string;
  /** Nota breve por set (ej. tie-break histórico), solo lectura. */
  notes?: (string | null)[];
  onChange: (index: number, side: "a" | "b", value: string) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  addLabel: string;
  canAdd: boolean;
}) {
  // Con 4+ columnas (mejor de 5) el nombre no cabe junto a los campos: se
  // pone en su propia línea y los campos reparten el ancho.
  const stacked = rows.length > 3;
  const cols = stacked ? `repeat(${rows.length}, minmax(0,1fr))` : `minmax(0,1fr) repeat(${rows.length}, 3rem)`;
  const cell =
    "h-11 w-full rounded-lg border border-input bg-background text-center text-base font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className="grid gap-2">
      <div className="grid items-center gap-x-2 gap-y-1.5" style={{ gridTemplateColumns: cols }}>
        {stacked ? null : <span />}
        {rows.map((_, i) => (
          <div key={i} className="flex items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground">
            <span title={superTbIndex(i) ? `Super tie-break a ${superTbTo} puntos` : undefined}>{superTbIndex(i) ? "STB" : `S${i + 1}`}</span>
          </div>
        ))}
        {(["a", "b"] as const).map((side) => (
          <div key={side} className="contents">
            <span className={cn("line-clamp-2 break-words text-sm font-semibold leading-tight", stacked && "col-span-full mt-1", side === "a" ? "text-primary" : "text-foreground")} title={side === "a" ? sideA : sideB}>
              {side === "a" ? sideA : sideB}
            </span>
            {rows.map((r, i) => (
              <input
                key={i}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className={cell}
                value={r[side]}
                onChange={(e) => onChange(i, side, e.target.value.replace(/[^0-9]/g, ""))}
                aria-label={
                  superTbIndex(i)
                    ? `Puntos de ${side === "a" ? sideA : sideB} en el super tie-break`
                    : `Juegos de ${side === "a" ? sideA : sideB} en el set ${i + 1}`
                }
              />
            ))}
          </div>
        ))}
        {rows.length > 1 && (
          <>
            {stacked ? null : <span />}
            {rows.map((_, i) => (
              <div key={i} className="flex justify-center">
                <button
                    type="button"
                    onClick={() => onRemove(i)}
                    className="h-8 rounded-md px-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={superTbIndex(i) ? "Quitar super tie-break" : `Quitar set ${i + 1}`}
                  >
                    Quitar
                  </button>
              </div>
            ))}
          </>
        )}
      </div>
      {notes?.some(Boolean) && (
        <p className="text-xs text-muted-foreground">
          {notes
            .map((n, i) => (n ? `${superTbIndex(i) ? "STB" : `S${i + 1}`}: ${n}` : null))
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : <span />}
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onAdd} disabled={!canAdd}>
          <Plus className="h-4 w-4" /> {addLabel}
        </Button>
      </div>
    </div>
  );
}
