import type { Sponsor } from "@/types";

/** Orden de aparición en el banner: los principales primero. */
const TIER_ORDER: Record<Sponsor["tier"], number> = {
  principal: 0,
  oro: 1,
  plata: 2,
  bronce: 3,
};

export default function SponsorMarquee({ sponsors }: { sponsors: Sponsor[] }) {
  // Al menos 8 logos: duplicamos la lista si es corta.
  const base = [...sponsors]
    .filter((s) => !!s.logo_url)
    .sort((a, b) => (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9));
  let expanded = base;
  while (expanded.length < 8 && expanded.length < base.length * 4) {
    expanded = [...expanded, ...base];
  }
  // Si aún no hay 8, duplicamos los que hay una última vez.
  if (expanded.length < 8) {
    const needed = 8 - expanded.length;
    expanded = [...expanded, ...base.slice(0, Math.max(1, needed))];
  }

  return (
    <section className="relative overflow-hidden border-y border-border bg-gradient-to-r from-muted/40 via-background to-muted/40 py-5">
      <div className="flex whitespace-nowrap animate-marquee gap-14">
        {expanded.map((sponsor, i) => (
          <a
            key={`${sponsor.id}-${i}`}
            href={sponsor.website ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 opacity-80 transition-opacity hover:opacity-100"
            title={sponsor.name}
          >
            {sponsor.logo_url ? (
              <img
                src={sponsor.logo_url}
                alt={sponsor.name}
                className="h-10 w-auto max-w-[150px] object-contain grayscale transition-colors hover:grayscale-0"
              />
            ) : (
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {sponsor.name}
              </span>
            )}
          </a>
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-marquee { animation: none; }
        }
      `}</style>
    </section>
  );
}
