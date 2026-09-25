"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { RankingEntry, PlayerProfile } from "@/types";
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
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AdminRanking() {
  const [list, setList] = useState<RankingEntry[] | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<RankingEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    db.listRankings().then(setList);
  }, []);

  const load = () => db.listRankings().then(setList);

  async function handleSave(form: RankingFormData) {
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 400));
      if (editing) {
        await db.updateRanking(editing.player_id, {
          points: Number(form.points),
          played: Number(form.played),
          won: Number(form.won),
          delta: Number(form.delta),
        });
        toast.success(`Ranking de "${form.player_name}" actualizado`);
      } else {
        // For demo, create a ranking event
        await db.createPlayer({
          display_name: form.player_name,
          username: form.player_name.toLowerCase().replace(/\s+/g, ""),
          sex: form.sex as PlayerProfile["sex"],
          declared_level: 3.0,
          dominant_hand: "right",
          preferred_position: "both",
          city: "Ciudad de México",
          state: "CDMX",
          is_public: true,
        } as Omit<PlayerProfile, "id" | "user_id">);
        toast.success(`Jugador "${form.player_name}" agregado al ranking`);
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

  async function handleDelete(r: RankingEntry) {
    try {
      await db.updateRanking(r.player_id, { points: 0, played: 0, won: 0, delta: 0 });
      toast.success(`Ranking de "${r.player_name}" reseteado`);
      load();
    } catch (e) {
      toast.error((e as Error).message ?? "Error al eliminar");
    }
  }

  const dialogKey = editing?.player_id ?? "new";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Ranking</h1>
        <Button size="sm" onClick={() => { setEditing(null); setOpenCreate(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Agregar jugador
        </Button>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Clasificación</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Jugador</TableHead>
                <TableHead>Nivel</TableHead>
                <TableHead className="text-right">Puntos</TableHead>
                <TableHead className="text-right">PJ</TableHead>
                <TableHead className="text-right">PG</TableHead>
                <TableHead className="text-right">Cambio</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list !== null && list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No hay ranking todavía. Usa el botón "Agregar jugador" para agregar el primero.
                  </TableCell>
                </TableRow>
              )}
              {list?.map((r) => (
                <TableRow key={r.player_id}>
                  <TableCell className="font-medium">{r.position}</TableCell>
                  <TableCell>{r.player_name}</TableCell>
                  <TableCell>{r.level.toFixed(1)}</TableCell>
                  <TableCell className="text-right font-semibold">{r.points.toLocaleString("es-MX")}</TableCell>
                  <TableCell className="text-right">{r.played}</TableCell>
                  <TableCell className="text-right">{r.won}</TableCell>
                  <TableCell className={`text-right ${r.delta > 0 ? "text-emerald-600" : r.delta < 0 ? "text-red-500" : ""}`}>
                    {r.delta === 0 ? "—" : r.delta > 0 ? `+${r.delta}` : r.delta}
                  </TableCell>
                  <TableCell className="pr-2 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Acciones para ${r.player_name}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditing(r); setOpenCreate(true); }}>
                          <Pencil className="h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(r)} className="text-destructive focus:text-destructive">
                          <Trash2 className="h-4 w-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RankingFormDialog
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

interface RankingFormData {
  player_name: string;
  sex: string;
  level: string;
  points: string;
  played: string;
  won: string;
  delta: string;
}

function RankingFormDialog({
  open,
  onOpenChange,
  onSave,
  onCancel,
  editing,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: RankingFormData) => void;
  onCancel: () => void;
  editing: RankingEntry | null;
  submitting: boolean;
}) {
  const [form, setForm] = useState<RankingFormData>(() => {
    if (editing) {
      return {
        player_name: editing.player_name,
        sex: editing.sex ?? "X",
        level: String(editing.level),
        points: String(editing.points),
        played: String(editing.played),
        won: String(editing.won),
        delta: String(editing.delta),
      };
    }
    return {
      player_name: "",
      sex: "X",
      level: "3.0",
      points: "0",
      played: "0",
      won: "0",
      delta: "0",
    };
  });

  const update = (field: keyof RankingFormData, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar ranking" : "Agregar al ranking"}</DialogTitle>
          <DialogDescription>
            {editing ? `Edita "${editing.player_name}"` : "Añade un jugador al ranking."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Jugador</Label>
            <Input value={form.player_name} onChange={(e) => update("player_name", e.target.value)} placeholder="Nombre" disabled={!!editing} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Sexo</Label>
              <Select value={form.sex} onValueChange={(v) => update("sex", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Femenino</SelectItem>
                  <SelectItem value="X">Mixto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Nivel</Label>
              <Input type="number" step="0.1" value={form.level} onChange={(e) => update("level", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <p className="text-xs text-muted-foreground">PJ = partidos jugados, PG = partidos ganados, Cambio = posición sube(+)/baja(-)</p>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="grid gap-1.5">
              <Label>Puntos</Label>
              <Input type="number" value={form.points} onChange={(e) => update("points", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>PJ</Label>
              <Input type="number" value={form.played} onChange={(e) => update("played", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>PG</Label>
              <Input type="number" value={form.won} onChange={(e) => update("won", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Δ</Label>
              <Input type="number" value={form.delta} onChange={(e) => update("delta", e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); onCancel(); }}>Cancelar</Button>
          <Button onClick={() => onSave(form)} disabled={submitting || !form.player_name.trim()}>
            {submitting ? "Guardando…" : editing ? "Actualizar" : "Agregar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
