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
import { Plus, Trash2 } from "lucide-react";

export default function AdminTeams() {
  const [list, setList] = useState<Team[] | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    db.listTeams().then(setList);
  }, []);

  const load = () => db.listTeams().then(setList);

  async function handleSave(form: TeamFormData) {
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 400));
      if (editing) {
        await db.updateTeam(editing.slug, form as unknown as Partial<Team>);
        toast.success(`Equipo "${form.name}" actualizado`);
      } else {
        await db.createTeam(form as unknown as Omit<Team, "id" | "slug">);
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
        <h2 className="text-xl font-bold">Equipos</h2>
        <Button size="sm" onClick={() => { setEditing(null); setOpenCreate(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo equipo
        </Button>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Todos los equipos</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipo</TableHead>
                <TableHead className="hidden sm:table-cell">División</TableHead>
                <TableHead className="text-right">PJ</TableHead>
                <TableHead className="text-right">G</TableHead>
                <TableHead className="text-right">P</TableHead>
                <TableHead className="text-right">Posición</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list?.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">{t.category}</TableCell>
                  <TableCell className="text-right">{t.record.played}</TableCell>
                  <TableCell className="text-right text-emerald-600">{t.record.won}</TableCell>
                  <TableCell className="text-right text-red-500">{t.record.lost}</TableCell>
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
  category: string;
  captain_name: string;
  city: string;
  state: string;
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
        category: editing.category,
        captain_name: editing.captain_name,
        city: editing.city,
        state: editing.city,
      };
    }
    return {
      name: "",
      category: "Primera División",
      captain_name: "",
      city: "Ciudad de México",
      state: "CDMX",
    };
  });

  const update = (field: keyof TeamFormData, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar equipo" : "Nuevo equipo"}</DialogTitle>
          <DialogDescription>
            {editing ? `Edita "${editing.name}"` : "Crea un nuevo equipo para la liga."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Nombre</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Reforma Smash" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>División</Label>
              <Select value={form.category} onValueChange={(v) => update("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Primera División">Primera División</SelectItem>
                  <SelectItem value="Segunda División">Segunda División</SelectItem>
                  <SelectItem value="Tercera División">Tercera División</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Capitán</Label>
              <Input value={form.captain_name} onChange={(e) => update("captain_name", e.target.value)} placeholder="Nombre del capitán" />
            </div>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); onCancel(); }}>Cancelar</Button>
          <Button onClick={() => onSave(form)} disabled={submitting || !form.name.trim() || !form.captain_name.trim()}>
            {submitting ? "Guardando…" : editing ? "Actualizar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
