/**
 * CardKit — anatomía ÚNICA para todas las cards del sistema.
 *
 *   ┌──────────────────────────────────────┐
 *   │ [lead] Título                 [end]  │  ← CardIdentity
 *   │        meta (1 línea)                │
 *   ├──────────────────────────────────────┤
 *   │ stat · stat · stat            [chip] │  ← CardFooterStrip
 *   └──────────────────────────────────────┘
 *
 * Reglas del sistema:
 *  1. Se compone de primitivos shadcn/ui (Card, Badge, Avatar). Nada de contenedores propios.
 *  2. Tipografía solo por tokens semánticos: text-stat (valor), text-caption (etiqueta),
 *     font-headline (jerarquía editorial). Las pages no inventan tamaños.
 *  3. Color solo por token: bg-card, text-muted-foreground, bg-success, surface-inverse… nunca hex.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Calendar } from "lucide-react";
import { initials, formatMatchTime12, formatMatchDay, formatMatchMonth } from "@/lib/format";
import type { Match } from "@/types";

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
    <Card
      className={cn(
        "group gap-0 overflow-hidden py-0 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        className,
      )}
    >
      {accent && <div aria-hidden className="h-1 bg-primary" />}
      {children}
    </Card>
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
                  <span className="ml-1.5 text-caption text-muted-foreground">/</span>
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

/** Stat mini: valor (text-stat) sobre etiqueta (text-caption). Jerarquía descendente fija. */
export function CardStat({
  value,
  label,
  tone,
}: {
  value: ReactNode;
  label: string;
  tone?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center px-1 py-1.5">
      <span className={cn("text-stat tabular-nums", tone)}>{value}</span>
      <span className="text-caption uppercase text-muted-foreground">{label}</span>
    </div>
  );
}

/** Franja inferior: stats en grid + chip (Badge) a la derecha. */
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
    <div
      className={cn(
        "flex items-center gap-2 border-t border-border/60 bg-muted/40 px-3 py-1.5",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center justify-around divide-x divide-border/60">
        {stats}
      </div>
      {chip && <div className="shrink-0">{chip}</div>}
    </div>
  );
}

/** Avatares de pareja (2 jugadores solapados) sobre el primitivo Avatar de shadcn. */
export function PairAvatars({
  names,
  size = "md",
}: {
  names: (string | null | undefined)[];
  size?: "sm" | "md";
}) {
  return (
    <div className="flex shrink-0 -space-x-2.5">
      {names.slice(0, 2).map((n, i) => (
        <Avatar
          key={i}
          className={cn(
            "border-2 border-background bg-primary/10",
            size === "sm" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs",
          )}
        >
          <AvatarFallback className="bg-primary/10 font-bold text-primary">
            {initials(n ?? "?")}
          </AvatarFallback>
        </Avatar>
      ))}
    </div>
  );
}

/* ============================================================
 * MatchCard — LA card de partido del sistema (una sola anatomía).
 *   [ HORA | pareja A          s s ]
 *   [  pm  |────────────────────── ]
 *   [ día  | pareja B          s s ]
 *   [      | ronda · categoría     ]
 *   [      | [● Cancha N]          ]
 *
 * La usan: agenda/calendario, rol de equipo y popups de resultados.
 * Antes había 3 implementaciones distintas; ahora hay una.
 * ============================================================ */

/** Pares "Nombre Apellido" desde "Nombre1 / Nombre2" (tolera "y", "&"). */
function pairNames(full: string): string[] {
  const parts = full
    .split(/\s*\/\s*|\s+y\s*|\s*&\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : [full.trim()];
}

export function MatchCard({
  match,
  className,
  footer,
}: {
  match: Match;
  className?: string;
  /** Acción opcional bajo la card (ej. "Ver torneo"). */
  footer?: ReactNode;
}) {
  const isLive = match.status === "live";
  const hasScore = match.sets.length > 0;
  const timeParts = match.scheduled_at ? formatMatchTime12(match.scheduled_at).split(" ") : null;

  const sideRow = (side: "a" | "b") => {
    const names = pairNames(side === "a" ? match.side_a.pair_name : match.side_b.pair_name);
    const won = match.winner === side;
    return (
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            hasScore ? (won ? "bg-success" : "bg-muted-foreground/30") : "bg-primary/50",
          )}
        />
        <div className="min-w-0 flex-1">
          {names.map((n, i) => (
            <p
              key={i}
              className={cn(
                "truncate text-[13px] leading-snug",
                i === 0 && "font-semibold",
                hasScore ? (won ? "text-foreground" : "text-muted-foreground") : "text-foreground",
              )}
            >
              {n}
            </p>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {match.sets.map((s, i) => {
            const mine = side === "a" ? s.a : s.b;
            const theirs = side === "a" ? s.b : s.a;
            const tookSet = (mine ?? 0) > (theirs ?? 0);
            return (
              <span
                key={i}
                className={cn(
                  "flex h-6 w-7 items-center justify-center rounded-md font-mono text-xs font-bold tabular-nums",
                  tookSet ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                )}
              >
                {mine ?? "-"}
              </span>
            );
          })}
          {!hasScore && (
            <span className="px-1 text-caption uppercase text-muted-foreground/60">—</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card
      className={cn(
        "gap-0 py-0 transition-all duration-200 active:scale-[0.995]",
        isLive ? "border-destructive/40 bg-destructive/5" : "hover:border-primary/25",
        className,
      )}
    >
      <CardContent className="flex gap-3 p-3.5">
        {/* Riel izquierdo: CUÁNDO, el ancla visual más grande */}
        <div
          className={cn(
            "flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-2",
            isLive ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border/80 bg-muted/40",
          )}
        >
          {timeParts ? (
            <>
              <span className="font-headline text-xl leading-none tabular-nums">{timeParts[0]}</span>
              <span className="text-2xs font-bold uppercase">{timeParts[1] ?? ""}</span>
              <span className="mt-1 text-2xs font-semibold uppercase text-muted-foreground">
                {formatMatchDay(match.scheduled_at!)} {formatMatchMonth(match.scheduled_at!)}
              </span>
            </>
          ) : (
            <>
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="mt-1 text-2xs font-semibold uppercase text-muted-foreground">Por agendar</span>
            </>
          )}
          {isLive && (
            <span className="mt-1 flex items-center gap-1 text-2xs font-bold uppercase text-destructive">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" /> En vivo
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="mb-1.5 truncate text-caption uppercase text-muted-foreground">
            {[match.round, match.category_name].filter(Boolean).join(" · ") || match.tournament_name || "Liga16"}
          </p>
          <div className="space-y-1">
            {sideRow("a")}
            <div aria-hidden className="ml-4 h-px bg-border/70" />
            {sideRow("b")}
          </div>
          <div className="mt-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                match.court_name ? "bg-primary/10 text-primary" : "border border-dashed text-muted-foreground",
              )}
            >
              <MapPin className="h-3 w-3" />
              {match.court_name ? `Cancha ${match.court_name}` : "Cancha por asignar"}
            </span>
          </div>
        </div>
      </CardContent>
      {footer && (
        <div className="border-t border-border/60 px-3.5 py-2">{footer}</div>
      )}
    </Card>
  );
}
