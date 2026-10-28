import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { buzz } from "@/lib/haptics";
import { db } from "@/lib/data";
import {
  BottomNavigation,
  BottomNavigationHighlight,
  BottomNavigationHighlightItem,
  BottomNavigationItem,
} from "@animate-ui/react/primitives/bottom-navigation";
import { primaryNav } from "@/lib/site-nav";

// Los destinos salen de la MISMA lista que la barra de escritorio y la
// hamburguesa (`@/lib/site-nav`): aquí solo se filtran los `primary`, que son
// los cinco que caben bajo el pulgar. Antes esta barra traía su propia lista
// escrita a mano —con cinco secciones distintas de las siete del escritorio—,
// así que agregar una sección al menú no la ponía aquí y faltaba sola.
const items = primaryNav();

export function MobileBottomNav() {
  const { pathname } = useLocation();
  const [liveCount, setLiveCount] = useState(0);

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

  const activeRoute = items.find(({ to }) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to),
  )?.to ?? "";

  return (
    <BottomNavigation
      value={activeRoute}
      scrollBehavior="hide"
      className="fixed inset-x-0 bottom-0 z-50 md:hidden"
      aria-label="Navegación principal"
    >
      <div className="mx-auto max-w-md px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {/* Píldora flotante con borde luminoso y sombra profunda */}
        <BottomNavigationHighlight className="absolute inset-0 rounded-full bg-primary shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
          <ul className="flex items-stretch justify-between gap-0.5 rounded-2xl border border-white/10 bg-surface-inverse/95 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-lg">
            {items.map(({ to, label, icon: Icon }) => {
              const active = to === activeRoute;
              const showLive = to === "/calendario" && liveCount > 0;
              return (
                <li key={to} className="flex-1">
                  <BottomNavigationItem value={to} asChild>
                    <Link
                      to={to}
                      onClick={() => buzz()}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 outline-none transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
                        "active:scale-90 focus-visible:ring-2 focus-visible:ring-primary/60",
                      )}
                    >
                      {/* El mismo resaltado se desliza entre destinos. */}
                      <BottomNavigationHighlightItem value={to} asChild>
                        <span
                          className={cn(
                            "relative flex h-8 w-full max-w-14 items-center justify-center rounded-full transition-all duration-200",
                            active
                              ? "text-primary-foreground group-active:scale-90"
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
                            <span
                              aria-label={`${liveCount} ${liveCount === 1 ? "partido en vivo" : "partidos en vivo"}`}
                              className="absolute left-full -top-1 ml-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-xs font-bold leading-none text-white ring-2 ring-surface-inverse"
                            >
                              {liveCount > 9 ? "9+" : liveCount}
                            </span>
                          )}
                        </span>
                      </BottomNavigationHighlightItem>
                      <span
                        className={cn(
                          "text-xs leading-none transition-colors duration-200",
                          active ? "font-bold text-white" : "font-medium text-white/50 group-hover:text-white/80",
                        )}
                      >
                        {label}
                      </span>
                    </Link>
                  </BottomNavigationItem>
                </li>
              );
            })}
          </ul>
        </BottomNavigationHighlight>
      </div>
    </BottomNavigation>
  );
}
