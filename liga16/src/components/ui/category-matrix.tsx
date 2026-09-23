// Matriz de categorías para el asistente de torneo.
// Cada división es una fila; sus tres ramas (Varonil/Femenil/Mixto) son
// toggles visibles de un vistazo. Sin popovers: todo lo seleccionado
// permanece a la vista con su cupo editable inline.
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eraser } from "lucide-react";
import type { PadelDivision, Sex } from "@/types";

export interface CategoryValue {
  division: PadelDivision;
  sex: Sex;
  max_pairs: number;
}

const DIVISIONES: PadelDivision[] = ["1ra", "2da", "3ra", "4ta", "5ta", "6ta", "Novatos"];
const RAMAS: { value: Sex; label: string }[] = [
  { value: "M", label: "Varonil" },
  { value: "F", label: "Femenil" },
  { value: "X", label: "Mixto" },
];

const DEFAULT_CUPO = 16;

export default function CategoryMatrix({
  value,
  onChange,
}: {
  value: CategoryValue[];
  onChange: (next: CategoryValue[]) => void;
}) {
  const key = (c: { division: string; sex: string }) => `${c.division}|${c.sex}`;

  const find = (division: PadelDivision, sex: Sex) =>
    value.find((c) => c.division === division && c.sex === sex);

  function toggle(division: PadelDivision, sex: Sex) {
    if (find(division, sex)) {
      onChange(value.filter((c) => !(c.division === division && c.sex === sex)));
    } else {
      // Hereda el cupo de la última categoría tocada, si hay, para no
      // reescribir el criterio del usuario a cada clic.
      onChange([...value, { division, sex, max_pairs: value.at(-1)?.max_pairs ?? DEFAULT_CUPO }]);
    }
  }

  function setCupo(division: PadelDivision, sex: Sex, cupo: number) {
    onChange(
      value.map((c) =>
        key(c) === key({ division, sex }) ? { ...c, max_pairs: Math.max(1, cupo) } : c,
      ),
    );
  }

  function toggleRow(division: PadelDivision) {
    const rowOn = RAMAS.every((r) => find(division, r.value));
    onChange(
      rowOn
        ? value.filter((c) => c.division !== division)
        : [
            ...value.filter((c) => c.division !== division),
            ...RAMAS.map((r) => ({
              division,
              sex: r.value,
              max_pairs: value.at(-1)?.max_pairs ?? DEFAULT_CUPO,
            })),
          ],
    );
  }

  const rowIsFull = (d: PadelDivision) => RAMAS.every((r) => find(d, r.value));

  return (
    <div className="space-y-3">
      {/* Encabezado de columnas (solo >= sm, en móvil las ramas se leen en cada fila) */}
      <div className="hidden grid-cols-[88px_1fr_auto] items-center gap-3 px-1 sm:grid">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">División</span>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rama</span>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cupo</span>
      </div>

      <div className="overflow-hidden rounded-xl border" role="group" aria-label="Categorías del torneo">
        {DIVISIONES.map((d, di) => (
          <div
            key={d}
            className={`grid grid-cols-1 items-center gap-x-3 gap-y-1.5 px-3 py-2.5 sm:grid-cols-[88px_1fr_auto] ${
              di > 0 ? "border-t" : ""
            } ${rowIsFull(d) ? "bg-muted/40" : ""}`}
          >
            {/* División: clic en el nombre alterna toda la fila */}
            <button
              type="button"
              onClick={() => toggleRow(d)}
              title={rowIsFull(d) ? `Quitar las 3 ramas de ${d}` : `Poner las 3 ramas de ${d}`}
              className="flex w-fit items-center gap-1 text-sm font-semibold transition-colors hover:text-primary"
            >
              {d}
              <span
                className={`text-[10px] font-medium ${rowIsFull(d) ? "text-primary" : "text-muted-foreground"}`}
              >
                {rowIsFull(d) ? "×3" : "3"}
              </span>
            </button>

            {/* Ramas como toggles */}
            <div className="flex flex-wrap gap-1.5">
              {RAMAS.map((r) => {
                const on = Boolean(find(d, r.value));
                return (
                  <Toggle
                    key={r.value}
                    size="sm"
                    pressed={on}
                    onPressedChange={() => toggle(d, r.value)}
                    aria-label={`${d} ${r.label}`}
                    className="h-7 gap-1 rounded-full px-3 text-xs"
                  >
                    {r.label}
                    {on && <span className="text-[10px] tabular-nums opacity-70">{find(d, r.value)?.max_pairs}</span>}
                  </Toggle>
                );
              })}
            </div>

            {/* Cupo inline de la primera rama activa de la fila */}
            <div className="flex items-center gap-1 justify-self-start sm:justify-self-end">
              {(() => {
                const first = RAMAS.map((r) => find(d, r.value)).find(Boolean);
                if (!first) return null;
                return (
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    Cupo
                    <Input
                      type="number"
                      min={1}
                      value={first.max_pairs}
                      onChange={(e) => setCupo(d, first.sex, Number(e.target.value))}
                      className="h-7 w-14 text-center text-xs tabular-nums"
                      aria-label={`Cupo de parejas para ${d}`}
                    />
                    {/* Aplica el cupo a todas las ramas activas de la fila */}
                    {RAMAS.filter((r) => find(d, r.value)).length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          RAMAS.forEach((r) => {
                            if (find(d, r.value)) setCupo(d, r.value, first.max_pairs);
                          })
                        }
                        className="text-[10px] underline underline-offset-2 hover:text-foreground"
                      >
                        a las 3
                      </button>
                    )}
                  </label>
                );
              })()}
            </div>
          </div>
        ))}
      </div>

      {/* Resumen + acciones rápidas */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {value.length === 0
            ? "Activa las ramas que quieres por división. Clic en el nombre de la división para toda la fila."
            : `${value.length} ${value.length === 1 ? "categoría" : "categorías"} · ${value.reduce((s, c) => s + c.max_pairs, 0)} cupos totales`}
        </p>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(DIVISIONES.flatMap((d) => RAMAS.map((r) => ({ division: d, sex: r.value, max_pairs: DEFAULT_CUPO }))))}>
            Todas (21)
          </Button>
          {value.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
              <Eraser className="h-3.5 w-3.5 mr-1" /> Limpiar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
