import { Link } from "react-router";
import { Search, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const navItems = [
  { to: "/", label: "Inicio" },
  { to: "/torneos", label: "Torneos" },
  { to: "/ranking", label: "Ranking" },
  { to: "/clubes", label: "Clubes" },
  { to: "/jugadores", label: "Jugadores" },
  { to: "/noticias", label: "Noticias" },
  { to: "/admin", label: "Admin" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
            16
          </span>
          <span className="text-xl font-bold tracking-tight">Liga16</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar jugadores, clubes, torneos..."
              className="h-9 w-56 pl-9 lg:w-72"
            />
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link to="/jugadores">Entrar</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/torneos">Únete</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="ml-1 md:hidden"
            onClick={() => setOpen((v) => !v)}
          >
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
                className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}