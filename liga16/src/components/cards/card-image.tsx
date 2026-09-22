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
    single_elimination: "from-emerald-500/30 via-teal-500/10 to-background",
    groups_knockout: "from-blue-500/30 via-indigo-500/10 to-background",
    americano: "from-amber-500/30 via-orange-500/10 to-background",
    round_robin: "from-purple-500/30 via-violet-500/10 to-background",
    mexicano: "from-rose-500/30 via-pink-500/10 to-background",
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

  const colors = [
    "bg-primary",
    "bg-emerald-600",
    "bg-blue-600",
    "bg-purple-600",
    "bg-amber-600",
    "bg-rose-600",
    "bg-cyan-600",
    "bg-orange-600",
    "bg-teal-600",
    "bg-indigo-600",
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
    "from-primary/40 to-primary/10",
    "from-emerald-500/30 to-emerald-500/10",
    "from-blue-500/30 to-blue-500/10",
    "from-purple-500/30 to-purple-500/10",
    "from-amber-500/30 to-amber-500/10",
  ];
  const colorIndex = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl bg-gradient-to-br font-bold text-white/60 text-lg",
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
    Resultados: "from-emerald-500/30 via-emerald-500/10 to-background",
    Torneos: "from-blue-500/30 via-blue-500/10 to-background",
    Ligas: "from-purple-500/30 via-purple-500/10 to-background",
    Jugadores: "from-amber-500/30 via-amber-500/10 to-background",
    Clubs: "from-rose-500/30 via-rose-500/10 to-background",
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
