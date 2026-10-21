import { Component, type ReactNode } from "react";
import { useRouteError } from "react-router";
import { Link } from "react-router";
import { RefreshCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const RELOAD_FLAG = "liga16_chunk_reload";

/**
 * Un chunk que no se puede traer significa casi siempre un bundle viejo en el
 * navegador: se desplegó la web, los assets viejos desaparecieron y la pestaña
 * que estaba abierta sigue pidiendo el fichero con el hash anterior. La
 * respuesta es recargar, no mostrar una pantalla de error.
 *
 * El flag en sessionStorage evita el bucle: si al recargar sigue fallando, el
 * segundo intento ya no vuelve a recargar y el usuario ve el mensaje con
 * un botón para hacerlo a mano.
 */
function isChunkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("dynamically imported") ||
    msg.includes("Importing a module script failed")
  );
}

function scheduleSelfHeal(err: unknown): boolean {
  if (!isChunkError(err)) return false;
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return false;
    sessionStorage.setItem(RELOAD_FLAG, "1");
  } catch {
    /* sessionStorage bloqueado: seguimos sin auto-recarga */
  }
  setTimeout(() => window.location.reload(), 400);
  return true;
}

function ErrorScreen({ error }: { error: unknown }) {
  const chunk = isChunkError(error);
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-2">
        <h1 className="font-headline text-3xl uppercase tracking-tight">
          Algo salió mal
        </h1>
        <p className="text-muted-foreground">
          {chunk
            ? "La web se ha actualizado. Te la recargamos en un momento…"
            : "Ha ocurrido un error inesperado. Inténtalo de nuevo."}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild variant="outline" size="lg">
          <Link to="/">Ir al inicio</Link>
        </Button>
        <Button
          variant="default"
          size="lg"
          onClick={() => {
            try {
              sessionStorage.removeItem(RELOAD_FLAG);
            } catch {
              /* no-op */
            }
            window.location.reload();
          }}
        >
          <RefreshCcw className="mr-2 h-4 w-4" /> Recargar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Liga16 — Circuito de pádel
      </p>
    </div>
  );
}

/**
 * `errorElement` de React Router: el error llega por `useRouteError()`, no por
 * props, así que esta pieza solo lo extrae y se lo pasa a la pantalla.
 */
export function RouteErrorElement() {
  const error = useRouteError();
  scheduleSelfHeal(error);
  return <ErrorScreen error={error} />;
}

interface Props {
  children?: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Límite de errores de React para lo que revienta durante el render: una
 * vista que peta, un componente que lanza. El router usa `RouteErrorElement`
 * para los errores de navegación y de carga de chunks.
 */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    scheduleSelfHeal(error);
  }

  render() {
    if (this.state.error) return <ErrorScreen error={this.state.error} />;
    return this.props.children ?? null;
  }
}
