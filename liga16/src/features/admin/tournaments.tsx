import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { db } from "@/lib/data";
import type { Tournament } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateRange, tournamentStatusLabel } from "@/lib/format";
import { ExternalLink, Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { FilterBar } from "@/components/ui/filter-bar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { CardShell, CardIdentity, CardStat, CardFooterStrip } from "@/components/cards/card-kit";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPageHeader, AdminStat, AdminStatStrip } from "@/components/admin/page-header";
import { TournamentStatusBadge } from "@/components/admin/status-badge";
import { RowActionsMenu, RowContextMenu, type RowAction } from "@/components/admin/row-actions";

export default function AdminTournaments() {
  const [list, setList] = useState<Tournament[] | null>(null);
  // El buscador vive en el shell (SectionControl, ADR-0009) y escribe ?q=.
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

  /** Cifras de cabecera: qué está vivo, qué se puede abrir y qué ya pasó. */
  const resumen = useMemo(() => {
    const all = list ?? [];
    return {
      total: all.length,
      enJuego: all.filter((t) => t.status === "in_progress").length,
      abiertos: all.filter((t) => t.status === "registration_open").length,
      terminados: all.filter((t) => t.status === "finished").length,
    };
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
            selects={[
              {
                key: "status",
                ariaLabel: "Filtrar por estado",
                allLabel: "Todos los estados",
                value: status,
                onChange: setStatus,
                options: Object.entries(tournamentStatusLabel).map(([v, l]) => ({ value: v, label: l })),
              },
            ]}
            resultCount={filtered.length}
            resultLabel="torneos"
            onClear={() => { setQuery(""); setStatus("all"); }}
          />
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {/* Cards y no tabla (mismo CardKit del sitio público): el nombre,
              la sede y las fechas ya son el contenido de una tarjeta; en tabla
              había que leerlas en horizontal. */}
          {list === null && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          )}

          {list !== null && list.length === 0 && (
            <Empty className="border-0 py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Trophy className="h-5 w-5" /></EmptyMedia>
                <EmptyTitle className="text-base">No hay torneos todavía</EmptyTitle>
                <EmptyDescription>Crea el primero con el asistente de torneo.</EmptyDescription>
              </EmptyHeader>
              <Button asChild size="sm" className="mt-4">
                <Link to="/admin/torneos/nuevo">Crear torneo</Link>
              </Button>
            </Empty>
          )}

          {list !== null && list.length > 0 && filtered.length === 0 && (
            <Empty className="border-0 py-10">
              <EmptyHeader>
                <EmptyTitle className="text-base">Sin coincidencias</EmptyTitle>
                <EmptyDescription>Ningún torneo coincide con la búsqueda o el filtro.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {filtered.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((t) => {
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
                  {
                    label: "Eliminar",
                    icon: <Trash2 className="h-4 w-4" />,
                    onSelect: () => setDeleting(t),
                    destructive: true,
                    separator: true,
                  },
                ];
                return (
                  <RowContextMenu key={t.id} actions={actions}>
                    <CardShell accent={t.status === "in_progress"}>
                      <CardContent className="p-4">
                        <CardIdentity
                          lead={<Trophy className="h-5 w-5 shrink-0 text-primary" aria-hidden />}
                          title={t.name}
                          meta={[t.club_name ?? t.city, formatDateRange(t.start_date, t.end_date)]
                            .filter(Boolean)
                            .join(" · ")}
                          end={<TournamentStatusBadge status={t.status} />}
                        />
                      </CardContent>
                      <CardFooterStrip
                        stats={
                          <>
                            <CardStat value={t.city || "—"} label="Ciudad" />
                            <CardStat value={t.format === "groups_knockout" ? "Grupos" : "Eliminación"} label="Formato" />
                          </>
                        }
                        chip={
                          <RowActionsMenu actions={actions} label={`Acciones para ${t.name}`} />
                        }
                      />
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
      />
    </div>
  );
}
