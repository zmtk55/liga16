import { Link } from "react-router";
import { Facebook, Instagram } from "lucide-react";

const explore = [
  { to: "/torneos", label: "Torneos" },
  { to: "/ranking", label: "Ranking" },
  { to: "/padel", label: "Padel" },
  { to: "/calendario", label: "Calendario" },
];

const community = [
  { to: "/jugadores", label: "Jugadores" },
  { to: "/noticias", label: "Noticias" },
  { to: "/torneos", label: "Torneos" },
];

const legal = [
  { to: "/", label: "Aviso de Privacidad" },
  { to: "/", label: "Términos y Condiciones" },
  { to: "/", label: "Soporte y ayuda" },
  { to: "/", label: "Eliminar mi cuenta" },
];

export function AppFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
                16
              </span>
              <span className="text-xl font-bold tracking-tight">Liga16</span>
            </Link>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              Torneos, ranking y vida de padel en un solo lugar.
            </p>
            <div className="mt-4 flex gap-3">
              <a href="https://facebook.com" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </div>

          <FooterGroup title="Explorar" items={explore} />
          <FooterGroup title="Comunidad" items={community} />
          <FooterGroup title="Legal" items={legal} />
        </div>

        <div className="mt-10 border-t pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Liga16 — Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}

function FooterGroup({ title, items }: { title: string; items: { to: string; label: string }[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.to + item.label}>
            <Link to={item.to} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}