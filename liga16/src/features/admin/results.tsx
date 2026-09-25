"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { Match, SetScore, Tournament } from "@/types";
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
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import type { MatchStatus } from "@/types";
import { FilterBar } from "@/components/ui/filter-bar";
import {
  determineMatchWinner,
  formatMatchScore,
  normalizeScoring,
  validateScoring,
} from "@/lib/scoring";
import { Plus, Trash2, Trophy } from "lucide-react";

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
  const [tournaments, setTournaments] = useState<Record<string, Tournament>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Filtros
  const [query, setQuery] = useState("");
  const [fTournament, setFTournament] = useState("all");
  const [fStatus, setFStatus] = useState("all");

  const filtered = (list ?? []).filter((m) => {
    const q = query.trim().toLowerCase();
    if (q && !`${m.tournament_name} ${m.round} ${m.side_a.pair_name} ${m.side_b.pair_name}`.toLowerCase().includes(q)) return false;
    if (fTournament !== "all" && m.tournament_id !== fTournament) return false;
    if (fStatus !== "all" && m.status !== fStatus) return false;
    return true;
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [matches, tList] = await Promise.all([db.listRecentMatches(), db.listTournaments()]);
    setList(matches);
    const map: Record<string, Tournament> = {};
    for (const t of tList) map[t.id] = t;
    setTournaments(map);
  }

  async function handleSave(id: string, form: MatchFormData) {
    setSubmitting(true);
    try {
      const tournament = tournaments[form.tournament_id];
      const scoring = normalizeScoring(tournament?.scoring);
      const validation = validateScoring(form.sets, scoring);
      if (validation) {
        toast.error(validation);
        setSubmitting(false);
        return;
      }

      const winner = determineMatchWinner(form.sets, scoring);
      await db.updateMatch(id, {
        status: form.status as MatchStatus,
        round: form.round,
        court_name: form.court_name,
        scheduled_at: form.scheduled_at || undefined,
        winner: winner ?? (form.winner as Match["winner"]) ?? undefined,
        sets: form.sets,
      });
      toast.success("Partido actualizado");
      setEditingId(null);
      load();
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
        <h1 className="text-2xl font-bold tracking-tight">Resultados</h1>
        <p className="text-sm text-muted-foreground">Gestiona resultados con sets, juegos y tie-breaks</p>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm">Resultados</CardTitle>
            <FilterBar
              search={query}
              onSearch={setQuery}
              searchPlaceholder="Buscar equipo, torneo o ronda…"
              selects={[
                {
                  key: "tournament",
                  ariaLabel: "Filtrar por torneo",
                  allLabel: "Todos los torneos",
                  value: fTournament,
                  onChange: setFTournament,
                  options: Object.entries(tournaments).map(([id, t]) => ({ value: id, label: t.name })),
                  className: "w-52",
                },
                {
                  key: "status",
                  ariaLabel: "Filtrar por estado",
                  allLabel: "Todos los estados",
                  value: fStatus,
                  onChange: setFStatus,
                  options: STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label })),
                  className: "w-40",
                },
              ]}
              resultCount={filtered.length}
              resultLabel="de"
              onClear={() => { setQuery(""); setFTournament("all"); setFStatus("all"); }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Torneo</TableHead>
                <TableHead className="hidden sm:table-cell">Categoría</TableHead>
                <TableHead className="hidden md:table-cell">Ronda</TableHead>
                <TableHead>Marcador</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list !== null && list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="p-0">
                    <Empty className="py-8">
                      <EmptyHeader>
                        <EmptyTitle>No hay resultados todavía</EmptyTitle>
                        <EmptyDescription>Captúralos desde el calendario de cada torneo (pestaña Jornada).</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.tournament_name}</TableCell>
                  <TableCell className="hidden sm:table-cell">{m.category_name}</TableCell>
                  <TableCell className="hidden md:table-cell">{m.round}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {formatMatchScore(m.sets, tournaments[m.tournament_id]?.scoring ?? undefined)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.status === "finished" ? "default" : m.status === "live" ? "destructive" : "outline"}>
                      {STATUS_OPTIONS.find((s) => s.value === m.status)?.label ?? m.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(m.id)} aria-label={`Editar resultado de ${m.side_a.pair_name} vs ${m.side_b.pair_name}`}>
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
          tournament={tournaments[editingMatch.tournament_id]}
          open={!!editingId}
          onOpenChange={(o) => { if (!o) setEditingId(null); }}
          onSave={handleSave}
          submitting={submitting}
        />
      )}
    </div>
  );
}

interface SetInput {
  a: string;
  b: string;
  tiebreak_a: string;
  tiebreak_b: string;
}

