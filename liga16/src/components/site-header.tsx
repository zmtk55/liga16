import { Link, useNavigate } from "react-router";
import { Search, Menu, X, Shield, User, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const publicNav = [
  { to: "/", label: "Inicio" },
  { to: "/torneos", label: "Torneos" },
  { to: "/equipos", label: "Equipos" },
  { to: "/jugadores", label: "Jugadores" },
  { to: "/ranking", label: "Ranking" },
  { to: "/calendario", label: "Agenda" },
  { to: "/noticias", label: "Noticias" },
];

const adminNav = [
  { to: "/padel", label: "Sede" },
  { to: "/admin", label: "Admin" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.role === "admin" || user?.role === "organizer";
  const isDemo = !isSupabaseConfigured;
  const showAdminLinks = isAdmin || isDemo;

  const navItems = showAdminLinks ? [...publicNav, ...adminNav] : publicNav;

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!showAdminLinks) {
      navigate("/login");
      setOpen(false);
      return;
    }
    navigate(q ? `/jugadores?q=${encodeURIComponent(q)}` : "/jugadores");
    setOpen(false);
  }

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  const profileLink = user?.player_id ? `/jugadores/${user.player_id}` : "/login";

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
          <ThemeToggle />
          {showAdminLinks && (
            <form onSubmit={onSearch} className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar jugadores…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 w-48 lg:w-64 pl-9"
              />
            </form>
          )}

          {loading ? (
            <Button variant="ghost" size="icon" className="rounded-full" disabled>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-muted text-muted-foreground text-xs">…</AvatarFallback>
              </Avatar>
            </Button>
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {user.email?.[0]?.toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link to={profileLink}><User className="h-4 w-4 mr-2" /> Mi perfil</Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin"><Shield className="h-4 w-4 mr-2" /> Panel admin</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void handleSignOut(); }}>
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link to="/login"><LogIn className="h-4 w-4 mr-2" /> Entrar</Link>
            </Button>
          )}

          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen((v) => !v)}>
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
            {!user && (
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-primary"
              >
                <LogIn className="inline h-3.5 w-3.5" /> Entrar
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
