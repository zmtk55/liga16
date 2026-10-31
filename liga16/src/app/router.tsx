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
import { lazy } from "react";
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
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <RouteErrorElement />,
    children: [
      { index: true, element: <Home /> },
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
