import { cn } from "@/lib/utils";
import type { ComponentProps, ReactNode } from "react";

/**
 * Error state shake — shake por segmentos + border + mensaje auto-revert.
 * Uso:
 *   <ErrorState shake={true} error={true} message="Email inválido">
 *     <div className="t-input"><input … /></div>
 *   </ErrorState>
 */
export function ErrorState({
  shake,
  error,
  className,
  message,
  children,
  ...props
}: ComponentProps<"div"> & {
  shake?: boolean;
  error?: boolean;
  message?: ReactNode;
}) {
  return (
    <div
      className={cn("t-input-wrap", error && "is-error", className)}
      data-error={error ? "true" : "false"}
      {...props}
    >
      {children}
      {message != null && (
        <p className="t-error-msg">{message}</p>
      )}
    </div>
  );
}

export function ErrorInput({
  shaking,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { shaking?: boolean }) {
  return (
    <div
      className={cn("t-input", shaking && "is-shaking", className)}
      {...props}
    >
      {children}
    </div>
  );
}