import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { db, DATA_MODE } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Check = { label: string; ok: boolean; detail: string; warn?: boolean };

/**
 * Diagnóstico del entorno. Existe para no adivinar: si la pantalla de
 * pendientes no muestra nada, esta dice exactamente por qué.
 */
export default function SystemStatus() {
  const { user, isConfigured, loading } = useAuth();
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    const out: Check[] = [];

    out.push({
      label: "Modo de datos",
      ok: true,
      detail:
        DATA_MODE === "supabase"
          ? "Supabase (lee y escribe en tu base real)"
          : "DEMO (los cambios no llegan a tu base)",
      warn: DATA_MODE !== "supabase",
    });

    out.push({
      label: "Supabase configurado",
      ok: Boolean(isConfigured),
      detail: isConfigured ? "Sí" : "No — faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY",
      warn: !isConfigured,
    });

    if (supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        out.push({
          label: "Sesión",
          ok: Boolean(sessionData.session),
          detail: sessionData.session?.user?.email ?? "sin sesión",
          warn: !sessionData.session,
        });
        const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
        try {
          out.push({
            label: "Proyecto Supabase",
            ok: true,
            detail: url ? new URL(url).host : "sin URL",
          });
        } catch {
          out.push({ label: "Proyecto Supabase", ok: false, detail: "URL inválida" });
        }
      } catch (e) {
        out.push({ label: "Sesión", ok: false, detail: (e as Error).message });
      }
    }

    try {
      const players = await db.listPlayers();
      const conStatus = players.filter((p) => "status" in p).length;
      const counts = new Map<string, number>();
      for (const p of players) {
        const s = (p.status ?? "verificado") as string;
        counts.set(s, (counts.get(s) ?? 0) + 1);
      }
      out.push({
        label: "Columna `status`",
        ok: conStatus > 0,
        detail:
          conStatus > 0
            ? "existe (la migración está aplicada)"
            : "NO existe — falta correr supabase/self-registration.sql en ESTE proyecto",
        warn: conStatus === 0,
      });
      out.push({
        label: "Jugadores por estado",
        ok: true,
        detail:
          players.length === 0
            ? "0 jugadores (RLS o proyecto vacío)"
            : [...counts].map(([k, v]) => `${k}: ${v}`).join(" · "),
      });
    } catch (e) {
      out.push({ label: "Jugadores", ok: false, detail: (e as Error).message });
    }

    setChecks(out);
    setRunning(false);
  }

  useEffect(() => {
    if (!loading) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Estado del sistema</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Por qué ves (o no ves) lo que ves. No cambia nada, solo diagnostica.
          </p>
        </div>
        <Button onClick={() => void run()} disabled={running} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4" />
          {running ? "Comprobando…" : "Volver a comprobar"}
        </Button>
      </div>

      {user && (
        <Card>
          <CardContent className="pt-6 text-sm">
            <p>
              Sesión de <strong>{user.email || "(sin email)"}</strong> con rol{" "}
              <Badge variant="secondary">{user.role}</Badge>
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comprobaciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!checks && <p className="text-sm text-muted-foreground">Comprobando…</p>}
          {checks?.map((c) => (
            <div key={c.label} className="flex items-start gap-3 rounded-lg border p-3">
              {c.ok && !c.warn ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : c.warn ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.label}</p>
                <p className="break-words text-sm text-muted-foreground">{c.detail}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
