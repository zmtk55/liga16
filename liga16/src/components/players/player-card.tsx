/**
 * PlayerCard — la card de jugador del sistema.
 *
 * Anatomía única (CardKit): identidad arriba, stats abajo. La usan la galería
 * de /jugadores, la vista compacta y el directorio del admin. Antes cada uno
 * tenía su propio JSX y tres formas de mostrar "Nivel · Partidos · Récord".
 *
 * Reglas:
 *  - Nada de hex ni tamaños mágicos: solo tokens (text-stat, text-caption,
 *    bg-card, text-muted-foreground).
 *  - El valor es ReactNode; la etiqueta, string.
 *  - Sin contenedores propios: shadcn Card + CardKit.
 */
import { Link } from "react-router";
import { useState } from "react";
import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CardShell, CardIdentity, CardFooterStrip, CardStat } from "@/components/cards/card-kit";
import { PlayerAvatar } from "@/components/cards/card-image";
import { initials, sexLabel, winRate } from "@/lib/format";
import { buzz } from "@/lib/haptics";
import type { PlayerProfile } from "@/types";

export interface PlayerCardProps {
  player: PlayerProfile;
  played?: number;
  won?: number;
  division?: string | null;
  className?: string;
  footer?: ReactNode;
}

export function PlayerCard({
  player,
  played,
  won,
  division,
  className,
  footer,
}: PlayerCardProps) {
  const level = player.official_level ?? player.declared_level ?? 0;
  const hasStats = (played ?? 0) > 0;
  const wr = hasStats ? winRate(played!, won!) : null;
  const wrPct = wr !== null ? `${wr}%` : "—";
  const record =
    hasStats ? `${won}–${(played ?? 0) - (won ?? 0)}` : "—";

  return (
    <CardShell accent className={cn("h-full", className)}>
      <CardContent className="p-4">
        <CardIdentity
          lead={
            <PlayerAvatar
              name={player.display_name}
              photoUrl={player.photo_url}
              className="h-11 w-11"
            />
          }
          title={player.display_name}
          meta={
            [player.city, division].filter(Boolean).join(" · ") || undefined
          }
          end={
            hasStats ? (
              <Badge variant="secondary" className="shrink-0 tabular-nums">
                {wrPct}
              </Badge>
            ) : undefined
          }
        />
        <CardFooterStrip
          className="mt-3"
          stats={
            <>
              <CardStat value={level.toFixed(1)} label="Nivel" />
              <CardStat value={played ?? "—"} label="Partidos" />
              <CardStat value={record} label="Récord" />
            </>
          }
          chip={
            <Badge variant="outline" className="text-2xs">
              {sexLabel(player.sex)}
            </Badge>
          }
        />
        {footer}
      </CardContent>
    </CardShell>
  );
}

/** Vista compacta para listas densas (una línea + avatar). */
export function PlayerCompactRow({
  player,
  played,
  won,
  division,
}: {
  player: PlayerProfile;
  played?: number;
  won?: number;
  division?: string | null;
}) {
  const level = player.official_level ?? player.declared_level ?? 0;
  const hasStats = (played ?? 0) > 0;
  const wr = hasStats ? winRate(played!, won!) : null;

  return (
    <Link
      to={`/jugadores/${player.id}`}
      className="group flex items-center gap-2.5 rounded-xl border bg-card p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
    >
      <PlayerAvatar
        name={player.display_name}
        photoUrl={player.photo_url}
        className="h-9 w-9 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">
          {player.display_name}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {hasStats
            ? `${won}–${(played ?? 0) - (won ?? 0)} · ${wr}%`
            : `${level.toFixed(1)} lvl · ${division ?? sexLabel(player.sex)}`}
        </p>
      </div>
    </Link>
  );
}

// ── Piezas compartidas (estaban en el playground; ya son del sistema) ──────

/** Estrella de favorito compartida: clickeable en todas las variantes
 * (stopPropagation para no disparar el flip de la card). */
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

/** División a partir del nivel oficial/declarado. */
export function divisionFromLevel(level: number) {
  if (level >= 6) return "1ra";
  if (level >= 5.5) return "2da";
  if (level >= 5) return "3ra";
  if (level >= 4.5) return "4ta";
  if (level >= 4) return "5ta";
  if (level >= 3.5) return "6ta";
  return "Novatos";
}

/** Reverso del flip: stats grandes y homogéneas para comparar dos cards. */
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