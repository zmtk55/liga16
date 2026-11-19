import { Suspense } from "react";
import { Outlet, useLocation } from "react-router";
import { SiteHeader } from "@/components/site-header";
import { AppFooter } from "@/components/app-footer";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { Toaster } from "@/components/ui/sonner";

/** Fallback para las rutas lazy: sin esto, la primera visita a una ruta
    suspende la raíz y la navegación se queda en la pantalla anterior. */
export function RouteFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-muted-foreground">Cargando…</p>
    </div>
  );
}

export default function AppLayout() {
  const { pathname } = useLocation();
  // Las demos aisladas (/demo/*) son herramientas compactas de una pantalla:
  // el pie de marketing sobra y la barra fija inferior lo tapaba en móvil.
  const isDemo = pathname.startsWith("/demo/");
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className={`flex-1 px-4 pb-6 md:px-6 md:pb-6 ${isDemo ? "pt-3" : "pt-8"}`}>
        <div className="mx-auto w-full max-w-7xl">
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      {!isDemo && <AppFooter />}
      <MobileBottomNav />
      <Toaster />
    </div>
  );
}
