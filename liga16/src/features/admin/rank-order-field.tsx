import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DEFAULT_RANK_ORDER, type RankCriterion } from "@/lib/liga16-scoring";

export const RANK_LABELS: Record<RankCriterion, string> = {
  points_pct: "% de puntos",
  sets_diff: "Diferencia de sets",
  matches_won: "Partidos ganados",
  sets_won: "Sets ganados",
  matches_played: "Partidos jugados",
  head_to_head: "Dominio (enfrentamiento directo)",
};

const ALL = Object.keys(RANK_LABELS) as RankCriterion[];

/** Orden de criterios del ranking. Vacío = orden estándar del reglamento. */
export function RankOrderField({ value, onChange }: { value: RankCriterion[]; onChange: (v: RankCriterion[]) => void }) {
  const custom = value.length > 0;
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const free = ALL.filter((c) => !value.includes(c));
  return (
    <div className="grid gap-2">
      <Label className="text-xs text-muted-foreground">Orden del ranking</Label>
      {!custom ? (
        <p className="text-xs text-muted-foreground">
          Estándar: {DEFAULT_RANK_ORDER.map((c) => RANK_LABELS[c]).join(" → ")}.
        </p>
      ) : (
        <ol className="grid gap-1" aria-label="Criterios en orden de prioridad">
          {value.map((c, i) => (
            <li key={c} className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
              <span className="w-5 text-xs text-muted-foreground">{i + 1}.</span>
              <span className="flex-1">{RANK_LABELS[c]}</span>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} aria-label="Subir" onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === value.length - 1} aria-label="Bajar" onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Quitar" onClick={() => onChange(value.filter((x) => x !== c))}><X className="h-3.5 w-3.5" /></Button>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap gap-2">
        {!custom && (
          <Button type="button" size="sm" variant="outline" onClick={() => onChange([...DEFAULT_RANK_ORDER])}>Personalizar orden</Button>
        )}
        {custom && free.map((c) => (
          <Button key={c} type="button" size="sm" variant="outline" onClick={() => onChange([...value, c])}>+ {RANK_LABELS[c]}</Button>
        ))}
        {custom && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange([])}>Volver al estándar</Button>
        )}
      </div>
      <p className="text-xs leading-snug text-muted-foreground/80">
        Lo que empata en un criterio lo decide el siguiente. Los torneos que no lo cambian siguen con el orden estándar.
      </p>
    </div>
  );
}