interface MatchFormData {
  tournament_id: string;
  status: string;
  round: string;
  court_name: string;
  scheduled_at: string;
  winner: string;
  sets: SetScore[];
}

function toSetInputs(sets: SetScore[]): SetInput[] {
  return sets.map((s) => ({
    a: String(s.a ?? 0),
    b: String(s.b ?? 0),
    tiebreak_a: s.tiebreak_a != null ? String(s.tiebreak_a) : "",
    tiebreak_b: s.tiebreak_b != null ? String(s.tiebreak_b) : "",
  }));
}

function fromSetInputs(inputs: SetInput[]): SetScore[] {
  return inputs.map((s) => ({
    a: Number(s.a) || 0,
    b: Number(s.b) || 0,
    tiebreak_a: s.tiebreak_a.trim() ? Number(s.tiebreak_a) : null,
    tiebreak_b: s.tiebreak_b.trim() ? Number(s.tiebreak_b) : null,
  }));
}

function MatchEditDialog({
  match,
  tournament,
  open,
  onOpenChange,
  onSave,
  submitting,
}: {
  match: Match;
  tournament: Tournament | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: MatchFormData) => void;
  submitting: boolean;
}) {
  const scoring = normalizeScoring(tournament?.scoring);
  const [form, setForm] = useState<MatchFormData>(() => ({
    tournament_id: match.tournament_id,
    status: match.status,
    round: match.round,
    court_name: match.court_name ?? "",
    scheduled_at: match.scheduled_at ? match.scheduled_at.slice(0, 16) : "",
    winner: match.winner ?? "",
    sets: match.sets.length > 0 ? match.sets : [{ a: 0, b: 0, tiebreak_a: null, tiebreak_b: null }],
  }));
  const [setInputs, setSetInputs] = useState<SetInput[]>(() => toSetInputs(form.sets));

  const update = (field: keyof MatchFormData, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  function updateSet(index: number, field: keyof SetInput, value: string) {
    setSetInputs((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  function addSet() {
    setSetInputs((prev) => [...prev, { a: "", b: "", tiebreak_a: "", tiebreak_b: "" }]);
  }

  function removeSet(index: number) {
    setSetInputs((prev) => prev.filter((_, i) => i !== index));
  }

  const currentSets = fromSetInputs(setInputs);
  const winner = determineMatchWinner(currentSets, scoring);
  const scorePreview = formatMatchScore(currentSets, scoring);

  function submit() {
    onSave(match.id, { ...form, sets: currentSets });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Editar resultado</DialogTitle>
          <DialogDescription>
            {match.side_a.pair_name} vs {match.side_b.pair_name} · {match.tournament_name}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
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

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Sets</h3>
                <p className="text-xs text-muted-foreground">
                  {scoring.sets_to_win} de {scoring.sets_to_win * 2 - 1} sets · {scoring.games_per_set} juegos · tie-break a {scoring.tie_break_points} puntos
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addSet}>
                <Plus className="h-4 w-4 mr-1" /> Añadir set
              </Button>
            </div>

            {setInputs.map((set, i) => (
              <div key={i} className="grid gap-3 rounded-lg bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Set {i + 1}</span>
                  {setInputs.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSet(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Juegos A</Label>
                    <Input type="number" min={0} value={set.a} onChange={(e) => updateSet(i, "a", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Juegos B</Label>
                    <Input type="number" min={0} value={set.b} onChange={(e) => updateSet(i, "b", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tie A</Label>
                    <Input type="number" min={0} placeholder="TB" value={set.tiebreak_a} onChange={(e) => updateSet(i, "tiebreak_a", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tie B</Label>
                    <Input type="number" min={0} placeholder="TB" value={set.tiebreak_b} onChange={(e) => updateSet(i, "tiebreak_b", e.target.value)} />
                  </div>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between rounded-lg bg-primary/5 p-3">
              <div className="text-sm">
                <span className="text-muted-foreground">Marcador:</span>{" "}
                <span className="font-mono font-medium">{scorePreview}</span>
              </div>
              {winner ? (
                <Badge variant="default">
                  Ganador: {winner === "a" ? match.side_a.pair_name : match.side_b.pair_name}
                </Badge>
              ) : (
                <Badge variant="outline">Aún no hay ganador</Badge>
              )}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Ganador manual (opcional)</Label>
            <Select value={form.winner} onValueChange={(v) => update("winner", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Automático por sets</SelectItem>
                <SelectItem value="a">{match.side_a.pair_name}</SelectItem>
                <SelectItem value="b">{match.side_b.pair_name}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
