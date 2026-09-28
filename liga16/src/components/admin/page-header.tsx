import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";

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
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  backTo?: string;
  backLabel?: string;
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
    </header>
  );
}
