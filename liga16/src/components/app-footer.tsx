import { Link } from "react-router";
import { Facebook, Instagram } from "lucide-react";

const explore = [
  { to: "/torneos", label: "Torneos" },
  { to: "/calendario", label: "Agenda" },
  { to: "/ranking", label: "Ranking" },
  { to: "/equipos", label: "Equipos" },
];

const community = [
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
            <p className="col-span-2 text-caption leading-relaxed text-muted-foreground sm:col-span-1">
              Aviso de Privacidad · Términos y Condiciones · Soporte y ayuda · Eliminar mi cuenta
            </p>
          </div>
        </div>

        <div className="mt-5 border-t pt-3 text-center text-caption text-muted-foreground">
          © {new Date().getFullYear()} Liga16 — Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}

/** Los iconos se ven de 16px pero se tocan con 32px: el área de clic del
 * ícono desnudo era de 16x16, menor que la mitad del mínimo cómodo. */
function SocialLinks() {
  return (
    <>
      <a
        href="https://facebook.com"
        target="_blank"
        rel="noreferrer"
        aria-label="Liga16 en Facebook"
        className="-m-2 flex h-8 w-8 items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Facebook className="h-4 w-4" />
      </a>
      <a
        href="https://instagram.com"
        target="_blank"
        rel="noreferrer"
        aria-label="Liga16 en Instagram"
        className="-m-2 flex h-8 w-8 items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Instagram className="h-4 w-4" />
      </a>
    </>
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
              className="inline-block py-0.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}