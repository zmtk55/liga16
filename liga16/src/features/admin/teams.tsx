// Admin → Equipos: los equipos son POR TORNEO (tabla `pairs` con tournament_id).
// Un jugador pertenece al directorio global (player_profiles) pero su equipo
// solo existe dentro del torneo elegido. Otro torneo = otros equipos.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { db } from "@/lib/data";
import type { PlayerProfile, Tournament, TournamentCategory } from "@/types";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { AlertTriangle, Pencil, Plus, Trash2, Trophy, Users } from "lucide-react";
import { checkLevelSum } from "@/lib/qualification";
import { ramaLabel } from "@/lib/categories";
import PlayerSlot from "@/components/players/player-slot";
import { ensurePlayer } from "@/lib/players";
import { FilterBar } from "@/components/ui/filter-bar";
import { AdminFilterNav } from "@/components/admin/filter-nav";
import { countActive } from "@/lib/filters";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminPageHeader, AdminStat, AdminStatStrip } from "@/components/admin/page-header";
import ImageUpload from "@/components/ui/image-upload";
import { deleteStoredImage } from "@/lib/storage";
import { PairAvatar, CardShell, CardIdentity } from "@/components/cards/card-kit";
import { cn } from "@/lib/utils";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { SIN_CATEGORIA } from "@/lib/format";

interface EquipoForm {
  name: string;
  category_id: string;
  player1_name: string;
  player2_name: string;
  crest_url: string | null;
}

function autoName(f: { player1_name: string; player2_name: string }): string {
  return [f.player1_name.trim(), f.player2_name.trim()].filter(Boolean).join(" / ");
}

