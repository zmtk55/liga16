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
    <header className="flex flex-col gap-6 pb-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
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
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
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
    <div className={cn("flex min-w-0 flex-col justify-between gap-5 rounded-3xl bg-card p-6 first:bg-zinc-950 first:text-white [&:nth-child(2)]:bg-primary [&:nth-child(2)]:text-primary-foreground", className)}>
      <span className={cn("font-display text-5xl font-bold leading-none tracking-tight tabular-nums", tone)}>{value}</span>
      <span className="flex items-center gap-1.5 opacity-65">
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
  loading = false,
}: {
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
}) {
  return (
    // Los separadores son el hueco (1px) del grid, no `divide-x`: con
    // divide-x la primera cifra de la segunda fila hereda un borde vertical
    // que no separa nada. Con el hueco, cada línea cae donde toca.
    <dl
      aria-busy={loading}
      aria-label={loading ? "Cargando cifras" : "Resumen"}
      className={cn(
        "grid w-full basis-full grid-cols-1 gap-3 sm:grid-cols-2",
        Children.count(children) === 3 ? "xl:grid-cols-3" : Children.count(children) === 5 ? "xl:grid-cols-5" : "xl:grid-cols-4",
        loading && "[&>div>span:first-child]:invisible animate-pulse",
        className,
      )}
    >
      {children}
    </dl>
  );
}
