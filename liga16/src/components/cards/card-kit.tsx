/**
 * CardKit — anatomía ÚNICA para todas las cards del sistema.
 *
 *   ┌──────────────────────────────────────┐
 *   │ [identidad]  Título            [fin] │  ← Identity: lead + título + 1 meta
 *   │              meta                    │
 *   ├──────────────────────────────────────┤
 *   │ stat · stat · stat            [chip] │  ← FooterStrip: stats + 1 chip
 *   └──────────────────────────────────────┘
 *
 * Reglas: máx 1 línea de meta, solo datos con significado, nada duplicado.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Contenedor uniforme: mismo radio, borde, hover y transición en TODO el sistema. */
export function CardShell({
  children,
  className,
  accent = false,
}: {
  children: ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "group overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        className,
      )}
    >
      {accent && <div aria-hidden className="h-1 bg-primary" />}
      {children}
    </div>
  );
}

/** Identidad: avatar opcional + título (o 2 líneas para parejas) + UNA meta + slot derecho. */
export function CardIdentity({
  lead,
  title,
  titleLines,
  meta,
  end,
  className,
}: {
  lead?: ReactNode;
  title?: ReactNode;
  /** Nombres apilados (parejas): cada uno en su línea, sin truncarse. */
  titleLines?: string[];
  meta?: ReactNode;
  end?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {lead}
      <div className="min-w-0 flex-1">
        {titleLines ? (
          <div className="leading-tight">
            {titleLines.map((line, i) => (
              <p key={i} className="truncate text-sm font-bold tracking-tight">
                {line}
                {i < titleLines.length - 1 && (
                  <span className="ml-1.5 text-[10px] font-medium text-muted-foreground">/</span>
                )}
              </p>
            ))}
          </div>
        ) : (
          <p className="truncate text-sm font-bold tracking-tight">{title}</p>
        )}
        {meta && <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>}
      </div>
      {end && <div className="shrink-0">{end}</div>}
    </div>
  );
}

/** Stat mini: valor + etiqueta, para la franja inferior. */
export function CardStat({ value, label, tone }: { value: ReactNode; label: string; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center px-1 py-1.5">
      <span className={cn("font-display text-sm font-bold tabular-nums", tone)}>{value}</span>
      <span className="mt-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}

/** Franja inferior: stats en grid + chip a la derecha. */
export function CardFooterStrip({
  stats,
  chip,
  className,
}: {
  stats: ReactNode;
  chip?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 border-t border-border/60 bg-muted/40 px-3 py-1.5", className)}>
      <div className="flex min-w-0 flex-1 items-center justify-around divide-x divide-border/60">{stats}</div>
      {chip && <div className="shrink-0">{chip}</div>}
    </div>
  );
}

/** Avatares de pareja (2 jugadores solapados) con iniciales. */
export function PairAvatars({
  names,
  size = "md",
}: {
  names: (string | null | undefined)[];
  size?: "sm" | "md";
}) {
  const cls = size === "sm" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs";
  return (
    <div className="flex shrink-0 -space-x-2.5">
      {names.slice(0, 2).map((n, i) => (
        <span
          key={i}
          className={cn(
            "flex items-center justify-center rounded-full border-2 border-background bg-primary/10 font-bold text-primary",
            cls,
          )}
        >
          {(n ?? "?")
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </span>
      ))}
    </div>
  );
}
