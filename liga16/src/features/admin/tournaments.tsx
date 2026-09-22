"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { Tournament } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { tournamentStatusLabel } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export default function AdminTournaments() {
  const [list, setList] = useState<Tournament[] | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Tournament | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    db.listTournaments().then(setList);
  }, []);

  const load = () => db.listTournaments().then(setList);

  async function handleSave(form: TournamentFormData) {
    setSubmitting(true);
    try {
      const clubs = await db.listClubs();
      const clubId = clubs[0]?.id ?? "club-1";
      const payload = {
        name: form.name,
        cover_url: null,
        club_id: clubId,
        city: "Ciudad de México",
        state: "CDMX",
        start_date: form.start_date,
        end_date: form.end_date,
        registration_deadline: form.registration_deadline,
        status: form.status as Tournament["status"],
        modality: form.modality as Tournament["modality"],
        format: form.format as Tournament["format"],
        organizer_id: null,
        price_cents: Number(form.price_cents) || 0,
        currency: "MXN",
        rules_summary: form.rules_summary || null,
        description: form.description || null,
      };
      if (editing) {
        await db.updateTournament(editing.slug, payload);
        toast.success(`Torneo "${form.name}" actualizado`);
      } else {
        await db.createTournament(payload as Omit<Tournament, "id" | "slug">);
        toast.success(`Torneo "${form.name}" creado`);
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

  async function handleDelete(t: Tournament) {
    try {
      await db.deleteTournament(t.slug);
      toast.success(`Torneo "${t.name}" eliminado`);
      load();
    } catch (e) {
      toast.error((e as Error).message ?? "Error al eliminar");
    }
  }

  const dialogKey = editing?.id ?? "new";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Torneos</h1>
        <Button size="sm" onClick={() => { setEditing(null); setOpenCreate(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo torneo
        </Button>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Todos los torneos</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden sm:table-cell">Sede</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden md:table-cell">Formato</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list?.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">{t.club_name ?? t.city}</TableCell>
                  <TableCell><Badge variant="outline">{tournamentStatusLabel[t.status]}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell">{t.format}</TableCell>
                  <TableCell className="text-right">{t.price_cents > 0 ? `$${(t.price_cents / 100).toFixed(2)}` : "Gratis"}</TableCell>
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

      <TournamentFormDialog
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

interface TournamentFormData {
  name: string;
  slug: string;
  status: string;
  modality: string;
  format: string;
  price_cents: string;
  start_date: string;
  end_date: string;
  registration_deadline: string;
  rules_summary: string;
  description: string;
  category_names: string;
}

function TournamentFormDialog({
  open,
  onOpenChange,
  onSave,
  onCancel,
  editing,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: TournamentFormData) => void;
  onCancel: () => void;
  editing: Tournament | null;
  submitting: boolean;
}) {
  const [form, setForm] = useState<TournamentFormData>(() => {
    if (editing) {
      return {
        name: editing.name,
        slug: editing.slug,
        status: editing.status,
        modality: editing.modality,
        format: editing.format,
        price_cents: String(editing.price_cents),
        start_date: editing.start_date,
        end_date: editing.end_date,
        registration_deadline: editing.registration_deadline,
        rules_summary: editing.rules_summary ?? "",
        description: editing.description ?? "",
        category_names: "",
      };
    }
    return {
      name: "",
      slug: "",
      status: "draft",
      modality: "pairs",
      format: "groups_knockout",
      price_cents: "0",
      start_date: "",
      end_date: "",
      registration_deadline: "",
      rules_summary: "",
      description: "",
      category_names: "",
    };
  });

  const update = (field: keyof TournamentFormData, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar torneo" : "Nuevo torneo"}</DialogTitle>
          <DialogDescription>
            {editing ? `Edita "${editing.name}"` : "Crea un nuevo torneo para Club Pádel Reforma."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Nombre del torneo</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Copa Liga16 Apertura 2026" />
          </div>
          <div className="grid gap-1.5">
            <Label>Slug</Label>
            <Input value={form.slug} onChange={(e) => update("slug", e.target.value)} placeholder="copa-liga16-apertura-2026" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => update("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="published">Publicado</SelectItem>
                  <SelectItem value="registration_open">Inscripciones abiertas</SelectItem>
                  <SelectItem value="registration_closed">Inscripciones cerradas</SelectItem>
                  <SelectItem value="in_progress">En juego</SelectItem>
                  <SelectItem value="finished">Finalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Modalidad</Label>
              <Select value={form.modality} onValueChange={(v) => update("modality", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pairs">Parejas</SelectItem>
                  <SelectItem value="singles">Individual</SelectItem>
                  <SelectItem value="teams">Equipos</SelectItem>
                  <SelectItem value="league">Liga</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Formato</Label>
            <Select value={form.format} onValueChange={(v) => update("format", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="single_elimination">Eliminación directa</SelectItem>
                <SelectItem value="groups_knockout">Grupos + eliminación</SelectItem>
                <SelectItem value="americano">Americano</SelectItem>
                <SelectItem value="round_robin">Round robin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Precio (MXN)</Label>
              <Input type="number" value={form.price_cents} onChange={(e) => update("price_cents", e.target.value)} placeholder="80000" />
            </div>
            <div className="grid gap-1.5">
              <Label>Fecha inicio</Label>
              <Input type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Fecha fin</Label>
              <Input type="date" value={form.end_date} onChange={(e) => update("end_date", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Límite inscripción</Label>
              <Input type="date" value={form.registration_deadline} onChange={(e) => update("registration_deadline", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Categorías</Label>
            <Input value={form.category_names} onChange={(e) => update("category_names", e.target.value)} placeholder="4ta Masculino, 5ta Masculino, Novatos Mixto" />
            <p className="text-xs text-muted-foreground">Una por línea o separadas por coma. Ej: 4ta Masculino, 5ta Masculino, Novatos Mixto</p>
          </div>
          <div className="grid gap-1.5">
            <Label>Descripción</Label>
            <Input value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Describe el torneo brevemente" />
          </div>
          <div className="grid gap-1.5">
            <Label>Reglamento</Label>
            <Input value={form.rules_summary} onChange={(e) => update("rules_summary", e.target.value)} placeholder="Reglas principales del torneo" />
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">💡 Consejo:</p>
            <p>El precio se guarda en centavos MXN. $800 = 80000. Las fechas son en formato YYYY-MM-DD.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); onCancel(); }}>Cancelar</Button>
          <Button onClick={() => onSave(form)} disabled={submitting || !form.name.trim()}>
            {submitting ? "Guardando…" : editing ? "Actualizar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
