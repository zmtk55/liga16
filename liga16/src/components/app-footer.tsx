import { Link } from "react-router";
import { Mail } from "lucide-react";

const explore = [
  { to: "/torneos", label: "Torneos" },
  { to: "/calendario", label: "Agenda" },
  { to: "/ranking", label: "Ranking" },
  { to: "/equipos", label: "Equipos" },
];

const community = [
  { to: "/padel", label: "Sede" },
];

/** Footer compacto: menos altura en móvil, grupos en grid de 2 columnas y
 *  links legales que sí llevan a una página real. */
export function AppFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto max-w-7xl px-4 pb-6 pt-6 md:px-6">
        <div className="grid gap-6 md:grid-cols-[1.2fr_2fr] md:gap-10">
          <div>
            <div className="flex items-center justify-between gap-3">
              <Link to="/" className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-base font-bold text-primary-foreground">
                  16
                </span>
                <span className="text-lg font-bold tracking-tight">Liga16</span>
              </Link>
            </div>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              Torneos, ranking y vida de padel en un solo lugar.
            </p>
            <a
              href="mailto:admin@liga16.mx"
              className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Mail className="h-4 w-4" />
              admin@liga16.mx
            </a>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <FooterGroup title="Explorar" items={explore} />
            <FooterGroup title="Comunidad" items={community} />
            <div className="col-span-2 flex flex-col items-start gap-1 text-caption leading-relaxed text-muted-foreground sm:col-span-1">
              <Link to="/legal/privacidad" className="inline-flex min-h-8 items-center hover:text-foreground">
                Aviso de Privacidad
              </Link>
              <Link to="/legal/terminos" className="inline-flex min-h-8 items-center hover:text-foreground">
                Términos y Condiciones
              </Link>
              <Link to="/legal/soporte" className="inline-flex min-h-8 items-center hover:text-foreground">
                Soporte y ayuda
              </Link>
              <Link to="/legal/eliminar" className="inline-flex min-h-8 items-center hover:text-foreground">
                Eliminar mi cuenta
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-5 border-t pt-3 text-center text-caption text-muted-foreground">
          © {new Date().getFullYear()} Liga16 — Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}

/** Cada grupo del footer es una sección real de la página: por eso `h2` y no
 * `h3` (con `h3` la jerarquía saltaba de `h1` a `h3` en todas las páginas). */
function FooterGroup({ title, items }: { title: string; items: { to: string; label: string }[] }) {
  return (
    <div>
      <h2 className="text-caption font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item.to + item.label}>
            <Link
              to={item.to}
              className="inline-flex min-h-8 items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
