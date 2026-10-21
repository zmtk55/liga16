import { RouterProvider } from "react-router";
import { router } from "./app/router";
import AppErrorBoundary from "@/components/app-error-boundary";

export default function App() {
  return (
    <AppErrorBoundary>
      <RouterProvider router={router} />
    </AppErrorBoundary>
  );
}