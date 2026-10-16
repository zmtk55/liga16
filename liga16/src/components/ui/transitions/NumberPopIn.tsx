import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

/**
 * Number pop-in — cada dígito entra con deslizamiento + blur.
 * Uso:
 *   <NumberPopIn animating={true}>
 *     <span className="t-digit">1</span>
 *     <span className="t-digit" data-stagger="1">.</span>
 *     <span className="t-digit" data-stagger="2">3</span>
 *   </NumberPopIn>
 */
export function NumberPopIn({
  animating,
  className,
  children,
  ...props
}: ComponentProps<"span"> & { animating?: boolean }) {
  return (
    <span
      className={cn("t-digit-group", animating && "is-animating", className)}
      {...props}
    >
      {children}
    </span>
  );
}