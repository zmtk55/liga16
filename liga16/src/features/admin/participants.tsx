// Admin → Participantes: todas las parejas de TODOS los torneos en una sola vista.
// Filtra por torneo/categoría, y permite borrar o mover una pareja a otro torneo.
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/data";
import type { Tournament, TournamentCategory, UUID } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { FilterBar } from "@/components/ui/filter-bar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminTableEmpty, AdminTableSkeleton } from "@/components/admin/table-state";
import { RowActionsMenu, RowContextMenu, type RowAction } from "@/components/admin/row-actions";
import { FolderInput, Trash2, UsersRound } from "lucide-react";

interface AllPair {
  id: UUID;
  name: string;
  category_id: UUID | null;
  category_name: string | null;
  tournament_id: UUID | null;
  tournament_name: string | null;
  created_at: string | null;
}

export default function AdminParticipants() {
  const [pairs, setPairs] = useState<AllPair[] | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [categories, setCategories] = useState<TournamentCategory[]>([]);
  const [query, setQuery] = useState("");
  const [fTournament, setFTournament] = useState("all");
  const [fCategory, setFCategory] = useState("all");
  const [deleting, setDeleting] = useState<AllPair | null>(null);
  const [moving, setMoving] = useState<AllPair | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [allPairs, ts] = await Promise.all([db.listAllPairs(), db.listTournaments()]);
      setPairs(allPairs);
      setTournaments(ts);
    } catch (e) {
      toast.error((e as Error).message ?? "Error cargando participantes");
      setPairs([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Categorías de los torneos que están representados en la lista
  useEffect(() => {
    if (!pairs) return;
    const tids = [...new Set(pairs.map((p) => p.tournament_id).filter(Boolean))] as string[];
    Promise.all(
      tids.map((id) => db.getTournamentCategories(id).catch(() => [] as TournamentCategory[])),
    ).then((lists) => setCategories(lists.flat()));
  }, [pairs]);

  const catNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  // Categorías filtrables: las del torneo elegido, o todas si es "Todos"
  const filterCats = useMemo(() => {
    if (fTournament === "all") return categories;
    return categories.filter((c) => c.tournament_id === fTournament);
  }, [categories, fTournament]);

  const filtered = (pairs ?? []).filter((p) => {
    const q = query.trim().toLowerCase();
    if (q && !p.name.toLowerCase().includes(q) && !(p.tournament_name ?? "").toLowerCase().includes(q)) return false;
    if (fTournament !== "all" && p.tournament_id !== fTournament) return false;
    if (fCategory !== "all" && (p.category_id ?? "") !== fCategory) return false;
    return true;
  });

  async function handleDelete(p: AllPair) {
    setBusy(true);
    try {
      await db.deletePair(p.id);
      toast.success(`Pareja "${p.name}" eliminada`);
      load();
    } catch (e) {
      toast.error((e as Error).message ?? "Error al eliminar");
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  }

  function openMove(p: AllPair) {
    setMoving(p);
    setMoveTarget("");
  }

  async function handleMove() {
    if (!moving || !moveTarget) return;
    if (moveTarget === moving.tournament_id) {
      toast.info("La pareja ya está en ese torneo");
      return;
    }
    setBusy(true);
    try {
      // La categoría del torneo destino no existe aquí → se deja null para
      // que el admin la reasigne desde la pestaña Equipos del torneo destino.
      await db.updatePair(moving.id, { tournament_id: moveTarget });
      toast.success(`"${moving.name}" movida a otro torneo`);
      setMoving(null);
      load();
    } catch (e) {
      toast.error((e as Error).message ?? "Error al mover");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Participantes"
        description="Todas las parejas de todos los torneos, en una sola vista."
      />

      <Card>
        <CardHeader className="gap-3">
          <FilterBar
            search={query}
            onSearch={setQuery}
            searchPlaceholder="Buscar pareja o torneo…"
            selects={[
              {
                key: "tournament",
                ariaLabel: "Filtrar por torneo",
                allLabel: "Todos los torneos",
                value: fTournament,
                onChange: (v) => { setFTournament(v); setFCategory("all"); },
                options: tournaments.map((t) => ({ value: t.id, label: t.name })),
                className: "sm:w-52",
              },
              {
                key: "category",
                ariaLabel: "Filtrar por categoría",
                allLabel: "Todas las categorías",
                value: fCategory,
                onChange: setFCategory,
                options: filterCats.map((c) => ({ value: c.id, label: c.name })),
                className: "sm:w-48",
              },
            ]}
            resultCount={filtered.length}
            resultLabel="parejas"
            onClear={() => { setQuery(""); setFTournament("all"); setFCategory("all"); }}
          />
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Pareja</TableHead>
                <TableHead className="hidden sm:table-cell">Torneo</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right pr-4">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pairs === null && <AdminTableSkeleton columns={4} />}
              {pairs !== null && pairs.length === 0 && (
                <AdminTableEmpty
                  colSpan={4}
                  icon={<UsersRound className="h-5 w-5" />}
                  title="No hay participantes todavía"
                  description="Las parejas se inscriben desde el asistente de torneos o desde Equipos."
                />
              )}
              {pairs !== null && pairs.length > 0 && filtered.length === 0 && (
                <AdminTableEmpty
                  colSpan={4}
                  title="Sin coincidencias"
                  description="Ninguna pareja coincide con la búsqueda o el filtro."
                />
              )}
              {filtered.map((p) => {
                const actions: RowAction[] = [
                  {
                    label: "Mover a otro torneo",
                    icon: <FolderInput className="h-4 w-4" />,
                    onSelect: () => openMove(p),
                  },
                  {
                    label: "Eliminar",
                    icon: <Trash2 className="h-4 w-4" />,
                    onSelect: () => setDeleting(p),
                    destructive: true,
                    separator: true,
                  },
                ];
                return (
                <RowContextMenu key={p.id} actions={actions}>
                  <TableRow>
                  <TableCell className="pl-4 font-medium">{p.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {p.tournament_name ? (
                      <Badge variant="outline">{p.tournament_name}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.category_id ? (
                      <Badge variant="secondary">{p.category_name ?? catNameById.get(p.category_id) ?? "—"}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin categoría</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-2 text-right">
                    <RowActionsMenu actions={actions} label={`Acciones para ${p.name}`} />
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
        title={`¿Eliminar la pareja "${deleting?.name ?? ""}"?`}
        description="Se quita del torneo donde está inscrita. Sus perfiles de jugador no se borran."
      />

      <Dialog open={!!moving} onOpenChange={(o) => { if (!o) setMoving(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FolderInput className="h-5 w-5" /> Mover pareja</DialogTitle>
            <DialogDescription>
              Mueve "{moving?.name}" a otro torneo. Al llegar se queda sin categoría asignada hasta que la reasignes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Select value={moveTarget} onValueChange={setMoveTarget}>
              <SelectTrigger aria-label="Torneo destino">
                <SelectValue placeholder="Elige el torneo destino" />
              </SelectTrigger>
              <SelectContent>
                {tournaments
                  .filter((t) => t.id !== moving?.tournament_id)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoving(null)}>Cancelar</Button>
            <Button onClick={handleMove} disabled={!moveTarget || busy}>
              {busy ? "Moviendo…" : "Mover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
