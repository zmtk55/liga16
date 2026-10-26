import { Children } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cabecera única para todas las pantallas del admin.
 * Título y descripción a la izquierda, acciones a la derecha, sin variantes por pantalla.
 */
export function AdminPageHeader({
  title,
  description,
  action,
  backTo,
  backLabel = "Volver",
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  backTo?: string;
  backLabel?: string;
  /** Franja de cifras que orienta antes de la tabla (ver AdminStatStrip). */
  children?: React.ReactNode;
}) {
  return (
    // `flex-wrap` + la franja de cifras con `basis-full`: la franja va en su
    // propia línea, a todo el ancho. Antes competía con el título por el
    // espacio y con cinco cifras las etiquetas se partían en dos líneas
    // ("POR / CAPTURAR").
    <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div className="min-w-0">
        {backTo && (
          <Link
            to={backTo}
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {backLabel}
          </Link>
        )}
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
      {children}
    </header>
  );
}

/**
 * Una cifra de la franja. El valor manda; la etiqueta dice en qué unidad.
 * `tone` es lo único que cambia el color, y siempre por token del sistema.
 */
export function AdminStat({
  value,
  label,
  tone,
  icon,
  className,
}: {
  value: React.ReactNode;
  label: string;
  tone?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 bg-card px-4 py-3", className)}>
      <span className={cn("text-stat tabular-nums", tone)}>{value}</span>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-caption uppercase">{label}</span>
      </span>
    </div>
  );
}

/**
 * Franja de cifras bajo la cabecera de una pantalla del admin.
 *
 * Existe porque el listado crudo no orienta: veinte filas de "Nivel 4.2" no
 * dicen si hay algo que revisar. Estas cifras contestan eso antes de que el
 * organizador empiece a leer la tabla, y son las mismas en todas las pantallas.
 */
export function AdminStatStrip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  // Columnas según cuántas cifras hay: 3 → 3, 4 → 4, 5 → 5, 6 → 3x2.
  // Antes cada pantalla ajustaba el grid a mano y las de 5-6 cifras quedaban
  // con una fila coja.
  const count = Children.toArray(children).filter(Boolean).length;
  const cols =
    count <= 3 ? "sm:grid-cols-3" : count === 4 ? "sm:grid-cols-4" : count === 5 ? "sm:grid-cols-5" : "sm:grid-cols-3 lg:grid-cols-6";
  return (
    // Los separadores son el hueco (1px) del grid, no `divide-x`: con
    // divide-x la primera cifra de la segunda fila hereda un borde vertical
    // que no separa nada. Con el hueco, cada línea cae donde toca.
    <dl
      className={cn(
        "-mb-4 grid w-full basis-full grid-cols-2 gap-px overflow-hidden rounded-lg border border-border/60 bg-border/60",
        cols,
        className,
      )}
    >
      {children}
    </dl>
  );
}
