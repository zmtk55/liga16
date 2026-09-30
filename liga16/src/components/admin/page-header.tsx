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
    <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
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
    <div className={cn("flex min-w-0 flex-col gap-1 px-4 py-3", className)}>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-caption uppercase">{label}</span>
      </span>
      <span className={cn("text-stat tabular-nums", tone)}>{value}</span>
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
  return (
    <dl
      className={cn(
        "-mb-5 grid w-full grid-cols-2 divide-x divide-y divide-border/60 rounded-lg border bg-card sm:grid-cols-4 sm:divide-y-0",
        className,
      )}
    >
      {children}
    </dl>
  );
}
