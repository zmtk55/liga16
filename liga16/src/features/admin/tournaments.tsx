import { useEffect, useState } from "react";
import { Link } from "react-router";
import { db } from "@/lib/data";
import type { Tournament } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { tournamentStatusLabel } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";
import { FilterBar } from "@/components/ui/filter-bar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

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
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Torneos</h1>
        <Button size="sm" asChild>
          <Link to="/admin/torneos/nuevo">
            <Plus className="h-4 w-4 mr-1" /> Nuevo torneo
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm">Torneos</CardTitle>
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
                  className: "w-44",
                },
              ]}
              resultCount={filtered.length}
              resultLabel="de"
              onClear={() => { setQuery(""); setStatus("all"); }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
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
              {list === null && (
                <TableRow>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableCell key={i} className="py-4"><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              )}
              {list !== null && list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No hay torneos todavía. Crea el primero con el asistente.
                  </TableCell>
                </TableRow>
              )}
              {list !== null && list.length > 0 && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    Ningún torneo coincide con el filtro.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="pl-4 font-medium">
                    <Link to={`/admin/torneos/${t.slug}`} className="hover:underline">{t.name}</Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{t.club_name ?? t.city}</TableCell>
                  <TableCell><Badge variant="outline">{tournamentStatusLabel[t.status]}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                    {t.start_date} → {t.end_date}
                  </TableCell>
                  <TableCell className="pr-4 text-right space-x-1">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/admin/torneos/${t.slug}`}>Abrir</Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/admin/torneos/${t.slug}/editar`}>Editar</Link>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(t)} aria-label={`Eliminar ${t.name}`}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
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
