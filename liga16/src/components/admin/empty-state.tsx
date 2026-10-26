// Estado vacío de las pantallas del admin.
//
// Una sola anatomía para todas: icono, título, una línea de explicación y la
// acción que lo resuelve. Antes cada pantalla escribía su propio `<Empty>` con
// su padding y a veces sin icono ni CTA, y el resultado era el texto gris
// suelto ("Sin partidos para este filtro.") que no dice qué hacer.
//
// `AdminTableEmpty` (table-state.tsx) es la versión para tablas: la misma idea
// metida en una fila del `<Table>`.

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminPageHeader } from "@/components/admin/page-header";

export function AdminEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  /** Icono de lucide: da forma al estado vacío sin gritar. */
  icon?: React.ReactNode;
  title: string;
  description: string;
  /** La acción que resuelve el estado (un botón). */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Empty className={cn("border-0 py-10", className)}>
      <EmptyHeader>
        {icon && <EmptyMedia variant="icon">{icon}</EmptyMedia>}
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

/**
 * Pantalla completa cuando la carga inicial falla: la misma cabecera de siempre
 * y un estado de error con "Reintentar". Sin esto, un fallo de red dejaba el
 * esqueleto de carga para siempre, como si aún estuviera cargando.
 */
export function AdminLoadFailed({
  title,
  description,
  what,
  message,
  onRetry,
}: {
  title: string;
  description?: string;
  /** Qué no se pudo cargar, en minúsculas: "las noticias". */
  what: string;
  message?: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-5">
      <AdminPageHeader title={title} description={description} />
      <Card>
        <CardContent className="p-0">
          <AdminEmptyState
            icon={<AlertTriangle className="h-5 w-5" />}
            title={`No se pudieron cargar ${what}`}
            description={message || "Revisa tu conexión e inténtalo de nuevo."}
            action={
              <Button variant="outline" size="sm" onClick={onRetry}>
                Reintentar
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
