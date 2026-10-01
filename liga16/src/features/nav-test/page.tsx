// Página de prueba de variantes de Navbar (shadcn navbar-01).
// Permite toggle de modo night/day y selector de variantes sobre un slot
// sticky+blur para verificar sticky, backdrop, dropdown móvil, enlaces activos
// e iconos/botones de cada layout.
import { useState } from "react";
import { Link, NavLink } from "react-router";
import {
  ArrowUpRight,
  Bell,
  Calendar,
  Menu,
  Search,
  Settings,
  Shield,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { divisionOptions } from "@/lib/format";
import Navbar from "@/components/shadcn-space/blocks/navbar-01/navbar";

const navLinks = [
  { to: "/", label: "Inicio" },
  { to: "/torneos", label: "Torneos" },
  { to: "/jugadores", label: "Jugadores" },
  { to: "/ranking", label: "Ranking" },
  { to: "/test-navbar", label: "Test" },
];

// Hamburguesa móvil: reúne los links de navegación en un dropdown (md:hidden)
function NavMobileMenu() {
  return (
    <div className="md:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Abrir navegación"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 mt-2">
          {navLinks.map((l) => (
            <DropdownMenuItem key={l.to} asChild>
              <NavLink to={l.to} end={l.to === "/"} className={pillLink}>
                {l.label}
              </NavLink>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/login">Entrar</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function Brand() {
  return (
    <Link
      to="/"
      className="flex shrink-0 items-center gap-2.5"
      aria-label="Liga16 — Inicio"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground font-headline text-lg uppercase leading-none text-background">
        16
      </span>
      <span className="font-headline text-xl uppercase tracking-tight">
        Liga16
      </span>
    </Link>
  );
}

const pillLink = ({ isActive }: { isActive: boolean }) =>
  cn(
    "px-3 py-1.5 text-sm font-medium rounded-full outline outline-transparent transition",
    isActive
      ? "bg-primary text-primary-foreground outline-primary"
      : "text-muted-foreground hover:text-foreground hover:bg-accent",
  );

// Variante 2: iconos a la derecha + botones
function NavbarIcons() {
  return (
    <header className="border-b bg-background/80">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <nav className="flex items-center justify-between">
          <Brand />
          <NavMobileMenu />
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={pillLink}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Notificaciones"
            >
              <Bell className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Perfil"
            >
              <User className="h-4 w-4" />
            </Button>
            <Button asChild className="h-10 rounded-full ps-3">
              <Link to="/login">
                Entrar
                <ArrowUpRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}

// Variante 3: input buscar + iconos + botones + dropdown
function NavbarSearch() {
  return (
    <header className="border-b bg-background/80">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <nav className="flex items-center justify-between gap-3">
          <Brand />
          <NavMobileMenu />
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={pillLink}
              />
            ))}
          </div>
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar torneos, equipos…"
                className="h-9 w-full pl-8"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  aria-label="Menú de cuenta"
                >
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Cuenta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/login">Iniciar sesión</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/register">Crear cuenta</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild className="h-10 rounded-full ps-3">
              <Link to="/login">
                Entrar
                <ArrowUpRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}

// Variante 4: input buscar jugadores + 3 iconos diferentes + botones + alerta + dropdown
function NavbarPlayerSearch() {
  const [alerta, setAlerta] = useState(3);
  return (
    <header className="border-b bg-background/80">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <nav className="flex items-center justify-between gap-3">
          <Brand />
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar jugador…"
                className="h-9 w-full pl-8"
              />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Calendario"
            >
              <Calendar className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Usuarios"
            >
              <Users className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="relative rounded-full"
              aria-label="Alertas"
            >
              <Bell className="h-4 w-4" />
              {alerta > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-bold text-destructive-foreground">
                  {alerta}
                </span>
              )}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  aria-label="Menú de cuenta"
                >
                  <Shield className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Opciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/mi-perfil">Mi perfil</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/admin">Admin</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setAlerta(0)}
                  className="cursor-pointer"
                >
                  Limpiar alertas
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild className="h-10 rounded-full ps-3">
              <Link to="/login">
                Entrar
                <ArrowUpRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}

// Variante 5: pills de grupos (1ra..5ta) + dropdown filtros con pills de letras + botones
function NavbarGroupFilter() {
  const divisions = divisionOptions.filter((o) => o.value !== "all");
  const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const [groupSel, setGroupSel] = useState(divisions[0]?.value ?? "1ra");
  const [letterSel, setLetterSel] = useState<string | null>(null);

  return (
    <header className="border-b bg-background/80">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <nav className="flex items-center justify-between gap-3">
          <Brand />

          {/* Pills de divisiones (visibles también en móvil) */}
          <div className="flex flex-wrap items-center gap-1">
            {divisions.map((d) => (
              <button
                key={d.value}
                onClick={() => setGroupSel(d.value)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-medium transition",
                  groupSel === d.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={groupSel === d.value}
              >
                {d.label.replace(" División", "")}
              </button>
            ))}
          </div>

          {/* Search de grupos */}
          <div className="flex-1 max-w-sm">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar grupo…"
                className="h-9 w-full pl-8"
              />
            </div>
          </div>

          {/* Dropdown con pills de letras */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 rounded-full">
                <Settings className="mr-1.5 h-4 w-4" />
                Más filtros
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Filtrar por letra
              </p>
              <div className="flex flex-wrap gap-1.5">
                {letters.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLetterSel((p) => (p === l ? null : l))}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                      letterSel === l
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                    aria-pressed={letterSel === l}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {letterSel && (
                <button
                  onClick={() => setLetterSel(null)}
                  className="mt-3 text-xs text-muted-foreground underline"
                >
                  Limpiar letra
                </button>
              )}
            </PopoverContent>
          </Popover>

          {/* Botones de acción */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  aria-label="Menú de cuenta"
                >
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Cuenta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/mi-perfil">Mi perfil</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/admin">Admin</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setLetterSel(null)}>
                  Limpiar filtros
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild className="h-10 rounded-full ps-3">
              <Link to="/login">
                Entrar
                <ArrowUpRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}

const variants = {
  1: { name: "Base (navbar-01)", node: <Navbar /> },
  2: { name: "Iconos + botones", node: <NavbarIcons /> },
  3: { name: "Buscar + iconos + botones + dropdown", node: <NavbarSearch /> },
  4: {
    name: "Buscar jugadores + 3 iconos + alerta + dropdown",
    node: <NavbarPlayerSearch />,
  },
  5: {
    name: "Pills grupos + dropdown letras + botones",
    node: <NavbarGroupFilter />,
  },
} as const;

export default function NavTestPage() {
  const [v, setV] = useState<keyof typeof variants>(1);

  return (
    <div className="bg-background">
      {/* Barra de controles (no sticky) */}
      <div className="border-b bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Prueba de Navbar</h1>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Modo:</span>
              <ThemeToggle />
              <span className="text-sm text-muted-foreground">Variante:</span>
              <div className="inline-flex items-center gap-1 rounded-md bg-muted p-1 text-xs">
                {(Object.keys(variants) as unknown as Array<keyof typeof variants>).map(
                  (k) => (
                    <button
                      key={k}
                      onClick={() => setV(k)}
                      className={cn(
                        "rounded px-2 py-1 font-medium transition",
                        v === k
                          ? "bg-background text-foreground shadow"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      aria-pressed={v === k}
                    >
                      {k}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {variants[v].name}
          </p>
        </div>
      </div>

      {/* Slot sticky con blur para testear sticky + backdrop en todas las variantes */}
      <div className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-lg">
        {variants[v].node}
      </div>

      {/* Contenido scrollable para probar sticky + backdrop */}
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <section className="space-y-2">
          <h2 className="text-2xl font-bold">Contenido de prueba</h2>
          <p className="text-sm text-muted-foreground">
            Hace scroll para observar el comportamiento sticky + blur. Cambia de
            variante con los botones de arriba y togglea modo night/day.
          </p>
        </section>
        {Array.from({ length: 16 }).map((_, i) => (
          <section
            key={i}
            className="flex h-40 items-center justify-center rounded-lg border border-border bg-muted/20"
          >
            <span className="text-xs text-muted-foreground">
              Bloque {i + 1}
            </span>
          </section>
        ))}
      </main>
    </div>
  );
}
