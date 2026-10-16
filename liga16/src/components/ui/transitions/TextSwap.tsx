import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

/**
 * Text states swap — texto cambia en lugar, sale arriba con blur.
 * El componente es puro CSS; la lógica de cambio de texto es del padre.
 * Uso: <TextSwap className={state === "exit" ? "is-exit" : state === "enter" ? "is-enter-start" : ""}>…</TextSwap>
 */
export function TextSwap({
  className,
  children,
  ...props
}: ComponentProps<"span">) {
  return (
    <span className={cn("t-text-swap", className)} {...props}>
      {children}
    </span>
  );
}