"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { db } from "@/lib/data";
import type { PlayerProfile } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  LayoutGrid,
  List,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PlayerStatus } from "@/types";
import {
  buildDirectoryStats,
  type DirStats,
} from "@/lib/data/record-stats";
import { PlayerCardV5 } from "@/features/nav-test/player-card-v5";
import { sexLabel } from "@/lib/format";
import { FilterBar } from "@/components/ui/filter-bar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  AdminPageHeader,
  AdminStat,
  AdminStatStrip,
} from "@/components/admin/page-header";
import {
  AdminTableEmpty,
  AdminTableSkeleton,
} from "@/components/admin/table-state";
import {
  RowActionsMenu,
  RowContextMenu,
  type RowAction,
} from "@/components/admin/row-actions";

const SEX_OPTIONS = [
  { value: "M", label: "Varonil" },
  { value: "F", label: "Femenil" },
  { value: "X", label: "Mixto" },
];

const POSITION_OPTIONS = [
  { value: "drive", label: "Drive" },
  { value: "reves", label: "Revés" },
  { value: "both", label: "Ambos" },
];

export default function AdminPlayers() {
  const [list, setList] = useState<PlayerProfile[] | null>(null);
  const [view, setView] = useState<"lista" | "galeria">("lista");
  /** Récord derivado (jugado/ganado) por jugador para la galería. */
  const [stats, setStats] = useState<Record<string, DirStats>>({});
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<PlayerProfile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // El buscador vive en el shell (SectionControl, ADR-0009) y escribe ?q=.
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const setQuery = (v: string) => {
    const next = new URLSearchParams(params);
    if (!v) next.delete("q");
    else next.set("q", v);
    setParams(next, { replace: true });
  };
  // Filtro por torneo: los jugadores que juegan en él (via equipos inscritos)
  const [tournaments, setTournaments] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [tid, setTid] = useState("all");
  /** Ids de los jugadores inscritos en el torneo filtrado. */
  const [tournamentPlayers, setTournamentPlayers] = useState<Set<string>>(
    new Set(),
  );
  const [verification, setVerification] = useState("all");

  const statusOf = (p: PlayerProfile) => p.status ?? "verificado";
  const pendingCount = (list ?? []).filter(
    (p) => statusOf(p) === "pendiente",
  ).length;

  const filtered = (list ?? [])
    .filter((p) => {
      const q = query.trim().toLowerCase();
      if (
        q &&
        !p.display_name.toLowerCase().includes(q) &&
        !p.username.toLowerCase().includes(q)
      )
        return false;
      if (tid !== "all" && !tournamentPlayers.has(p.id)) return false;
      if (verification !== "all" && statusOf(p) !== verification) return false;
      return true;
    })
    // Los pendientes primero: si alguien espera verificación, es lo primero
    // que el organizador tiene que ver, no la fila 7 de la tabla.
    .sort((a, b) => {
      const rank = (p: PlayerProfile) => (statusOf(p) === "pendiente" ? 0 : 1);
      return rank(a) - rank(b) || a.display_name.localeCompare(b.display_name);
    });

  /** Récord derivado de partidos (player_cards nunca se actualiza). */
  const loadStats = (players: PlayerProfile[]) => {
    buildDirectoryStats(players)
      .then(setStats)
      .catch(() => undefined);
  };

  const load = () =>
    db.listPlayers().then((l) => {
      setList(l);
      loadStats(l);
    });

  useEffect(() => {
    load();
    db.listTournaments()
      .then((ts) => setTournaments(ts.map((t) => ({ id: t.id, name: t.name }))))
      .catch(() => setTournaments([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tid === "all") {
      setTournamentPlayers(new Set());
      return;
    }
    // Jugadores del torneo = los ids de los equipos inscritos. Se usa el id y
    // no el nombre: dos jugadores homónimos, o una pareja renombrada, romperían
    // el filtro sin avisar.
    db.getTournamentPairs(tid)
      .then((ps) => {
        const ids = new Set<string>();
        ps.forEach((p) => {
          if (p.player1_id) ids.add(p.player1_id);
          if (p.player2_id) ids.add(p.player2_id);
        });
        setTournamentPlayers(ids);
      })
      .catch(() => setTournamentPlayers(new Set()));
  }, [tid]);

  async function handleSave(form: PlayerFormData) {
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 400));
      if (editing) {
        await db.updatePlayer(
          editing.id,
          form as unknown as Partial<PlayerProfile>,
        );
        toast.success(`Jugador "${form.display_name}" actualizado`);
      } else {
        await db.createPlayer(
          form as unknown as Omit<PlayerProfile, "id" | "user_id">,
        );
        toast.success(`Jugador "${form.display_name}" creado`);
      }
      setOpenCreate(false);
      setEditing(null);
      load();
    } catch (e) {
      toast.error((e as Error).message ?? "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(p: PlayerProfile) {
    try {
      await db.deletePlayer(p.id);
      toast.success(`Jugador "${p.display_name}" eliminado`);
      load();
    } catch (e) {
      toast.error((e as Error).message ?? "Error al eliminar");
    }
  }

  const dialogKey = editing?.id ?? "new";
  const [deleting, setDeleting] = useState<PlayerProfile | null>(null);
  const [approving, setApproving] = useState<PlayerProfile | null>(null);

  async function handleApprove(p: PlayerProfile) {
    try {
      await db.setPlayerStatus(p.id, "verificado");
      toast.success(
        `${p.display_name} verificado — ya puede inscribirse a torneos`,
      );
      load();
    } catch (e) {
      toast.error((e as Error).message ?? "Error al verificar");
    } finally {
      setApproving(null);
    }
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Jugadores"
        description="Directorio de jugadores, nivel y rama de juego."
        action={
          <>
            {pendingCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setVerification((v) =>
                    v === "pendiente" ? "all" : "pendiente",
                  )
                }
              >
                <ShieldCheck className="h-4 w-4" />
                {pendingCount} por verificar
              </Button>
            )}
            {/* Siempre visible: verificar pendientes no puede quitarte la
                acción de crear un jugador. */}
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setOpenCreate(true);
              }}
            >
              <Plus className="h-4 w-4" /> Nuevo jugador
            </Button>
          </>
        }
      >
        <AdminStatStrip>
          <AdminStat value={list?.length ?? 0} label="Jugadores" />
          <AdminStat
            value={pendingCount}
            label="Por verificar"
            tone={
              pendingCount > 0
                ? "text-amber-600 dark:text-amber-400"
                : undefined
            }
          />
          <AdminStat
            value={
              (list ?? []).filter(
                (p) => (p.status ?? "verificado") === "verificado",
              ).length
            }
            label="Verificados"
            tone="text-success"
          />
          <AdminStat value={tournaments.length} label="Torneos" />
        </AdminStatStrip>
      </AdminPageHeader>
      <Card>
        <CardHeader className="gap-3">
          <div className="flex justify-end">
            <div className="inline-flex rounded-lg border p-0.5">
              <Button
                size="sm"
                variant={view === "lista" ? "secondary" : "ghost"}
                aria-label="Ver como lista"
                aria-pressed={view === "lista"}
                className="h-7 gap-1.5 px-2.5"
                onClick={() => setView("lista")}
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">Lista</span>
              </Button>
              <Button
                size="sm"
                variant={view === "galeria" ? "secondary" : "ghost"}
                aria-label="Ver como galería"
                aria-pressed={view === "galeria"}
                className="h-7 gap-1.5 px-2.5"
                onClick={() => setView("galeria")}
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Galería</span>
              </Button>
            </div>
          </div>
          <FilterBar
            selects={[
              {
                key: "tid",
                ariaLabel: "Filtrar por torneo",
                allLabel: "Todo el directorio",
                value: tid,
                onChange: setTid,
                options: tournaments.map((t) => ({
                  value: t.id,
                  label: `Juega en: ${t.name}`,
                })),
                className: "sm:w-60",
              },
              {
                key: "verification",
                ariaLabel: "Filtrar por verificación",
                allLabel: "Cualquier verificación",
                value: verification,
                onChange: setVerification,
                options: [
                  {
                    value: "pendiente",
                    label: `Por verificar (${pendingCount})`,
                  },
                  { value: "verificado", label: "Verificados" },
                  { value: "rechazado", label: "Rechazados" },
                ],
                className: "sm:w-48",
              },
            ]}
            resultCount={filtered.length}
            resultLabel="jugadores"
            onClear={() => {
              setQuery("");
              setTid("all");
              setVerification("all");
            }}
          />
        </CardHeader>
        {view === "lista" ? (
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Nivel</TableHead>
                <TableHead className="hidden md:table-cell">Sexo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list === null && <AdminTableSkeleton columns={4} />}
              {list !== null && list.length === 0 && (
                <AdminTableEmpty
                  colSpan={6}
                  icon={<Users className="h-5 w-5" />}
                  title="No hay jugadores todavía"
                  description="Agrega al primer jugador para empezar el directorio."
                  action={
                    <Button
                      size="sm"
                      className="mt-4"
                      onClick={() => {
                        setEditing(null);
                        setOpenCreate(true);
                      }}
                    >
                      Agregar jugador
                    </Button>
                  }
                />
              )}
              {list !== null && list.length > 0 && filtered.length === 0 && (
                <AdminTableEmpty
                  colSpan={6}
                  title="Sin coincidencias"
                  description="Ningún jugador coincide con la búsqueda o el filtro."
                />
              )}
              {filtered.map((p) => {
                const status = (p.status ?? "verificado") as PlayerStatus;
                const isPending = status === "pendiente";
                const actions: RowAction[] = [
                  ...(isPending
                    ? [
                        {
                          label: "Verificar perfil",
                          icon: <ShieldCheck className="h-4 w-4" />,
                          onSelect: () => {
                            setApproving(p);
                          },
                        } as RowAction,
                      ]
                    : []),
                  {
                    label: "Editar",
                    icon: <Pencil className="h-4 w-4" />,
                    onSelect: () => {
                      setEditing(p);
                      setOpenCreate(true);
                    },
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
                    <TableRow
                      className={
                        isPending
                          ? "bg-amber-50/50 dark:bg-amber-950/20"
                          : undefined
                      }
                    >
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          {p.display_name}
                          {isPending && (
                            <Badge
                              variant="outline"
                              className="border-amber-300 bg-amber-100 text-xs uppercase tracking-wide text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            >
                              Por verificar
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {p.declared_level.toFixed(1)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {sexLabel(p.sex)}
                      </TableCell>
                      <TableCell className="pr-2 text-right">
                        <RowActionsMenu
                          actions={actions}
                          label={`Acciones para ${p.display_name}`}
                        />
                      </TableCell>
                    </TableRow>
                  </RowContextMenu>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
        ) : (
          <CardContent className="p-4">
            {list === null && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Cargando jugadores…
              </p>
            )}
            {list !== null && filtered.length === 0 && (
              <div className="flex flex-col items-center py-8 text-center">
                <Users className="h-5 w-5 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">
                  {list.length === 0
                    ? "No hay jugadores todavía"
                    : "Sin coincidencias"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {list.length === 0
                    ? "Agrega al primer jugador para empezar el directorio."
                    : "Ningún jugador coincide con la búsqueda o el filtro."}
                </p>
              </div>
            )}
            {filtered.length > 0 && (
              <div className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((p) => {
                  const c = stats[p.id];
                  return (
                    <PlayerCardV5
                      key={p.id}
                      player={p}
                      played={c?.played}
                      won={c?.won}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <ConfirmDialog
        open={!!approving}
        onOpenChange={(o) => {
          if (!o) setApproving(null);
        }}
        onConfirm={() => approving && handleApprove(approving)}
        title={`¿Verificar el perfil de ${approving?.display_name ?? "este jugador"}?`}
        description="Al verificarlo, el jugador podrá inscribirse a los torneos del circuito. Revisa antes que sus datos correspondan a una persona real."
        confirmLabel="Verificar"
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
        onConfirm={() => deleting && handleDelete(deleting)}
        title={`¿Eliminar a ${deleting?.display_name ?? "este jugador"}?`}
        description="Se perderá su perfil y sus datos quedaron fuera de los rankings. Esta acción no se puede deshacer."
        destructive
      />

      <PlayerFormDialog
        key={dialogKey}
        open={openCreate}
        onOpenChange={(o) => {
          if (!o) {
            setOpenCreate(false);
            setEditing(null);
          }
        }}
        onSave={handleSave}
        onCancel={() => setEditing(null)}
        editing={editing}
        submitting={submitting}
      />
    </div>
  );
}

interface PlayerFormData {
  display_name: string;
  username: string;
  sex: string;
  declared_level: string;
  dominant_hand: string;
  preferred_position: string;
  city: string;
  state: string;
  bio: string;
}

function PlayerFormDialog({
  open,
  onOpenChange,
  onSave,
  onCancel,
  editing,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: PlayerFormData) => void;
  onCancel: () => void;
  editing: PlayerProfile | null;
  submitting: boolean;
}) {
  const [form, setForm] = useState<PlayerFormData>(() => {
    if (editing) {
      return {
        display_name: editing.display_name,
        username: editing.username,
        sex: editing.sex,
        declared_level: String(editing.declared_level),
        dominant_hand: editing.dominant_hand,
        preferred_position: editing.preferred_position,
        city: editing.city,
        state: editing.state ?? "CDMX",
        bio: editing.bio ?? "",
      };
    }
    return {
      display_name: "",
      username: "",
      sex: "X",
      declared_level: "3.0",
      dominant_hand: "right",
      preferred_position: "both",
      city: "Ciudad de México",
      state: "CDMX",
      bio: "",
    };
  });

  const update = (field: keyof PlayerFormData, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar jugador" : "Nuevo jugador"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? `Edita "${editing.display_name}"`
              : "Registra un nuevo jugador al directorio."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              value={form.display_name}
              onChange={(e) => update("display_name", e.target.value)}
              placeholder="Nombre completo"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="usuario">Usuario</Label>
              <Input
                id="usuario"
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
                placeholder="juanperez"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="nivel">Nivel</Label>
              <Input
                id="nivel"
                type="number"
                step="0.1"
                min="1"
                max="7"
                value={form.declared_level}
                onChange={(e) => update("declared_level", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Nivel del 1.0 al 7.0 (se recomienda actualizar a oficial
                después)
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sexo">Sexo</Label>
              <Select value={form.sex} onValueChange={(v) => update("sex", v)}>
                <SelectTrigger id="sexo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEX_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="posicion-preferida">Posición preferida</Label>
              <Select
                value={form.preferred_position}
                onValueChange={(v) => update("preferred_position", v)}
              >
                <SelectTrigger id="posicion-preferida">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POSITION_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ciudad">Ciudad</Label>
              <Input
                id="ciudad"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="estado">Estado</Label>
              <Input
                id="estado"
                value={form.state}
                onChange={(e) => update("state", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="biografia">Biografía</Label>
            <Input
              id="biografia"
              value={form.bio}
              onChange={(e) => update("bio", e.target.value)}
              placeholder="Breve descripción"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onCancel();
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => onSave(form)}
            disabled={
              submitting || !form.display_name.trim() || !form.username.trim()
            }
          >
            {submitting ? "Guardando…" : editing ? "Actualizar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
