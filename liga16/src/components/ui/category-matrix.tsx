// Matriz de categorías del asistente de torneo.
// Las categorías se TECLEAN (nombre libre: "4ta Varonil", "Suma Nueve" —
// que significa 4ta+5ta). Sin cupos: el número de grupos se decide en el
// sorteo según los inscritos.
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eraser, Plus, X } from "lucide-react";
import type { Sex } from "@/types";
import {
  categoriaProblema,
  categorySuggestions,
  type CategoryValue,
} from "@/lib/categories";
import { divisionOptions, SEX_BRANCHES } from "@/lib/format";

export type { CategoryValue };

const RAMAS = SEX_BRANCHES;

/** "1ra"…"6ta" (sin Novatos): el atajo que ofrece el botón. */
const CLASICAS = divisionOptions
  .filter((d) => d.value !== "all" && d.value !== "Novatos")
  .map((d) => [d.value, "M"] as [string, Sex]);

const nuevoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `cat-${Math.random().toString(36).slice(2)}`;

export default function CategoryMatrix({
  value,
  onChange,
}: {
  value: CategoryValue[];
  onChange: (next: CategoryValue[]) => void;
}) {
  // Los nombres que se ofrecen salen de la misma lista de divisiones y ramas
  // que usa el resto del app. Antes eran dos listas escritas a mano aquí, y por
  // eso se ofrecía "5ta" pero no "4ta Varonil", que es como se llaman de verdad.
  const sugerencias = categorySuggestions();

  function update(index: number, patch: Partial<CategoryValue>) {
    onChange(value.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function add() {
    onChange([...value, { id: nuevoId(), label: "", sex: "M" }]);
  }

  function addClasicas() {
    const next = [...value];
    for (const [label, sex] of CLASICAS) {
      if (!next.some((c) => c.label.trim().toLowerCase() === label.toLowerCase())) {
        next.push({ id: nuevoId(), label, sex });
      }
    }
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <datalist id="categorias-basicas">
        {sugerencias.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <div className="hidden grid-cols-[1fr_140px_36px] items-center gap-2 px-1 sm:grid">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Categoría</span>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rama</span>
        <span />
      </div>

      <div role="group" aria-label="Categorías del torneo" className="space-y-3">
        {value.map((c, i) => {
          // La regla vive en `lib/categories`; aquí solo se pinta en su fila.
          const problema = categoriaProblema(value, i);
          return (
            <div key={c.id ?? i} className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Input
                    value={c.label}
                    onChange={(e) => update(i, { label: e.target.value })}
                    placeholder='Teclea o elige — 1ra, 2da… o "Suma Nueve"'
                    aria-label={`Nombre de la categoría ${i + 1}`}
                    aria-invalid={problema !== null}
                    list="categorias-basicas"
                    className="h-9"
                  />
                </div>
                <Select value={c.sex} onValueChange={(v) => update(i, { sex: v as Sex })}>
                  <SelectTrigger className="h-9 w-[140px]" aria-label={`Rama de la categoría ${i + 1}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RAMAS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => remove(i)}
                  aria-label={`Quitar categoría ${c.label || i + 1}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {problema && (
                <p className="text-xs text-destructive" role="alert">
                  {problema}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4 mr-1" /> Añadir categoría
        </Button>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={addClasicas}>
            Clásicas (1ra–6ta Varonil)
          </Button>
          {value.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
              <Eraser className="h-3.5 w-3.5 mr-1" /> Limpiar
            </Button>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Teclea el nombre exacto que usa tu club — "Suma Nueve" significa 4ta+5ta. El número de grupos se
        decide en el sorteo según los inscritos, aquí no hay cupos.
      </p>
    </div>
  );
}
