import { Link, Outlet, useLocation } from "react-router";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, Trophy, Building2, Newspaper, Users, UsersRound, BarChart3, ClipboardList, Shield, Menu, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const items = [
  { to: "/admin", label: "Panel", icon: LayoutDashboard, exact: true },
  { to: "/admin/torneos", label: "Torneos", icon: Trophy },
  { to: "/admin/equipos", label: "Equipos", icon: Users },
  { to: "/admin/participantes", label: "Participantes", icon: UsersRound },
  { to: "/admin/jugadores", label: "Jugadores", icon: UsersRound },
  { to: "/admin/ranking", label: "Ranking", icon: BarChart3 },
  { to: "/admin/resultados", label: "Resultados", icon: ClipboardList },
  { to: "/admin/padel", label: "Sede", icon: Building2 },
  { to: "/admin/noticias", label: "Noticias", icon: Newspaper },
];

function SidebarContent({ loc, openSidebar, setOpenSidebar }: { loc: ReturnType<typeof useLocation>; openSidebar: boolean; setOpenSidebar: (v: boolean) => void }) {
  return (
    <>
      <div className="lg:hidden flex items-center justify-between px-4 pt-4">
        <Sheet open={openSidebar} onOpenChange={setOpenSidebar}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm"><Menu className="h-4 w-4" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[260px] p-0">
            <div className="flex items-center justify-between p-4 border-b">
              <p className="flex items-center gap-2 text-sm font-bold"><Shield className="h-4 w-4 text-primary" /> Admin Liga16</p>
              <Button variant="ghost" size="sm" onClick={() => setOpenSidebar(false)}><X className="h-4 w-4" /></Button>
            </div>
            <nav className="grid gap-1 p-2">
              {items.map(({ to, label, icon: Icon, exact }) => {
                const active = exact ? loc.pathname === to : loc.pathname.startsWith(to);
                return (
                  <Link key={to} to={to} onClick={() => setOpenSidebar(false)} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}>
                    <Icon className="h-4 w-4" /> {label}
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
        <Badge variant="outline" className="text-xs">Demo mode</Badge>
      </div>

      <aside className="space-y-4 hidden lg:block">
        <div className="rounded-xl border bg-card p-4">
          <p className="flex items-center gap-2 text-sm font-bold"><Shield className="h-4 w-4 text-primary" /> Admin Liga16</p>
          <p className="mt-1 text-xs text-muted-foreground">Centro operativo — demo sin auth real</p>
          <Badge variant="outline" className="mt-2 text-xs">Demo mode</Badge>
        </div>
        <nav className="grid gap-1">
          {items.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? loc.pathname === to : loc.pathname.startsWith(to);
            return (
              <Link key={to} to={to} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}>
                <Icon className="h-4 w-4" /> {label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

export default function AdminLayout() {
  const loc = useLocation();
  const { user, isConfigured, loading } = useAuth();
  const [openSidebar, setOpenSidebar] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  const role = (user as unknown as { role?: string })?.role;
  const isDemo = !isConfigured || !user || (role !== "admin" && role !== "organizer");
  const warningMsg = !isConfigured
    ? "Demo mode — las operaciones son locales sin persistencia."
    : !user
      ? "Modo demo — sin sesión. Todos los cambios son locales."
      : `Tu rol es "${role}" — en Supabase real necesitarías admin, aquí tienes acceso demo.`;
  const badgeVariant = !isConfigured ? "outline" : !user ? "outline" : "secondary";
  const badgeLabel = !isConfigured ? "Demo mode" : !user ? "Demo" : role ?? "player";
  void badgeVariant;
  void badgeLabel;

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <SidebarContent loc={loc} openSidebar={openSidebar} setOpenSidebar={setOpenSidebar} />

      <section className="min-w-0 px-4 lg:px-0 pt-4 lg:pt-0">
        {isDemo && (
          <div className={`mb-4 rounded-lg border p-3 text-xs ${!isConfigured ? "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/10 dark:border-yellow-800 dark:text-yellow-200" : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/10 dark:text-amber-200"}`}>
            ⚠️ {warningMsg}
          </div>
        )}
        <Outlet />
      </section>
    </div>
  );
}