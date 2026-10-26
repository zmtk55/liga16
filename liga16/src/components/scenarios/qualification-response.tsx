import { Component, useMemo } from "react";
import type { ReactNode } from "react";
import { createParser, Renderer } from "@openuidev/react-lang";
import { openUILibrary } from "@/lib/openui";
import { buildQualificationUI } from "@/lib/qualification-openui";
import type { ResponseProps } from "@/lib/qualification-openui";


class ResponseBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function QualificationResponse(props: ResponseProps) {
  const response = buildQualificationUI(props);
  const valid = useMemo(() => {
    try {
      const result = createParser(openUILibrary.toJSONSchema(), openUILibrary.root).parse(response);
      return result.meta.errors.length === 0 && result.meta.unresolved.length === 0;
    } catch {
      return false;
    }
  }, [response]);
  const fallback = (
    <div className="space-y-3 break-words">
      {props.answer.split("\n\n").filter(Boolean).map((paragraph, index) => (
        <p key={index} className="max-w-[72ch] text-sm leading-relaxed">
          {paragraph.charAt(0).toUpperCase() + paragraph.slice(1)}
        </p>
      ))}
      <p className="text-xs text-muted-foreground">
        {props.position}° · {props.points}% · pasan {props.slots} · {props.remainingMatches} por jugar · {props.source === "jev" ? "lectura JEV" : "cálculo local"}
      </p>
    </div>
  );
  if (!valid) return fallback;
  return (
    <ResponseBoundary key={response} fallback={fallback}>
      <div data-qualification-renderer="openui" className="min-w-0">
        <Renderer response={response} library={openUILibrary} isStreaming={false} />
        <p className="mt-4 text-xs text-muted-foreground">
          {props.source === "jev" ? "Lectura JEV" : "Cálculo local"} · Con la tabla actual
        </p>
      </div>
    </ResponseBoundary>
  );
}
