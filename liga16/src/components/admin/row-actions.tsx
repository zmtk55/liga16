import { Ellipsis } from "@/components/animate-ui/icons/ellipsis";
import { Pencil as AnimatedPencil } from "@/components/animate-ui/icons/pencil";
import { Trash2 as AnimatedTrash } from "@/components/animate-ui/icons/trash-2";
import { Fragment, useState, type ReactNode } from "react";
import { Link } from "react-router";
import * as AnimatedMenu from "@animate-ui/react/primitives/radix-ui/dropdown-menu";
import { Pencil, FolderInput, LockKeyhole, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  disabled?: boolean;
  disabledReason?: string;
  /** Dibuja un separador antes de esta acción. */
  separator?: boolean;
};

type ItemComponent = React.ElementType<{
  asChild?: boolean;
  disabled?: boolean;
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
        disabled={action.disabled}
        className={cn(
          "min-h-11",
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
export function RowActionsMenu({actions,label,title}:{actions:RowAction[];label:string;title?:string}) {
  const [activeAction,setActiveAction]=useState<string | null>(null);
  const iconFor=(action:RowAction)=> /^(Editar)/.test(action.label) ? <AnimatedPencil size={16} aria-hidden animate={activeAction===action.label && !action.disabled}/> : /^(Eliminar)/.test(action.label) ? <AnimatedTrash size={16} aria-hidden animate={activeAction===action.label && !action.disabled}/> : action.icon;
  const itemClass="relative flex min-h-11 cursor-default items-center gap-3 rounded-lg px-2.5 text-sm outline-none focus:outline-none data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary-strong [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0";
  return <AnimatedMenu.Root onOpenChange={()=>setActiveAction(null)}>
    <AnimatedMenu.Trigger asChild><Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary-strong data-[state=open]:bg-primary/10 data-[state=open]:text-primary-strong" aria-label={label}><Ellipsis size={20} aria-hidden animation="pulse" animateOnHover animateOnTap/></Button></AnimatedMenu.Trigger>
    <AnimatedMenu.Portal><AnimatedMenu.Content align="end" sideOffset={6} collisionPadding={12} transition={{duration:0.16,ease:[0.215,0.61,0.355,1]}} exitTransition={{duration:0.1}} className="z-50 w-60 max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg">
      <AnimatedMenu.Label className="truncate px-2.5 pb-2 pt-1 text-xs font-medium text-muted-foreground">{title ?? label.replace(/^Acciones (para|de) /,"")}</AnimatedMenu.Label>
      {actions.map(action=><Fragment key={action.label}>
        {action.separator && <AnimatedMenu.Separator className="my-1 h-px bg-border"/>}
        <AnimatedMenu.Item onFocus={()=>setActiveAction(action.label)} onPointerMove={()=>setActiveAction(action.label)} asChild={action.to ? true : undefined} disabled={action.disabled} onSelect={action.onSelect} className={cn(itemClass,action.destructive && "text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive",action.disabled && "text-muted-foreground")}>
          {action.to ? <Link to={action.to}>{iconFor(action)}{action.label}</Link> : <>{iconFor(action)}{action.label}{action.disabled && <LockKeyhole className="ml-auto"/>}</>}
        </AnimatedMenu.Item>
        {action.disabledReason && <p className="px-2.5 pb-1 pt-0.5 text-xs leading-4 text-muted-foreground">{action.disabledReason}</p>}
      </Fragment>)}
    </AnimatedMenu.Content></AnimatedMenu.Portal>
  </AnimatedMenu.Root>;
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

/** Acciones de pareja con los mismos permisos que el flujo anterior. */
export function RowActions({name,onEdit,onMove,onDelete,deleteDisabled=false}:{name:string;onEdit?:()=>void;onMove?:()=>void;onDelete:()=>void;deleteDisabled?:boolean}) {
  const actions:RowAction[]=[];
  if(onEdit)actions.push({label:"Editar pareja",icon:<Pencil/>,onSelect:onEdit});
  if(onMove)actions.push({label:"Mover a otro torneo",icon:<FolderInput/>,onSelect:onMove});
  actions.push({label:"Eliminar pareja",icon:<Trash2/>,onSelect:onDelete,destructive:true,disabled:deleteDisabled,disabledReason:deleteDisabled ? "Historial protegido. Borrado en revisión." : undefined,separator:actions.length>0});
  return <RowActionsMenu label={`Acciones de ${name}`} title={name} actions={actions}/>;
}
