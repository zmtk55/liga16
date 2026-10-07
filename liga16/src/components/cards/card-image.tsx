import { cn } from "@/lib/utils";
import { formatLabel } from "@/lib/format";
import {
  Trophy,
  Newspaper,
  type LucideIcon,
} from "lucide-react";

interface CardImageProps {
  src?: string | null;
  alt?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  gradient?: string;
  className?: string;
  children?: React.ReactNode;
}

export function CardImage({
  src,
  alt = "",
  icon: Icon,
  iconClassName,
  gradient = "from-primary/30 via-primary/10 to-background",
  className,
  children,
}: CardImageProps) {
  if (src) {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
          loading="lazy"
        />
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-gradient-to-br",
        gradient,
        className,
      )}
    >
      {Icon && (
        <Icon
          className={cn("h-1/2 w-1/2 opacity-20 transition-transform duration-500 hover:scale-110", iconClassName)}
        />
      )}
      {children}
    </div>
  );
}

export function TournamentCover({
  tournament,
  className,
}: {
  tournament: Pick<
    import("@/types").Tournament,
    "name" | "modality" | "format" | "cover_url"
  >;
  className?: string;
}) {
  const gradients: Record<string, string> = {
    single_elimination: "from-success/30 via-success/10 to-background",
    groups_knockout: "from-blue-500/30 via-indigo-500/10 to-background",
    americano: "from-amber-500/30 via-orange-500/10 to-background",
    round_robin: "from-purple-500/30 via-violet-500/10 to-background",
    mexicano: "from-destructive/30 via-destructive/10 to-background",
    ladder: "from-cyan-500/30 via-sky-500/10 to-background",
    custom: "from-primary/30 via-primary/10 to-background",
  };

  if (tournament.cover_url) {
    return (
      <div className={cn("relative overflow-hidden aspect-square", className)}>
        <img
          src={tournament.cover_url}
          alt={tournament.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden aspect-square",
        gradients[tournament.format] ?? gradients.custom,
        className,
      )}
    >
      <div className="text-center px-4">
        <Trophy className="mx-auto h-12 w-12 opacity-25 mb-2" />
        <p className="text-sm font-semibold opacity-40 uppercase tracking-wider">
          {tournament.modality}
        </p>
        <p className="text-xs opacity-30 mt-1">
          {formatLabel[tournament.format] ?? tournament.format}
        </p>
      </div>
    </div>
  );
}

export function PlayerAvatar({
  name,
  photoUrl,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
}) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={cn("rounded-full object-cover", className)}
        loading="lazy"
      />
    );
  }

  // Tonos -700 (o el token, que ya es oscuro): con -600 y texto blanco las
  // iniciales medían 2.9:1 sobre el ámbar y 3.4:1 sobre el naranja.
  const colors = [
    "bg-primary text-primary-foreground",
    "bg-success",
    "bg-blue-700",
    "bg-purple-700",
    "bg-amber-700",
    "bg-destructive",
    "bg-cyan-700",
    "bg-orange-700",
    "bg-teal-700",
    "bg-indigo-700",
  ];
  const colorIndex = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full text-white font-bold",
        colors[colorIndex],
        className,
      )}
    >
      {name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()}
    </div>
  );
}

export function TeamCrest({
  name,
  crestUrl,
  className,
}: {
  name: string;
  crestUrl?: string | null;
  className?: string;
}) {
  if (crestUrl) {
    return (
      <img
        src={crestUrl}
        alt={name}
        className={cn("rounded-xl object-cover", className)}
        loading="lazy"
      />
    );
  }

  const colors = [
    "bg-primary/20 text-primary",
    "bg-success/15 text-success",
    "bg-sky-500/15 text-sky-600",
    "bg-amber-500/20 text-amber-600",
    "bg-destructive/15 text-destructive",
  ];
  const colorIndex = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl bg-muted font-bold text-lg",
        colors[colorIndex],
        className,
      )}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function NewsThumbnail({
  news,
  className,
}: {
  news: Pick<import("@/types").NewsItem, "title" | "tag" | "image_url">;
  className?: string;
}) {
  const gradients: Record<string, string> = {
    General: "from-primary/30 via-primary/10 to-background",
    Resultados: "from-success/30 via-success/10 to-background",
    Torneos: "from-blue-500/30 via-blue-500/10 to-background",
    Ligas: "from-purple-500/30 via-purple-500/10 to-background",
    Jugadores: "from-amber-500/30 via-amber-500/10 to-background",
    Clubs: "from-destructive/30 via-destructive/10 to-background",
  };

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden aspect-video",
        gradients[news.tag] ?? "from-primary/30 via-primary/10 to-background",
        className,
      )}
    >
      <Newspaper className="h-10 w-10 opacity-25" />
    </div>
  );
}
