import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { Home, Trophy, Users, BarChart3, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { buzz } from "@/lib/haptics";
import { db } from "@/lib/data";

const items = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/torneos", label: "Torneos", icon: Trophy },
  { to: "/ranking", label: "Ranking", icon: BarChart3 },
  { to: "/equipos", label: "Equipos", icon: Users },
  { to: "/calendario", label: "Agenda", icon: CalendarDays },
] as const;

export function MobileBottomNav() {
  const { pathname } = useLocation();
  const [liveCount, setLiveCount] = useState(0);
  // La nav se esconde al bajar y reaparece al subir: nunca tapa el contenido
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      // Umbral para evitar parpadeo con micro-scrolls
      if (delta > 6 && y > 80) setHidden(true);
      else if (delta < -6) setHidden(false);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Badge EN VIVO en la pestaña Agenda (solo móvil; polling suave)
  useEffect(() => {
    let active = true;
    const load = () =>
      db
        .listRecentMatches()
        .then((ms) => {
          if (active) setLiveCount(ms.filter((m) => m.status === "live").length);
        })
        .catch(() => undefined);
    load();
    const t = setInterval(load, 60_000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out md:hidden",
        hidden ? "pointer-events-none translate-y-full" : "translate-y-0",
      )}
      aria-label="Navegación principal"
      aria-hidden={hidden}
    >
      <div className="mx-auto max-w-md px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {/* Píldora flotante con borde luminoso y sombra profunda */}
        <ul className="flex items-stretch justify-between gap-0.5 rounded-2xl border border-white/10 bg-surface-inverse/95 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-lg">
          {items.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            const showLive = to === "/calendario" && liveCount > 0;
            return (
              <li key={to} className="flex-1">
                <Link
                  to={to}
                  onClick={() => {
                    buzz();
                    // Navegar siempre muestra la nav, sin un setState dentro de un efecto.
                    setHidden(false);
                  }}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 outline-none transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                    "active:scale-90 focus-visible:ring-2 focus-visible:ring-primary/60",
                  )}
                >
                  {/* Cápsula del icono: se enciende al activar */}
                  <span
                    className={cn(
                      "relative flex h-8 w-full max-w-14 items-center justify-center rounded-full transition-all duration-200",
                      active
                        ? "bg-primary text-primary-foreground shadow-[0_2px_12px_rgba(0,0,0,0.35)] group-active:scale-90"
                        : "text-white/70 group-hover:bg-white/10 group-hover:text-white group-active:scale-90",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5 transition-transform duration-200",
                        active && "scale-110",
                      )}
                      strokeWidth={active ? 2.4 : 2}
                    />
                    {/* Badge EN VIVO con ping */}
                    {showLive && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive ring-2 ring-surface-inverse" />
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] leading-none transition-colors duration-200",
                      active ? "font-bold text-white" : "font-medium text-white/50 group-hover:text-white/80",
                    )}
                  >
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
