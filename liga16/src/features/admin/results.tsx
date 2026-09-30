"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/data";
import type { Match, SetScore, Tournament } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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
import { FilterBar } from "@/components/ui/filter-bar";
import { DateTimePicker } from "@/components/ui/date-picker";
import { MatchScoreboard } from "@/components/match-scoreboard";
import { AdminPageHeader, AdminStat, AdminStatStrip } from "@/components/admin/page-header";
import { AdminTableEmpty, AdminTableSkeleton } from "@/components/admin/table-state";
import { MatchStatusBadge } from "@/components/admin/status-badge";
import { matchStatusLabel } from "@/lib/format";
import {
  determineMatchWinner,
  normalizeScoring,
  validateScoring,
} from "@/lib/scoring";
import { ClipboardList, Plus, Trash2, Trophy } from "lucide-react";

const STATUS_OPTIONS = Object.entries(matchStatusLabel).map(([value, label]) => ({ value, label }));

/** "Emilio Garza / Ricardo Anaya" → "Garza / Anaya" — para cabeceras compactas. */
function shortPairName(pairName: string): string {
  return pairName
    .split("/")
    .map((s) => (s.trim().split(" ").pop() ?? s.trim()) || "?")
    .join(" / ");
}

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

      // El ganador automático (por sets) manda; el manual sólo aplica si los
      // sets no definen ganador. Nunca guardar "" como winner.
      const autoWinner = determineMatchWinner(form.sets, scoring);
      const manualWinner: Match["winner"] =
        form.winner === "a" || form.winner === "b" ? form.winner : null;
      await db.updateMatch(id, {
        status: form.status as MatchStatus,
        round: form.round,
        court_name: form.court_name,
        scheduled_at: form.scheduled_at || undefined,
        winner: autoWinner ?? manualWinner,
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

  /**
   * Cifras de cabecera. Lo que importa en esta pantalla es el trabajo que
   * falta: partidos sin capturar y partidos en juego. Lo terminado es contexto.
   */
  const resumen = useMemo(() => {
    const all = list ?? [];
    return {
      total: all.length,
      porCapturar: all.filter((m) => m.status === "scheduled").length,
      enJuego: all.filter((m) => m.status === "live").length,
      terminados: all.filter((m) => m.status === "finished").length,
    };
  }, [list]);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Resultados"
        description="Captura sets, juegos y tie-breaks de cada partido."
        action={
          resumen.porCapturar > 0 ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFStatus((s) => (s === "scheduled" ? "all" : "scheduled"))}
            >
              <ClipboardList className="h-4 w-4" />
              {resumen.porCapturar} por capturar
            </Button>
          ) : undefined
        }
      >
        <AdminStatStrip>
          <AdminStat value={resumen.total} label="Partidos" />
          <AdminStat
            value={resumen.porCapturar}
            label="Por capturar"
            tone={resumen.porCapturar > 0 ? "text-primary" : undefined}
          />
          <AdminStat
            value={resumen.enJuego}
            label="En juego"
            tone={resumen.enJuego > 0 ? "text-destructive" : undefined}
          />
          <AdminStat value={resumen.terminados} label="Terminados" tone="text-success" />
        </AdminStatStrip>
      </AdminPageHeader>
      <Card>
        <CardHeader className="gap-3">
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
                className: "sm:w-52",
              },
              {
                key: "status",
                ariaLabel: "Filtrar por estado",
                allLabel: "Todos los estados",
                value: fStatus,
                onChange: setFStatus,
                options: STATUS_OPTIONS,
                className: "sm:w-44",
              },
            ]}
            resultCount={filtered.length}
            resultLabel="partidos"
            onClear={() => { setQuery(""); setFTournament("all"); setFStatus("all"); }}
          />
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partido</TableHead>
                <TableHead className="hidden sm:table-cell">Torneo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list === null && <AdminTableSkeleton columns={4} />}
              {list !== null && list.length === 0 && (
                <AdminTableEmpty
                  colSpan={4}
                  icon={<Trophy className="h-5 w-5" />}
                  title="No hay resultados todavía"
                  description="Los partidos se capturan desde la pestaña Jornada de cada torneo."
                />
              )}
              {list !== null && list.length > 0 && filtered.length === 0 && (
                <AdminTableEmpty
                  colSpan={4}
                  title="Sin coincidencias"
                  description="Ningún partido coincide con la búsqueda o el filtro."
                />
              )}
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  {/* SIEMPRE se ve quién juega contra quién */}
                  <TableCell>
                    <div className="min-w-0">
                      <p className="mb-1 truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:hidden">
                        {m.tournament_name}{m.round ? ` · ${m.round}` : ""}
                      </p>
                      <p className={cn("truncate text-sm font-semibold", m.winner === "a" && "text-success")}>
                        {m.side_a.pair_name}
                      </p>
                      <p className="my-0.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">vs</p>
                      <p className={cn("truncate text-sm font-semibold", m.winner === "b" && "text-success")}>
                        {m.side_b.pair_name}
                      </p>
                      {(m.status === "finished" || m.status === "live") && m.sets.length > 0 && (
                        <div className="mt-1.5">
                          <MatchScoreboard
                            sideA={m.side_a.pair_name}
                            sideB={m.side_b.pair_name}
                            sets={m.sets}
                            winner={m.winner}
                            status={m.status}
                            size="sm"
                          />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <p className="font-medium">{m.tournament_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[m.category_name, m.round].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <MatchStatusBadge status={m.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setEditingId(m.id)} aria-label={`Editar resultado de ${m.side_a.pair_name} vs ${m.side_b.pair_name}`}>
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
              <Label htmlFor="estado">Estado</Label>
              <Select value={form.status} onValueChange={(v) => update("status", v)}>
                <SelectTrigger id="estado"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ronda">Ronda</Label>
              <Input id="ronda" value={form.round} onChange={(e) => update("round", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cancha">Cancha</Label>
              <Input id="cancha" value={form.court_name} onChange={(e) => update("court_name", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fecha-y-hora">Fecha y hora</Label>
              <DateTimePicker id="fecha-y-hora"
                value={form.scheduled_at}
                onChange={(v) => update("scheduled_at", v ?? "")}
                ariaLabel="Fecha y hora del partido"
              />
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
              <div key={i} className="rounded-lg bg-muted/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    Set {i + 1}
                    {i >= 2 && (
                      <span className="ml-2 text-[10px] font-normal normal-case text-amber-600 dark:text-amber-400">
                        Super tie-break a 10 (dif. 2)
                      </span>
                    )}
                  </span>
                  {setInputs.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSet(i)} aria-label={`Quitar set ${i + 1}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {/* Columnas con el nombre real de cada pareja: siempre se sabe de quién es cada número */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <p className="truncate text-xs font-bold text-primary" title={match.side_a.pair_name}>{shortPairName(match.side_a.pair_name)}</p>
                    <Input type="number" min={0} aria-label={`Juegos de ${match.side_a.pair_name} en set ${i + 1}`} value={set.a} onChange={(e) => updateSet(i, "a", e.target.value)} />
                    <Input type="number" min={0} aria-label={`Tie-break de ${match.side_a.pair_name} en set ${i + 1}`} placeholder="TB" className="h-8 text-xs" value={set.tiebreak_a} onChange={(e) => updateSet(i, "tiebreak_a", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <p className="truncate text-xs font-bold text-foreground" title={match.side_b.pair_name}>{shortPairName(match.side_b.pair_name)}</p>
                    <Input type="number" min={0} aria-label={`Juegos de ${match.side_b.pair_name} en set ${i + 1}`} value={set.b} onChange={(e) => updateSet(i, "b", e.target.value)} />
                    <Input type="number" min={0} aria-label={`Tie-break de ${match.side_b.pair_name} en set ${i + 1}`} placeholder="TB" className="h-8 text-xs" value={set.tiebreak_b} onChange={(e) => updateSet(i, "tiebreak_b", e.target.value)} />
                  </div>
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">Caja grande = juegos ganados · TB = tie-break (solo 6-6)</p>
              </div>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/5 p-3">
              <MatchScoreboard
                sideA={match.side_a.pair_name}
                sideB={match.side_b.pair_name}
                sets={currentSets}
                winner={winner}
                size="md"
              />
              {winner ? (
                <Badge variant="default">
                  Ganador: {shortPairName(winner === "a" ? match.side_a.pair_name : match.side_b.pair_name)}
                </Badge>
              ) : (
                <Badge variant="outline">Aún no hay ganador</Badge>
              )}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="ganador-manual-opcional">Ganador manual (opcional)</Label>
            <Select value={form.winner || "none"} onValueChange={(v) => update("winner", v === "none" ? "" : v)}>
              <SelectTrigger id="ganador-manual-opcional"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Automático por sets</SelectItem>
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
