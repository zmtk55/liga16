// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { db } from "@/lib/data";
import type { Tournament, TieBreakerRule } from "@/types";
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
import { DEFAULT_SCORING } from "@/lib/scoring";

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
      const tieBreakerRules = form.tie_breaker_rules
        .split(",")
        .map((r) => r.trim())
        .filter((r): r is TieBreakerRule =>
          [
            "points",
            "sets_won",
            "sets_diff",
            "games_won",
            "games_diff",
            "head_to_head",
            "tiebreak_won",
          ].includes(r)
        ) || DEFAULT_SCORING.tie_breaker_rules;

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
        scoring: {
          sets_to_win: Number(form.sets_to_win) || DEFAULT_SCORING.sets_to_win,
          games_per_set: Number(form.games_per_set) || DEFAULT_SCORING.games_per_set,
          tie_break_at: Number(form.tie_break_at) || DEFAULT_SCORING.tie_break_at,
          tie_break_points: Number(form.tie_break_points) || DEFAULT_SCORING.tie_break_points,
          tie_breaker_rules: tieBreakerRules,
        },
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
        <Button size="sm" asChild>
          <Link to="/admin/torneos/nuevo">
            <Plus className="h-4 w-4 mr-1" /> Nuevo torneo
          </Link>
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
                  <TableCell className="font-medium">
                    <Link to={`/admin/torneos/${t.slug}`} className="hover:underline">{t.name}</Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{t.club_name ?? t.city}</TableCell>
                  <TableCell><Badge variant="outline">{tournamentStatusLabel[t.status]}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell">{t.format}</TableCell>
                  <TableCell className="text-right">{t.price_cents > 0 ? `$${(t.price_cents / 100).toFixed(2)}` : "Gratis"}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/admin/torneos/${t.slug}`}>Grupos</Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/admin/torneos/${t.slug}/editar`}>Editar</Link>
                    </Button>
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
  sets_to_win: string;
  games_per_set: string;
  tie_break_at: string;
  tie_break_points: string;
  tie_breaker_rules: string; // coma-separated
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
      const s = editing.scoring;
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
        sets_to_win: String(s?.sets_to_win ?? DEFAULT_SCORING.sets_to_win),
        games_per_set: String(s?.games_per_set ?? DEFAULT_SCORING.games_per_set),
        tie_break_at: String(s?.tie_break_at ?? DEFAULT_SCORING.tie_break_at),
        tie_break_points: String(s?.tie_break_points ?? DEFAULT_SCORING.tie_break_points),
        tie_breaker_rules: (s?.tie_breaker_rules ?? DEFAULT_SCORING.tie_breaker_rules!).join(", "),
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
      sets_to_win: String(DEFAULT_SCORING.sets_to_win),
      games_per_set: String(DEFAULT_SCORING.games_per_set),
      tie_break_at: String(DEFAULT_SCORING.tie_break_at),
      tie_break_points: String(DEFAULT_SCORING.tie_break_points),
      tie_breaker_rules: DEFAULT_SCORING.tie_breaker_rules!.join(", "),
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

          <div className="rounded-lg border p-4 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">🏓 Sistema de puntuación</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Sets para ganar</Label>
                <Input type="number" min={1} value={form.sets_to_win} onChange={(e) => update("sets_to_win", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Juegos por set</Label>
                <Input type="number" min={1} value={form.games_per_set} onChange={(e) => update("games_per_set", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Tie-break al llegar a</Label>
                <Input type="number" min={1} value={form.tie_break_at} onChange={(e) => update("tie_break_at", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Puntos tie-break</Label>
                <Input type="number" min={1} value={form.tie_break_points} onChange={(e) => update("tie_break_points", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Orden de desempate (separado por comas)</Label>
              <Input value={form.tie_breaker_rules} onChange={(e) => update("tie_breaker_rules", e.target.value)} placeholder="points, sets_diff, games_diff, head_to_head" />
              <p className="text-xs text-muted-foreground">
                Opciones: points, sets_won, sets_diff, games_won, games_diff, head_to_head, tiebreak_won
              </p>
            </div>
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
