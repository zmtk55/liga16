import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { Team, PlayerProfile } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { sexShort } from "@/lib/format";
import PlayerSlot from "@/components/players/player-slot";
import ImageUpload from "@/components/ui/image-upload";
import { ensurePlayer } from "@/lib/players";

// Categorías cerradas del ranking: 4ta, 5ta, 6ta… (nombres libres como "Suma Nueve" viven en el torneo)
const DIVISIONS = ["1ra", "2da", "3ra", "4ta", "5ta", "6ta", "Novatos"];

interface EquipoForm {
  name: string;
  division: string;
  sex: string;
  logo: string | null;
  player1_name: string;
  player2_name: string;
}

const EMPTY_FORM: EquipoForm = {
  name: "",
  division: "4ta",
  sex: "M",
  logo: null,
  player1_name: "",
  player2_name: "",
};

/** Nombre automático con los jugadores; respeta edición manual. */
function autoName(f: EquipoForm): string {
  return [f.player1_name.trim(), f.player2_name.trim()].filter(Boolean).join(" / ");
}

export default function AdminTeams() {
  const [list, setList] = useState<Team[] | null>(null);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState("all");

  useEffect(() => {
    db.listTeams().then(setList);
    db.listPlayers().then((p) => setPlayers(p)).catch(() => setPlayers([]));
  }, []);

  const load = () => db.listTeams().then(setList);

  const filtered = (list ?? []).filter((t) => {
    const q = query.trim().toLowerCase();
    if (q && !t.name.toLowerCase().includes(q) && !(t.player1?.name ?? "").toLowerCase().includes(q) && !(t.player2?.name ?? "").toLowerCase().includes(q)) return false;
    if (division !== "all" && t.division !== division) return false;
    return true;
  });

  async function handleSave(form: EquipoForm) {
    setSubmitting(true);
    try {
      // Registrar perfiles de jugadores nuevos (si no existen)
      const [p1, p2] = await Promise.all([
        ensurePlayer(form.player1_name, form.division),
        ensurePlayer(form.player2_name, form.division),
      ]);
      const payload = {
        name: form.name.trim(),
        division: form.division,
        sex: form.sex,
        crest_url: form.logo,
        player1: p1 ? { player_id: p1.id, name: p1.display_name, level: p1.declared_level } : null,
        player2: p2 ? { player_id: p2.id, name: p2.display_name, level: p2.declared_level } : null,
      };
      if (editing) {
        await db.updateTeam(editing.slug, payload as unknown as Partial<Team>);
        toast.success(`Equipo "${payload.name}" actualizado`);
      } else {
        await db.createTeam(payload as unknown as Omit<Team, "id" | "slug">);
        toast.success(`Equipo "${payload.name}" creado`);
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

  async function handleDelete(t: Team) {
    if (!confirm(`¿Eliminar el equipo "${t.name}"?`)) return;
    try {
      await db.deleteTeam(t.slug);
      toast.success(`Equipo "${t.name}" eliminado`);
      load();
    } catch (e) {
      toast.error((e as Error).message ?? "Error al eliminar");
    }
  }

  const dialogKey = editing?.id ?? "new";

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Equipos</h1>
        <Button size="sm" onClick={() => { setEditing(null); setOpenCreate(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo equipo
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm">{filtered.length} de {list?.length ?? 0} equipos</CardTitle>
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
              <Select value={division} onValueChange={setDivision}>
                <SelectTrigger className="h-9 w-40" aria-label="Filtrar por categoría">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {DIVISIONS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
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
                <TableHead className="text-right">PJ</TableHead>
                <TableHead className="text-right">G</TableHead>
                <TableHead className="text-right pr-4">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list === null && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">Cargando…</TableCell>
                </TableRow>
              )}
              {list !== null && list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No hay equipos todavía. Registra el primero con "Nuevo equipo".
                  </TableCell>
                </TableRow>
              )}
              {list !== null && list.length > 0 && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Ningún equipo coincide con el filtro.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="pl-4 font-medium">
                    <span className="flex items-center gap-2">
                      {t.crest_url ? (
                        <img src={t.crest_url} alt="" className="h-7 w-7 rounded object-contain" />
                      ) : null}
                      <Link to={`/equipos/${t.slug}`} className="hover:underline">{t.name}</Link>
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badgeish division={t.division} sex={t.sex} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {[t.player1?.name, t.player2?.name].filter(Boolean).join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="text-right">{t.played}</TableCell>
                  <TableCell className="text-right text-emerald-600">{t.won}</TableCell>
                  <TableCell className="pr-4 text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(t); setOpenCreate(true); }} aria-label={`Editar ${t.name}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(t)} aria-label={`Eliminar ${t.name}`}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EquipoDialog
        key={dialogKey}
        open={openCreate}
        onOpenChange={(o) => { if (!o) { setOpenCreate(false); setEditing(null); } }}
        onSave={handleSave}
        editing={editing}
        submitting={submitting}
        players={players}
      />
    </div>
  );
}

function Badgeish({ division, sex }: { division: string; sex: string }) {
  return (
    <span className="text-sm">
      {division} · {sexShort(sex)}
    </span>
  );
}

function EquipoDialog({
  open,
  onOpenChange,
  onSave,
  editing,
  submitting,
  players,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: EquipoForm) => void;
  editing: Team | null;
  submitting: boolean;
  players: PlayerProfile[];
}) {
  const [form, setForm] = useState<EquipoForm>(() => {
    if (editing) {
      return {
        name: editing.name,
        division: editing.division,
        sex: editing.sex,
        logo: editing.crest_url ?? null,
        player1_name: editing.player1?.name ?? "",
        player2_name: editing.player2?.name ?? "",
      };
    }
    return EMPTY_FORM;
  });
  // El nombre dejó de ser automático cuando el usuario lo edita a mano
  const [manualName, setManualName] = useState(Boolean(editing?.name));

  function setPlayers(slot: 1 | 2, name: string) {
    setForm((f) => {
      const next = { ...f, [slot === 1 ? "player1_name" : "player2_name"]: name };
      // Si el nombre no fue tocado a mano, se arma solo
      const wasAuto = !manualName;
      return { ...next, name: wasAuto ? autoName(next) : next.name };
    });
  }

  const valid = form.name.trim() && form.player1_name.trim() && form.player2_name.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar equipo" : "Nuevo equipo"}</DialogTitle>
          <DialogDescription>
            Un equipo es una pareja de 2 jugadores. Busca a los registrados o escribe nombres nuevos.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Logo + nombre */}
          <div className="flex items-start gap-3">
            <ImageUpload
              id="equipo-logo"
              value={form.logo}
              label="Logo del equipo"
              onChange={(dataUrl) => setForm((f) => ({ ...f, logo: dataUrl }))}
            />
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="equipo-name">Nombre del equipo</Label>
              <Input
                id="equipo-name"
                value={form.name}
                onChange={(e) => {
                  setManualName(true);
                  setForm((f) => ({ ...f, name: e.target.value }));
                }}
                placeholder={autoName(form) || "Se arma solo con los jugadores"}
              />
              {!manualName && autoName(form) && (
                <p className="text-xs text-muted-foreground">Automático — edítalo si quieres otro nombre</p>
              )}
            </div>
          </div>

          {/* Jugadores */}
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

          {/* Categoría + rama */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Categoría</Label>
              <Select value={form.division} onValueChange={(v) => setForm((f) => ({ ...f, division: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIVISIONS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Rama</Label>
              <Select value={form.sex} onValueChange={(v) => setForm((f) => ({ ...f, sex: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Varonil</SelectItem>
                  <SelectItem value="F">Femenil</SelectItem>
                  <SelectItem value="X">Mixto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSave(form)} disabled={submitting || !valid}>
            {submitting ? "Guardando…" : editing ? "Actualizar" : "Crear equipo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
