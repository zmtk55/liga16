import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { db } from "@/lib/data";
import type { Tournament } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCity, formatDateRange, formatLabel, tournamentStatusLabel } from "@/lib/format";
import { ExternalLink, Pencil, Plus, Trash2, Trophy, Check } from "lucide-react";
import { FilterBar } from "@/components/ui/filter-bar";
import { AdminFacet, AdminFacets } from "@/components/admin/filter-facets";
import { countActive } from "@/lib/filters";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { CardShell, CardIdentity } from "@/components/cards/card-kit";
import { AdminEmptyState } from "@/components/admin/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPageHeader, AdminStat, AdminStatStrip } from "@/components/admin/page-header";
import { TournamentStatusBadge } from "@/components/admin/status-badge";
import { RowActionsMenu, RowContextMenu, type RowAction } from "@/components/admin/row-actions";

const STATUS_TRANSITIONS: Record<Tournament["status"], { label: string; target: Tournament["status"] }[]> = {
  draft: [
    { label: "Publicar", target: "published" },
    { label: "Cancelar", target: "cancelled" },
  ],
  published: [
    { label: "Abrir inscripciones", target: "registration_open" },
    { label: "Pasar a borrador", target: "draft" },
    { label: "Cancelar", target: "cancelled" },
  ],
  registration_open: [
    { label: "Cerrar inscripciones", target: "registration_closed" },
    { label: "Iniciar torneo", target: "in_progress" },
    { label: "Volver a publicar", target: "published" },
  ],
  registration_closed: [
    { label: "Abrir inscripciones", target: "registration_open" },
    { label: "Iniciar torneo", target: "in_progress" },
    { label: "Volver a publicar", target: "published" },
  ],
  in_progress: [
    { label: "Finalizar", target: "finished" },
    { label: "Cancelar", target: "cancelled" },
  ],
  finished: [
    { label: "Reabrir", target: "registration_open" },
  ],
  cancelled: [
    { label: "Reactivar", target: "draft" },
  ],
};