export default function AdminTeams() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tid, setTid] = useState<string>("");
  const [categories, setCategories] = useState<TournamentCategory[]>([]);
  const [pairs, setPairs] = useState<Array<{ id: string; name: string; category_id: string | null; crest_url: string | null }> | null>(null);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string; category_id: string | null; crest_url: string | null } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const setQuery = (v: string) => {
    const next = new URLSearchParams(params);
    if (!v) next.delete("q");
    else next.set("q", v);
    setParams(next, { replace: true });
  };
  const [cat, setCat] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  const openSheetWith = (id: string) => {
    setSelectedId(id);
    setShowSheet(true);
  };

  const selectedPair = pairs?.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    db.listTournaments().then((ts) => {
      setTournaments(ts);
      const active =
        ts.find((t) => t.status === "registration_open") ??
        ts.find((t) => t.status === "in_progress") ??
        ts[0];
      if (active) setTid(active.id);
    }).catch(() => setTournaments([]));
    db.listPlayers().then((p) => setPlayers(p)).catch(() => setPlayers([]));
  }, []);

  useEffect(() => {
    if (!tid) return;
    setPairs(null);
    db.getTournamentCategories(tid).then(setCategories).catch(() => setCategories([]));
    db.getTournamentPairs(tid)
      .then((ps) => setPairs(ps as unknown as Array<{ id: string; name: string; category_id: string | null; crest_url: string | null }>}))
      .catch(() => setPairs([]));
  }, [tid]);

  const load = () => {
    db.getTournamentPairs(tid)
      .then((ps) => setPairs(ps as unknown as Array<{ id: string; name: string; category_id: string | null; crest_url: string | null }>}))
      .catch(() => setPairs([]));
  };

  const catNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const categoryOf = (id: string | null): string =>
    (id ? catNameById.get(id) : undefined) ?? SIN_CATEGORIA;

  const filtered = (pairs ?? []).filter((p) => {
    const q = query.trim().toLowerCase();
    if (q && !p.name.toLowerCase().includes(q)) return false;
    if (cat !== "all" && (p.category_id ?? "") !== cat) return false;
    return true;
  });

  const catOptions = useMemo(() => {
    const all = pairs ?? [];
    return categories
      .map((c) => ({ key: c.id, label: c.name, n: all.filter((p) => p.category_id === c.id).length }))
      .filter((o) => o.n > 0);
  }, [categories, pairs]);

  const resumen = useMemo(() => {
    const all = pairs ?? [];
    const porCategoria = new Map<string, number>();
    for (const p of all) {
      const k = p.category_id ?? "";
      porCategoria.set(k, (porCategoria.get(k) ?? 0) + 1);
    }
    return {
      parejas: all.length,
      categorias: categories.length,
      conEscudo: all.filter((p) => p.crest_url).length,
      completas: [...porCategoria.values()].filter((n) => n >= 2).length,
    };
  }, [pairs, categories]);

  async function handleSave(form: EquipoForm) {
    const p1 = form.player1_name.trim();
    const p2 = form.player2_name.trim();
    if (p1.toLowerCase() === p2.toLowerCase()) {
      toast.error("El mismo jugador no puede estar 2 veces en el equipo");
      return;
    }
    const pairCat = categories.find((c) => c.id === (form.category_id || categories[0]?.id));
    if (pairCat && pairCat.sex !== "X") {
      const roster = [
        { name: p1, profile: players.find((pl) => pl.display_name.trim().toLowerCase() === p1.toLowerCase()) },
        { name: p2, profile: players.find((pl) => pl.display_name.trim().toLowerCase() === p2.toLowerCase()) },
      ];
      for (const r of roster) {
        if (r.profile && r.profile.sex !== "X" && r.profile.sex !== pairCat.sex) {
          toast.error(`"${r.name}" juega en rama ${ramaLabel(r.profile.sex)} y esta categoría es ${ramaLabel(pairCat.sex)}`);
          return;
        }
      }
    }
    const others = (pairs ?? []).filter((p) => p.id !== editing?.id);
    for (const p of others) {
      const roster = p.name.split("/").map((s) => s.trim().toLowerCase());
      const clash = [p1, p2].find((n) => roster.includes(n.toLowerCase()));
      if (clash) {
        toast.error(`"${clash}" ya juega en el equipo "${p.name}" de este torneo`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const [prof1, prof2] = await Promise.all([
        ensurePlayer(p1).catch(() => null),
        ensurePlayer(p2).catch(() => null),
      ]);
      const name = form.name.trim() || autoName(form);
      const originalCrest = editing?.crest_url ?? null;
      if (editing) {
        const oldName = editing.name;
        await db.updatePair(editing.id, { name, category_id: form.category_id || null, crest_url: form.crest_url });
        if (oldName !== name) {
          const matches = await db.listMatchesByTournament(tid).catch(() => []);
          for (const m of matches) {
            const side_a = m.side_a?.pair_id === editing.id || m.side_a?.pair_name === oldName
              ? { ...m.side_a, pair_name: name }
              : m.side_a;
            const side_b = m.side_b?.pair_id === editing.id || m.side_b?.pair_name === oldName
              ? { ...m.side_b, pair_name: name }
              : m.side_b;
            if (side_a !== m.side_a || side_b !== m.side_b) {
              try { await db.updateMatch(m.id, { side_a, side_b }); } catch { /* non-fatal */ }
            }
          }
        }
        if (originalCrest && form.crest_url !== originalCrest) {
          void deleteStoredImage(originalCrest, "team-crests");
        }
        toast.success(`Equipo "${name}" actualizado`);
      } else {
        await db.createPair({ tournament_id: tid, category_id: form.category_id || null, name, player1_id: prof1?.id ?? null, player2_id: prof2?.id ?? null, crest_url: form.crest_url });
        toast.success(`Equipo "${name}" inscrito en el torneo`);
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

  function handleDelete(p: { id: string; name: string }) {
    db.deletePair(p.id).then(() => {
      toast.success(`Equipo "${p.name}" eliminado`);
      load();
    }).catch((e) => {
      toast.error((e as Error).message ?? "Error al eliminar");
    });
  }

  const dialogKey = editing?.id ?? "new";

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Equipos"
        description="Las parejas inscritas viven dentro de cada torneo."
        action={
          <Button size="sm" disabled={!tid} onClick={() => { setEditing(null); setOpenCreate(true); }}>
            <Plus className="h-4 w-4" /> Inscribir pareja
          </Button>
        }
      >
        <AdminStatStrip>
          <AdminStat value={resumen.parejas} label="Parejas" />
          <AdminStat value={resumen.categorias} label="Categorías" />
          <AdminStat value={resumen.completas} label="Con rival" tone={resumen.completas > 0 ? "text-success" : undefined} />
          <AdminStat value={resumen.conEscudo} label="Con escudo" />
        </AdminStatStrip>
      </AdminPageHeader>

      {selectedId && selectedPair ? (
        <div className="flex gap-4 lg:grid lg:grid-cols-[260px_1fr]">
          <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
            <Card>
              <CardHeader className="gap-2">
                <h2 className="text-sm font-semibold">Seleccionado</h2>
              </CardHeader>
              <CardContent className="p-0">
                <button
                  type="button"
                  onClick={() => { setSelectedId(null); setShowSheet(false); }}
                  className="w-full text-left px-4 py-3 border-b hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <PairAvatar p1={selectedPair.name.split(" / ")[0]} p2={selectedPair.name.split(" / ")[1]} className="h-8 w-8" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{selectedPair.name}</p>
                      <p className="text-xs text-muted-foreground">{categoryOf(selectedPair.category_id)}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">Cerrar</span>
                  </div>
                </button>
              </CardContent>
            </Card>
          </div>
          <div className="min-w-0">
            <Sheet open={showSheet} onOpenChange={(o) => { if (!o) { setShowSheet(false); setSelectedId(null); } }}>
              <SheetContent side="right" className="w-full max-w-xl">
                <SheetHeader className="border-b pb-4 mb-4">
                  <SheetTitle className="flex items-center gap-2">
                    <Trophy className="h-6 w-6" />
                    {selectedPair.name}
                  </SheetTitle>
                </SheetHeader>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-4">
                    {selectedPair.crest_url ? (
                      <img src={selectedPair.crest_url} alt="" className="h-16 w-16 rounded-full object-cover" />
                    ) : (
                      <PairAvatar p1={selectedPair.name.split(" / ")[0]} p2={selectedPair.name.split(" / ")[1]} className="h-16 w-16 text-xl" />
                    )}
                    <div>
                      <h3 className="text-base font-semibold">{selectedPair.name}</h3>
                      <p className="text-xs text-muted-foreground">{categoryOf(selectedPair.category_id)}</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div><dt className="text-xs text-muted-foreground">Categoría</dt><dd>{categoryOf(selectedPair.category_id)}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Escudo</dt><dd>{selectedPair.crest_url ? "Sí" : "No"}</dd></div>
                  </dl>
                  <div className="flex gap-2 border-t pt-3">
                    <Button size="sm" variant="outline" onClick={() => { setEditing(selectedPair); setOpenCreate(true); setShowSheet(false); }}>
                      <Pencil className="h-4 w-4" /> Editar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => { setDeleting(selectedPair); setShowSheet(false); setSelectedId(null); }}>
                      <Trash2 className="h-4 w-4" /> Eliminar
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      ) : (
        tid ? (
          <Card>
            <CardHeader className="gap-2">
              <h2 className="text-sm font-semibold">Equipos</h2>
              <p className="text-xs text-muted-foreground">{filtered.length} de {pairs?.length ?? 0}</p>
            </CardHeader>
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <div className="px-4 py-4 text-sm text-muted-foreground">
                  {pairs === null ? "Cargando…" : "Sin coincidencias"}
                </div>
              ) : (
                <ul className="space-y-2 p-2">
                  {filtered.map((p) => {
                    const [p1, p2] = p.name.split(" / ");
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => openSheetWith(p.id)}
                          className="w-full text-left px-3 py-2 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <PairAvatar p1={p1} p2={p2} className="h-8 w-8" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{p.name}</p>
                              <p className="text-xs text-muted-foreground">{categoryOf(p.category_id)}</p>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Empty>
                <EmptyHeader>
                  <EmptyTitle className="text-base">Elige un torneo</EmptyTitle>
                  <EmptyDescription>Cada torneo tiene sus propios equipos.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        )
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        onConfirm={() => deleting && handleDelete(deleting)}
        title={`¿Eliminar el equipo "${deleting?.name ?? ""}"?`}
        description="Se quita de este torneo. Sus perfiles de jugador no se borran."
        destructive
      />

      <Dialog>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar equipo" : "Inscribir equipo"}</DialogTitle>
            <DialogDescription>Un equipo es una pareja de 2 jugadores. Busca a los registrados o escribe nombres nuevos.</DialogDescription>
          </DialogHeader>
          <EquipoFormForm
            editing={editing}
            players={players}
            categories={categories}
            onSubmit={handleSave}
            onCancel={() => { setOpenCreate(false); setEditing(null); setDeleting(null); }}
            submitting={submitting}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EquipoFormForm({ editing, players, categories, onSubmit, onCancel, submitting }: {
  editing: typeof editing;
  players: PlayerProfile[];
  categories: TournamentCategory[];
  onSubmit: (form: EquipoForm) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState<EquipoForm>(() => ({
    name: "",
    category_id: categories[0]?.id ?? "",
    player1_name: "",
    player2_name: "",
    crest_url: null,
  }));
  const [manualName, setManualName] = useState(!editing);
  const [crest, setCrest] = useState<string | null>(editing?.crest_url ?? null);

  useEffect(() => {
    if (editing) {
      const [p1, p2] = editing.name.split(" / ");
      setForm({
        name: editing.name,
        category_id: editing.category_id ?? "",
        player1_name: p1 ?? "",
        player2_name: p2 ?? "",
        crest_url: editing.crest_url ?? null,
      });
      setManualName(!!editing.name);
      setCrest(editing.crest_url);
    }
  }, [editing]);

  if (crest !== form.crest_url) setForm((f) => ({ ...f, crest_url: crest }));

  function setPlayers(slot: 1 | 2, name: string) {
    setForm((f) => ({
      ...f,
      [slot === 1 ? "player1_name" : "player2_name"]: name,
      name: manualName ? f.name : autoName({ ...f, player1_name: slot === 1 ? name : f.player1_name, player2_name: slot === 2 ? name : f.player2_name }),
    }));
  }

  const valid = form.player1_name.trim() && form.player2_name.trim();
  const checkMessage = checkLevelSum(form.category_id, [
    players.find((p) => p.display_name === form.player1_name)?.declared_level,
    players.find((p) => p.display_name === form.player2_name)?.declared_level,
  ]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
      <div className="grid gap-4 py-4">
        <div className="flex gap-4 rounded-lg border bg-muted/30 p-3">
          <ImageUpload
            id="team-crest"
            value={crest}
            onChange={setCrest}
            label="Foto"
            size="lg"
            bucket="team-crests"
            path="pairs"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Foto del equipo</p>
            <p className="text-xs text-muted-foreground">Logo o escudo de la pareja.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <PlayerSlot label="Jugador 1" value={form.player1_name} players={players} onPick={(n) => setPlayers(1, n)} onType={(n) => setPlayers(1, n)} />
          <PlayerSlot label="Jugador 2" value={form.player2_name} players={players} onPick={(n) => setPlayers(2, n)} onType={(n) => setPlayers(2, n)} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="eq-name">Nombre del equipo</Label>
          <Input
            id="eq-name"
            value={form.name}
            onChange={(e) => { setManualName(true); setForm({ ...form, name: e.target.value }); }}
            placeholder={autoName(form) || "Se arma solo con los jugadores"}
          />
          {!manualName && autoName(form) && <p className="text-xs text-muted-foreground">Automático — edítalo si quieres otro nombre</p>}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="categoria">Categoría</Label>
          <Select value={form.category_id || "__none__"} onValueChange={(v) => setForm({ ...form, category_id: v === "__none__" ? "" : v })}>
            <SelectTrigger id="categoria"><SelectValue placeholder={SIN_CATEGORIA} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin categoría</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {checkMessage && (
          <p className="flex items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs font-semibold text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {checkMessage}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onSubmit(form)} disabled={submitting || !valid}>
          {submitting ? "Guardando…" : editing ? "Actualizar" : "Inscribir equipo"}
        </Button>
      </DialogFooter>
    </form>
  );
}