import { useEffect } from "react";

export const MATCH_UPDATED_EVENT = "match-updated";

export function emitMatchUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MATCH_UPDATED_EVENT));
  }
}

export function useMatchUpdated(callback: () => void) {
  useEffect(() => {
    const handler = () => callback();
    window.addEventListener(MATCH_UPDATED_EVENT, handler);
    return () => window.removeEventListener(MATCH_UPDATED_EVENT, handler);
  }, [callback]);
}
