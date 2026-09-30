// Navbar pública de Liga16 — patrón "navbar-01" (shadcn-space) adaptado:
// marca propia, NavigationMenu de shadcn en desktop con estado activo,
// dropdown de menú en móvil, botón de entrada destacado y menú de cuenta.
// Reglas UX aplicadas: nav-state-active, nav-label-icon, targets ≥44px,
// focus visible, transiciones ≤300ms.
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { ArrowUpRight, Menu, Shield, User, UserCog, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buzz } from "@/lib/haptics";
import { cn } from "@/lib/utils";

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
  { to: "/admin", label: "Admin", icon: Shield },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isAdmin = user?.role === "admin" || user?.role === "organizer";
  const navItems = isAdmin ? [...publicNav, ...adminNav] : publicNav;

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  const profileLink = user?.player_id ? `/jugadores/${user.player_id}` : "/login";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6">
        <nav className="flex h-11 w-full items-center justify-between gap-3.5">
          {/* Marca */}
          <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Liga16 — Inicio">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground font-headline text-lg uppercase leading-none text-background">
              16
            </span>
            <span className="hidden font-headline text-xl uppercase tracking-tight sm:inline">
              Liga16
            </span>
          </Link>

          {/* Links desktop — pastillas en contenedor píldora */}
          <div className="hidden lg:block">
            <NavigationMenu className="max-lg:hidden rounded-full bg-muted p-0.5">
              <NavigationMenuList className="flex gap-0">
                {navItems.map((item) => (
                  <NavigationMenuItem key={item.to}>
                    <NavigationMenuLink asChild>
                      <NavLink
                        to={item.to}
                        end={item.to === "/"}
                        className={cn(
                          "flex min-h-9 items-center rounded-full px-4 py-2 text-sm font-medium tracking-normal outline outline-transparent transition duration-200 hover:bg-background hover:text-foreground hover:outline-border hover:shadow-xs focus-visible:outline-2 focus-visible:outline-ring",
                          // El estado activo se calcula fuera: el className función
                          // se corrompe al pasar por el Slot de Radix.
                          (item.to === "/" ? pathname === "/" : pathname.startsWith(item.to))
                            ? "bg-background text-foreground shadow-xs outline-border"
                            : "text-muted-foreground",
                          item.to === "/admin" && "text-primary",
                        )}
                      >
                        {item.to === "/admin" && <Shield className="mr-1 h-3.5 w-3.5" />}
                        {item.label}
                      </NavLink>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          {/* Acciones */}
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <ThemeToggle />

            {loading ? (
              <Button variant="ghost" size="icon" className="rounded-full" disabled aria-label="Cargando sesión">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-muted text-xs text-muted-foreground">…</AvatarFallback>
                </Avatar>
              </Button>
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    aria-label="Menú de cuenta"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                        {user.email?.[0]?.toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem asChild>
                    <Link to="/mi-perfil">
                      <UserCog className="mr-2 h-4 w-4" /> Editar mi perfil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={profileLink}>
                      <User className="mr-2 h-4 w-4" /> Ver mi ficha
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin">
                        <Shield className="mr-2 h-4 w-4" /> Panel admin
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void handleSignOut(); }}>
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              // CTA destacado estilo navbar-01 (solo desktop; en móvil vive en el menú)
              <Button asChild className="group hidden h-10 rounded-full ps-4 pe-3 sm:inline-flex">
                <Link to="/login">
                  Entrar
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-background text-foreground transition-transform duration-200 group-hover:rotate-45">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </Link>
              </Button>
            )}

            {/* Botón de menú móvil */}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full lg:hidden"
              onClick={() => {
                buzz("tap");
                setOpen((v) => !v);
              }}
              aria-expanded={open}
              aria-controls="site-nav-mobile"
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </nav>

        {/* Menú móvil: panel desplegable, items ≥44px con estado activo */}
        {open && (
          <nav id="site-nav-mobile" className="border-t pt-2 lg:hidden" aria-label="Navegación principal">
            <div className="space-y-1 pb-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex min-h-11 items-center gap-1 rounded-lg px-3 py-2.5 text-sm font-medium transition duration-150 hover:bg-accent/10 hover:pl-4 hover:text-foreground active:scale-[0.98]",
                      isActive ? "bg-accent/15 text-foreground" : "text-muted-foreground",
                      item.to === "/admin" && "text-primary",
                    )
                  }
                >
                  {item.to === "/admin" && <Shield className="h-3.5 w-3.5" />}
                  {item.label}
                </NavLink>
              ))}
              {!user && (
                <Button asChild className="mt-2 h-11 w-full rounded-full" size="lg">
                  <Link to="/login" onClick={() => setOpen(false)}>
                    Entrar <ArrowUpRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
