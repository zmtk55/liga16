import { Menu } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 h-14">
      <SidebarTrigger>
        <Menu className="h-4 w-4" />
      </SidebarTrigger>
      <div className="flex items-center space-x-2">
        <span className="text-sm text-muted-foreground">Admin</span>
      </div>
    </header>
  );
}