import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { db } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader, AdminStat, AdminStatStrip } from "@/components/admin/page-header";
import { BENTO_CARD, BENTO_DARK } from "@/components/admin/bento";

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
      detail: "Supabase (lee y escribe en tu base real)",
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

  const total = checks?.length ?? 0;
  const warns = checks?.filter((c) => c.warn).length ?? 0;
  const fails = checks?.filter((c) => !c.ok && !c.warn).length ?? 0;
  const oks = total - warns - fails;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Estado del sistema"
        description="Por qué ves (o no ves) lo que ves. No cambia nada, solo diagnostica."
        action={
          <Button onClick={() => void run()} disabled={running} variant="outline" size="sm" className="rounded-full">
            <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
            {running ? "Comprobando…" : "Volver a comprobar"}
          </Button>
        }
      >
        <AdminStatStrip loading={checks === null}>
          <AdminStat value={total} label="Comprobaciones" />
          <AdminStat value={oks} label="Correctas" />
          <AdminStat value={warns} label="Con aviso" tone={warns > 0 ? "text-warning-strong" : undefined} />
          <AdminStat value={fails} label="Con error" tone={fails > 0 ? "text-destructive" : undefined} />
        </AdminStatStrip>
      </AdminPageHeader>

      {user && (
        <div className={`${BENTO_CARD} ${BENTO_DARK} flex flex-wrap items-center justify-between gap-3`}>
          <div className="min-w-0">
            <p className="text-caption uppercase opacity-65">Sesión activa</p>
            <p className="mt-1 truncate font-display text-xl font-semibold">{user.email || "(sin email)"}</p>
          </div>
          <Badge className="rounded-full">{user.role}</Badge>
        </div>
      )}

      {!checks && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}
        </div>
      )}
      {checks && (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {checks.map((c) => {
            const state = c.ok && !c.warn ? "ok" : c.warn ? "warn" : "fail";
            return (
              <li
                key={c.label}
                className={`flex min-h-32 flex-col justify-between gap-4 rounded-3xl border bg-card p-5 ${
                  state === "warn" ? "border-warning/40" : state === "fail" ? "border-destructive/40" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-display text-lg font-semibold leading-snug">{c.label}</p>
                  {state === "ok" ? (
                    <CheckCircle2 aria-label="Correcto" className="h-5 w-5 shrink-0 text-success" />
                  ) : state === "warn" ? (
                    <AlertTriangle aria-label="Aviso" className="h-5 w-5 shrink-0 text-warning-strong" />
                  ) : (
                    <XCircle aria-label="Error" className="h-5 w-5 shrink-0 text-destructive" />
                  )}
                </div>
                <p className="break-words text-sm leading-relaxed text-muted-foreground">{c.detail}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
