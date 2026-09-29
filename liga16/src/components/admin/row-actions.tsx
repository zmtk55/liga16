import { Fragment, type ReactNode } from "react";
import { Link } from "react-router";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

/** Una acción de fila, declarada una sola vez y reutilizada en ambos menús. */
export type RowAction = {
  label: string;
  icon?: ReactNode;
  to?: string;
  onSelect?: () => void;
  destructive?: boolean;
  /** Dibuja un separador antes de esta acción. */
  separator?: boolean;
};

type ItemComponent = React.ElementType<{
  asChild?: boolean;
  onSelect?: () => void;
  className?: string;
  children?: ReactNode;
}>;
type SeparatorComponent = React.ElementType;

function renderItems(
  actions: RowAction[],
  Item: ItemComponent,
  Separator: SeparatorComponent,
) {
  return actions.map((action) => (
    <Fragment key={action.label}>
      {action.separator && <Separator />}
      <Item
        asChild={action.to ? true : undefined}
        onSelect={action.onSelect}
        className={cn(
          action.destructive && "text-destructive focus:text-destructive",
        )}
      >
        {action.to ? (
          <Link to={action.to}>
            {action.icon}
            {action.label}
          </Link>
        ) : (
          <>
            {action.icon}
            {action.label}
          </>
        )}
      </Item>
    </Fragment>
  ));
}

/** Menú visible de la fila (⋯). Es la vía descubrible. */
export function RowActionsMenu({
  actions,
  label,
}: {
  actions: RowAction[];
  label: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {renderItems(actions, DropdownMenuItem, DropdownMenuSeparator)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Mismo menú con click derecho: atajo, nunca la única vía. */
export function RowContextMenu({
  actions,
  children,
}: {
  actions: RowAction[];
  children: ReactNode;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {renderItems(actions, ContextMenuItem, ContextMenuSeparator)}
      </ContextMenuContent>
    </ContextMenu>
  );
}
