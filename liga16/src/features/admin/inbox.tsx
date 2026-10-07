"use client";

import { CheckCircle2, Inbox, RefreshCw, XCircle } from 'lucide-react';
import { useAdminAlerts } from '@/hooks/use-admin-alerts';
import type { AlertSeverity, AdminAlert } from '@/types';
import { alertTypeMeta } from '@/lib/alerts';
import { AdminPageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';
import { DATA_MODE } from '@/lib/data';

const severityOrder: AlertSeverity[] = ['critical', 'warning', 'info'];
const severityLabel: Record<AlertSeverity, string> = {
  critical: 'Requieren atención urgente',
  warning: 'Requieren atención',
  info: 'Sistema',
};

const severityTone: Record<AlertSeverity, string> = {
  critical: 'destructive',
  warning: 'outline border-amber-200/50 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  info: 'secondary',
};

const severityIcon: Record<AlertSeverity, React.ReactNode> = {
  critical: <XCircle className="h-4 w-4 text-destructive" />,
  warning: <AlertTriangleIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
  info: <CheckCircle2 className="h-4 w-4 text-sky-600 dark:text-sky-400" />,
};

function AlertTriangleIcon(props: { className?: string }) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>;
}

function AlertRow({ alert }: { alert: AdminAlert }) {
  const meta = alertTypeMeta[alert.type];
  const Icon = meta.icon;

  return (
    <Link to={alert.href} className="group">
      <div className="flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/40">
        <div className="mt-0.5 shrink-0 rounded-md bg-muted/60 p-1.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium">{alert.title}</p>
            <Badge className={cn('border-transparent text-[10px]', severityTone[alert.severity])}>
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
      </div>
    </Link>
  );
}

function severityLabelKey(s: AlertSeverity) {
  return { critical: 'Urgente', warning: 'Atención', info: 'Info' }[s];
}

export default function AdminInbox() {
  const { alerts, loading, error, refresh } = useAdminAlerts();
  const grouped = (key: AlertSeverity) => alerts.filter((a) => a.severity === key);
  const total = alerts.length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Bandeja de entrada"
        description="Alertas y mensajes del sistema derivados de los datos en vivo. Desaparecen al resolverse."
        action={
          <div className="flex items-center gap-2">
            {DATA_MODE === 'demo' && (
              <Badge variant="secondary" className="text-[10px]">
                Modo demo
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading} aria-label="Actualizar alertas">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      />

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
      ) : total === 0 ? (
        <Empty className="border-0 py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox className="h-8 w-8 text-muted-foreground/50" />
            </EmptyMedia>
            <EmptyTitle>Todo al día</EmptyTitle>
            <EmptyDescription>
              No hay alertas en este momento. Aparecerán aquí cuando un jugador quede por verificar, un torneo
              empiece o cierre inscripciones, o un partido se juegue o se marque en disputa.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
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
                <Badge variant="secondary" className="text-[10px]">
                  {items.length}
                </Badge>
              </div>
              <Card>
                <CardContent className="p-2">
                  <div className="divide-y">
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