export default function AdminTournaments() {
  const [list, setList] = useState<Tournament[] | null>(null);
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const setQuery = (v: string) => {
    const next = new URLSearchParams(params);
    if (!v) next.delete("q");
    else next.set("q", v);
    setParams(next, { replace: true });
  };
  const [status, setStatus] = useState("all");

  useEffect(() => {
    db.listTournaments().then(setList);
  }, []);

  const filtered = (list ?? []).filter((t) => {
    const q = query.trim().toLowerCase();
    if (q && !t.name.toLowerCase().includes(q) && !(t.club_name ?? t.city ?? "").toLowerCase().includes(q)) return false;
    if (status !== "all" && t.status !== status) return false;
    return true;
  });

  const [deleting, setDeleting] = useState<Tournament | null>(null);
  const [changingStatus, setChangingStatus] = useState<{ tournament: Tournament; target: Tournament["status"] } | null>(null);

  const resumen = useMemo(() => {
    const all = list ?? [];
    return {
      total: all.length,
      enJuego: all.filter((t) => t.status === "in_progress").length,
      abiertos: all.filter((t) => t.status === "registration_open").length,
      terminados: all.filter((t) => t.status === "finished").length,
    };
  }, [list]);

  /**
   * Los estados que de verdad hay, con su cuenta. La lista sale de los
   * torneos cargados, no de un catálogo escrito a mano: un estado sin
   * torneos no se ofrece y uno con playoffs no falta.
   */
  const statusOptions = useMemo(() => {
    const all = list ?? [];
    return Object.entries(tournamentStatusLabel)
      .map(([key, label]) => ({ key, label, n: all.filter((t) => t.status === key).length }))
      .filter((o) => o.n > 0)
      .sort((a, b) => b.n - a.n);
  }, [list]);

  async function handleDelete(t: Tournament) {
    try {
      await db.deleteTournament(t.slug);
      toast.success(`Torneo "${t.name}" eliminado`);
      db.listTournaments().then(setList);
    } catch (e) {
      toast.error((e as Error).message ?? "Error al eliminar");
    } finally {
      setDeleting(null);
    }
  }

  async function handleStatusChange(t: Tournament, target: Tournament["status"]) {
    try {
      await db.updateTournament(t.slug, { status: target });
      toast.success(`"${t.name}" cambiado a ${tournamentStatusLabel[target]}`);
      db.listTournaments().then(setList);
    } catch (e) {
      toast.error((e as Error).message ?? "Error al cambiar estado");
    } finally {
      setChangingStatus(null);
    }
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Torneos"
        description="Crea, publica y administra los torneos del circuito."
        action={
          <Button asChild size="sm">
            <Link to="/admin/torneos/nuevo">
              <Plus className="h-4 w-4" /> Nuevo torneo
            </Link>
          </Button>
        }
      >
        <AdminStatStrip>
          <AdminStat value={resumen.total} label="Torneos" />
          <AdminStat
            value={resumen.enJuego}
            label="En juego"
            tone={resumen.enJuego > 0 ? "text-primary" : undefined}
          />
          <AdminStat
            value={resumen.abiertos}
            label="Inscripciones abiertas"
            tone={resumen.abiertos > 0 ? "text-success" : undefined}
          />
          <AdminStat value={resumen.terminados} label="Terminados" />
        </AdminStatStrip>
      </AdminPageHeader>

      <Card>
        <CardHeader className="gap-3">
          <FilterBar
            search={query}
            onSearch={setQuery}
            searchPlaceholder="Buscar torneo…"
            resultCount={filtered.length}
            resultLabel="torneos"
            activeCount={countActive(status)}
            onClear={() => { setQuery(""); setStatus("all"); }}
          >
            <AdminFacets>
              <AdminFacet
                label="Estado"
                value={status}
                onChange={setStatus}
                options={statusOptions}
                allLabel="Todos"
              />
            </AdminFacets>
          </FilterBar>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {list === null && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardShell key={i} className="h-full">
                  <Skeleton className="aspect-[16/7] w-full" />
                  <CardContent className="pt-12">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="mt-2 h-3 w-1/2" />
                  </CardContent>
                  <div className="flex items-center justify-end border-t border-border/60 bg-muted/40 px-3 py-1.5">
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                </CardShell>
              ))}
            </div>
          )}

          {list !== null && list.length === 0 && (
            <AdminEmptyState
              icon={<Trophy className="h-5 w-5" />}
              title="No hay torneos todavía"
              description="Crea el primero con el asistente de torneo."
              action={
                <Button asChild size="sm">
                  <Link to="/admin/torneos/nuevo">Crear torneo</Link>
                </Button>
              }
            />
          )}

          {list !== null && list.length > 0 && filtered.length === 0 && (
            <AdminEmptyState
              title="Sin coincidencias"
              description="Ningún torneo coincide con la búsqueda o el filtro."
            />
          )}

          {filtered.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((t) => {
                const canTransition = STATUS_TRANSITIONS[t.status] ?? [];
                const actions: RowAction[] = [
                  {
                    label: "Abrir",
                    icon: <ExternalLink className="h-4 w-4" />,
                    to: `/admin/torneos/${t.slug}`,
                  },
                  {
                    label: "Editar",
                    icon: <Pencil className="h-4 w-4" />,
                    to: `/admin/torneos/${t.slug}/editar`,
                  },
                ];
                for (const tr of canTransition) {
                  actions.push({
                    label: tr.label,
                    icon: <Check className="h-4 w-4" />,
                    onSelect: () => setChangingStatus({ tournament: t, target: tr.target }),
                    separator: tr.target === "cancelled" || tr.target === "finished",
                  });
                }
                actions.push({
                  label: "Eliminar",
                  icon: <Trash2 className="h-4 w-4" />,
                  onSelect: () => setDeleting(t),
                  destructive: true,
                  separator: true,
                });
                return (
                  <RowContextMenu key={t.id} actions={actions}>
                    <CardShell banner={t.cover_url} bannerAlt={`Cubierta del torneo ${t.name}`} className="relative">
                      {t.cover_url && (
                        <>
                          <h3 className="absolute inset-inline-start-4 top-4 z-10 line-clamp-1 text-base font-bold text-white drop-shadow-sm">
                            {t.name}
                          </h3>
                          <div className="absolute inset-inline-end-4 top-4 z-10">
                            <TournamentStatusBadge status={t.status} />
                          </div>
                        </>
                      )}
                      <CardContent className={t.cover_url ? "pt-12" : "p-4"}>
                          <CardIdentity
                            lead={<Trophy className="h-5 w-5 shrink-0 text-primary" aria-hidden />}
                            titleLines={[
                              t.club_name ?? formatCity(t.city),
                              `${formatDateRange(t.start_date, t.end_date)} · ${formatLabel[t.format] ?? t.format}`,
                            ]}
                          />
                        </CardContent>
                      <div className="flex items-center justify-end border-t border-border/60 bg-muted/40 px-3 py-1.5">
                        <RowActionsMenu actions={actions} label={`Acciones para ${t.name}`} />
                      </div>
                    </CardShell>
                  </RowContextMenu>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        onConfirm={() => deleting && handleDelete(deleting)}
        title={`¿Eliminar el torneo "${deleting?.name ?? ""}"?`}
        description="Se borran sus partidos, equipos y categorías. No se puede deshacer."
        destructive
      />

      <ConfirmDialog
        open={!!changingStatus}
        onOpenChange={(o) => { if (!o) setChangingStatus(null); }}
        onConfirm={() => changingStatus && handleStatusChange(changingStatus.tournament, changingStatus.target)}
        title={`¿Cambiar estado del torneo "${changingStatus?.tournament.name ?? ""}"?`}
        description={`Se cambiará a "${tournamentStatusLabel[changingStatus?.target ?? ""]}"`}
        confirmLabel="Confirmar"
      />
    </div>
  );
}
