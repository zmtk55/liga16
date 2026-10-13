// Estadísticas del jugador: forma reciente y sets, sin gráficas decorativas.
// El % de efectividad ya vive en el hero; aquí va lo que el hero no dice:
// la secuencia de resultados (V/D) y la diferencia de sets.
import { cn } from "@/lib/utils";
import type { PlayerRecord } from "@/lib/records";

export function PlayerStatsCharts({ record }: { record: PlayerRecord }) {
  const form = record.form.slice(-10);
  const offset = record.form.length - form.length;
  const total = record.setsFor + record.setsAgainst;
  const pctFor = total > 0 ? (record.setsFor / total) * 100 : 50;
  const diff = record.setsFor - record.setsAgainst;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="min-w-0">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Forma reciente</p>
          <span className="text-xs text-muted-foreground">últimos {form.length}</span>
        </div>
        <ol className="flex flex-wrap gap-1.5" aria-label={`Últimos ${form.length} partidos`}>
          {form.map((g, i) => {
            const n = offset + i + 1;
            const won = g === "G";
            const last = i === form.length - 1;
            return (
              <li
                key={n}
                title={`${won ? "Victoria" : "Derrota"} · partido ${n}${last ? " (más reciente)" : ""}`}
                aria-label={`${won ? "Victoria" : "Derrota"} en el partido ${n}`}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-extrabold",
                  won ? "bg-success text-success-foreground" : "bg-destructive/10 text-destructive",
                  last && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                )}
              >
                {won ? "V" : "D"}
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">El de la derecha es el más reciente.</p>
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sets</p>
          <span className={cn("text-xs font-extrabold tabular-nums", diff >= 0 ? "text-success" : "text-destructive")}>
            {diff > 0 ? `+${diff}` : `${diff}`}
          </span>
        </div>
        <div
          className="flex h-3 gap-1 overflow-hidden rounded-full"
          role="img"
          aria-label={`${record.setsFor} sets a favor, ${record.setsAgainst} en contra`}
        >
          <div className="bg-success" style={{ width: `${pctFor}%` }} />
          <div className="flex-1 bg-muted-foreground/25" />
        </div>
        <div className="mt-2 flex items-baseline justify-between text-sm">
          <p>
            <span className="font-extrabold tabular-nums">{record.setsFor}</span>{" "}
            <span className="text-muted-foreground">a favor</span>
          </p>
          <p>
            <span className="font-extrabold tabular-nums">{record.setsAgainst}</span>{" "}
            <span className="text-muted-foreground">en contra</span>
          </p>
        </div>
      </div>
    </div>
  );
}
