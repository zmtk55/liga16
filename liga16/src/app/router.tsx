// El router es el punto de entrada de la app y tiene que exportarse junto a
// los componentes que sus rutas usan. La regla de fast-refresh no lo contempla
// porque `createBrowserRouter()` es una llamada y no una constante literal;
// partirlo en otro archivo solo movería la tabla de rutas sin cambiar lo que se
// entrega.
/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Navigate, useParams } from "react-router";
import AppLayout from "./layout";
import { RouteErrorElement } from "@/components/app-error-boundary";
import Home from "../features/home/page";
import { lazy, useEffect, useState } from "react";
import { Link } from "react-router";

import { useAuth } from "@/contexts/AuthContext";
import { RequireAuth, RequireRole } from "@/components/auth/guards";

// Lazy-loaded routes for performance
const Login = lazy(() => import("../features/auth/page"));
const Calendar = lazy(() => import("../features/calendar/page"));
const Players = lazy(() => import("../features/players/page"));
const PlayerDetail = lazy(() => import("../features/players/detail"));
const Teams = lazy(() => import("../features/teams/page"));
const TeamDetail = lazy(() => import("../features/teams/detail"));
const Tournaments = lazy(() => import("../features/tournaments/page"));
const TournamentDetail = lazy(() => import("../features/tournaments/detail"));
const Rankings = lazy(() => import("../features/rankings/page"));
import LegalPage from "../features/legal/page";
const Clubs = lazy(() => import("../features/clubs/page"));
const News = lazy(() => import("../features/news/page"));
const MyProfile = lazy(() => import("../features/players/my-profile"));
const SystemStatus = lazy(() => import("../features/admin/system-status"));

/** URL corta del bracket: /admin/torneos/mi-torneo/bracket abre directo la pestaña. */
function BracketShortcut() {

  const { slug } = useParams();
  return <Navigate to={`/admin/torneos/${slug}?tab=bracket`} replace />;
}
const AdminLayout = lazy(() => import("../features/admin/layout"));
const AdminDashboard = lazy(() => import("../features/admin/dashboard"));
const AdminTournaments = lazy(() => import("../features/admin/tournaments"));
const AdminTournamentDetail = lazy(
  () => import("../features/admin/tournament-detail"),
);
const AdminTournamentWizard = lazy(
  () => import("../features/admin/tournament-wizard"),
);
const AdminClubs = lazy(() => import("../features/admin/clubs"));
const AdminNews = lazy(() => import("../features/admin/news"));
const AdminPlayers = lazy(() => import("../features/admin/players"));
const AdminTeams = lazy(() => import("../features/admin/teams"));
const AdminParticipants = lazy(() => import("../features/admin/participants"));
const AdminResults = lazy(() => import("../features/admin/results"));
const AdminRanking = lazy(() => import("../features/admin/ranking"));
const AdminInbox = lazy(() => import("../features/admin/inbox"));
const AdminOrganizers = lazy(() => import("../features/admin/organizers"));

function AdminRoute({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole
      roles={["admin", "organizer"]}
      message="Solo administradores y organizadores pueden acceder al panel."
    >
      {children}
    </RequireRole>
  );
}

function GlobalAdminRoute({ children }: { children: React.ReactNode }) {
  return <RequireRole roles={["admin"]} message="Esta sección es del administrador general.">{children}</RequireRole>;
}
function AdminStart() {
  const {user} = useAuth();
  return user?.role === "organizer" ? <Navigate to="/admin/torneos" replace /> : <AdminDashboard />;
}

