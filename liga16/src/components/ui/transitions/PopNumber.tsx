import { cn } from "@/lib/utils";
import { NumberPopIn } from "./NumberPopIn";

/**
 * Number pop-in para cifras que cambian — transitions-dev.
 *
 * React suplanta el patrón "quitar la clase → reflow → volver a ponerla" de
 * la skill con una `key`: al cambiar el texto, los spans se remontan y la
 * animación vuelve a empezar sola, sin medir duraciones a mano.
 *
 * Se usa en las cifras del admin: cuando se captura un resultado, el número
 * que baja no se sustituye en silencio, entra.
 */
export function PopNumber({
  value,
  className,
}: {
  value: string | number;
  className?: string;
}) {
  const text = String(value);
  const chars = text.split("");
  return (
    <NumberPopIn key={text} animating className={cn("tabular-nums", className)}>
      {chars.map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          className="t-digit"
          // Los dos últimos dígitos entran con retardo: el número se lee
          // como si contara hacia arriba.
          data-stagger={
            i === chars.length - 2 ? "1" : i === chars.length - 1 ? "2" : undefined
          }
        >
          {ch}
        </span>
      ))}
    </NumberPopIn>
  );
}
