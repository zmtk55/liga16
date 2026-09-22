import { Link, Outlet, useLocation } from "react-router";
import { LayoutDashboard, Trophy, Building2, Newspaper, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const items = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/torneos", label: "Torneos", icon: Trophy },
  { to: "/admin/clubes", label: "Clubes", icon: Building2 },
  { to: "/admin/noticias", label: "Noticias", icon: Newspaper },
];

export default function AdminLayout() {
  const loc = useLocation();
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-4">
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
      <section className="min-w-0">
        <Outlet />
      </section>
    </div>
  );
}