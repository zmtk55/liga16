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
