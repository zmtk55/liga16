// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { useAuth } from "@/contexts/AuthContext";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { UserRole } from "@/types";
import { Navigate, useLocation } from "react-router";
import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface RequireAuthProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequireAuth({ children, fallback }: RequireAuthProps) {
  const { user, loading, isConfigured } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Cargando sesión…</p>
      </div>
    );
  }

  // Modo demo sin Supabase: permitir acceso (útil para desarrollo local)
  if (!isConfigured) {
    return <>{children}</>;
  }

  if (!user) {
    if (fallback) return <>{fallback}</>;
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  return (
    <RequireRole roles={["admin", "organizer"]} message="Solo administradores y organizadores pueden acceder al panel.">
      {children}
    </RequireRole>
  );
}

export function RequireRole({ children, roles, message }: RequireRoleProps) {
  const { user, loading, isConfigured } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Cargando sesión…</p>
      </div>
    );
  }

  if (!isConfigured) {
    return <>{children}</>;
  }

  const role = user?.role;
  if (!role || !roles.includes(role)) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="max-w-md text-center">
          <CardContent className="pt-6 space-y-4">
            <ShieldAlert className="h-12 w-12 mx-auto text-destructive" />
            <div>
              <h2 className="text-xl font-bold">Acceso restringido</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {message ?? "No tienes permisos para ver esta página."}
              </p>
            </div>
            <Button asChild><a href="/">Ir al inicio</a></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
