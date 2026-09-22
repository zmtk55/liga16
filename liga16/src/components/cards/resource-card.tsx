import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Tournament } from "@/types";
import { formatMoney, formatDateRange, tournamentStatusLabel } from "@/lib/format";

interface ResourceCardProps {
  tournament: Tournament;
  badge?: string;
  description?: string;
  cta?: string;
  to?: string;
  className?: string;
}

export function ResourceCard({
  tournament,
  badge,
  description,
  cta = "Ver detalle",
  to,
  className,
}: ResourceCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5",
        className,
      )}
    >
      {/* Square-dominant image area */}
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {tournament.cover_url ? (
          <img
            src={tournament.cover_url}
            alt={tournament.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <svg
              className="h-12 w-12 opacity-30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}

        {/* Floating status badge */}
        {badge && (
          <div className="absolute top-3 right-3">
            <Badge variant="secondary" className="shadow-sm">
              {badge}
            </Badge>
          </div>
        )}

        {/* Dark hover overlay — visible on mobile (touch), hover-only on desktop */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
          {description && (
            <p className="mb-3 line-clamp-2 text-sm text-white/90">
              {description}
            </p>
          )}
          {to ? (
            <Button asChild size="sm" className="self-start bg-white text-foreground hover:bg-white/90">
              <Link to={to}>{cta}</Link>
            </Button>
          ) : (
            <Button asChild size="sm" className="self-start bg-white text-foreground hover:bg-white/90">
              <span>{cta}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Footer with metadata and action */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{tournament.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {tournament.club_name ?? "Club Pádel Reforma"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-xs text-muted-foreground">
            {formatDateRange(tournament.start_date, tournament.end_date)}
          </span>
          {tournament.price_cents > 0 && (
            <span className="text-xs font-medium">
              {formatMoney(tournament.price_cents, tournament.currency)}
            </span>
          )}
        </div>
        {to && (
          <Button asChild size="sm" className="sm:hidden">
            <Link to={to}>{cta}</Link>
          </Button>
        )}
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
  const description = tournament.description ?? `${tournament.modality} · ${tournament.format}`;
  return (
    <ResourceCard
      tournament={tournament}
      badge={statusBadge}
      description={description}
      cta="Ver torneo"
      to={`/torneos/${tournament.slug}`}
      className={className}
    />
  );
}
