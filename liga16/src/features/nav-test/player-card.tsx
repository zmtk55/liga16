// Piezas de card de jugador compartidas por `player-card-v5` (admin/jugadores)
// y `team-card`. El playground de variantes se borró; queda solo lo productivo.
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initials, sexLabel, winRate } from "@/lib/format";
import { buzz } from "@/lib/haptics";
import { Star } from "lucide-react";
import type { PlayerProfile } from "@/types";

export interface PlayerCardProps {
  player: PlayerProfile;
  /** Partidos / victorias opcionales para la stats strip. */
  played?: number;
  won?: number;
  onOpen?: (player: PlayerProfile) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export function divisionFromLevel(level: number) {
  if (level >= 6) return "1ra";
  if (level >= 5.5) return "2da";
  if (level >= 5) return "3ra";
  if (level >= 4.5) return "4ta";
  if (level >= 4) return "5ta";
  if (level >= 3.5) return "6ta";
  return "Novatos";
}

// Estrella de favorito compartida: clickeable en todas las variantes
// (stopPropagation para no disparar el flip de la card).
export function FavStar({ className }: { className?: string }) {
  const [fav, setFav] = useState(false);
  return (
    <button
      type="button"
      aria-label="Favorito"
      aria-pressed={fav}
      onClick={(e) => {
        e.stopPropagation();
        buzz("select");
        setFav((v) => !v);
      }}
      className={cn(
        "rounded-full bg-black/45 p-1.5 text-white transition hover:bg-black/70",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
        className,
      )}
    >
      <Star className={cn("h-4 w-4", fav && "fill-yellow-400 text-yellow-400")} />
    </button>
  );
}

// Reverso del flip: stats grandes y homogéneas para comparar dos cards.
export function PlayerCardCompareBack({
  player,
  played,
  won,
}: {
  player: PlayerProfile;
  played?: number;
  won?: number;
}) {
  const level = player.official_level ?? player.declared_level;
  const categoria = divisionFromLevel(level);
  const wr = played && played > 0 ? winRate(played, won ?? 0) : null;
  const lost = played != null && won != null ? Math.max(played - won, 0) : null;

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/60 bg-background p-4 text-foreground">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 shrink-0 border">
          <AvatarImage src={player.photo_url ?? undefined} alt="" />
          <AvatarFallback
            aria-hidden
            className="bg-muted font-bold text-foreground"
          >
            {initials(player.display_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-bold">{player.display_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {categoria} · {sexLabel(player.sex)} · Nivel {level}
          </p>
        </div>
      </div>

      <div className="mt-3 grid flex-1 grid-cols-2 gap-2">
        <BigStat value={wr !== null ? `${wr}%` : "—"} label="Victorias" />
        <BigStat value={String(level)} label="Nivel" />
        <BigStat value={String(won ?? "—")} label="Ganados" />
        <BigStat value={String(lost ?? "—")} label="Perdidos" />
      </div>

      <p className="mt-2 text-center text-xs uppercase tracking-wide text-muted-foreground">
        Toca para voltear
      </p>
    </div>
  );
}

function BigStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-muted py-2">
      <span className="text-3xl leading-none font-extrabold tabular-nums">
        {value}
      </span>
      <span className="mt-1 text-xs uppercase text-muted-foreground">
        {label}
      </span>
    </div>
  );
}


