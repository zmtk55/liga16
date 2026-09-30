// Hero de página reutilizable — lleva el lenguaje visual de la landing (póster
// oscuro, franja primaria, numeral fantasma y tracking amplio) a cada sección.
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeroProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  ghost?: string;
  stats?: { k: string; v: string | number; icon?: React.ReactNode }[];
  className?: string;
}

export function PageHero({ eyebrow, title, subtitle, ghost = "16", stats, className }: PageHeroProps) {
  return (
    <section
      className={cn(
        "relative -mx-4 -mt-8 overflow-hidden bg-surface-inverse text-white md:-mx-6 md:rounded-b-[2rem]",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-14 select-none font-headline text-[10rem] leading-none text-white/[0.04] sm:text-[14rem] md:-right-10 md:text-[20rem]"
      >
        {ghost}
      </span>
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-primary" />
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{ backgroundImage: "radial-gradient(circle at 15% 0%, hsl(var(--primary)/0.15), transparent 55%)" }}
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-8 pt-8 md:px-6 md:pb-10 md:pt-10">
        <p className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-primary sm:text-xs">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          {eyebrow}
        </p>
        <h1 className="font-headline text-3xl uppercase leading-[0.95] tracking-tight sm:text-4xl md:text-5xl">
          {title}
        </h1>
        {subtitle && <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70 md:text-base">{subtitle}</p>}
        {stats && stats.length > 0 && (
          <dl
            className="mt-6 grid max-w-2xl divide-x divide-white/10 rounded-xl border border-white/10 bg-white/[0.03]"
            style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
          >
            {stats.map((s) => (
              <div key={s.k} className="px-3 py-2.5 text-center md:px-4 md:text-left flex flex-col items-center md:items-start gap-2">
                {s.icon && <div className="text-primary shrink-0">{s.icon}</div>}
                <dd className="font-headline text-xl tabular-nums sm:text-2xl md:text-3xl">{s.v}</dd>
                <dt className="mt-0.5 text-[9px] uppercase tracking-widest text-white/50 sm:text-[10px]">{s.k}</dt>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}