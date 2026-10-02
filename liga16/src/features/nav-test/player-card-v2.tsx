// PlayerCardV2 — variante full-bleed: la foto abarca TODO el card y los textos
// (nombre, badge, stats, markers) se superponen sobre la imagen.
// Click = flip (reverso con stats grandes para comparar).
import { useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sexShort, winRate } from "@/lib/format";
import { buzz } from "@/lib/haptics";
import {
  FavStar,
  PlayerCardCompareBack,
  samplePlayers,
  divisionFromLevel,
} from "./player-card";
import type { PlayerCardProps } from "./player-card";

export function PlayerCardV2({ player, played, won, onOpen }: PlayerCardProps) {
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
        "group relative h-72 w-full max-w-xs overflow-hidden py-0 gap-0",
        "rounded-xl border-none bg-muted shadow-lg outline-none",
        "transition-all duration-500 ease-out [perspective:1200px]",
        "hover:-translate-y-1 hover:shadow-xl hover:brightness-110",
        "focus-visible:ring-2 focus-visible:ring-ring",
        flipped
          ? "z-30 scale-110 shadow-2xl ring-2 ring-foreground/40"
          : "active:scale-[0.985]",
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
        {/* Frente: foto full-bleed abarcando TODO el card */}
        <div className="absolute inset-0 flex flex-col [backface-visibility:hidden]">
          <img
            src={player.photo_url ?? undefined}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
            alt={player.display_name}
            className={cn(
              "absolute inset-0 h-full w-full object-cover object-center",
              "transition-transform duration-500",
              "group-hover:scale-105",
            )}
          />
          {/* Velo: en day refuerza abajo (texto oscuro); en night oscurece */}
          <div
            className={cn(
              "absolute inset-0",
              "bg-gradient-to-t from-background/90 via-background/55 to-background/25",
              "dark:from-background/55 dark:via-background/30 dark:to-background/15",
              "dark:backdrop-brightness-75",
            )}
          />

          {/* Verificado (chip para no perderse sobre la foto) */}
          <div className="absolute top-3 right-3 z-20 rounded-full bg-black/45 p-1">
            <ShieldCheck
              className="h-4 w-4 text-white"
              aria-label="Verificado"
            />
          </div>
          {/* Favorito clickeable */}
          <FavStar className="absolute top-3 left-3 z-20" />

          {/* Texto superpuesto en la zona inferior */}
          <div className="relative mt-auto space-y-2 p-4 text-foreground">
            <h3 className="font-bold text-lg text-foreground">
              {player.display_name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-foreground/80">
              <Badge
                variant="outline"
                className="rounded-full border-foreground/20 bg-foreground/10 text-foreground"
              >
                {categoria}
              </Badge>
              <span>{sexShort(player.sex)}</span>
              <span>· Nivel {level}</span>
            </div>

            {/* Stats strip: chips oscuros siempre legibles (sin verde/naranja) */}
            <div className="mt-1 flex items-center justify-between gap-2 border-t border-foreground/10 pt-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {wr !== null && (
                  <span className="rounded-full bg-black/55 px-2 py-0.5 font-bold text-white">
                    {wr}% victorias
                  </span>
                )}
                <span className="rounded-full bg-black/55 px-2 py-0.5 font-bold text-white">
                  Nivel {level}
                </span>
              </div>
              <Button
                asChild
                size="sm"
                variant="ghost"
                className={cn(
                  "h-7 shrink-0 rounded-full px-3 font-semibold",
                  "text-foreground hover:bg-foreground/10 hover:text-foreground",
                )}
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
            </div>
          </div>
        </div>

        {/* Reverso: stats grandes para comparar */}
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <PlayerCardCompareBack player={player} played={played} won={won} />
        </div>
      </div>
    </Card>
  );
}

export function PlayerCardV2Demo() {
  return (
    <section className="grid gap-6 justify-items-center sm:grid-cols-2 sm:justify-items-start lg:max-w-3xl">
      {samplePlayers.map((p) => (
        <PlayerCardV2 key={p.player.id} {...p} />
      ))}
    </section>
  );
}
