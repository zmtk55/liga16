import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

/**
 * Modal — escala desde el centro. Usa `asChild` con DialogContent de shadcn:
 *   <Dialog>
 *     <DialogTrigger>…</DialogTrigger>
 *     <DialogContent asChild><Modal>…</Modal></DialogContent>
 *   </Dialog>
 */
export function Modal({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div className={cn("t-modal", className)} {...props}>
      {children}
    </div>
  );
}