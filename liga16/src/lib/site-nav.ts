// Los links del sitio, en UN solo sitio.
//
// Antes cada barra llevaba su propia lista: `publicNav` en el SiteHeader,
// `items` en la MobileBottomNav y `DEFAULT_NAV_LINKS` en el catálogo del
// playground. Tres listas, tres Criteria: la barra inferior offering 5 secciones
// y la hamburguesa 7, sin que nadie lo decidiera. Agregar una sección al menú
// no la ponía en la barra móvil, y el sitio se veía como si cada barra fuera un
// producto distinto.
//
// Ahora hay una lista. Las barras eligen de ella:
//
//   - escritorio  → los 7, en fila
//   - móvil        → los 5 `primary` (los que se usan a diario, caben en el pulgar)
//   - hamburguesa  → los 7 + los de admin, que no caben abajo
//
// `primary` no es decoración: es lo que decide qué entra en la barra inferior.
// Por eso Inicio, Torneos, Equipos, Jugadores y Agenda la tienen; Ranking y
// Noticias se quedan solo en la hamburguesa.
import {
  Home,
  Trophy,
  Users,
  BarChart3,
  CalendarDays,
  Newspaper,
  Building2,
  Shield,
  type LucideIcon,
} from "lucide-react";

export type SiteNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Entra en la barra inferior del móvil, donde caben ~5 y no más. */
  primary?: boolean;
  /** Solo para quien administra; no va en la barra inferior. */
  adminOnly?: boolean;
};

export const SITE_NAV: SiteNavItem[] = [
  { to: "/", label: "Inicio", icon: Home, primary: true },
  { to: "/torneos", label: "Torneos", icon: Trophy, primary: true },
  { to: "/equipos", label: "Equipos", icon: Users, primary: true },
  { to: "/jugadores", label: "Jugadores", icon: Users, primary: true },
  { to: "/ranking", label: "Ranking", icon: BarChart3 },
  { to: "/calendario", label: "Agenda", icon: CalendarDays, primary: true },
  { to: "/noticias", label: "Noticias", icon: Newspaper },
  { to: "/padel", label: "Sede", icon: Building2, adminOnly: true },
  { to: "/admin", label: "Admin", icon: Shield, adminOnly: true },
];

export function navFor(isAdmin: boolean): SiteNavItem[] {
  return SITE_NAV.filter((i) => !i.adminOnly || isAdmin);
}

/** Las cinco destinos de la barra inferior móvil. */
export function primaryNav(): SiteNavItem[] {
  return SITE_NAV.filter((i) => i.primary);
}