// Date picker shadcn: popover + calendar. Sustituye a <input type="date"> crudo.
// Modo simple (una fecha) o rango (inicio/fin en un solo control).
import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
