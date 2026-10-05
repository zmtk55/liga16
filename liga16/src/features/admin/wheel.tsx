import { useEffect, useRef, useState } from "react";

/* ── el dial · un anillo de instrumento arrastrable ─────────
   60 ticks sobre un arco de 300° con un hueco de 60° abajo.
   El valor es un resorte, no una transición: se pasa y se
   asienta. Los ticks encendidos llevan una onda lenta cuya
   amplitud escala con la lectura. Arrastra el anillo. */

const N = 60;
const START = 120;   // grados, abajo a la izquierda
const SWEEP = 300;   // grados, horario hasta abajo a la derecha
const CX = 100;
const CY = 100;
const R = 52;        // radio interior de la banda de ticks

const rad = (d: number) => (d * Math.PI) / 180;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* ── CUATRO BANDAS, Y EL COLOR VIVE EN CSS ─────────────────
   Esta función devuelve un NOMBRE y la hoja de estilos tiene
   los valores: así el dial gana paleta clara y oscura sin que
   ningún archivo fije un número que el otro tenga que igualar.

   Y lo que faltaba: rojo. "Crítico" era ámbar, el color de un
   aviso y no de un problema. El extremo inferior se parte: bajo
   12 es rojo y lo dice, 12 a 25 sigue siendo el ámbar de
   siempre. Los labels se quedan aunque nada los pinte: son lo
   que las cuatro cifras SIGNIFICAN. */
function stateFor(v: number) {
  if (v < 12) return { label: "Critical", key: "crit" };
  if (v < 25) return { label: "Low", key: "low" };
  if (v > 80) return { label: "High", key: "high" };
  return { label: "Normal", key: "ok" };
}

/* dónde abre el dial sin dato: 15%, en la banda ámbar */
const OPEN_AT = 15;

export default function Wheel({
  /* lectura entrante (0–100). El resorte la persigue. */
  value = OPEN_AT,
  /* nombre del instrumento para lectores de pantalla */
  label = "Progreso",
  /* qué tan fino se corta la banda: poco lee como escala,
     mucho lee como superficie */
  ticks = N,
  /* cuánto del círculo cubre la banda, el resto es el hueco */
  sweep = SWEEP,
  /* la onda que viajan los ticks encendidos. En 0 el anillo
     es un medidor estático; este es el número que decide si
     se ve vivo. */
  wave: waveAmp = 2.6,
}: {
  value?: number;
  label?: string;
  ticks?: number;
  sweep?: number;
  wave?: number;
}) {
  /* el dato entra al montar, que es como carga el panel (una sola vez);
     si algún día el panel recarga en vivo, habrá que perseguir `value` */
  const [target, setTarget] = useState(value);
  const [display, setDisplay] = useState(value);
  const [dragging, setDragging] = useState(false);
  /* la fase de la onda es estado y no ref: se lee al armar los ticks
     durante el render, y un ref leido ahi esta prohibido (y se congelaria) */
  const [phase, setPhase] = useState(0);

  const cur = useRef(value);
  const vel = useRef(0);
  const raf = useRef<number | undefined>(undefined);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  /* resorte hacia el objetivo + reloj de onda corriendo */
  useEffect(() => {
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(34, t - last) / 16.67;
      last = t;

      if (reduced) {
        cur.current = target;
      } else {
        const k = 0.16;   // rigidez
        const d = 0.76;   // amortiguación
        vel.current += (target - cur.current) * k * dt;
        vel.current *= Math.pow(d, dt);
        cur.current += vel.current * dt;
        if (Math.abs(target - cur.current) < 0.02 && Math.abs(vel.current) < 0.02) {
          cur.current = target;
          vel.current = 0;
        }
      }

      setPhase((p) => p + dt * 0.055);
      setDisplay(cur.current);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, reduced]);

  /* ángulo del puntero a valor */
  const fromPointer = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const b = svg.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * 200 - CX;
    const y = ((e.clientY - b.top) / b.height) * 200 - CY;
    let deg = (Math.atan2(y, x) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    let rel = deg - START;
    if (rel < 0) rel += 360;
    if (rel > sweep) rel = rel < sweep + 30 ? sweep : 0;  // salta sobre el hueco
    setTarget(Math.round((rel / sweep) * 100));
  };

  const st = stateFor(display);
  const f = clamp(display, 0, 100) / 100;
  const amp = reduced ? 0 : 1 + (display / 100) * waveAmp;

  const band = Array.from({ length: ticks }, (_, i) => {
    const tf = i / (ticks - 1);
    const on = tf <= f + 0.001;
    const behind = f - tf;                         // >0 cuando el tick va detrás de la cabeza
    const comet = on && behind < 0.14 ? (1 - behind / 0.14) * 8 : 0;
    const undulate = on ? Math.sin(phase + i * 0.5) * amp : 0;
    /* ── 24 encendidos y no 23 ──────────────────────────────
       La LONGITUD es la señal gruesa y la OPACIDAD la fina:
       los encendidos van de 0.42 a 1 según qué tan atrás de
       la cabeza estén, que es lo que lleva la lectura. La base
       es 24 y no 23 por la OLA: con la onda por defecto la
       base 23 hundía el valle por debajo de los apagados (21)
       y la banda leía como ruido; 24 deja el valle en 21.4,
       apenas sobre el suelo. Medido. */
    const len = (on ? 24 : 21) + comet + undulate;
    const a = rad(START + tf * sweep);
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    return {
      key: i,
      x1: CX + cos * R,
      y1: CY + sin * R,
      x2: CX + cos * (R + len),
      y2: CY + sin * (R + len),
      on,
      opacity: on ? 0.42 + (1 - clamp(behind, 0, 1)) * 0.58 : 1,
    };
  });

  return (
    /* ── SIN PANEL ─────────────────────────────────────────
       Un anillo de ticks ya ES una forma; enmarcarlo en un
       rectángulo helado solo diría "esto es un componente".
       El pane lo que hacía, en silencio, era dar contraste —
       ver la opacidad de los ticks abajo. */
    <div className="hum" data-state={st.key}>
      <div className="hum-dial">
        <svg
          ref={svgRef}
          className="hwheel"
          viewBox="0 0 200 200"
          data-dragging={dragging}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuenow={Math.round(display)}
          aria-valuemin={0}
          aria-valuemax={100}
          onPointerDown={(e) => {
            e.stopPropagation();
            setDragging(true);
            (e.target as Element).setPointerCapture?.(e.pointerId);
            fromPointer(e);
          }}
          onPointerMove={(e) => dragging && fromPointer(e)}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") setTarget((v) => clamp(v + 2, 0, 100));
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") setTarget((v) => clamp(v - 2, 0, 100));
          }}
        >
          {band.map((t) => (
            <line
              key={t.key}
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              /* un style y no el atributo `stroke`: un atributo
                 no acepta var(), y el color de la banda es uno
                 — ver stateFor y el bloque .hum en index.css */
              style={{ stroke: t.on ? "var(--hum-lit)" : "currentColor" }}
              /* 0.24 y no 0.13: sobre el gris de la card el tick
                 apagado medía ~1.2:1 y no estaba. Misma
                 corrección que necesitó el dial de sueño. */
              strokeOpacity={t.on ? t.opacity : 0.24}
              strokeWidth={2}
              strokeLinecap="round"
            />
          ))}
        </svg>

        <div className="hwheel-readout">
          <span className="hum-figure">{Math.round(display)}</span>
          <span className="hum-unit">%</span>
        </div>
      </div>
    </div>
  );
}
