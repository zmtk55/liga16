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
      { path: "clubes", element: <Clubs /> },
      { path: "noticias", element: <News /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);