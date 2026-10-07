import { Link, NavLink, Outlet } from "react-router";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  ClipboardList,
  ExternalLink,
  Inbox,
  LayoutDashboard,
  Menu,
  Newspaper,
  Trophy,
  User,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { useAdminAlerts } from "@/hooks/use-admin-alerts";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { SectionControl } from "@/components/shadcn-space/blocks/navbar-01/section-control";

/** Todos los items comparten forma; `end` y `badge` son opcionales. */
type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: "alerts";
};

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Operación",
    items: [
      { to: "/admin", label: "Panel", icon: LayoutDashboard, end: true },
      { to: "/admin/torneos", label: "Torneos", icon: Trophy },
      { to: "/admin/equipos", label: "Equipos", icon: Users },
      { to: "/admin/participantes", label: "Participantes", icon: UsersRound },
      { to: "/admin/resultados", label: "Resultados", icon: ClipboardList },
    ],
  },
  {
    label: "Directorio",
    items: [
      { to: "/admin/jugadores", label: "Jugadores", icon: User },
      { to: "/admin/ranking", label: "Ranking", icon: BarChart3 },
    ],
  },
  {
    label: "Contenido",
    items: [
      { to: "/admin/padel", label: "Sede", icon: Building2 },
      { to: "/admin/noticias", label: "Noticias", icon: Newspaper },
    ],
  },
  {
    label: "Sistema",
    items: [
      { to: "/admin/inbox", label: "Bandeja de entrada", icon: Inbox, badge: "alerts" },
      { to: "/admin/estado", label: "Estado", icon: Activity },
    ],
  },
];

function AdminBrand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link to="/admin" onClick={onNavigate} className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
        16
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight">Liga16</span>
        <span className="block text-xs leading-tight text-muted-foreground">Administración</span>
      </span>
    </Link>
  );
}

function AdminNav({ onNavigate, alertCount }: { onNavigate?: () => void; alertCount?: number }) {
  return (
    <nav className="space-y-5 px-3 py-4" aria-label="Navegación del admin">
      {navGroups.map((group) => (
        <div key={group.label}>
          <p className="mb-1 px-3 text-xs font-medium text-muted-foreground">{group.label}</p>
          <div className="space-y-0.5">
            {group.items.map(({ to, label, icon: Icon, end, badge }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary-strong"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
                {badge === "alerts" && alertCount && alertCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-auto text-xs font-semibold"
                  >
                    {alertCount}
                  </Badge>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function AccountPanel({ onNavigate }: { onNavigate?: () => void }) {
  const { user, isConfigured } = useAuth();

  return (
    <div className="space-y-3 border-t p-3">
      <div className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{user?.email ?? "Sesión no iniciada"}</p>
          <p className="text-xs text-muted-foreground">
            {isConfigured ? `Rol: ${user?.role ?? "—"}` : "Modo demo local"}
          </p>
        </div>
        <ThemeToggle />
      </div>
      <Button asChild variant="outline" size="sm" className="w-full justify-start">
        <Link to="/" onClick={onNavigate}>
          <ExternalLink className="h-4 w-4" />
          Ver sitio público
        </Link>
      </Button>
    </div>
  );
}

export default function AdminLayout() {
  const [openNav, setOpenNav] = useState(false);
  const { loading, isConfigured } = useAuth();
  const { alerts: adminAlerts } = useAdminAlerts();
  const alertCount = adminAlerts.length;

  return (
    <div className="min-h-dvh bg-muted/30">
      <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-card lg:flex">
          <div className="flex h-16 shrink-0 items-center border-b px-5">
            <AdminBrand />
          </div>
          <div className="flex-1 overflow-y-auto">
            <AdminNav alertCount={alertCount} />
          </div>
          <AccountPanel />
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-card/95 px-4 backdrop-blur lg:hidden">
            <Sheet open={openNav} onOpenChange={setOpenNav}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Abrir navegación">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-[280px] flex-col p-0">
                <div className="flex h-16 items-center justify-between border-b px-4">
                  <SheetTitle className="p-0">
                    <AdminBrand onNavigate={() => setOpenNav(false)} />
                  </SheetTitle>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <AdminNav alertCount={alertCount} onNavigate={() => setOpenNav(false)} />
                </div>
                <AccountPanel onNavigate={() => setOpenNav(false)} />
              </SheetContent>
            </Sheet>
            <AdminBrand />
            <Button asChild variant="ghost" size="icon" className="relative" aria-label={`Bandeja de entrada (${alertCount})`}>
              <Link to="/admin/inbox">
                <Bell className="h-5 w-5" />
                {alertCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-0.5 -right-0.5 h-5 min-w-[20px] rounded-full px-[3px]"
                  >
                    {alertCount}
                  </Badge>
                )}
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/">Salir</Link>
            </Button>
          </header>

          <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {loading ? (
              <div className="space-y-6" aria-label="Cargando panel">
                <Skeleton className="h-20 w-full" />
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-28" />
                  ))}
                </div>
                <Skeleton className="h-72 w-full" />
              </div>
            ) : (
              <>
                {!isConfigured && (
                  <div
                    role="status"
                    className="mb-6 flex items-start gap-2.5 rounded-lg border bg-card px-3.5 py-2.5 text-sm text-muted-foreground"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <p>
                      Modo demo: los cambios viven en memoria — duran hasta que
                      recargues la página y no se sincronizan con Supabase.
                    </p>
                  </div>
                )}
                {/* El control de sección (ADR-0009) va sobre el contenido, no en
                    la barra. El admin no es una navbar: es sidebar + contenido, y
                    la barra de arriba la ocupa la marca y la bandeja. Meter el
                    buscador ahí lo dejaba en 110px dentro de una columna de 248px
                    —y el buscador del Ranking, en 67px en móvil—, porque competía
                    con el logo y con el botón de salir. Arriba del contenido tiene
                    todo el ancho, y la regla se sigue cumpliendo igual: un solo
                    control por sección, siempre en el mismo sitio. Para las
                    secciones "browse" no se dibuja nada.

                    Esto sustituye al parche del commit 186a4e0 (fila propia en el
                    sidebar solo para tipo "search"): aquel duplicaba el control
                    con una segunda llamada a SectionControl, que es justamente el
                    patrón de dos llamadas que este layout ya no tiene. La fila
                    del sidebar, además, daba el buscador a 216px de ancho útil
                    dentro de una columna de 248px. */}
                <SectionControl className="mb-4 sm:max-w-md" />
                <Outlet />
              </>
            )}
          </main>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
