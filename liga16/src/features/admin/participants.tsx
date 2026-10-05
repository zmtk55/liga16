// Admin → Participantes: todas las parejas de TODOS los torneos en una sola vista.
// Filtra por torneo/categoría, y permite borrar o mover una pareja a otro torneo.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
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
import { toast } from "sonner";
import { FilterBar } from "@/components/ui/filter-bar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CardShell, CardIdentity, CardStat, CardFooterStrip, PairAvatars } from "@/components/cards/card-kit";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPageHeader, AdminStat, AdminStatStrip } from "@/components/admin/page-header";
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
  // El buscador vive en el shell (SectionControl, ADR-0009) y escribe ?q=.
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const setQuery = (v: string) => {
    const next = new URLSearchParams(params);
    if (!v) next.delete("q");
    else next.set("q", v);
    setParams(next, { replace: true });
  };
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

  /**
   * Cifras de cabecera. Se cuenta por torneo —cada torneo es su propio
   * circuito— y no un total que mezcle todos los torneos en un solo número.
   */
  const resumen = useMemo(() => {
    const all = pairs ?? [];
    const conTorneo = all.filter((p) => Boolean(p.tournament_id));
    return {
      parejas: all.length,
      torneos: new Set(conTorneo.map((p) => p.tournament_id)).size,
      sinTorneo: all.length - conTorneo.length,
      sinCategoria: all.filter((p) => !p.category_id).length,
    };
  }, [pairs]);

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
      >
        <AdminStatStrip>
          <AdminStat value={resumen.parejas} label="Parejas" />
          <AdminStat value={resumen.torneos} label="Torneos" />
          <AdminStat
            value={resumen.sinTorneo}
            label="Sin torneo"
            tone={resumen.sinTorneo > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
          />
          <AdminStat
            value={resumen.sinCategoria}
            label="Sin categoría"
            tone={resumen.sinCategoria > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
          />
        </AdminStatStrip>
      </AdminPageHeader>

      <Card>
        <CardHeader className="gap-3">
          <FilterBar
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
          {/* Cards y no tabla: es el mismo CardKit del sitio público y el
              mismo patrón que Equipos. Una tabla de "pareja / torneo /
              categoría" no decía nada de un vistazo. */}
          {pairs === null && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          )}

          {pairs !== null && pairs.length === 0 && (
            <Empty className="border-0 py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon"><UsersRound className="h-5 w-5" /></EmptyMedia>
                <EmptyTitle className="text-base">No hay participantes todavía</EmptyTitle>
                <EmptyDescription>
                  Las parejas se inscriben desde el asistente de torneos o desde Equipos.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {pairs !== null && pairs.length > 0 && filtered.length === 0 && (
            <Empty className="border-0 py-10">
              <EmptyHeader>
                <EmptyTitle className="text-base">Sin coincidencias</EmptyTitle>
                <EmptyDescription>
                  Ninguna pareja coincide con la búsqueda o el filtro.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {filtered.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((p) => {
                const [p1, p2] = p.name.split(" / ");
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
                    <CardShell accent>
                      <CardContent className="p-4">
                        <CardIdentity
                          lead={<PairAvatars names={[p1, p2]} size="sm" />}
                          titleLines={[p1, p2].filter(Boolean)}
                          meta={p.category_id
                            ? (p.category_name ?? catNameById.get(p.category_id) ?? "Sin categoría")
                            : "Sin categoría"}
                          end={
                            <RowActionsMenu actions={actions} label={`Acciones para ${p.name}`} />
                          }
                        />
                      </CardContent>
                      <CardFooterStrip
                        stats={
                          <>
                            <CardStat
                              value={p.tournament_name ? "Sí" : "No"}
                              label="En torneo"
                              tone={p.tournament_name ? "text-success" : undefined}
                            />
                          </>
                        }
                        chip={p.tournament_name
                          ? <Badge variant="outline">{p.tournament_name}</Badge>
                          : <Badge variant="secondary">Sin torneo</Badge>}
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
