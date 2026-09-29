// Scoreboard de partido unificado — se usa en resultados, calendario, rol de
// equipo y últimos partidos del jugador. Resuelve la ambigüedad de "6-3":
// siempre muestra el nombre de cada pareja junto a SUS juegos, y muestra el
// tie-break como número pequeño SOLO en sets empatados (6-6). El super
// tie-break (ej. 10-8) es un set con juegos: caja normal, sin TB falso.
import type { MatchStatus, SetScore } from "@/types";
import { cn } from "@/lib/utils";

export function MatchScoreboard({
  sideA,
  sideB,
  sets,
  winner,
  status,
  size = "md",
  className,
}: {
  sideA: string;
  sideB: string;
  sets: SetScore[];
  winner: "a" | "b" | null;
  status?: MatchStatus;
  size?: "sm" | "md";
  className?: string;
}) {
  const pending = status != null && status !== "finished" && status !== "live";
  const nameCls = size === "sm" ? "text-xs" : "text-sm";
  const cellCls = size === "sm" ? "h-5 min-w-6 px-1 text-[11px]" : "h-6 min-w-7 px-1.5 text-xs";

  if (pending || sets.length === 0) {
    return (
      <span className={cn("inline-block font-mono text-muted-foreground", nameCls, className)}>
        {pending ? "Por jugar" : "—"}
      </span>
    );
  }

  const row = (side: "a" | "b") => {
    const name = side === "a" ? sideA : sideB;
    const isWinner = winner === side;
    return (
      <div key={side} className="flex min-w-0 items-center justify-end gap-2">
        <span
          title={name}
          className={cn("max-w-[11rem] min-w-0 truncate text-right", nameCls, isWinner ? "font-bold" : "text-muted-foreground")}
        >
          {name}
        </span>
        <span className="flex shrink-0 gap-1">
          {sets.map((s, i) => {
            const mine = side === "a" ? (s.a ?? 0) : (s.b ?? 0);
            const theirs = side === "a" ? (s.b ?? 0) : (s.a ?? 0);
            const tb = side === "a" ? s.tiebreak_a : s.tiebreak_b;
            const tookSet = mine > theirs;
            // TB pequeño sólo si el set está empatado (6-6); evita el "tie-break
            // siempre activo" cuando hay datos con TB en sets que no lo tienen.
            const showTb = tb != null && (s.a ?? 0) === (s.b ?? 0);
            return (
              <span
                key={i}
                className={cn(
                  "inline-flex items-baseline justify-center rounded font-mono tabular-nums",
                  cellCls,
                  tookSet
                    ? "bg-emerald-600/15 font-bold text-emerald-700 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {mine}
                {showTb && <span className="ml-0.5 text-[8px] font-normal opacity-70">{tb}</span>}
              </span>
            );
          })}
        </span>
      </div>
    );
  };

  return (
    <div className={cn("inline-grid min-w-0 max-w-full gap-1", className)} aria-label={`Marcador: ${sideA} vs ${sideB}`}>
      {row("a")}
      {row("b")}
    </div>
  );
}
