"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { PlayerProfile } from "@/types";
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
import { Plus, Trash2 } from "lucide-react";
import { sexLabel } from "@/lib/format";

const SEX_OPTIONS = [
  { value: "M", label: "Varonil" },
  { value: "F", label: "Femenil" },
  { value: "X", label: "Mixto" },
];

const HAND_OPTIONS = [
  { value: "right", label: "Diestro" },
  { value: "left", label: "Zurdo" },
  { value: "both", label: "Ambidiestro" },
];

const POSITION_OPTIONS = [
  { value: "drive", label: "Drive" },
  { value: "reves", label: "Revés" },
  { value: "both", label: "Ambos" },
];

export default function AdminPlayers() {
  const [list, setList] = useState<PlayerProfile[] | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<PlayerProfile | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    db.listPlayers().then(setList);
  }, []);

  const load = () => db.listPlayers().then(setList);

  async function handleSave(form: PlayerFormData) {
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 400));
      if (editing) {
        await db.updatePlayer(editing.id, form as unknown as Partial<PlayerProfile>);
        toast.success(`Jugador "${form.display_name}" actualizado`);
      } else {
        await db.createPlayer(form as unknown as Omit<PlayerProfile, "id" | "user_id">);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Jugadores</h1>
        <Button size="sm" onClick={() => { setEditing(null); setOpenCreate(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo jugador
        </Button>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Directorio</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden sm:table-cell">Usuario</TableHead>
                <TableHead>Nivel</TableHead>
                <TableHead className="hidden md:table-cell">Sexo</TableHead>
                <TableHead className="hidden md:table-cell">Mano</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.display_name}</TableCell>
                  <TableCell className="hidden sm:table-cell">@{p.username}</TableCell>
                  <TableCell>{p.declared_level.toFixed(1)}</TableCell>
                  <TableCell className="hidden md:table-cell">{sexLabel(p.sex)}</TableCell>
                  <TableCell className="hidden md:table-cell">{{ right: "Diestro", left: "Zurdo", both: "Ambidiestro" }[p.dominant_hand]}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(p); setOpenCreate(true); }}>Editar</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PlayerFormDialog
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
          <DialogTitle>{editing ? "Editar jugador" : "Nuevo jugador"}</DialogTitle>
          <DialogDescription>
            {editing ? `Edita "${editing.display_name}"` : "Registra un nuevo jugador al directorio."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Nombre</Label>
            <Input value={form.display_name} onChange={(e) => update("display_name", e.target.value)} placeholder="Nombre completo" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Usuario</Label>
              <Input value={form.username} onChange={(e) => update("username", e.target.value)} placeholder="juanperez" />
            </div>
            <div className="grid gap-1.5">
              <Label>Nivel</Label>
              <Input type="number" step="0.1" min="1" max="7" value={form.declared_level} onChange={(e) => update("declared_level", e.target.value)} />
              <p className="text-xs text-muted-foreground">Nivel del 1.0 al 7.0 (se recomienda actualizar a oficial después)</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Sexo</Label>
              <Select value={form.sex} onValueChange={(v) => update("sex", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEX_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Mano</Label>
              <Select value={form.dominant_hand} onValueChange={(v) => update("dominant_hand", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HAND_OPTIONS.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Posición preferida</Label>
            <Select value={form.preferred_position} onValueChange={(v) => update("preferred_position", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {POSITION_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Ciudad</Label>
              <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Estado</Label>
              <Input value={form.state} onChange={(e) => update("state", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Biografía</Label>
            <Input value={form.bio} onChange={(e) => update("bio", e.target.value)} placeholder="Breve descripción" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); onCancel(); }}>Cancelar</Button>
          <Button onClick={() => onSave(form)} disabled={submitting || !form.display_name.trim() || !form.username.trim()}>
            {submitting ? "Guardando…" : editing ? "Actualizar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
