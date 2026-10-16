import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

/**
 * Card resize — tween width/height al cambiar estado de layout.
 * Uso: <CardResize className="...">...</CardResize>
 * El cambio de tamaño lo disparas tú (state que altera width/height).
 */
export function CardResize({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div className={cn("t-resize", className)} {...props}>
      {children}
    </div>
  );
}