import { Calendar, Home, Package, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
} from "@/components/ui/sidebar";

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
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav className="flex flex-col space-y-1">
              <a href="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent">
                <Home className="h-4 w-4" />
                Dashboard
              </a>
              <a href="/calendar" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent">
                <Calendar className="h-4 w-4" />
                Calendario
              </a>
              <a href="/teams" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent">
                <Package className="h-4 w-4" />
                Equipos
              </a>
              <a href="/players" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent">
                <Users className="h-4 w-4" />
                Jugadores
              </a>
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