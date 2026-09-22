// Selector compacto de categorías para el onboarding.
// Combina Popover + Command (shadcn) para buscar divisiones y ramas,
// y muestra la selección como chips editables — ocupa una fracción del
// espacio de la lista de filas anterior.
import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sexShort } from "@/lib/format";
import { Check, ChevronsUpDown, X } from "lucide-react";
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

export default function CategoryPicker({
  value,
  onChange,
}: {
  value: CategoryValue[];
  onChange: (next: CategoryValue[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [cupo, setCupo] = useState(16);

  const key = (c: { division: string; sex: string }) => `${c.division}|${c.sex}`;

  const selected = useMemo(() => new Set(value.map(key)), [value]);

  function toggle(division: PadelDivision, sex: Sex) {
    if (selected.has(`${division}|${sex}`)) {
      onChange(value.filter((c) => !(c.division === division && c.sex === sex)));
    } else {
      onChange([...value, { division, sex, max_pairs: cupo }]);
    }
  }

  const quickAll = () => {
    onChange(
      DIVISIONES.flatMap((d) => RAMAS.map((r) => ({ division: d, sex: r.value, max_pairs: cupo }))),
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={open} className="w-64 justify-between font-normal">
              {value.length === 0 ? "Seleccionar categorías…" : `${value.length} categorías`}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar división…" />
              <CommandList>
                <CommandEmpty>Sin resultados.</CommandEmpty>
                <CommandGroup heading="Cupo por defecto para nuevas categorías">
                  <div className="flex items-center gap-2 px-2 pb-2">
                    <Input
                      type="number"
                      min={1}
                      value={cupo}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCupo(Math.max(1, Number(e.target.value)))}
                      className="h-8 w-20"
                      aria-label="Cupo de parejas"
                    />
                    <span className="text-xs text-muted-foreground">parejas máximo</span>
                  </div>
                </CommandGroup>
                {DIVISIONES.map((d) => (
                  <CommandGroup key={d} heading={`División ${d}`}>
                    {RAMAS.map((r) => {
                      const on = selected.has(`${d}|${r.value}`);
                      return (
                        <CommandItem key={r.value} value={`${d} ${r.label}`} onSelect={() => toggle(d, r.value)}>
                          <Check className={`mr-1 h-4 w-4 ${on ? "opacity-100" : "opacity-0"}`} />
                          {r.label}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="sm" onClick={quickAll}>Todas</Button>
        {value.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onChange([])}>Limpiar</Button>
        )}
      </div>

      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Elige al menos una categoría: combinación de división y rama donde competirán las parejas.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {value.map((c) => (
            <Badge key={key(c)} variant="secondary" className="gap-1 py-1.5 pl-3 pr-1.5 text-xs">
              <span className="font-semibold">{c.division}</span> {sexShort(c.sex)}
              <span className="mx-1 text-muted-foreground">·</span>
              <label className="sr-only" htmlFor={`cupo-${key(c)}`}>Cupo</label>
              <input
                id={`cupo-${key(c)}`}
                type="number"
                min={1}
                value={c.max_pairs}
                onChange={(e) =>
                  onChange(
                    value.map((x) =>
                      key(x) === key(c) ? { ...x, max_pairs: Math.max(1, Number(e.target.value)) } : x,
                    ),
                  )
                }
                className="w-12 rounded border bg-background px-1 text-center text-xs tabular-nums"
              />
              <button
                type="button"
                onClick={() => toggle(c.division, c.sex)}
                aria-label={`Quitar categoría ${c.division} ${sexShort(c.sex)}`}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
