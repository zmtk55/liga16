import { useRef } from "react";

/**
 * Forzar un reflow de layout para que una animación que depende de una
 * clase/attribute se replayee desde el offset 0.
 *
 * Sin esto, quitar y volver a añadir la misma clase no reinicia
 * los keyframes (el navegador la ve como idéntica y salta).
 */
export function useReflow() {
  const ref = useRef<HTMLElement>(null);

  const reflow = () => {
    if (ref.current) void ref.current.offsetWidth;
  };

  return { ref, reflow };
}