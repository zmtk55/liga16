import { Link, Outlet, useLocation } from "react-router";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, Trophy, Building2, Newspaper, Users, BarChart3, Sparkles, Shield, ShieldCheck, ShieldAlert, Menu, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const items = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/torneos", label: "Torneos", icon: Trophy },
  { to: "/admin/equipos", label: "Equipos", icon: ShieldCheck },
  { to: "/admin/jugadores", label: "Jugadores", icon: Users },
  { to: "/admin/ranking", label: "Ranking", icon: BarChart3 },
  { to: "/admin/resultados", label: "Resultados", icon: Trophy },
  { to: "/admin/padel", label: "Padel", icon: Building2 },
  { to: "/admin/noticias", label: "Noticias", icon: Newspaper },
  { to: "/admin/onboarding", label: "Onboarding", icon: Sparkles },
];

export default function AdminLayout() {
  const loc = useLocation();
  const { user, isConfigured, loading } = useAuth();
  const [openSidebar, setOpenSidebar] = useState(false);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  // Demo mode — permitir acceso con indicador visual
  if (!isConfigured) {
    return (
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
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

        <section className="min-w-0 px-4 lg:px-0 pt-4 lg:pt-0">
          <div className="mb-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 p-3 text-xs text-yellow-800 dark:text-yellow-200">
            ⚠️ Demo mode — las operaciones son locales sin persistencia.
          </div>
          <Outlet />
        </section>
      </div>
    );
  }

  // Supabase mode — requerir auth
  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="max-w-md text-center space-y-4">
          <CardContent className="pt-6 space-y-4">
            <ShieldAlert className="h-12 w-12 mx-auto text-destructive" />
            <div>
              <h2 className="text-xl font-bold">Acceso restringido</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Necesitas iniciar sesión como administrador u organizador.
              </p>
            </div>
            <Button asChild><a href="/">Ir al inicio</a></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const role = (user as any)?.role;
  if (role !== "admin" && role !== "organizer") {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="max-w-md text-center space-y-4">
          <CardContent className="pt-6 space-y-4">
            <ShieldAlert className="h-12 w-12 mx-auto text-destructive" />
            <div>
              <h2 className="text-xl font-bold">Permisos insuficientes</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Tu rol ({role || "sin rol"}) no tiene acceso al panel de administración.
              </p>
            </div>
            <Button asChild><a href="/">Ir al inicio</a></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Autenticado — renderizar layout normal
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      {/* Mobile toggle */}
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
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setOpenSidebar(false)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}>
                    <Icon className="h-4 w-4" /> {label}
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
        <Badge variant="secondary" className="text-xs">{role}</Badge>
      </div>

      <aside className="space-y-4 hidden lg:block">
        <div className="rounded-xl border bg-card p-4">
          <p className="flex items-center gap-2 text-sm font-bold"><Shield className="h-4 w-4 text-primary" /> Admin Liga16</p>
          <p className="mt-1 text-xs text-muted-foreground">Rol: {role}</p>
          <Badge variant="secondary" className="mt-2 text-xs">{role}</Badge>
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

      <section className="min-w-0 px-4 lg:px-0 pt-4 lg:pt-0">
        <Outlet />
      </section>
    </div>
  );
}