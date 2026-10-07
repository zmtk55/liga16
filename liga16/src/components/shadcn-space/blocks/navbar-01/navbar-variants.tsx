// Variantes de Navbar (shadcn navbar-01) como componentes reutilizables.
// Cada variante recibe `navLinks` (default: nav pública Liga16) y props opcionales
// para integrar en landing / admin. Responsivas: hamburger móvil, pills flex-wrap,
// toggle night/day (ThemeToggle) incluido.
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
import { GroupFilterBar, type GroupOption } from "./group-filter-bar";
import NavbarBase from "./navbar";

export interface NavLinkItem {
  to: string;
  label: string;
}

export const DEFAULT_NAV_LINKS: NavLinkItem[] = [
  { to: "/", label: "Inicio" },
  { to: "/torneos", label: "Torneos" },
  { to: "/jugadores", label: "Jugadores" },
  { to: "/ranking", label: "Ranking" },
];

export const pillLink = ({ isActive }: { isActive: boolean }) =>
  cn(
    "px-3 py-1.5 text-sm font-medium rounded-full outline outline-transparent transition",
    isActive
      ? "bg-primary text-primary-foreground outline-primary"
      : "text-muted-foreground hover:text-foreground hover:bg-accent",
  );

export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      to="/"
      onClick={onNavigate}
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

export function NavMobileMenu({
  navLinks,
  onNavigate,
}: { navLinks?: NavLinkItem[]; onNavigate?: () => void } = {}) {
  const items = navLinks ?? DEFAULT_NAV_LINKS;
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
          {items.map((l) => (
            <DropdownMenuItem key={l.to} asChild>
              <NavLink
                to={l.to}
                end={l.to === "/"}
                className={pillLink}
                onClick={onNavigate}
              >
                {l.label}
              </NavLink>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/login" onClick={onNavigate}>
              Entrar
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// V2: iconos a la derecha + botones
export function NavbarIcons({
  navLinks,
  onNavigate,
}: {
  navLinks?: NavLinkItem[];
  onNavigate?: () => void;
}) {
  const items = navLinks ?? DEFAULT_NAV_LINKS;
  return (
    <header className="border-b bg-background/80">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <nav className="flex items-center justify-between">
          <Brand onNavigate={onNavigate} />
          <NavMobileMenu navLinks={items} onNavigate={onNavigate} />
          <div className="hidden md:flex items-center gap-1">
            {items.map((l) => (
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

// V3: input buscar + iconos + botones + dropdown
export function NavbarSearch({
  navLinks,
  onNavigate,
  searchPlaceholder = "Buscar torneos, equipos…",
  searchValue,
  onSearch,
}: {
  navLinks?: NavLinkItem[];
  onNavigate?: () => void;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearch?: (value: string) => void;
}) {
  const items = navLinks ?? DEFAULT_NAV_LINKS;
  return (
    <header className="border-b bg-background/80">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <nav className="flex items-center justify-between gap-3">
          <Brand onNavigate={onNavigate} />
          <NavMobileMenu navLinks={items} onNavigate={onNavigate} />
          <div className="hidden md:flex items-center gap-1">
            {items.map((l) => (
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
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearch?.(e.target.value)}
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

// V4: input buscar jugadores + 3 iconos + botones + alerta + dropdown
export function NavbarPlayerSearch({
  navLinks,
  onNavigate,
  searchPlaceholder = "Buscar jugador…",
  searchValue,
  onSearch,
  alertCount = 3,
}: {
  navLinks?: NavLinkItem[];
  onNavigate?: () => void;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearch?: (value: string) => void;
  alertCount?: number;
}) {
  const items = navLinks ?? DEFAULT_NAV_LINKS;
  return (
    <header className="border-b bg-background/80">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <nav className="flex items-center justify-between gap-3">
          <Brand onNavigate={onNavigate} />
          <NavMobileMenu navLinks={items} onNavigate={onNavigate} />
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearch?.(e.target.value)}
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
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold leading-none text-destructive-foreground">
                  {alertCount}
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
                <DropdownMenuItem onSelect={() => undefined}>
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

// V5: pills de grupos + dropdown letras + botones (responsive)
export function NavbarGroupFilter({
  navLinks,
  onNavigate,
  divisions,
  letters = ["A", "B", "C", "D", "E", "F", "G", "H"],
  searchPlaceholder = "Buscar grupo…",
  searchValue,
  onSearch,
}: {
  navLinks?: NavLinkItem[];
  onNavigate?: () => void;
  divisions?: GroupOption[];
  letters?: string[];
  searchPlaceholder?: string;
  searchValue?: string;
  onSearch?: (value: string) => void;
}) {
  const items = navLinks ?? DEFAULT_NAV_LINKS;
  const [groupSel, setGroupSel] = useState("");
  const [letterSel, setLetterSel] = useState<string | null>(null);
  const groupDivisions =
    divisions ?? divisionOptions.filter((o) => o.value !== "all");

  return (
    <header className="border-b bg-background/80">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <nav className="flex items-center justify-between gap-3">
          <Brand onNavigate={onNavigate} />
          <NavMobileMenu navLinks={items} onNavigate={onNavigate} />

          {/* Pills de divisiones (visibles en móvil) */}
          <GroupFilterBar
            divisions={groupDivisions}
            value={groupSel}
            onChange={setGroupSel}
          />

          {/* Search de grupos */}
          <div className="flex-1 max-w-sm">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearch?.(e.target.value)}
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
                    type="button"
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

export { NavbarBase };
