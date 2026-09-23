"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { Team } from "@/types";
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
import { Plus, Search, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { sexShort } from "@/lib/format";

const DIVISIONS = ["1ra", "2da", "3ra", "4ta", "5ta", "6ta", "Novatos"];

export default function AdminTeams() {
  const [list, setList] = useState<Team[] | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState("all");

  const filtered = (list ?? []).filter((t) => {
    const q = query.trim().toLowerCase();
    if (q && !t.name.toLowerCase().includes(q) && !(t.player1?.name ?? "").toLowerCase().includes(q) && !(t.player2?.name ?? "").toLowerCase().includes(q)) return false;
    if (division !== "all" && t.division !== division) return false;
    return true;
  });

  useEffect(() => {
    db.listTeams().then(setList);
  }, []);

  const load = () => db.listTeams().then(setList);

  async function handleSave(form: TeamFormData) {
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 400));
      const payload = {
        name: form.name,
        division: form.division,
        sex: form.sex,
        city: form.city,
        player1: form.player1_name ? { player_id: "", name: form.player1_name, level: 0 } : null,
        player2: form.player2_name ? { player_id: "", name: form.player2_name, level: 0 } : null,
      };
      if (editing) {
        await db.updateTeam(editing.slug, payload as unknown as Partial<Team>);
        toast.success(`Equipo "${form.name}" actualizado`);
      } else {
        await db.createTeam(payload as unknown as Omit<Team, "id" | "slug">);
        toast.success(`Equipo "${form.name}" creado`);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Equipos</h1>
        <Button size="sm" onClick={() => { setEditing(null); setOpenCreate(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nueva pareja
        </Button>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm">{filtered.length} de {list?.length ?? 0} parejas</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar pareja o jugador…"
                  className="h-9 w-52 pl-8"
                  aria-label="Buscar parejas"
                />
              </div>
              <Select value={division} onValueChange={setDivision}>
                <SelectTrigger className="h-9 w-40" aria-label="Filtrar por división">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las divisiones</SelectItem>
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
                <TableHead>Pareja</TableHead>
                <TableHead className="hidden sm:table-cell">División</TableHead>
                <TableHead className="text-right">PJ</TableHead>
                <TableHead className="text-right">G</TableHead>
                <TableHead className="text-right">P</TableHead>
                <TableHead className="text-right">Posición</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list !== null && list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No hay parejas todavía. Usa el botón "Nueva pareja" para agregar el primero.
                  </TableCell>
                </TableRow>
              )}
              {list !== null && list.length > 0 && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Ninguna pareja coincide con el filtro.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    <Link to={`/equipos/${t.slug}`} className="hover:underline">{t.name}</Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {t.division} {sexShort(t.sex)}
                  </TableCell>
                  <TableCell className="text-right">{t.played}</TableCell>
                  <TableCell className="text-right text-emerald-600">{t.won}</TableCell>
                  <TableCell className="text-right text-red-500">{t.lost}</TableCell>
                  <TableCell className="text-right">{t.position}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(t); setOpenCreate(true); }}>Editar</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(t)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TeamFormDialog
        key={dialogKey}
        open={openCreate}
        onOpenChange={(o) => { if (!o) { setOpenCreate(false); setEditing(null); } }}
        onSave={handleSave}
        onCancel={() => setEditing(null)}
        editing={editing}
        submitting={submitting}
      />
    </div>
  );
}

interface TeamFormData {
  name: string;
  division: string;
  sex: string;
  city: string;
  player1_name: string;
  player2_name: string;
}

function TeamFormDialog({
  open,
  onOpenChange,
  onSave,
  onCancel,
  editing,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: TeamFormData) => void;
  onCancel: () => void;
  editing: Team | null;
  submitting: boolean;
}) {
  const [form, setForm] = useState<TeamFormData>(() => {
    if (editing) {
      return {
        name: editing.name,
        division: editing.division,
        sex: editing.sex,
        city: editing.city,
        player1_name: editing.player1?.name ?? "",
        player2_name: editing.player2?.name ?? "",
      };
    }
    return {
      name: "",
      division: "1ra",
      sex: "M",
      city: "Ciudad de México",
      player1_name: "",
      player2_name: "",
    };
  });

  const update = (field: keyof TeamFormData, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar pareja" : "Nueva pareja"}</DialogTitle>
          <DialogDescription>
            {editing ? `Edita "${editing.name}"` : "Registra una pareja (2 jugadores) en una división."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Nombre de la pareja</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Fuentes / Rojas" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>División</Label>
              <Select value={form.division} onValueChange={(v) => update("division", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIVISIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d === "1ra" ? "1ra División (élite)" : d === "Novatos" ? "Novatos" : `${d} División`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">1ra = élite, Novatos = principiantes</p>
            </div>
            <div className="grid gap-1.5">
              <Label>Género</Label>
              <Select value={form.sex} onValueChange={(v) => update("sex", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Femenino</SelectItem>
                  <SelectItem value="X">Mixto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Jugador 1</Label>
              <Input value={form.player1_name} onChange={(e) => update("player1_name", e.target.value)} placeholder="Nombre del jugador 1" />
            </div>
            <div className="grid gap-1.5">
              <Label>Jugador 2</Label>
              <Input value={form.player2_name} onChange={(e) => update("player2_name", e.target.value)} placeholder="Nombre del jugador 2" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Ciudad</Label>
            <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); onCancel(); }}>Cancelar</Button>
          <Button onClick={() => onSave(form)} disabled={submitting || !form.name.trim() || !form.player1_name.trim() || !form.player2_name.trim()}>
            {submitting ? "Guardando…" : editing ? "Actualizar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
