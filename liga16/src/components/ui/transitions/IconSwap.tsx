import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

/**
 * Icon swap — cross-fade dos iconos en la misma slot.
 * Uso:
 *   <IconSwap state={theme === "dark" ? "b" : "a"} className="size-5">
 *     <span className="t-icon" data-icon="a"><SunIcon /></span>
 *     <span className="t-icon" data-icon="b"><MoonIcon /></span>
 *   </IconSwap>
 */
export function IconSwap({
  state,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { state: string }) {
  return (
    <div
      className={cn("t-icon-swap", className)}
      data-state={state}
      {...props}
    >
      {children}
    </div>
  );
}

export function IconSlot({
  icon,
  className,
  children,
  ...props
}: ComponentProps<"span"> & { icon: string }) {
  return (
    <span className={cn("t-icon", className)} data-icon={icon} {...props}>
      {children}
    </span>
  );
}