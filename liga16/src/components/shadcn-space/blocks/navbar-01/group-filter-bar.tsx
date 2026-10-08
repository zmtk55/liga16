// Barra de pills responsiva de filtros de grupo (divisiones / letras).
// Reutilizable en landing (Home) y admin (Jugadores) y el playground nav-test.
// Estilo pills de navbar-01; responsive: flex-wrap, se achica en móvil.
import { cn } from "@/lib/utils";

export interface GroupOption {
  value: string;
  label: string;
}

export function GroupFilterBar({
  divisions,
  letters,
  value,
  onChange,
  clearValue = "",
  className,
}: {
  divisions?: GroupOption[];
  letters?: string[];
  value?: string;
  onChange?: (value: string) => void;
  clearValue?: string;
  className?: string;
}) {
  const toggle = (v: string) => onChange?.(v === value ? clearValue : v);

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {divisions?.map((d) => {
        const active = value === d.value;
        return (
          <button
            key={d.value}
            type="button"
            onClick={() => toggle(d.value)}
            aria-pressed={active}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {d.label}
          </button>
        );
      })}
      {letters?.map((l) => {
        const active = value === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => toggle(l)}
            aria-pressed={active}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
            aria-label={`Filtra por letra ${l}`}
          >
            {l}
          </button>
        );
      })}
      {value && (divisions?.length || letters?.length) && (
        <button
          type="button"
          onClick={() => onChange?.(clearValue)}
          className="inline-flex h-7 items-center rounded-md px-2 text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Limpiar filtro de grupos"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}
