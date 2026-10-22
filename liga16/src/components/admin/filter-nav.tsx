import { cn } from "@/lib/utils";

export interface FilterNavOption {
  key: string;
  label: string;
  count?: number;
}

export function AdminFilterNav({
  label,
  value,
  options,
  onChange,
  allLabel = "Todos",
}: {
  label: string;
  value: string;
  options: FilterNavOption[];
  onChange: (key: string) => void;
  allLabel?: string;
}) {
  const allOption: FilterNavOption = { key: "all", label: allLabel };
  const allOpts = [allOption, ...options];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground w-20 shrink-0 hidden sm:block">{label}</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {allOpts.map((o) => {
          const active = value === o.key || (o.key === "all" && (value === "" || value === "all"));
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onChange(o.key === "all" ? "all" : o.key)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                active
                  ? "bg-primary/10 text-primary-strong border-primary/20"
                  : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground",
                o.count && o.count > 0 ? "pr-1.5" : "",
              )}
            >
              <span className="truncate">{o.label}</span>
              {o.count !== undefined && (
                <span className={cn("text-[10px] tabular-nums", active ? "text-primary-strong/80" : "text-muted-foreground")}>
                  {o.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
