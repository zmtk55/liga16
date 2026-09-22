import { Link } from "react-router";
import { Search, Menu, X, Shield, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const publicNav = [
  { to: "/", label: "Inicio" },
  { to: "/torneos", label: "Torneos" },
  { to: "/ranking", label: "Ranking" },
  { to: "/equipos", label: "Equipos" },
  { to: "/padel", label: "Padel" },
  { to: "/jugadores", label: "Jugadores" },
  { to: "/noticias", label: "Noticias" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const showAdmin = !isSupabaseConfigured || user?.role === "admin" || user?.role === "organizer";

  const navItems = showAdmin ? [...publicNav, { to: "/admin", label: "Admin" }] : publicNav;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
            16
          </span>
          <span className="text-xl font-bold tracking-tight hidden sm:inline">Liga16</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1 rounded-full border bg-muted/50 px-1.5 py-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                item.to === "/"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : item.to === "/admin"
                    ? "text-primary hover:bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              {item.to === "/admin" && <Shield className="inline h-3.5 w-3.5 mr-1" />}
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar..." className="h-9 w-48 lg:w-64 pl-9" />
          </div>

          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {user?.email?.[0]?.toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild><Link to="/jugadores">Mi perfil</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/admin">Panel admin</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/">Cerrar sesión</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" className="ml-0 md:hidden" onClick={() => setOpen((v) => !v)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <nav className="border-t md:hidden">
          <div className="space-y-1 px-4 py-2">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/10 hover:text-foreground ${
                  item.to === "/admin" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {item.to === "/admin" && <Shield className="inline h-3.5 w-3.5" />}
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
