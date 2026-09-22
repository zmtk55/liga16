"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { Match } from "@/types";
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
import { toast } from "sonner";
import type { MatchStatus } from "@/types";

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Programado" },
  { value: "live", label: "En vivo" },
  { value: "finished", label: "Terminado" },
  { value: "walkover", label: "Walkover" },
  { value: "disputed", label: "Disputado" },
  { value: "cancelled", label: "Cancelado" },
];

export default function AdminResults() {
  const [list, setList] = useState<Match[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    db.listRecentMatches().then(setList);
  }, []);

  async function handleSave(id: string, form: MatchFormData) {
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 400));
      await db.updateMatch(id, {
        status: form.status as MatchStatus,
        round: form.round,
        court_name: form.court_name,
        scheduled_at: form.scheduled_at || undefined,
        winner: form.winner as Match["winner"] || undefined,
        sets: form.sets_a ? [{ a: Number(form.sets_a), b: Number(form.sets_b ?? 0) }] : [],
      });
      toast.success("Partido actualizado");
      setEditingId(null);
      db.listRecentMatches().then(setList);
    } catch (e) {
      toast.error((e as Error).message ?? "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  }

  const editingMatch = list?.find((m) => m.id === editingId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Resultados</h2>
        <p className="text-sm text-muted-foreground">Gestiona el estado de los partidos</p>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Últimos partidos</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Torneo</TableHead>
                <TableHead className="hidden sm:table-cell">Categoría</TableHead>
                <TableHead className="hidden md:table-cell">Ronda</TableHead>
                <TableHead className="hidden md:table-cell">Cancha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list?.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.tournament_name}</TableCell>
                  <TableCell className="hidden sm:table-cell">{m.category_name}</TableCell>
                  <TableCell className="hidden md:table-cell">{m.round}</TableCell>
                  <TableCell className="hidden md:table-cell">{m.court_name}</TableCell>
                  <TableCell>
                    <Badge variant={m.status === "finished" ? "default" : m.status === "live" ? "destructive" : "outline"}>
                      {STATUS_OPTIONS.find((s) => s.value === m.status)?.label ?? m.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(m.id)}>
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editingMatch && (
        <MatchEditDialog
          match={editingMatch}
          open={!!editingId}
          onOpenChange={(o) => { if (!o) setEditingId(null); }}
          onSave={handleSave}
          submitting={submitting}
        />
      )}
    </div>
  );
}

interface MatchFormData {
  status: string;
  round: string;
  court_name: string;
  scheduled_at: string;
  winner: string;
  sets_a: string;
  sets_b: string;
}

function MatchEditDialog({
  match,
  open,
  onOpenChange,
  onSave,
  submitting,
}: {
  match: Match;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: MatchFormData) => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState<MatchFormData>(() => ({
    status: match.status,
    round: match.round,
    court_name: match.court_name ?? "",
    scheduled_at: match.scheduled_at ? match.scheduled_at.slice(0, 16) : "",
    winner: match.winner ?? "",
    sets_a: match.sets.length > 0 ? String(match.sets[0].a) : "",
    sets_b: match.sets.length > 0 ? String(match.sets[0].b) : "",
  }));

  const update = (field: keyof MatchFormData, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar resultado</DialogTitle>
          <DialogDescription>
            {match.side_a?.pair_name ?? "Partido"} — {match.tournament_name}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => update("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Ronda</Label>
              <Input value={form.round} onChange={(e) => update("round", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Cancha</Label>
              <Input value={form.court_name} onChange={(e) => update("court_name", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Fecha y hora</Label>
              <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => update("scheduled_at", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Sets A</Label>
              <Input type="number" value={form.sets_a} onChange={(e) => update("sets_a", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Sets B</Label>
              <Input type="number" value={form.sets_b} onChange={(e) => update("sets_b", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Ganador</Label>
              <Select value={form.winner} onValueChange={(v) => update("winner", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">TBD</SelectItem>
                  <SelectItem value="a">Equipo A</SelectItem>
                  <SelectItem value="b">Equipo B</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSave(match.id, form)} disabled={submitting}>
            {submitting ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
