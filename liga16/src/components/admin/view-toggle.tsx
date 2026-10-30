// Conmutador de vista para las secciones del admin: cards, tabla o compacta.
// Mismo patrón visual que el selector lista/timeline del calendario de torneo.
// La elección se guarda en localStorage por sección: sobrevive a recargas.
import { useState, type ReactNode } from "react";
import { LayoutGrid, List, Table2 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type AdminViewKey = "cards" | "tabla" | "compacta";

const VIEW_META: Record<AdminViewKey, { label: string; icon: ReactNode }> = {
  cards: { label: "Tarjetas", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  tabla: { label: "Tabla", icon: <Table2 className="h-3.5 w-3.5" /> },
  compacta: { label: "Compacta", icon: <List className="h-3.5 w-3.5" /> },
};

/** Vista elegida por sección, persistida en localStorage. */
export function useAdminView(
  storageKey: string,
  available: AdminViewKey[],
  fallback: AdminViewKey = "cards",
) {
  const [view, setView] = useState<AdminViewKey>(() => {
    try {
      const saved = window.localStorage.getItem(`admin-view:${storageKey}`);
      if (saved && (available as string[]).includes(saved)) {
        return saved as AdminViewKey;
      }
    } catch {
      // Sin storage disponible: se queda con el fallback.
    }
    return fallback;
  });

  const change = (next: AdminViewKey) => {
    setView(next);
    try {
      window.localStorage.setItem(`admin-view:${storageKey}`, next);
    } catch {
      // Sin storage: la vista solo vive en memoria.
    }
  };

  return [view, change] as const;
}

export function AdminViewToggle({
  value,
  onChange,
  views,
}: {
  value: AdminViewKey;
  onChange: (next: AdminViewKey) => void;
  views: AdminViewKey[];
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as AdminViewKey)}
      className="gap-0 rounded-lg border p-0.5"
      aria-label="Tipo de vista"
    >
      {(["cards", "compacta", "tabla"] as AdminViewKey[]).filter((v) => views.includes(v)).map((v) => (
        <ToggleGroupItem
          key={v}
          value={v}
          className="h-9 gap-1.5 rounded-md px-2 text-xs data-[state=on]:bg-secondary"
          aria-label={VIEW_META[v].label}
        >
          {VIEW_META[v].icon}
          {VIEW_META[v].label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
