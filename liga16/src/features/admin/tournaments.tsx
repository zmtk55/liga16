import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { db } from "@/lib/data";
import type { Tournament } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateRange, tournamentStatusLabel } from "@/lib/format";
import { ExternalLink, Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { FilterBar } from "@/components/ui/filter-bar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { AdminPageHeader, AdminStat, AdminStatStrip } from "@/components/admin/page-header";
import { AdminTableEmpty, AdminTableSkeleton } from "@/components/admin/table-state";
import { TournamentStatusBadge } from "@/components/admin/status-badge";
import { RowActionsMenu, RowContextMenu, type RowAction } from "@/components/admin/row-actions";

export default function AdminTournaments() {
  const [list, setList] = useState<Tournament[] | null>(null);
  const [query, setQuery] = useState("");
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
            search={query}
            onSearch={setQuery}
            searchPlaceholder="Buscar torneo o sede…"
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Nombre</TableHead>
                <TableHead className="hidden sm:table-cell">Sede</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden md:table-cell">Fechas</TableHead>
                <TableHead className="text-right pr-4">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list === null && <AdminTableSkeleton columns={5} />}
              {list !== null && list.length === 0 && (
                <AdminTableEmpty
                  colSpan={5}
                  icon={<Trophy className="h-5 w-5" />}
                  title="No hay torneos todavía"
                  description="Crea el primero con el asistente de torneo."
                  action={
                    <Button asChild size="sm" className="mt-4">
                      <Link to="/admin/torneos/nuevo">Crear torneo</Link>
                    </Button>
                  }
                />
              )}
              {list !== null && list.length > 0 && filtered.length === 0 && (
                <AdminTableEmpty
                  colSpan={5}
                  title="Sin coincidencias"
                  description="Ningún torneo coincide con la búsqueda o el filtro."
                />
              )}
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
                  <TableRow>
                  <TableCell className="pl-4 font-medium">
                    <Link
                      to={`/admin/torneos/${t.slug}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {t.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {t.club_name ?? t.city}
                  </TableCell>
                  <TableCell>
                    <TournamentStatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                    {formatDateRange(t.start_date, t.end_date)}
                  </TableCell>
                  <TableCell className="pr-2 text-right">
                    <RowActionsMenu actions={actions} label={`Acciones para ${t.name}`} />
                  </TableCell>
                </TableRow>
                </RowContextMenu>
                );
              })}
            </TableBody>
          </Table>
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
