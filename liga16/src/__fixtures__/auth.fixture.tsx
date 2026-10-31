// Sesión admin sintética para capturas locales. Solo vite.screenshots.config.ts.
import { createContext, useContext, type ReactNode } from "react";
import type { User } from "@/types";

const DEMO_USER = {
  id: "admin-demo",
  email: "julian@liga16.test",
  role: "admin",
  player_id: null,
} as unknown as User;

// Tema por URL para las capturas: ?theme=dark fuerza oscuro sin tocar nada.
if (typeof window !== "undefined") {
  const theme = new URLSearchParams(window.location.search).get("theme");
  if (theme === "dark" || theme === "light") {
    window.localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }
}

const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isConfigured: boolean;
} | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        user: DEMO_USER,
        loading: false,
        signIn: async () => {},
        signUp: async () => {},
        signOut: async () => {},
        isConfigured: true,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}
