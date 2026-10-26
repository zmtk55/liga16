import { useSearchParams } from "react-router";

import { useState } from "react";
import { CheckCircle2, ChevronRight, Inbox, RefreshCw, XCircle } from 'lucide-react';
import { useAdminAlerts } from '@/hooks/use-admin-alerts';
import type { AlertSeverity, AdminAlert } from '@/types';
import { alertTypeMeta } from '@/lib/alerts';
import { AdminPageHeader, AdminStat, AdminStatStrip } from '@/components/admin/page-header';
import { FilterBar } from '@/components/ui/filter-bar';
import { AdminFacet, AdminFacets } from '@/components/admin/filter-facets';
import { countActive } from '@/lib/filters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminEmptyState } from "@/components/admin/empty-state";
import { Link } from 'react-router';
import { cn } from '@/lib/utils';

const severityOrder: AlertSeverity[] = ['critical', 'warning', 'info'];
const severityLabel: Record<AlertSeverity, string> = {
  critical: 'Requieren atención urgente',
  warning: 'Requieren atención',
  info: 'Sistema',
};

const severityTone: Record<AlertSeverity, string> = {
  critical: 'destructive',
  warning: 'border-warning/30 bg-warning/10 text-warning-strong',
  info: 'secondary',
};

const severityIcon: Record<AlertSeverity, React.ReactNode> = {
  critical: <XCircle className="h-4 w-4 text-destructive" />,
  warning: <AlertTriangleIcon className="h-4 w-4 text-warning-strong" />,
  info: <CheckCircle2 className="h-4 w-4 text-info" />,
};

function AlertTriangleIcon(props: { className?: string }) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>;
}

function AlertRow({ alert }: { alert: AdminAlert }) {
  const meta = alertTypeMeta[alert.type];
  const Icon = meta.icon;

  return (
    <Link
      to={alert.href}
      className="block rounded-3xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex h-full items-start gap-4 rounded-3xl border bg-card p-6 transition-colors hover:bg-muted/40">
        <div className="mt-0.5 shrink-0 rounded-md bg-muted/60 p-1.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="font-display text-lg font-semibold">{alert.title}</p>
            <Badge className={cn('border-transparent text-xs', severityTone[alert.severity])}>
              {severityLabelKey(alert.severity)}
            </Badge>
          </div>
          <p className="mt-0.5 break-words text-sm text-muted-foreground">{alert.description}</p>
          {alert.count !== undefined && alert.count > 1 && (
            <Badge variant="outline" className="mt-1.5">
              {alert.count} elementos
            </Badge>
          )}
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 self-center text-muted-foreground/60" aria-hidden />
      </div>
    </Link>
  );
}

function severityLabelKey(s: AlertSeverity) {
  return { critical: 'Urgente', warning: 'Atención', info: 'Info' }[s];
}

export default function AdminInbox() {
  const { alerts, loading, error, refresh } = useAdminAlerts();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const setQuery = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set("q", value); else next.delete("q");
    setParams(next, { replace: true });
  };
  const [fSeverity, setFSeverity] = useState("all");
  const visible = alerts.filter((a) => {
    const q = query.trim().toLowerCase();
    if (q && !a.title.toLowerCase().includes(q) && !(a.description ?? "").toLowerCase().includes(q)) return false;
    if (fSeverity !== "all" && a.severity !== fSeverity) return false;
    return true;
  });
  const grouped = (key: AlertSeverity) => visible.filter((a) => a.severity === key);
  const total = visible.length;

  /** Las severidades que hay, con su cuenta. */
  const severityOptions = severityOrder
    .map((s) => ({ key: s, label: severityLabelKey(s), n: alerts.filter((a) => a.severity === s).length }))
    .filter((o) => o.n > 0);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Bandeja de entrada"
        description="Alertas y mensajes del sistema derivados de los datos en vivo. Desaparecen al resolverse."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        }
      >
        <AdminStatStrip loading={loading}>
          <AdminStat value={alerts.length} label="Alertas" />
          <AdminStat
            value={alerts.filter((a) => a.severity === "critical").length}
            label="Urgentes"
            tone={alerts.some((a) => a.severity === "critical") ? "text-destructive" : undefined}
          />
          <AdminStat
            value={alerts.filter((a) => a.severity === "warning").length}
            label="Atención"
            tone={alerts.some((a) => a.severity === "warning") ? "text-warning-strong" : undefined}
          />
          <AdminStat value={alerts.filter((a) => a.severity === "info").length} label="Info" />
        </AdminStatStrip>
      </AdminPageHeader>

      <FilterBar
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Buscar alerta…"
        resultCount={total}
        resultLabel="alertas"
        activeCount={countActive(fSeverity)}
        onClear={() => { setQuery(""); setFSeverity("all"); }}
      >
        <AdminFacets>
          <AdminFacet
            label="Severidad"
            value={fSeverity}
            onChange={setFSeverity}
            options={severityOptions}
            allLabel="Todas"
          />
        </AdminFacets>
      </FilterBar>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-muted-foreground">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : error ? null : total === 0 ? (
        alerts.length === 0 ? (
        <AdminEmptyState
          className="py-16"
          icon={<Inbox className="h-8 w-8 text-muted-foreground/50" />}
          title="Todo al día"
          description="No hay alertas en este momento. Aparecerán aquí cuando un jugador quede por verificar, un torneo empiece o cierre inscripciones, o un partido se juegue o se marque en disputa."
        />
        ) : (
          <AdminEmptyState
            className="py-16"
            icon={<Inbox className="h-8 w-8 text-muted-foreground/50" />}
            title="Sin coincidencias"
            description="Ninguna alerta coincide con la búsqueda."
          />
        )
      ) : (
        severityOrder.map((sev) => {
          const items = grouped(sev);
          if (items.length === 0) return null;
          return (
            <section key={sev} aria-labelledby={`sev-${sev}`}>
              <div className="mb-2 flex items-center gap-2">
                {severityIcon[sev]}
                <h2 id={`sev-${sev}`} className="text-sm font-semibold">
                  {severityLabel[sev]}
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {items.length}
                </Badge>
              </div>
              <Card className="rounded-3xl border-0 bg-transparent shadow-none">
                <CardContent className="p-2">
                  <div className="grid gap-4 lg:grid-cols-2">
                    {items.map((a) => (
                      <AlertRow key={a.id} alert={a} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>
          );
        })
      )}
    </div>
  );
}
