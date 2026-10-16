import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

/**
 * Menu dropdown — abre desde el trigger, origin-aware.
 * Usa `asChild` para que tu contenido herede de DropdownMenuContent de shadcn:
 *   <Dropdown>
 *     <DropdownTrigger>…</DropdownTrigger>
 *     <DropdownContent asChild><MenuDropdown origin="bottom-center">…</MenuDropdown></DropdownContent>
 *   </Dropdown>
 */
type Origin =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export function MenuDropdown({
  origin = "bottom-center",
  className,
  children,
  ...props
}: ComponentProps<"div"> & { origin?: Origin }) {
  return (
    <div
      className={cn("t-dropdown", className)}
      data-origin={origin}
      {...props}
    >
      {children}
    </div>
  );
}