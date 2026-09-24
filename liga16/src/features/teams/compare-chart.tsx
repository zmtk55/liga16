// Gráfica comparativa entre dos equipos: barras horizontales animadas, sin dependencia de recharts.
// Microanimaciones: las barras crecen al montar; respeta prefers-reduced-motion.
import { useEffect, useState } from "react";

export function TeamCompareChart({
  a,
  b,
}: {
  a: { name: string; won: number; lost: number; setsFor: number; setsAgainst: number; points: number };
  b: { name: string; won: number; lost: number; setsFor: number; setsAgainst: number; points: number };
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  const rows = [
    { label: "Victorias", a: a.won, b: b.won, max: Math.max(a.won, b.won, 1) },
    { label: "Derrotas", a: a.lost, b: b.lost, max: Math.max(a.lost, b.lost, 1) },
    { label: "Sets a favor", a: a.setsFor, b: b.setsFor, max: Math.max(a.setsFor, b.setsFor, 1) },
    { label: "Sets en contra", a: a.setsAgainst, b: b.setsAgainst, max: Math.max(a.setsAgainst, b.setsAgainst, 1) },
    { label: "Puntos", a: a.points, b: b.points, max: Math.max(a.points, b.points, 1) },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> {a.name}</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/50" /> {b.name}</span>
      </div>
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{r.label}</span>
            <span className="tabular-nums">{r.a} · {r.b}</span>
          </div>
          <div className="space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
                style={{ width: mounted ? `${(r.a / r.max) * 100}%` : "0%" }}
              />
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-muted-foreground/50 transition-[width] duration-700 ease-out"
                style={{ width: mounted ? `${(r.b / r.max) * 100}%` : "0%" }}
              />
            </div>
          </div>
        </div>
      ))}
      <style>{`@media (prefers-reduced-motion: reduce) { .transition-\\[width\\] { transition: none !important; } }`}</style>
    </div>
  );
}
