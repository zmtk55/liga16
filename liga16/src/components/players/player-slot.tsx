import { useMemo, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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

/** Campo de jugador: escribe un nombre nuevo o selecciona uno ya registrado. */
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
  onPick: (name: string) => void;
  onType: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players.slice(0, 30);
    return players.filter((pl) => pl.display_name.toLowerCase().includes(q)).slice(0, 30);
  }, [players, query]);

  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={`h-9 w-full justify-between font-normal ${value ? "" : "text-muted-foreground"}`}
          >
            <span className="truncate">{value || "Escribir o buscar…"}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar jugador registrado…"
              onValueChange={(q) => {
                setQuery(q);
                // Escribir en el buscador también define el nombre si no coincide con nadie
                onType(q);
              }}
            />
            <CommandList>
              {filtered.length === 0 ? (
                <CommandEmpty>
                  Jugador nuevo: "{value}" — se registrará al completar
                </CommandEmpty>
              ) : (
                <CommandGroup heading="Jugadores registrados">
                  {filtered.map((pl) => (
                    <CommandItem
                      key={pl.id}
                      value={pl.display_name}
                      onSelect={() => {
                        onPick(pl.display_name);
                        setOpen(false);
                      }}
                    >
                      {pl.display_name}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {categoriaDeJugador(pl)}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
