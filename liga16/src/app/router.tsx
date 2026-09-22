import { createBrowserRouter, Navigate } from "react-router";
import AppLayout from "./layout";
import Home from "../features/home/page";
import { lazy } from "react";

// Lazy-loaded routes for performance
const Calendar = lazy(() => import("../features/calendar/page"));
const Players = lazy(() => import("../features/players/page"));
const PlayerDetail = lazy(() => import("../features/players/detail"));
const Teams = lazy(() => import("../features/teams/page"));
const Tournaments = lazy(() => import("../features/tournaments/page"));
const TournamentDetail = lazy(() => import("../features/tournaments/detail"));
const Rankings = lazy(() => import("../features/rankings/page"));
const Clubs = lazy(() => import("../features/clubs/page"));
const News = lazy(() => import("../features/news/page"));
const AdminLayout = lazy(() => import("../features/admin/layout"));
const AdminDashboard = lazy(() => import("../features/admin/dashboard"));
const AdminTournaments = lazy(() => import("../features/admin/tournaments"));
const AdminClubs = lazy(() => import("../features/admin/clubs"));
const AdminNews = lazy(() => import("../features/admin/news"));
const AdminPlayers = lazy(() => import("../features/admin/players"));
const AdminTeams = lazy(() => import("../features/admin/teams"));
const AdminResults = lazy(() => import("../features/admin/results"));
const AdminRanking = lazy(() => import("../features/admin/ranking"));
const AdminOnboarding = lazy(() => import("../features/admin/onboarding"));

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "torneos", element: <Tournaments /> },
      { path: "torneos/:slug", element: <TournamentDetail /> },
      { path: "calendario", element: <Calendar /> },
      { path: "ranking", element: <Rankings /> },
      { path: "equipos", element: <Teams /> },
      { path: "jugadores", element: <Players /> },
      { path: "jugadores/:id", element: <PlayerDetail /> },
      { path: "padel", element: <Clubs /> },
      { path: "noticias", element: <News /> },
      {
        path: "admin",
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminDashboard /> },
          { path: "torneos", element: <AdminTournaments /> },
          { path: "equipos", element: <AdminTeams /> },
          { path: "jugadores", element: <AdminPlayers /> },
          { path: "ranking", element: <AdminRanking /> },
          { path: "resultados", element: <AdminResults /> },
          { path: "padel", element: <AdminClubs /> },
          { path: "noticias", element: <AdminNews /> },
          { path: "onboarding", element: <AdminOnboarding /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);