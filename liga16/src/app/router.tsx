import { createBrowserRouter, Navigate } from "react-router";
import AppLayout from "./layout";
import Home from "../features/home/page";
import { lazy } from "react";

// Lazy-loaded routes for performance
const Calendar = lazy(() => import("../features/calendar/page"));
const Players = lazy(() => import("../features/players/page"));
const Teams = lazy(() => import("../features/teams/page"));

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "calendar", element: <Calendar /> },
      { path: "players", element: <Players /> },
      { path: "teams", element: <Teams /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);