import * as React from "react";
import { cn } from "@/lib/utils";
import { Card as BaseCard } from "@/components/ui/card";

/** Tarjeta bento: esquinas grandes y sin sombra, igual que el resto del admin. */
export function BentoCard({ className, ...props }: React.ComponentProps<typeof BaseCard>) {
  return <BaseCard className={cn("rounded-3xl shadow-none", className)} {...props} />;
}
