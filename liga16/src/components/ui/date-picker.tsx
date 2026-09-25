// Date picker shadcn: popover + calendar. Sustituye a <input type="date"> crudo.
// Modo simple (una fecha) o rango (inicio/fin en un solo control).
import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function dateFromValue(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Elegir fecha",
  className,
  clearable = false,
  ariaLabel,
}: {
  id?: string;
  value?: string | null; // YYYY-MM-DD
  onChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
  clearable?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const date = dateFromValue(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-label={ariaLabel ?? placeholder}
          className={cn(
            "h-9 justify-between gap-2 px-3 font-normal",
            !date && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {date ? format(date, "EEE d MMM yyyy") : placeholder}
            </span>
          </span>
          {clearable && date ? (
            <X
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
            />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          captionLayout="dropdown"
          onSelect={(d) => {
            onChange(d ? format(d, "yyyy-MM-dd") : null);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Selector de fecha Y hora (local, YYYY-MM-DDTHH:mm). Popover con Calendar + inputs de hora.
 * Sustituye a <input type="datetime-local"> crudo.
 */
export function DateTimePicker({
  value,
  onChange,
  placeholder = "Elegir fecha y hora",
  className,
  ariaLabel,
}: {
  value?: string | null; // YYYY-MM-DDTHH:mm (formato de datetime-local) o ISO
  onChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  // Trabajamos con la fecha local; la hora como HH:mm
  const day = dateFromValue(value);
  const time = value ? value.slice(11, 16) : "";

  function emit(nextDay: Date | undefined, nextTime: string) {
    if (!nextDay) {
      onChange(null);
      return;
    }
    const d = format(nextDay, "yyyy-MM-dd");
    onChange(nextTime ? `${d}T${nextTime}` : d);
  }

  const label = day
    ? `${format(day, "EEE d MMM yyyy")}${time ? ` · ${time}` : ""}`
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={ariaLabel ?? placeholder}
          className={cn("h-9 justify-between gap-2 px-3 font-normal", !day && "text-muted-foreground", className)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <Calendar
          mode="single"
          selected={day}
          captionLayout="dropdown"
          onSelect={(d) => emit(d, time || "12:00")}
        />
        <div className="mt-2 flex items-center gap-2 border-t pt-2">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            type="time"
            value={time}
            onChange={(e) => emit(day, e.target.value)}
            className="h-8 w-28"
            aria-label="Hora del partido"
          />
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto h-8"
              onClick={() => onChange(null)}
            >
              Limpiar
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function DateRangePicker({
  start,
  end,
  onChange,
  className,
}: {
  start?: string | null;
  end?: string | null;
  onChange: (range: { start: string | null; end: string | null }) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const from = dateFromValue(start);
  const to = dateFromValue(end);

  const label =
    from && to
      ? `${format(from, "d MMM")} – ${format(to, "d MMM yyyy")}`
      : from
        ? `Desde ${format(from, "d MMM")}`
        : "Rango de fechas";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("h-9 justify-start gap-2 px-3 font-normal", !from && "text-muted-foreground", className)}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={from && to ? { from, to } : undefined}
          onSelect={(range) => {
            onChange({
              start: range?.from ? format(range.from, "yyyy-MM-dd") : null,
              end: range?.to ? format(range.to, "yyyy-MM-dd") : null,
            });
            if (range?.from && range?.to) setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
