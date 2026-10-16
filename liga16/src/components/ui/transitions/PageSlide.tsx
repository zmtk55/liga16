import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

/**
 * Page side-by-side — lista ↔ detalle, paso 1 ↔ paso 2.
 * Uso:
 *   <PageSlide page={2}>
 *     <section className="t-page" data-page-id="1">…</section>
 *     <section className="t-page" data-page-id="2">…</section>
 *   </PageSlide>
 */
export function PageSlide({
  page,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { page: number | string }) {
  return (
    <div
      className={cn("t-page-slide", className)}
      data-page={String(page)}
      {...props}
    >
      {children}
    </div>
  );
}

export function Page({
  pageId,
  className,
  children,
  ...props
}: ComponentProps<"section"> & { pageId: number | string }) {
  return (
    <section
      className={cn("t-page", className)}
      data-page-id={String(pageId)}
      {...props}
    >
      {children}
    </section>
  );
}