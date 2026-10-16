import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

/**
 * Avatar group hover — lift con falloff de distancia, spring al volver.
 * Cada hijo debe tener className "t-avatar".
 * Uso:
 *   <AvatarGroup>
 *     <Avatar>…</Avatar>
 *     <Avatar>…</Avatar>
 *   </AvatarGroup>
 */
export function AvatarGroup({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div className={cn("t-avatar-group", className)} {...props}>
      {children}
    </div>
  );
}

export function Avatar({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div className={cn("t-avatar", className)} {...props}>
      {children}
    </div>
  );
}