import { Suspense } from "react";
import { Outlet } from "react-router";
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
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 px-4 py-8 pb-20 md:px-6 md:pb-8">
        <div className="mx-auto w-full max-w-7xl">
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <AppFooter />
      <MobileBottomNav />
      <Toaster />
    </div>
  );
}