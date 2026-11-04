import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
export function PublicLoadError({ onRetry }: { onRetry: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 text-sm"><AlertTriangle className="h-4 w-4 shrink-0" /><p className="min-w-0 flex-1">No se pudieron cargar los datos. No es una lista vacía.</p><Button variant="outline" size="sm" onClick={onRetry}>Reintentar</Button></div>;
}
