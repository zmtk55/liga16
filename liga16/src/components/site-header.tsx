// Navbar pública de Liga16 — patrón "navbar-01" (shadcn-space) adaptado:
// marca propia, NavigationMenu de shadcn en desktop con estado activo,
// dropdown de menú en móvil, botón de entrada destacado y menú de cuenta.
//
// El control que acompaña a los links NO es una elección por sección: lo decide
// `navbarTypeFor` (ADR-0009). Browse no lleva nada, search lleva buscador, filter
// lleva buscador + división. El filtro vive en la URL, así que sobrevive al
// ir y venir y se puede compartir.
//
// Los links salen de `navFor` en `@/lib/site-nav`: la barra de escritorio y el
// menú móvil toman la MISMA lista, con el filtro de admin aplicado. Antes cada
// barra llevaba la suya y se desincronizaban solas.
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { ArrowUpRight, Menu, Shield, User, UserCog } from "lucide-react";
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
import { navFor } from "@/lib/site-nav";
import { SectionControl } from "@/components/shadcn-space/blocks/navbar-01/section-control";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isAdmin = user?.role === "admin" || user?.role === "organizer";
  const navItems = navFor(isAdmin);

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  const profileLink = user?.player_id ? `/jugadores/${user.player_id}` : "/login";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6">
        {/* Una sola fila y sin anchos fijos: marca, links, control y acciones se
            reparten el espacio con flex y el buscador cede antes que el resto.
            Antes el buscador tenía w-52 y los links no cedían, así que a 1024
            la fila se salía de la pantalla. */}
        <nav className="flex w-full items-center gap-3" aria-label="Principal">
          {/* Marca */}
          <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Liga16 — Inicio">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground font-headline text-lg uppercase leading-none text-background">
              16
            </span>
            <span className="hidden font-headline text-xl uppercase tracking-tight sm:inline">
              Liga16
            </span>
          </Link>

          {/* Links desktop — pastillas en contenedor píldora.
              Aparecen en `xl` (1280) y no en `lg` (1024) por una razón medible:
              los siete links ocupan ~627px y, con la marca y las acciones, a
              1024 no le queda sitio para el buscador —que quedaba en 50px,
              más estrecho que su propio icono de lupa—. A 1280 sí cabe entero.
              Entre `lg` y `xl` el buscador manda: es el control de la sección y
              la página se navega con la hamburguesa, que ya existe. */}
          <div className="hidden min-w-0 xl:block">
            <NavigationMenu className="rounded-full bg-muted p-0.5">
              <NavigationMenuList className="flex gap-0">
                {navItems.map((item) => (
                  <NavigationMenuItem key={item.to}>
                    <NavigationMenuLink asChild>
                      <NavLink
                        to={item.to}
                        end={item.to === "/"}
                        className={cn(
                          "flex min-h-9 items-center whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium tracking-normal outline outline-transparent transition duration-200 hover:bg-background hover:text-foreground hover:outline-border hover:shadow-xs focus-visible:outline-2 focus-visible:outline-ring",
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

          {/* El control de sección (ADR-0009). En móvil también: enterrarlo tras
              la hamburguesa dejaría sin buscador a las secciones "search", que no
              tienen otro. `min-w-0` para que sea lo que cede el espacio. */}
          <SectionControl className="xl:max-w-none" />

          {/* Acciones */}
          <div className="ml-auto flex shrink-0 items-center gap-2">
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
              <Button asChild className="group hidden h-10 shrink-0 rounded-full ps-4 pe-3 sm:inline-flex">
                <Link to="/login">
                  Entrar
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-background text-foreground transition-transform duration-200 group-hover:rotate-45">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </Link>
              </Button>
            )}

            {/* Menú móvil: el dropdown del catálogo (NavbarSearch/V5 usan este
                mismo patrón) y la misma lista de links que el escritorio. */}
            <DropdownMenu open={open} onOpenChange={setOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full xl:hidden"
                  aria-label={open ? "Cerrar menú" : "Abrir menú"}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="mt-2 w-56">
                {navItems.map((item) => (
                  <DropdownMenuItem key={item.to} asChild>
                    <NavLink
                      to={item.to}
                      end={item.to === "/"}
                      onClick={() => {
                        buzz("tap");
                        setOpen(false);
                      }}
                      className={({ isActive }) =>
                        cn(
                          "flex min-h-10 items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium",
                          isActive ? "bg-accent/15 text-foreground" : "",
                          item.to === "/admin" && "text-primary",
                        )
                      }
                    >
                      {item.to === "/admin" && <Shield className="h-3.5 w-3.5" />}
                      {item.label}
                    </NavLink>
                  </DropdownMenuItem>
                ))}
                {!user && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/login" onClick={() => setOpen(false)}>
                        Entrar
                        <ArrowUpRight className="ml-1 h-4 w-4" />
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>
      </div>
    </header>
  );
}
