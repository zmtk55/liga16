import { Link } from "react-router";
import { Mail } from "lucide-react";

const explore = [
  { to: "/torneos", label: "Torneos" },
  { to: "/calendario", label: "Agenda" },
  { to: "/ranking", label: "Ranking" },
  { to: "/equipos", label: "Equipos" },
  { to: "/padel", label: "Sede" },
];
const help = [
  { to: "/legal/privacidad", label: "Aviso de Privacidad" },
  { to: "/legal/terminos", label: "Términos y Condiciones" },
  { to: "/legal/soporte", label: "Soporte y ayuda" },
  { to: "/legal/eliminar", label: "Eliminar mi cuenta" },
];

export function AppFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto max-w-7xl px-4 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-6 md:pb-5">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr] md:gap-8">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 md:block">
              <Link to="/" className="inline-flex min-h-11 items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">16</span>
                <span className="text-lg font-bold tracking-tight">Liga16</span>
              </Link>
              <a href="mailto:admin@liga16.mx" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:flex">
                <Mail className="h-4 w-4" />admin@liga16.mx
              </a>
            </div>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">Torneos, ranking y vida de padel en un solo lugar.</p>
          </div>
          <nav aria-label="Explorar Liga16" className="border-t border-border/70 pt-3 md:border-0 md:pt-0">
            <h2 className="text-xs font-semibold text-muted-foreground">Explorar</h2>
            <ul className="grid grid-cols-3 gap-x-3 md:grid-cols-2">
              {explore.map((item) => <li key={item.to}><Link to={item.to} className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground">{item.label}</Link></li>)}
            </ul>
          </nav>
          <nav aria-label="Ayuda y legal" className="border-t border-border/70 pt-3 md:border-0 md:pt-0">
            <h2 className="text-xs font-semibold text-muted-foreground">Ayuda y legal</h2>
            <ul className="grid grid-cols-2 gap-x-3">
              {help.map((item) => <li key={item.to}><Link to={item.to} className="inline-flex min-h-11 items-center py-1 text-xs leading-snug text-muted-foreground hover:text-foreground">{item.label}</Link></li>)}
            </ul>
          </nav>
        </div>
        <p className="mt-3 border-t pt-3 text-xs leading-relaxed text-muted-foreground">© {new Date().getFullYear()} Liga16. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}
