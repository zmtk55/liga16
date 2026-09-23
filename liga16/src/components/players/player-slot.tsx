import { useState } from "react";
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
                // Escribir en el buscador también define el nombre si no coincide con nadie
                onType(q);
              }}
            />
            <CommandList>
              <CommandEmpty>
                Jugador nuevo: "{value}" — se registrará al completar
              </CommandEmpty>
              <CommandGroup heading="Jugadores registrados">
                {players.slice(0, 30).map((pl) => (
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
                      N {(pl.official_level ?? pl.declared_level).toFixed(1)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
