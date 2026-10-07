// PlayerCard — showcase de card para jugador en el playground nav-test.
// Reusa CardKit (CardIdentity, CardStat, CardFooterStrip), Avatar de shadcn,
// micro-animaciones de Tailwind (config) y haptics. No modifica el productivo.
// Click en la card = flip (vuelta con stats grandes para comparar).
import { useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardIdentity, CardStat, CardFooterStrip } from "@/components/cards/card-kit";
import { cn } from "@/lib/utils";
import { initials, sexShort, winRate } from "@/lib/format";
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
            {categoria} · {sexShort(player.sex)} · Nivel {level}
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

export function PlayerCard({ player, played, won, onOpen }: PlayerCardProps) {
  const [flipped, setFlipped] = useState(false);
  const level = player.official_level ?? player.declared_level;
  const categoria = divisionFromLevel(level);
  const wr = played && played > 0 ? winRate(played, won ?? 0) : null;

  const toggleFlip = () => {
    buzz("tap");
    setFlipped((f) => !f);
  };

  return (
    <Card
      onClick={toggleFlip}
      className={cn(
        "group relative h-60 w-full gap-0 overflow-hidden py-0 shadow-sm outline-none",
        "transition-all duration-500 [perspective:1200px]",
        "hover:-translate-y-0.5 hover:shadow-md",
        "focus-visible:ring-2 focus-visible:ring-ring",
        flipped
          ? "z-30 scale-110 shadow-2xl ring-2 ring-foreground/40"
          : "active:scale-[0.990]",
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          toggleFlip();
        }
      }}
    >
      <div
        className={cn(
          "relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d]",
          flipped && "[transform:rotateY(180deg)]",
        )}
      >
        {/* Frente: foto full-bleed de fondo + CardKit encima */}
        <div className="absolute inset-0 flex flex-col [backface-visibility:hidden]">
          <img
            src={player.photo_url ?? undefined}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/75 via-background/55 to-background/75" />
          <CardContent className="relative z-10 p-4">
            <CardIdentity
              lead={
                <Avatar className="h-12 w-12 shrink-0 border-2 border-background bg-muted">
                  <AvatarImage src={player.photo_url ?? undefined} alt={player.display_name} />
                  <AvatarFallback
                    aria-hidden
                    className="bg-muted font-bold text-foreground"
                  >
                    {initials(player.display_name)}
                  </AvatarFallback>
                </Avatar>
              }
              title={player.display_name}
              meta={
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge
                    variant="outline"
                    className="rounded-full border-muted"
                  >
                    {categoria}
                  </Badge>
                  <span>{sexShort(player.sex)}</span>
                  <span>· Nivel {level}</span>
                </div>
              }
              end={
                <span className="flex items-center gap-1.5">
                  <ShieldCheck
                    className="h-4 w-4 text-foreground/70"
                    aria-label="Verificado"
                  />
                  <FavStar />
                </span>
              }
            />
          </CardContent>

          <CardFooterStrip
            className="relative z-10 border-foreground/10 bg-background/60 py-1.5 backdrop-blur-md"
            stats={
              <>
                {wr !== null && (
                  <CardStat value={`${wr}%`} label="Victorias" />
                )}
                <CardStat value={level} label="Nivel" />
              </>
            }
            chip={
              <Button
                asChild
                size="sm"
                variant="ghost"
                className="h-7 rounded-full px-3 font-semibold"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onOpen) {
                    buzz("select");
                    onOpen(player);
                  }
                }}
              >
                <Link
                  to={`/jugadores/${player.id}`}
                  onClick={() => buzz("select")}
                >
                  Ver perfil
                  <ArrowUpRight className="ml-1.5 h-3.5 w-4" />
                </Link>
              </Button>
            }
          />
        </div>

        {/* Reverso: stats grandes para comparar */}
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <PlayerCardCompareBack player={player} played={played} won={won} />
        </div>
      </div>
    </Card>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const samplePlayers: PlayerCardProps[] = [
  {
    player: {
      id: "p1",
      user_id: "u1",
      display_name: "María Fernández",
      username: "maria.f",
      photo_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&h=800&fit=crop",
      city: "Lima",
      state: "Lima",
      country: "Perú",
      birth_date: "1995-04-12",
      sex: "F",
      declared_level: 5.5,
      official_level: 5.5,
      dominant_hand: "right",
      preferred_position: "reves",
      bio: null,
      is_public: true,
      role: "player",
      status: "verificado",
    },
    played: 42,
    won: 28,
  },
  {
    player: {
      id: "p2",
      user_id: "u2",
      display_name: "Carlos Mendoza",
      username: "carlitotenis",
      photo_url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&h=800&fit=crop",
      city: "Bogotá",
      state: "Cundinamarca",
      country: "Colombia",
      birth_date: "1992-09-30",
      sex: "M",
      declared_level: 3.75,
      official_level: null,
      dominant_hand: "left",
      preferred_position: "drive",
      bio: null,
      is_public: true,
      role: "player",
      status: "verificado",
    },
    played: 8,
    won: 2,
  },
  ];

export function PlayerCardDemo() {
  return (
    <section className="grid gap-4 justify-items-center sm:grid-cols-2 sm:justify-items-start lg:max-w-3xl">
      {samplePlayers.map((p) => (
        <PlayerCard key={p.player.id} {...p} />
      ))}
    </section>
  );
}
