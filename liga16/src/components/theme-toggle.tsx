import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sun } from "lucide-react";
import SwitchButton from "@/components/kokonutui/switch-button";

// Botón sol/luna de Kokonut UI con animación de barrido. Misma función que
// antes (claro/oscuro vía next-themes), nuevo componente visual.
export function ThemeToggle() {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  if (!mounted) return <Button variant="ghost" size="icon" className="rounded-full" disabled aria-label="Cambiar tema"><Sun className="h-4 w-4" /></Button>;
  const isDark = (theme === "system" ? resolvedTheme : theme) === "dark";
  return (
    <SwitchButton
      theme={isDark ? "dark" : "light"}
      onThemeChange={setTheme}
      showLabel={false}
      size="sm"
      aria-label="Cambiar tema"
    />
  );
}
