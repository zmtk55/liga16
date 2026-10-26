"use client";

import { AdminLoadFailed } from "@/components/admin/empty-state";
import { useEffect, useMemo, useState } from "react";
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
import { toast } from "sonner";
import {
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
import { SEX_BRANCHES, sexLabel } from "@/lib/format";
import { FilterBar } from "@/components/ui/filter-bar";
import { AdminFacet, AdminFacets } from "@/components/admin/filter-facets";
import { countActive } from "@/lib/filters";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  AdminPageHeader,
  AdminStat,
  AdminStatStrip,
} from "@/components/admin/page-header";
import { AdminEmptyState } from "@/components/admin/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RowActionsMenu,
  RowContextMenu,
  type RowAction,
} from "@/components/admin/row-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminTableSkeleton, AdminTableEmpty } from "@/components/admin/table-state";
import { AdminViewToggle, useAdminView } from "@/components/admin/view-toggle";

const SEX_OPTIONS = SEX_BRANCHES;

const POSITION_OPTIONS = [
  { value: "drive", label: "Drive" },
  { value: "reves", label: "Revés" },
  { value: "both", label: "Ambos" },
];

export default function AdminPlayers() {
  const [list, setList] = useState<PlayerProfile[] | null>(null);
  /** Récord derivado (jugado/ganado) por jugador para la galería. */
  const [stats, setStats] = useState<Record<string, DirStats>>({});
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<PlayerProfile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // El buscador vive en el FilterBar de la página y escribe ?q= (estándar admin).
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
  const [playerIdsByTournament, setPlayerIdsByTournament] = useState<Record<string, string[]>>({});
  /** Ids de los jugadores inscritos en el torneo filtrado. */
  const [tournamentPlayers, setTournamentPlayers] = useState<Set<string>>(
    new Set(),
  );
  const [verification, setVerification] = useState("all");
  // Vista del directorio: cards o tabla. La elección se recuerda por sección.
  const [view, setView] = useAdminView("jugadores", ["cards", "tabla"]);

  /** Acciones de un jugador, compartidas por la vista de cards y la de tabla. */
  function actionsFor(p: PlayerProfile): RowAction[] {
    const isPending = (p.status ?? "verificado") === "pendiente";
    return [
      ...(isPending
        ? [{ label: "Verificar perfil", icon: <ShieldCheck className="h-4 w-4" />, onSelect: () => { setApproving(p); } } as RowAction]
        : []),
      { label: "Editar", icon: <Pencil className="h-4 w-4" />, onSelect: () => { setEditing(p); setOpenCreate(true); } },
      { label: "Eliminar", icon: <Trash2 className="h-4 w-4" />, onSelect: () => setDeleting(p), destructive: true, separator: true },
    ];
  }

  const statusOf = (p: PlayerProfile) => p.status ?? "verificado";
  const pendingCount = (list ?? []).filter(
    (p) => statusOf(p) === "pendiente",
  ).length;

  /**
   * Las facetas con su cuenta. La de verificación es la que el organizador
   * usa todos los días —los pendientes van primero en la tabla—, así que su
   * cuenta se ve sin abrir nada.
   */
  const verificationOptions = useMemo(() => {
    const all = list ?? [];
    const n = (s: string) => all.filter((p) => statusOf(p) === s).length;
    return [
      { key: "pendiente", label: "Por verificar", n: n("pendiente") },
      { key: "verificado", label: "Verificados", n: n("verificado") },
      { key: "rechazado", label: "Rechazados", n: n("rechazado") },
    ].filter((o) => o.n > 0);
  }, [list]);

  const tournamentOptions = useMemo(() => {
    const all = list ?? [];
    return tournaments
      .map((t) => ({ key: t.id, label: t.name, n: all.filter((p) => (playerIdsByTournament[t.id] ?? []).includes(p.id)).length }))
      .filter((o) => o.n > 0);
  }, [list, tournaments, playerIdsByTournament]);

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

  const [loadError, setLoadError] = useState<string | null>(null);
  const load = () =>
    db.listPlayers()
      .then((l) => { setList(l); setLoadError(null); loadStats(l); })
      .catch((e) => setLoadError((e as Error)?.message || "Error al cargar los jugadores"));

  useEffect(() => {
    load();
    db.listAllPairs().then(pairs => {
      const ids: Record<string, Set<string>> = {};
      for (const pair of pairs) {
        if (!pair.tournament_id) continue;
        const group = ids[pair.tournament_id] ??= new Set();
        if (pair.player1_id) group.add(pair.player1_id);
        if (pair.player2_id) group.add(pair.player2_id);
      }
      setPlayerIdsByTournament(Object.fromEntries(Object.entries(ids).map(([id, members]) => [id, [...members]])));
    }).catch(() => toast.error("No se pudieron cargar los filtros de torneo"));
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
      if (!form.display_name?.trim()) {
        toast.error("El nombre visible es obligatorio");
        setSubmitting(false);
        return;
      }
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

  if (loadError && list === null) {
    return (
      <AdminLoadFailed
        title="Jugadores"
        description="Directorio de jugadores, nivel y rama de juego."
        what="los jugadores"
        message={loadError}
        onRetry={() => { load(); }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Jugadores"
        description="Directorio de jugadores, nivel y rama de juego."
        action={
          <>
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
        <AdminStatStrip loading={list === null}>
          <AdminStat value={list?.length ?? 0} label="Jugadores" />
          <AdminStat
            value={pendingCount}
            label="Por verificar"
            tone={
              pendingCount > 0
                ? "text-warning-strong"
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
      <Card className="rounded-3xl border-0 bg-transparent shadow-none">
        <CardHeader className="gap-3 px-0">
          <FilterBar
            search={query}
            onSearch={setQuery}
            searchPlaceholder="Buscar jugador…"
            resultCount={filtered.length}
            resultLabel="jugadores"
            activeCount={countActive(tid, verification)}
            onClear={() => {
              setQuery("");
              setTid("all");
              setVerification("all");
            }}
          >
            <AdminFacets>
              <AdminFacet
                label="Verificación"
                value={verification}
                onChange={setVerification}
                options={verificationOptions}
                allLabel="Cualquiera"
              />
              <AdminFacet
                label="Torneo"
                value={tid}
                onChange={setTid}
                options={tournamentOptions}
                allLabel="Todo el directorio"
              />
            </AdminFacets>
          </FilterBar>
          <div className="flex justify-end">
            <AdminViewToggle value={view} onChange={setView} views={["cards", "tabla"]} />
          </div>
        </CardHeader>
        {view === "tabla" ? (
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">Jugador</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Rama</TableHead>
                <TableHead className="text-end">Nivel</TableHead>
                <TableHead>Récord</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="pe-4 text-end"><span className="sr-only">Acciones</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list === null && <AdminTableSkeleton columns={7} rows={6} />}
              {list !== null && filtered.length === 0 && (
                <AdminTableEmpty
                  colSpan={7}
                  icon={<Users className="h-5 w-5" />}
                  title={list.length ? "Sin coincidencias" : "No hay jugadores todavía"}
                  description="Agrega un jugador o ajusta los filtros para ver el directorio."
                />
              )}
              {filtered.map((p) => {
                const status = (p.status ?? "verificado") as PlayerStatus;
                const isPending = status === "pendiente";
                return (
                  <TableRow key={p.id}>
                    <TableCell className="ps-4">
                      <span className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-950 text-xs font-bold text-primary">
                          {p.photo_url ? <img src={p.photo_url} alt="" className="h-full w-full object-cover" /> : p.display_name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                        </span>
                        <span className="font-medium">{p.display_name}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.city || "–"}</TableCell>
                    <TableCell className="text-muted-foreground">{sexLabel(p.sex)}</TableCell>
                    <TableCell className="text-end tabular-nums">{p.declared_level.toFixed(1)}</TableCell>
                    <TableCell className="text-muted-foreground">{stats[p.id] ? `${stats[p.id].played} partidos · ${stats[p.id].won} ganados` : "–"}</TableCell>
                    <TableCell><Badge variant="outline" className="rounded-full">{isPending ? "Por verificar" : status === "rechazado" ? "Rechazado" : "Verificado"}</Badge></TableCell>
                    <TableCell className="pe-4 text-end"><RowActionsMenu actions={actionsFor(p)} label={`Acciones para ${p.display_name}`} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
        ) : (
        <CardContent className="grid gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {list === null && Array.from({length: 6}, (_, i) => <Skeleton key={i} className="h-64 rounded-3xl" />)}
          {list !== null && filtered.length === 0 && <AdminEmptyState className="col-span-full rounded-3xl bg-card" icon={<Users className="h-6 w-6" />} title={list.length ? "Sin coincidencias" : "No hay jugadores todavía"} description="Agrega un jugador o ajusta los filtros para ver el directorio." />}
              {filtered.map((p) => {
                const status = (p.status ?? "verificado") as PlayerStatus;
                const isPending = status === "pendiente";
                const actions = actionsFor(p);
                return (
                  <RowContextMenu key={p.id} actions={actions}>
                    <article className="group overflow-hidden rounded-3xl border bg-card transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
                      <div className="relative flex h-32 items-center justify-center bg-zinc-950">
                        {p.photo_url ? <img src={p.photo_url} alt="" className="h-20 w-20 rounded-full object-cover ring-4 ring-white/10" /> : <span className="font-display text-5xl font-bold text-primary">{p.display_name.split(" ").map(n => n[0]).slice(0,2).join("")}</span>}
                        <div className="absolute right-3 top-3 rounded-full bg-card"><RowActionsMenu actions={actions} label={`Acciones para ${p.display_name}`} /></div>
                      </div>
                      <div className="space-y-4 p-5">
                        <Badge variant="outline" className="rounded-full">{isPending ? "Por verificar" : status === "rechazado" ? "Rechazado" : "Verificado"}</Badge>
                        <h2 className="font-display text-2xl font-semibold">{p.display_name}</h2>
                        <p className="text-sm text-muted-foreground">{[p.city, sexLabel(p.sex)].filter(Boolean).join(" · ")}</p><p className="text-xs text-muted-foreground">{stats[p.id] ? `${stats[p.id].played} partidos · ${stats[p.id].won} ganados` : "Récord no disponible"}</p>
                        <div className="flex items-end justify-between border-t pt-4"><div><p className="text-xs text-muted-foreground">Nivel declarado</p><p className="font-display text-3xl font-bold tabular-nums">{p.declared_level.toFixed(1)}</p></div><Button size="sm" variant="outline" className="rounded-full" onClick={() => {setEditing(p); setOpenCreate(true);}}>Editar</Button></div>
                      </div>
                    </article>
                  </RowContextMenu>
                );
              })}
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
