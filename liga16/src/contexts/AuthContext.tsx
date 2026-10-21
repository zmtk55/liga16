import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User, UserRole } from "@/types";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isConfigured: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function resolveUser(sessionUser: { id: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> }): Promise<Pick<User, "role" | "player_id">> {
  if (!isSupabaseConfigured || !supabase) {
    return { role: "player", player_id: null };
  }
  try {
    // El rol ya viene en la sesión: no hace falta otro viaje de red con getUser()
    const role =
      (sessionUser.app_metadata?.role as UserRole | undefined) ||
      (sessionUser.user_metadata?.role as UserRole | undefined) ||
      "player";

    // Buscar el perfil de jugador asociado al usuario auth
    const { data: profile } = await supabase
      .from("player_profiles")
      .select("id")
      .eq("user_id", sessionUser.id)
      .maybeSingle();

    return { role, player_id: profile?.id ?? null };
  } catch {
    return { role: "player", player_id: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    /**
     * Una sola hidratación a la vez.
     *
     * La sesión llega por dos vías (`getSession()` y el evento INITIAL_SESSION
     * del listener) y las dos disparan la hidratación. Antes, la segunda
     * encontra el id ya hidratado, hace `setLoading(false)` y se va: el guard
     * veía "ya no estoy cargando" con el usuario todavía SIN PONER, y
     * `RequireAuth` echaba al login. Por eso /jugadores y /mi-perfil
     * devolvían al login con la sesión viva, mientras el admin no (su guard
     * no redirige, muestra "Acceso restringido" y se recupera solo).
     *
     * Ahora la segunda señal ESPERA a la primera: `loading` baja a false
     * cuando el usuario ya está puesto.
     */
    let hydration: Promise<void> | null = null;

    async function hydrateUser(
      sessionUser: { id: string; email?: string | null; created_at?: string | null; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> },
    ) {
      if (!hydration) {
        hydration = (async () => {
          const { role, player_id } = await resolveUser(sessionUser);
          setUser({
            id: sessionUser.id,
            email: sessionUser.email || "",
            role,
            player_id,
            created_at: sessionUser.created_at || new Date().toISOString(),
          });
        })();
      }
      await hydration;
      setLoading(false);
    }

    // Check active session
    supabase!.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        void hydrateUser(session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen to auth changes
    const { data: listener } = supabase!.auth.onAuthStateChange(
      async (_, session) => {
        if (session?.user) {
          void hydrateUser(session.user);
        } else {
          hydration = null;
          setUser(null);
          setLoading(false);
        }
      }
    );

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase no configurado");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase no configurado");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, signUp, signOut, isConfigured: isSupabaseConfigured }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return context;
}
