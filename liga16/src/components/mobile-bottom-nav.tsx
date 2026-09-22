import { Link, useLocation } from "react-router";
import { Home, Trophy, Users, BarChart3, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/torneos", label: "Torneos", icon: Trophy },
  { to: "/equipos", label: "Equipos", icon: Users },
  { to: "/ranking", label: "Ranking", icon: BarChart3 },
  { to: "/calendario", label: "Agenda", icon: CalendarDays },
] as const;

export function MobileBottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden">
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
        {items.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-9 items-center justify-center rounded-full transition-colors",
                    active ? "bg-primary text-primary-foreground shadow-sm" : "bg-transparent"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className={cn(active && "font-semibold")}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
