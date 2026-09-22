import { Outlet } from "react-router";
import { SiteHeader } from "@/components/site-header";
import { AppFooter } from "@/components/app-footer";
import { Toaster } from "@/components/ui/sonner";

export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 px-4 py-8 md:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <Outlet />
        </div>
      </main>
      <AppFooter />
      <Toaster />
    </div>
  );
}