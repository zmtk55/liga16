import { NavLink } from "react-router";
import { Calendar, Home, MapPin, Newspaper, Package, Trophy, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: Home, end: true },
  { to: "/torneos", label: "Torneos", icon: Trophy },
  { to: "/calendario", label: "Calendario", icon: Calendar },
  { to: "/ranking", label: "Ranking", icon: Package },
  { to: "/equipos", label: "Equipos", icon: Users },
  { to: "/jugadores", label: "Jugadores", icon: Users },
  { to: "/clubes", label: "Clubes", icon: MapPin },
  { to: "/noticias", label: "Noticias", icon: Newspaper },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
    isActive
      ? "bg-accent text-accent-foreground font-medium"
      : "hover:bg-accent hover:text-accent-foreground",
  );

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-3 font-bold">
          <span>Liga16</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav className="flex flex-col space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={navLinkClass}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="p-4 text-xs text-muted-foreground">
          Liga16 Web v1.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}