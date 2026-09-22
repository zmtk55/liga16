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

async function resolveUser(userId: string): Promise<Pick<User, "role" | "player_id">> {
  if (!isSupabaseConfigured || !supabase) {
    return { role: "player", player_id: null };
  }
  try {
    const { data: authData } = await supabase.auth.getUser();
    const sessionUser = authData?.user;
    const role =
      (sessionUser?.app_metadata?.role as UserRole | undefined) ||
      (sessionUser?.user_metadata?.role as UserRole | undefined) ||
      "player";

    // Buscar el perfil de jugador asociado al usuario auth
    const { data: profile } = await supabase
      .from("player_profiles")
      .select("id")
      .eq("user_id", userId)
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

    async function hydrateUser(
      sessionUser: { id: string; email?: string | null; created_at?: string | null },
    ) {
      const { role, player_id } = await resolveUser(sessionUser.id);
      setUser({
        id: sessionUser.id,
        email: sessionUser.email || "",
        role,
        player_id,
        created_at: sessionUser.created_at || new Date().toISOString(),
      });
    }

    // Check active session
    supabase!.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        void hydrateUser(session.user);
      }
      setLoading(false);
    });

    // Listen to auth changes
    const { data: listener } = supabase!.auth.onAuthStateChange(
      async (_, session) => {
        if (session?.user) {
          void hydrateUser(session.user);
        } else {
          setUser(null);
        }
        setLoading(false);
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
