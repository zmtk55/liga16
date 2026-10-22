import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { matchStatusLabel, tournamentStatusLabel } from "@/lib/format";
import type { MatchStatus, TournamentStatus } from "@/types";

const tournamentTone: Record<TournamentStatus, string> = {
  draft: "border-border bg-muted text-muted-foreground",
  published: "border-info/30 bg-info/10 text-info",
  registration_open: "border-success/30 bg-success/10 text-success",
  registration_closed: "border-warning/30 bg-warning/10 text-warning-strong",
  in_progress: "border-primary/30 bg-primary/10 text-primary-strong",
  finished: "border-border bg-secondary text-secondary-foreground",
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
};

const matchTone: Record<MatchStatus, string> = {
  scheduled: "border-border bg-muted text-muted-foreground",
  live: "border-destructive/30 bg-destructive/10 text-destructive",
  finished: "border-success/30 bg-success/10 text-success",
  walkover: "border-warning/30 bg-warning/10 text-warning-strong",
  disputed: "border-warning/30 bg-warning/10 text-warning-strong",
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
