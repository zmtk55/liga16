/**
 * Repisa de medallas del perfil: los logros derivados (lib/medals) como
 * badges con nivel bronce/plata/oro y progreso hacia el siguiente.
 *
 * El ARTE es intercambiable: cada medalla puede traer un asset generado por
 * nivel (`art`); sin asset cae al badge de componente (anillo metálico +
 * icono), que es la base visual garantizada en dark/light.
 */

import { useState } from "react";
import { motion } from "motion/react";
import {
  Award, CalendarCheck, Crown, Flame, Lock, Medal, Shield, Star, Target, Trophy,
} from "lucide-react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { MedalState, MedalTier } from "@/lib/medals";

/**
 * Arte generado por medalla y nivel (assets intercambiables): si existe
 * `/medals/<id>-<nivel>.webp` en public/ se usa como badge; si no, la medalla
 * cae al icono de componente con los colores del nivel. Así el arte puede
 * llegar pieza por pieza sin tocar código.
 */

const ICONS: Record<string, typeof Trophy> = {
  trophy: Trophy,
  medal: Medal,
  award: Award,
  crown: Crown,
  star: Star,
  calendar: CalendarCheck,
  flame: Flame,
  target: Target,
  shield: Shield,
};

const TIER_LABEL: Record<MedalTier, string> = { bronce: "Bronce", plata: "Plata", oro: "Oro" };

/** Anillo metálico del nivel: gradiente + brillo sutil, legible en dark/light. */
const TIER_RING: Record<MedalTier, string> = {
  oro: "from-amber-400 via-yellow-600 to-amber-700 shadow-[0_0_18px_-2px_hsl(38_92%_50%/0.6)]",
  plata: "from-slate-300 via-slate-500 to-slate-600 shadow-[0_0_14px_-4px_hsl(220_10%_50%/0.55)]",
  bronce: "from-orange-400 via-orange-700 to-orange-900 shadow-[0_0_14px_-4px_hsl(28_87%_38%/0.55)]",
};
const TIER_INNER: Record<MedalTier, string> = {
  oro: "bg-amber-50 dark:bg-amber-500/10",
  plata: "bg-slate-100 dark:bg-slate-400/10",
  bronce: "bg-orange-50 dark:bg-orange-500/10",
};
const TIER_ICON: Record<MedalTier, string> = {
  oro: "text-amber-500",
  plata: "text-slate-500 dark:text-slate-300",
  bronce: "text-orange-700 dark:text-orange-400",
};

function MedalBadge({ medal, index }: { medal: MedalState; index: number }) {
  const Icon = ICONS[medal.def.icon] ?? Medal;
  const earned = medal.tier !== null;
  const [open, setOpen] = useState(false);
  const art = earned ? `/medals/${medal.def.id}-${medal.tier}.webp` : null;
  const [artBroken, setArtBroken] = useState(false);
  return (
    <motion.li
      initial={{ opacity: 0, y: 10, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.05 * index, duration: 0.35, ease: "easeOut" }}
      className="relative flex flex-col items-center gap-1.5 text-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div
        className={cn(
          "relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br p-1 sm:h-[4.5rem] sm:w-[4.5rem]",
          earned ? TIER_RING[medal.tier!] : "border-2 border-dashed border-border bg-transparent p-0",
        )}
      >
        <div
          className={cn(
            "flex h-full w-full items-center justify-center rounded-full",
            earned ? TIER_INNER[medal.tier!] : "bg-muted/50",
          )}
        >
          {earned && art && !artBroken ? (
            <img
              src={art}
              alt=""
              className="h-full w-full rounded-full object-cover"
              onError={() => setArtBroken(true)}
            />
          ) : (
            <Icon className={cn("h-6 w-6", earned ? TIER_ICON[medal.tier!] : "text-muted-foreground/50")} />
          )}
        </div>
        {!earned && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border bg-card text-muted-foreground">
            <Lock className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
      <div className="space-y-0.5">
        <p className={cn("text-2xs font-bold uppercase tracking-wider leading-tight", earned ? "text-foreground" : "text-muted-foreground/70")}>
          {medal.def.name}
        </p>
        {earned ? (
          <p className={cn("text-2xs font-semibold tabular-nums", TIER_ICON[medal.tier!])}>
            {medal.def.descending
              ? `${TIER_LABEL[medal.tier!]} · #${medal.current}`
              : `${TIER_LABEL[medal.tier!]}${medal.nextTarget ? ` · ${medal.current}/${medal.nextTarget}` : ""}`}
          </p>
        ) : (
          <p className="text-2xs tabular-nums text-muted-foreground/70">
            {medal.lockedNote
              ? medal.lockedNote
              : medal.nextTarget
                ? `${medal.def.descending ? `#${medal.current || "—"}` : medal.current}/${medal.def.descending ? `#${medal.nextTarget}` : medal.nextTarget}`
                : "por ganar"}
          </p>
        )}
        {!earned && medal.progress > 0 && (
          <div className="mx-auto h-1 w-10 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-muted-foreground/40" style={{ width: `${Math.round(medal.progress * 100)}%` }} />
          </div>
        )}
      </div>
      {open && (
        <div className="absolute z-50 bottom-full left-1/2 mb-2 w-56 -translate-x-1/2 rounded-lg bg-surface-inverse px-3 py-2 text-left text-xs text-surface-inverse-foreground shadow-lg animate-fade-in">
          <p className="font-semibold">{medal.def.name}</p>
          <p className="mt-0.5 opacity-90">{medal.def.rule}</p>
          <p className="mt-1 opacity-75">{medal.detail}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-inverse" />
        </div>
      )}
    </motion.li>
  );
}

export function MedalShelf({ medals }: { medals: MedalState[] }) {
  const [open, setOpen] = useState(false);
  if (medals.length === 0) return null;
  const earned = medals.filter((m) => m.tier !== null).length;
  return (
    <Card className="overflow-hidden">
      {/* Colapsable (pedido de Julian, 31-oct-2026): la repisa se puede ocultar;
          cerrada por defecto, queda el título con el contador. */}
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 text-left"
              aria-expanded={open}
            >
              <CardTitle className="text-base flex items-center gap-2">
                <Medal className="h-4 w-4 text-primary" /> Repisa de medallas
              </CardTitle>
              <span className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground transition-colors hover:text-foreground">
                {earned}/{medals.length} conseguidas
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
              </span>
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            <ul className="grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-3 lg:grid-cols-3">
              {medals.map((m, i) => (
                <MedalBadge key={m.def.id} medal={m} index={i} />
              ))}
            </ul>
            <p className="mt-4 text-center text-2xs text-muted-foreground">
              Se calculan solas de tus resultados: si se corrige un partido, la repisa se ajusta.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
