import { Link } from "react-router";
import { Facebook, Instagram } from "lucide-react";

const explore = [
  { to: "/torneos", label: "Torneos" },
  { to: "/calendario", label: "Agenda" },
  { to: "/ranking", label: "Ranking" },
  { to: "/equipos", label: "Equipos" },
];

const community = [
  { to: "/jugadores", label: "Jugadores" },
  { to: "/noticias", label: "Noticias" },
  { to: "/padel", label: "Sede" },
];

/** Footer compacto: menos altura en móvil, grupos en grid de 2 columnas y
 * links legales como texto simple porque aún no tienen página de destino. */
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
              <div className="flex gap-3 md:hidden">
                <SocialLinks />
              </div>
            </div>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              Torneos, ranking y vida de padel en un solo lugar.
            </p>
            <div className="mt-3 hidden gap-3 md:flex">
              <SocialLinks />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <FooterGroup title="Explorar" items={explore} />
            <FooterGroup title="Comunidad" items={community} />
            <p className="col-span-2 text-[11px] leading-relaxed text-muted-foreground/70 sm:col-span-1">
              Aviso de Privacidad · Términos y Condiciones · Soporte y ayuda · Eliminar mi cuenta
            </p>
          </div>
        </div>

        <div className="mt-5 border-t pt-3 text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} Liga16 — Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}

function SocialLinks() {
  return (
    <>
      <a
        href="https://facebook.com"
        target="_blank"
        rel="noreferrer"
        aria-label="Facebook"
        className="text-muted-foreground transition-colors hover:text-primary"
      >
        <Facebook className="h-4 w-4" />
      </a>
      <a
        href="https://instagram.com"
        target="_blank"
        rel="noreferrer"
        aria-label="Instagram"
        className="text-muted-foreground transition-colors hover:text-primary"
      >
        <Instagram className="h-4 w-4" />
      </a>
    </>
  );
}

function FooterGroup({ title, items }: { title: string; items: { to: string; label: string }[] }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item.to + item.label}>
            <Link
              to={item.to}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}