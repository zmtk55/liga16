import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

/**
 * Panel reveal — se desliza en Y con cross-blur.
 * Uso: <PanelReveal open={mostrar}>…</PanelReveal>
 */
export function PanelReveal({
  open,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { open: boolean }) {
  return (
    <div
      className={cn("t-panel-slide", className)}
      data-open={open ? "true" : "false"}
      {...props}
    >
      {children}
    </div>
  );
}