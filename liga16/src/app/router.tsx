// El router es el punto de entrada de la app y tiene que exportarse junto a
// los componentes que sus rutas usan. La regla de fast-refresh no lo contempla
// porque `createBrowserRouter()` es una llamada y no una constante literal;
// partirlo en otro archivo solo movería la tabla de rutas sin cambiar lo que se
// entrega.
/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Navigate, useParams } from "react-router";
import AppLayout from "./layout";
import Home from "../features/home/page";
import { lazy } from "react";
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

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
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
      {
        path: "jugadores",
        element: (
          <RequireAuth>
            <Players />
          </RequireAuth>
        ),
      },
      {
        path: "jugadores/:id",
        element: (
          <RequireAuth>
            <PlayerDetail />
          </RequireAuth>
        ),
      },
      { path: "padel", element: <Clubs /> },
      { path: "noticias", element: <News /> },
    ],
  },
  {
    path: "/admin",
    element: (
      <AdminRoute>
        <AdminLayout />
      </AdminRoute>
    ),
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: "estado", element: <SystemStatus /> },
      { path: "torneos", element: <AdminTournaments /> },
      { path: "torneos/nuevo", element: <AdminTournamentWizard /> },
      { path: "torneos/:slug", element: <AdminTournamentDetail /> },
      { path: "torneos/:slug/editar", element: <AdminTournamentWizard /> },
      { path: "torneos/:slug/bracket", element: <BracketShortcut /> },
      { path: "equipos", element: <AdminTeams /> },
      { path: "participantes", element: <AdminParticipants /> },
      { path: "jugadores", element: <AdminPlayers /> },
      { path: "ranking", element: <AdminRanking /> },
      { path: "inbox", element: <AdminInbox /> },
      { path: "resultados", element: <AdminResults /> },
      { path: "padel", element: <AdminClubs /> },
      { path: "noticias", element: <AdminNews /> },
      {
        path: "onboarding",
        element: <Navigate to="/admin/torneos/nuevo" replace />,
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
