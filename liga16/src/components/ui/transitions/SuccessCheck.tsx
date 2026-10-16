import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

/**
 * Success check — fade + rotate + Y-bob + stroke-draw.
 * data-state="out" = oculto (cold load, sin animación).
 * data-state="in"  = aparece animado.
 * Para replay: set "out", reflow, set "in".
 */
export function SuccessCheck({
  state = "out",
  className,
  children,
  ...props
}: ComponentProps<"span"> & { state?: "out" | "in" }) {
  return (
    <span
      className={cn("t-success-check", className)}
      data-state={state}
      aria-hidden="true"
      {...props}
    >
      {children}
    </span>
  );
}