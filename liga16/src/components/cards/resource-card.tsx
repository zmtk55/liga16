import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Tournament } from "@/types";
import { formatMoney, formatDateRange, formatLabel, tournamentStatusLabel } from "@/lib/format";
import { TournamentCover } from "./card-image";

interface ResourceCardProps {
  tournament: Tournament;
  badge?: string;
  cta?: string;
  to?: string;
  className?: string;
}

export function ResourceCard({
  tournament,
  badge,
  cta = "Ver detalle",
  to,
  className,
}: ResourceCardProps) {
  const isLive = tournament.status === "in_progress";
  const price =
    tournament.price_cents > 0
      ? formatMoney(tournament.price_cents, tournament.currency)
      : null;

  return (
    <div
      className={cn(
        "liga16-surface--poster liga16-card liga16-card--lift relative overflow-hidden rounded-xl",
        "min-h-[14rem] transition-colors",
        className,
      )}
    >
      <span className="liga16-stripe" aria-hidden />

      <div className="relative flex flex-col">
        {/* Image zone: 4:5 portrait, the poster face */}
        <div className="relative aspect-[4/5] overflow-hidden">
          <TournamentCover tournament={tournament} className="h-full w-full" />

          {/* Live dot — top-left, always visible */}
          {isLive && (
            <span className="absolute inset-inline-start-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-destructive/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
              </span>
              En vivo
            </span>
          )}

          {/* Status badge — top-right, only when not live and a badge was passed */}
          {badge && !isLive && (
            <span className="absolute inset-inline-end-3 top-3 z-20">
              <Badge variant="secondary" className="rounded-full bg-black/55 text-white backdrop-blur-sm">
                {badge}
              </Badge>
            </span>
          )}

          {/* Hover CTA — desktop only, keyboard safe */}
          {to && (
            <div className="absolute inset-0 hidden flex-col items-end justify-end p-3 transition-opacity duration-200 group-hover:flex group-focus-within:flex">
              <Button
                asChild
                size="sm"
                className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Link to={to}>{cta}</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Body: title + meta + price */}
        <div className="flex flex-1 flex-col gap-1.5 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-bold leading-tight text-surface-inverse-foreground">
              {tournament.name}
            </p>
            {price && (
              <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-primary">
                {price}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-surface-inverse-foreground/60">
            {tournament.club_name ?? tournament.city ?? "Sede por confirmar"}
          </p>
          <p className="truncate text-[11px] uppercase tracking-wide text-surface-inverse-foreground/45">
            {formatDateRange(tournament.start_date, tournament.end_date)} — {formatLabel[tournament.format] ?? tournament.format}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Card specifically for tournament listing — adapts ResourceCard
 * with tournament-appropriate defaults (status badge, club description).
 */
export function TournamentCard({
  tournament,
  className,
}: {
  tournament: Tournament;
  className?: string;
}) {
  const statusBadge = tournamentStatusLabel[tournament.status];
  return (
    <ResourceCard
      tournament={tournament}
      badge={statusBadge}
      cta="Ver torneo"
      to={`/torneos/${tournament.slug}`}
      className={className}
    />
  );
}
