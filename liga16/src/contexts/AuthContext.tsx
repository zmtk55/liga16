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

async function resolveRole(userId: string): Promise<UserRole> {
  if (!isSupabaseConfigured || !supabase) return "player";
  try {
    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();
    return (data?.role as UserRole | undefined) ?? "player";
  } catch {
    return "player";
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
      const role = await resolveRole(sessionUser.id);
      setUser({
        id: sessionUser.id,
        email: sessionUser.email || "",
        role,
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
