import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { matchStatusLabel, tournamentStatusLabel } from "@/lib/format";
import type { MatchStatus, TournamentStatus } from "@/types";

const tournamentTone: Record<TournamentStatus, string> = {
  draft: "border-border bg-muted text-muted-foreground",
  published: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300",
  registration_open: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  registration_closed: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  in_progress: "border-primary/30 bg-primary/10 text-primary",
  finished: "border-border bg-secondary text-secondary-foreground",
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
};

const matchTone: Record<MatchStatus, string> = {
  scheduled: "border-border bg-muted text-muted-foreground",
  live: "border-destructive/30 bg-destructive/10 text-destructive",
  finished: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  walkover: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  disputed: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
};

function StatusBadge({
  label,
  tone,
  pulse = false,
}: {
  label: string;
  tone: string;
  pulse?: boolean;
}) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap font-medium", tone, pulse && "animate-pulse")}>
      {label}
    </Badge>
  );
}

export function TournamentStatusBadge({ status }: { status: TournamentStatus }) {
  return (
    <StatusBadge
      label={tournamentStatusLabel[status] ?? status}
      tone={tournamentTone[status] ?? tournamentTone.draft}
    />
  );
}

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  return (
    <StatusBadge
      label={matchStatusLabel[status] ?? status}
      tone={matchTone[status] ?? matchTone.scheduled}
      pulse={status === "live"}
    />
  );
}
