import { useState, type ReactNode } from "react";
import * as Tooltip from "@animate-ui/react/primitives/radix-ui/tooltip";

/** Short definitions available on hover, keyboard focus and tap. */
export function StatHelp({ text, children }: { text: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip.Provider delayDuration={250}>
      <Tooltip.Root open={open} onOpenChange={setOpen}>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            aria-label={typeof children === "string" ? `${children}: ${text}` : text}
            aria-expanded={open}
            onPointerDown={(event) => {
              // Touch should toggle the definition, not start a hover gesture.
              if (event.pointerType === "touch") event.preventDefault();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setOpen((value) => !value);
            }}
            className="inline-flex min-h-8 min-w-6 items-center justify-center rounded-sm border-b border-dotted border-current/40 text-inherit outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {children}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            collisionPadding={12}
            className="z-[70] max-w-[min(18rem,calc(100vw-1.5rem))] rounded-lg border bg-popover px-3 py-2 text-xs font-normal leading-relaxed text-popover-foreground shadow-md"
          >
            {text}
            <Tooltip.Arrow className="fill-popover" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
