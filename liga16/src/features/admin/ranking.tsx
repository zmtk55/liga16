"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { RankingEntry, PlayerProfile } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
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
import { BarChart3, MoreHorizontal, Pencil, Plus, RotateCcw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminTableEmpty, AdminTableSkeleton } from "@/components/admin/table-state";

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

  async function handleReset(r: RankingEntry) {
    try {
      await db.updateRanking(r.player_id, { points: 0, played: 0, won: 0, delta: 0 });
      toast.success(`Ranking de "${r.player_name}" reiniciado`);
      load();
    } catch (e) {
      toast.error((e as Error).message ?? "Error al reiniciar");
    }
  }

  const dialogKey = editing?.player_id ?? "new";
  const [resetting, setResetting] = useState<RankingEntry | null>(null);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Ranking"
        description="Puntos, partidos jugados y variación de cada jugador."
        action={
          <Button size="sm" onClick={() => { setEditing(null); setOpenCreate(true); }}>
            <Plus className="h-4 w-4" /> Agregar jugador
          </Button>
        }
      />
      <Card>
        <CardContent className="overflow-x-auto p-0">
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
              {list === null && <AdminTableSkeleton columns={8} />}
              {list !== null && list.length === 0 && (
                <AdminTableEmpty
                  colSpan={8}
                  icon={<BarChart3 className="h-5 w-5" />}
                  title="No hay ranking todavía"
                  description="Agrega a un jugador para comenzar la clasificación."
                  action={
                    <Button size="sm" className="mt-4" onClick={() => { setEditing(null); setOpenCreate(true); }}>
                      Agregar jugador
                    </Button>
                  }
                />
              )}
              {list?.map((r) => (
                <TableRow key={r.player_id}>
                  <TableCell className="font-medium tabular-nums text-muted-foreground">{r.position}</TableCell>
                  <TableCell className="font-medium">{r.player_name}</TableCell>
                  <TableCell className="tabular-nums">{r.level.toFixed(1)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{r.points.toLocaleString("es-MX")}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.played}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.won}</TableCell>
                  <TableCell className={`text-right tabular-nums ${r.delta > 0 ? "text-emerald-600" : r.delta < 0 ? "text-destructive" : "text-muted-foreground"}`}>
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
                        <DropdownMenuItem
                          onClick={() => setResetting(r)}
                          className="text-destructive focus:text-destructive"
                        >
                          <RotateCcw className="h-4 w-4" /> Reiniciar puntos
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

      <ConfirmDialog
        open={!!resetting}
        onOpenChange={(o) => { if (!o) setResetting(null); }}
        onConfirm={() => resetting && handleReset(resetting)}
        title={`¿Reiniciar el ranking de ${resetting?.player_name ?? "este jugador"}?`}
        description="Puntos, partidos jugados, victorias y variación volverán a cero. Esta acción no se puede deshacer."
      />

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
