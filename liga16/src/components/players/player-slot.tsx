import { useEffect, useId, useMemo, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Combobox } from "@animate-ui/react/primitives/base-ui/combobox";
import { Label } from "@/components/ui/label";
import type { PlayerProfile } from "@/types";

/** Categoría cerrada del jugador: su división, no decimales. */
function categoriaDeJugador(pl: PlayerProfile): string {
  const lvl = pl.official_level ?? pl.declared_level;
  if (lvl >= 6) return "1ra";
  if (lvl >= 5.5) return "2da";
  if (lvl >= 5) return "3ra";
  if (lvl >= 4.5) return "4ta";
  if (lvl >= 4) return "5ta";
  if (lvl >= 3.5) return "6ta";
  return "Novatos";
}

/**
 * Campo de jugador: escribe un nombre nuevo o selecciona uno ya registrado.
 * El texto del campo ES el nombre (`value`): escribir lo define al instante y
 * elegir uno registrado lo reemplaza. Nunca se borra solo al cerrar la lista.
 */
export default function PlayerSlot({
  label,
  value,
  players,
  onPick,
  onType,
}: {
  label: string;
  value: string;
  players: PlayerProfile[];
  onPick: (name: string, playerId: string) => void;
  onType: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputId = useId();

  // Dentro de un diálogo, Escape cerraba el diálogo entero además de la lista
  // (el diálogo escucha en captura). Mientras la lista está abierta, Escape solo
  // la cierra a ella, como hacía el Popover anterior.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players.slice(0, 30);
    return players.filter((pl) => pl.display_name.toLowerCase().includes(q)).slice(0, 30);
  }, [players, query]);

  return (
    <div className="grid gap-1">
      <Label htmlFor={inputId} className="text-xs text-muted-foreground">{label}</Label>
      <Combobox.Root<PlayerProfile>
        items={filtered}
        filter={null}
        value={null}
        inputValue={value}
        open={open}
        onOpenChange={setOpen}
        itemToStringLabel={(pl) => pl.display_name}
        onInputValueChange={(text, details) => {
          // Solo lo que el usuario escribe cambia el nombre; los reinicios internos
          // al abrir/cerrar la lista no deben borrar un nombre nuevo ya escrito.
          if (details.reason !== "input-change") return;
          setQuery(text);
          onType(text);
        }}
        onValueChange={(pl) => {
          if (!pl) return;
          setQuery("");
          onPick(pl.display_name,pl.id);
        }}
      >
        <div className="relative">
          <Combobox.Input
            id={inputId}
            placeholder="Escribir o buscar…"
            autoComplete="off"
            className="border-input placeholder:text-muted-foreground dark:bg-input/30 h-9 w-full min-w-0 rounded-md border bg-transparent py-1 pl-3 pr-9 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-foreground/40 md:text-sm"
          />
          <Combobox.Trigger
            aria-label={`Ver jugadores registrados para ${label}`}
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground"
          >
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Combobox.Trigger>
        </div>
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={4} align="start" className="pointer-events-auto z-[60]">
            <Combobox.Popup className="bg-popover text-popover-foreground w-[var(--anchor-width)] min-w-56 max-w-[calc(100vw-1.5rem)] origin-[var(--transform-origin)] rounded-md border p-1 shadow-md outline-hidden">
              {filtered.length === 0 ? (
                <div className="px-2 py-2 text-sm">
                  <p>Jugador nuevo: "{value}"</p>
                  <p className="text-xs text-muted-foreground">Se registrará al completar</p>
                </div>
              ) : (
                <>
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Jugadores registrados</div>
                  <Combobox.List className="max-h-[min(300px,calc(var(--available-height)-3rem))] overflow-y-auto overflow-x-hidden">
                    {(pl: PlayerProfile) => (
                      <Combobox.Item
                        key={pl.id}
                        value={pl}
                        className="flex min-h-9 [@media(pointer:coarse)]:min-h-11 cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-hidden data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                      >
                        {pl.display_name}
                        <span className="ml-auto pl-2 text-xs text-muted-foreground">{categoriaDeJugador(pl)}</span>
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </>
              )}
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  );
}
