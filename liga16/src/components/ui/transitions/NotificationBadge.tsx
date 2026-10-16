import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

/**
 * Notification badge — se desliza y el dot rebota; el trigger no se mueve.
 * El trigger debe ser position: relative.
 * Uso:
 *   <NotificationBadge open={hasUnread} className="top-0 right-0">
 *     <span className="t-badge-dot">{count}</span>
 *   </NotificationBadge>
 */
export function NotificationBadge({
  open,
  className,
  children,
  ...props
}: ComponentProps<"span"> & { open: boolean }) {
  return (
    <span
      className={cn("t-badge", className)}
      data-open={open ? "true" : "false"}
      {...props}
    >
      {children}
    </span>
  );
}

export function BadgeDot({
  className,
  children,
  ...props
}: ComponentProps<"span">) {
  return (
    <span className={cn("t-badge-dot", className)} {...props}>
      {children}
    </span>
  );
}