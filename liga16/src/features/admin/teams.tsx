// Admin → Equipos: los equipos son POR TORNEO (tabla `pairs` con tournament_id).
// Un jugador pertenece al directorio global (player_profiles) pero su equipo
// solo existe dentro del torneo elegido. Otro torneo = otros equipos.
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/data";
import type { PlayerProfile, Tournament, TournamentCategory } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import PlayerSlot from "@/components/players/player-slot";
import { ensurePlayer } from "@/lib/players";

interface EquipoForm {
  name: string;
  category_id: string;
  player1_name: string;
  player2_name: string;
}

/** Nombre automático con los jugadores; respeta edición manual. */
function autoName(f: { player1_name: string; player2_name: string }): string {
  return [f.player1_name.trim(), f.player2_name.trim()].filter(Boolean).join(" / ");
}

export default function AdminTeams() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tid, setTid] = useState<string>("");
  const [categories, setCategories] = useState<TournamentCategory[]>([]);
  const [pairs, setPairs] = useState<Array<{ id: string; name: string; category_id: string | null }> | null>(null);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string; category_id: string | null } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");

  useEffect(() => {
    db.listTournaments().then((ts) => {
      setTournaments(ts);
      // Selecciona el torneo activo más reciente por defecto
      const active = ts.find((t) => t.status === "published") ?? ts[0];
      if (active) setTid(active.id);
    }).catch(() => setTournaments([]));
    db.listPlayers().then((p) => setPlayers(p)).catch(() => setPlayers([]));
  }, []);

  useEffect(() => {
    if (!tid) return;
    setPairs(null);
    db.getTournamentCategories(tid).then(setCategories).catch(() => setCategories([]));
    db.getTournamentPairs(tid)
      .then((ps) => setPairs(ps as unknown as Array<{ id: string; name: string; category_id: string | null }>))
      .catch(() => setPairs([]));
  }, [tid]);

  const load = () => {
    db.getTournamentPairs(tid)
      .then((ps) => setPairs(ps as unknown as Array<{ id: string; name: string; category_id: string | null }>))
      .catch(() => setPairs([]));
  };

  const catNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const filtered = (pairs ?? []).filter((p) => {
    const q = query.trim().toLowerCase();
    if (q && !p.name.toLowerCase().includes(q)) return false;
    if (cat !== "all" && (p.category_id ?? "") !== cat) return false;
    return true;
  });

  async function handleSave(form: EquipoForm) {
    const p1 = form.player1_name.trim();
    const p2 = form.player2_name.trim();
    if (p1.toLowerCase() === p2.toLowerCase()) {
      toast.error("El mismo jugador no puede estar 2 veces en el equipo");
      return;
    }
    // Rama del torneo: si la categoría define sexo (M/F), los jugadores deben coincidir
    const pairCat = categories.find((c) => c.id === (form.category_id || categories[0]?.id));
    if (pairCat && pairCat.sex !== "X") {
      const roster = [
        { name: p1, profile: players.find((pl) => pl.display_name.trim().toLowerCase() === p1.toLowerCase()) },
        { name: p2, profile: players.find((pl) => pl.display_name.trim().toLowerCase() === p2.toLowerCase()) },
      ];
      for (const r of roster) {
        if (r.profile && r.profile.sex !== "X" && r.profile.sex !== pairCat.sex) {
          const ramaEs = pairCat.sex === "M" ? "varonil" : "femenil";
          toast.error(`"${r.name}" es ${r.profile.sex === "F" ? "jugadora femenil" : "jugador varonil"} y esta categoría es ${ramaEs}`);
          return;
        }
      }
    }
    // Un jugador no puede estar en 2 equipos del mismo torneo
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
      // Los jugadores se registran/reutilizan en el directorio global
      await Promise.all([
        ensurePlayer(p1).catch(() => null),
        ensurePlayer(p2).catch(() => null),
      ]);
      const name = form.name.trim() || autoName(form);
      if (editing) {
        await db.updatePair(editing.id, { name, category_id: form.category_id || null });
        toast.success(`Equipo "${name}" actualizado`);
      } else {
        await db.createPair({ tournament_id: tid, category_id: form.category_id || null, name });
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

  async function handleDelete(p: { id: string; name: string }) {
    if (!confirm(`¿Eliminar el equipo "${p.name}" de este torneo?`)) return;
    try {
      await db.deletePair(p.id);
      toast.success(`Equipo "${p.name}" eliminado`);
      load();
    } catch (e) {
      toast.error((e as Error).message ?? "Error al eliminar");
    }
  }

  const dialogKey = editing?.id ?? "new";

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Equipos del torneo</h1>
        <Button size="sm" disabled={!tid} onClick={() => { setEditing(null); setOpenCreate(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Inscribir equipo
        </Button>
      </div>

      {/* Selector de torneo: cada torneo tiene sus propios equipos */}
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-sm text-muted-foreground">Torneo:</Label>
        <Select value={tid} onValueChange={setTid}>
          <SelectTrigger className="h-9 w-72" aria-label="Elegir torneo">
            <SelectValue placeholder="Elige un torneo" />
          </SelectTrigger>
          <SelectContent>
            {tournaments.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tournaments.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay torneos aún — crea uno en Torneos → Nuevo torneo.</p>
        )}
      </div>

      {!tid ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Elige un torneo para ver e inscribir sus equipos.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-sm">{filtered.length} de {pairs?.length ?? 0} equipos</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar equipo o jugador…"
                    className="h-9 w-56 pl-8"
                    aria-label="Buscar equipos"
                  />
                </div>
                <Select value={cat} onValueChange={setCat}>
                  <SelectTrigger className="h-9 w-44" aria-label="Filtrar por categoría">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Equipo</TableHead>
                  <TableHead className="hidden sm:table-cell">Categoría</TableHead>
                  <TableHead className="hidden md:table-cell">Jugadores</TableHead>
                  <TableHead className="text-right pr-4">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pairs === null && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">Cargando…</TableCell>
                  </TableRow>
                )}
                {pairs !== null && pairs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      Sin equipos en este torneo. Inscribe el primero con "Inscribir equipo".
                    </TableCell>
                  </TableRow>
                )}
                {pairs !== null && pairs.length > 0 && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      Ningún equipo coincide con el filtro.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((p) => {
                  const [p1, p2] = p.name.split(" / ");
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="pl-4 font-medium">{p.name}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {p.category_id ? (
                          <Badge variant="secondary">{catNameById.get(p.category_id) ?? "—"}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin categoría</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {[p1, p2].filter(Boolean).join(" · ") || "—"}
                      </TableCell>
                      <TableCell className="pr-4 text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(p); setOpenCreate(true); }} aria-label={`Editar ${p.name}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(p)} aria-label={`Eliminar ${p.name}`}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <EquipoDialog
        key={dialogKey}
        open={openCreate}
        onOpenChange={(o) => { if (!o) { setOpenCreate(false); setEditing(null); } }}
        onSave={handleSave}
        editing={editing}
        submitting={submitting}
        players={players}
        categories={categories}
      />
    </div>
  );
}

function EquipoDialog({
  open,
  onOpenChange,
  onSave,
  editing,
  submitting,
  players,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: EquipoForm) => void;
  editing: { id: string; name: string; category_id: string | null } | null;
  submitting: boolean;
  players: PlayerProfile[];
  categories: TournamentCategory[];
}) {
  const [form, setForm] = useState<EquipoForm>(() => {
    if (editing) {
      const [p1, p2] = editing.name.split(" / ");
      return {
        name: editing.name,
        category_id: editing.category_id ?? "",
        player1_name: p1 ?? "",
        player2_name: p2 ?? "",
      };
    }
    return { name: "", category_id: categories[0]?.id ?? "", player1_name: "", player2_name: "" };
  });
  // El nombre dejó de ser automático cuando el usuario lo edita a mano
  const [manualName, setManualName] = useState(Boolean(editing?.name));

  function setPlayers(slot: 1 | 2, name: string) {
    setForm((f) => {
      const next = { ...f, [slot === 1 ? "player1_name" : "player2_name"]: name };
      return { ...next, name: manualName ? next.name : autoName(next) };
    });
  }

  const valid = form.player1_name.trim() && form.player2_name.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar equipo" : "Inscribir equipo"}</DialogTitle>
          <DialogDescription>
            Un equipo es una pareja de 2 jugadores. Busca a los registrados o escribe nombres nuevos — el perfil se crea solo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <PlayerSlot
              label="Jugador 1"
              value={form.player1_name}
              players={players}
              onPick={(n) => setPlayers(1, n)}
              onType={(n) => setPlayers(1, n)}
            />
            <PlayerSlot
              label="Jugador 2"
              value={form.player2_name}
              players={players}
              onPick={(n) => setPlayers(2, n)}
              onType={(n) => setPlayers(2, n)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="eq-name">Nombre del equipo</Label>
            <Input
              id="eq-name"
              value={form.name}
              onChange={(e) => { setManualName(true); setForm((f) => ({ ...f, name: e.target.value })); }}
              placeholder={autoName(form) || "Se arma solo con los jugadores"}
            />
            {!manualName && autoName(form) && (
              <p className="text-xs text-muted-foreground">Automático — edítalo si quieres otro nombre</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>Categoría</Label>
            <Select value={form.category_id || "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v === "__none__" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin categoría</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSave(form)} disabled={submitting || !valid}>
            {submitting ? "Guardando…" : editing ? "Actualizar" : "Inscribir equipo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
