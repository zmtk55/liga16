// Hero de página reutilizable — lleva el lenguaje visual de la landing (póster
// oscuro, franja primaria, numeral fantasma y tracking amplio) a cada sección.
//
// Sin "eyebrow" ni tira de stats: el kicker en versalitas sobre cada título
// es andamiaje de plantilla, no información. Si una sección necesita una cifra
// de contexto, la muestra junto al contenido que explica, no en el hero.
import { cn } from "@/lib/utils";

interface PageHeroProps {
  title: string;
  subtitle?: string;
  ghost?: string;
  className?: string;
}

export function PageHero({ title, subtitle, ghost = "16", className }: PageHeroProps) {
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
        {/* El hero es una superficie oscura: aquí el naranja de marca sí tiene
            contraste (5.3:1). `--primary-strong` es para texto sobre fondo claro. */}
        <h1 className="font-headline text-3xl uppercase leading-[0.95] tracking-tight sm:text-4xl md:text-5xl">
          {title}
        </h1>
        {subtitle && <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70 md:text-base">{subtitle}</p>}
      </div>
    </section>
  );
}