export const router = createBrowserRouter([
  { path: "/recuperar-contrasena", element: <PasswordRecoveryPage /> },
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <RouteErrorElement />,
    children: [
      { index: true, element: <RecoveryAwareHome /> },
      { path: "login", element: <Login /> },
      {
        path: "mi-perfil",
        element: (
          <RequireAuth>
            <MyProfile />
          </RequireAuth>
        ),
      },
      {
        path: "onboarding",
        element: <Navigate to="/admin/torneos/nuevo" replace />,
      },
      { path: "torneos", element: <Tournaments /> },
      { path: "torneos/:slug", element: <TournamentDetail /> },
      { path: "calendario", element: <Calendar /> },
      { path: "ranking", element: <Rankings /> },
      { path: "equipos", element: <Teams /> },
      { path: "equipos/:slug", element: <TeamDetail /> },
      { path: "jugadores", element: <Players /> },
      { path: "jugadores/:id", element: <PlayerDetail /> },
      { path: "padel", element: <Clubs /> },
      { path: "noticias", element: <News /> },
      { path: "legal/privacidad", element: <LegalPage slug="privacidad" /> },
      { path: "legal/terminos", element: <LegalPage slug="terminos" /> },
      { path: "legal/soporte", element: <LegalPage slug="soporte" /> },
      { path: "legal/eliminar", element: <LegalPage slug="eliminar" /> },
      { path: "cuenta/eliminar", element: <LegalPage slug="eliminar" /> },
    ],
  },
  {
    path: "/admin",
    element: (
      <AdminRoute>
        <AdminLayout />
      </AdminRoute>
    ),
    errorElement: <RouteErrorElement />,
    children: [
      { index: true, element: <AdminStart /> },
      { path: "estado", element: <GlobalAdminRoute><SystemStatus /></GlobalAdminRoute> },
      { path: "torneos", element: <AdminTournaments /> },
      { path: "torneos/nuevo", element: <AdminTournamentWizard /> },
      { path: "torneos/:slug", element: <AdminTournamentDetail /> },
      { path: "torneos/:slug/editar", element: <AdminTournamentWizard /> },
      { path: "torneos/:slug/bracket", element: <BracketShortcut /> },
      { path: "equipos", element: <GlobalAdminRoute><AdminTeams /></GlobalAdminRoute> },
      { path: "participantes", element: <AdminParticipants /> },
      { path: "jugadores", element: <GlobalAdminRoute><AdminPlayers /></GlobalAdminRoute> },
      { path: "organizadores", element: <GlobalAdminRoute><AdminOrganizers /></GlobalAdminRoute> },
      { path: "ranking", element: <GlobalAdminRoute><AdminRanking /></GlobalAdminRoute> },
      { path: "inbox", element: <GlobalAdminRoute><AdminInbox /></GlobalAdminRoute> },
      { path: "resultados", element: <GlobalAdminRoute><AdminResults /></GlobalAdminRoute> },
      { path: "padel", element: <GlobalAdminRoute><AdminClubs /></GlobalAdminRoute> },
      { path: "noticias", element: <GlobalAdminRoute><AdminNews /></GlobalAdminRoute> },
      {
        path: "onboarding",
        element: <Navigate to="/admin/torneos/nuevo" replace />,
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);



import { supabase } from "@/lib/supabase";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield } from "lucide-react";

function PasswordRecoveryPage() {
  const [status, setStatus] = useState<"checking" | "ready" | "saving" | "done" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void hasValidRecoverySession().then((valid) => {
      if (active) setStatus(valid ? "ready" : "invalid");
    }).catch(() => { if (active) setStatus("invalid"); }).finally(() => {
      // Wait until Auth has consumed the recovery fragment before clearing it.
      window.history.replaceState(null, "", window.location.pathname);
    });
    return () => { active = false; };
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (status !== "ready" || !supabase) return;
    const validation = passwordError(password, confirmation);
    if (validation) { setError(validation); return; }
    setError(null);
    setStatus("saving");
    try {
      if (!await hasValidRecoverySession()) { setStatus("invalid"); return; }
      const result = await supabase.auth.updateUser({ password });
      if (result.error) {
        setError("No se pudo guardar la contraseña. Revisa los requisitos e inténtalo de nuevo.");
        setStatus("ready");
        return;
      }
      setPassword("");
      setConfirmation("");
      // A password change invalidates other refresh sessions. End this recovery session too.
      const signedOut = await supabase.auth.signOut({ scope: "global" });
      if (signedOut.error) setError("Contraseña guardada. No se pudo confirmar el cierre de todas las sesiones.");
      setStatus("done");
    } catch {
      setError("No se pudo confirmar el cambio. No reenvíes el formulario; verifica el acceso antes de intentarlo otra vez.");
      setStatus("invalid");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Shield className="h-6 w-6" /></div>
          <CardTitle className="text-2xl">Nueva contraseña</CardTitle>
          <CardDescription>Conserva tu cuenta y tus torneos de liga16.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "checking" && <p role="status" className="text-sm text-muted-foreground">Verificando enlace…</p>}
          {status === "invalid" && <Alert variant="destructive"><AlertDescription>El enlace no es válido o ya venció. Necesitas un nuevo correo de recuperación.</AlertDescription></Alert>}
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {status === "done" ? <>
            <p role="status" className="text-sm">Contraseña guardada. Inicia sesión con la nueva contraseña.</p>
            <Button asChild className="w-full"><a href="/login">Ir a iniciar sesión</a></Button>
          </> : <form onSubmit={save} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="new-password">Nueva contraseña</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={12} required disabled={status !== "ready"} value={password} onChange={(e) => setPassword(e.target.value)} /><p className="text-xs text-muted-foreground">Usa al menos 12 caracteres.</p></div>
            <div className="space-y-2"><Label htmlFor="confirm-password">Confirmar contraseña</Label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={12} required disabled={status !== "ready"} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={status !== "ready"}>{status === "saving" ? "Guardando…" : "Guardar contraseña"}</Button>
          </form>}
          {status !== "done" && <p className="text-center text-sm text-muted-foreground"><Link to="/login" className="hover:underline">Volver a iniciar sesión</Link></p>}
        </CardContent>
      </Card>
    </main>
  );
}

function recoveryToken(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.get("type") === "recovery" && !params.has("error")
    ? params.get("access_token") || null
    : null;
}

function passwordError(password: string, confirmation: string): string | null {
  if (password.length < 12) return "Usa al menos 12 caracteres.";
  if (password !== confirmation) return "Las contraseñas no coinciden.";
  return null;
}

// Capture before Supabase consumes and removes the fragment. Never persist it.
const incomingRecoveryToken = typeof window !== 'undefined' ? recoveryToken(window.location.hash) : null;

async function hasValidRecoverySession(): Promise<boolean> {
  if (!supabase || !incomingRecoveryToken) return false;
  const { data, error } = await supabase.auth.getSession();
  if (error || data.session?.access_token !== incomingRecoveryToken) return false;
  const verified = await supabase.auth.getUser();
  return !verified.error && verified.data.user?.id === data.session.user.id;
}


function RecoveryAwareHome() {
  return incomingRecoveryToken ? <Navigate to="/recuperar-contrasena" replace /> : <Home />;
}
