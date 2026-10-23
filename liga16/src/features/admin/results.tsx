"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { db } from "@/lib/data";
import type { Match, SetScore, Tournament } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { toast } from "sonner";
import type { MatchStatus } from "@/types";
import { FilterBar } from "@/components/ui/filter-bar";
import { DateTimePicker } from "@/components/ui/date-picker";
import { MatchScoreboard } from "@/components/match-scoreboard";
// MatchCard no longer used — pair rows use inline layout
import { matchBucket, matchState, type MatchBucket } from "@/lib/match-state";
import { AdminEmptyState } from "@/components/admin/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPageHeader, AdminStat, AdminStatStrip } from "@/components/admin/page-header";
import { AdminFacet, AdminFacets } from "@/components/admin/filter-facets";
import { countActive } from "@/lib/filters";
import { matchStatusLabel, SIN_CATEGORIA } from "@/lib/format";
import { categoryFacetOfValues } from "@/lib/categories";
import { jornadaKey, parseRound } from "@/lib/groups";
import {
  determineMatchWinner,
  normalizeScoring,
  validateScoring,
} from "@/lib/scoring";
import { ClipboardList, Eye, ChevronDown, ChevronUp, Calendar, MapPin, Trophy, Plus, Trash2 } from "lucide-react";

const STATUS_OPTIONS = Object.entries(matchStatusLabel).map(([value, label]) => ({ value, label }));

const BUCKET_LABEL: Record<MatchBucket, string> = {
  pending: "Por capturar",
  playing: "En curso",
  live: "En vivo",
  finished: "Terminados",
  disputed: "En disputa",
  walkover: "Walkover",
  cancelled: "Cancelado",
};

interface PairMatchView {
  pairName: string;
  tournamentId: string;
  tournamentName: string;
  categoryName: string;
  matches: Match[];
}

export default function AdminResults() {
  const [list, setList] = useState<Match[] | null>(null);
  const [tournaments, setTournaments] = useState<Record<string, Tournament>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedPairs, setExpandedPairs] = useState<Record<string, boolean>>({});

  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const setQuery = (v: string) => {
    const next = new URLSearchParams(params);
    if (!v) next.delete("q");
    else next.set("q", v);
    setParams(next, { replace: true });
  };
  const [fTournament, setFTournament] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fCategory, setFCategory] = useState("all");
  const [fRound, setFRound] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list ?? []).filter((m) => {
      if (
        q &&
        !`${m.tournament_name ?? ""} ${m.category_name ?? ""} ${m.round} ${m.side_a.pair_name} ${m.side_b.pair_name}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      if (fTournament !== "all" && m.tournament_id !== fTournament) return false;
      if (fStatus !== "all" && matchBucket(m) !== fStatus) return false;
      if (fCategory !== "all" && (m.category_name ?? "").toLowerCase() !== fCategory) return false;
      if (fRound !== "all" && jornadaKey(m.round) !== fRound) return false;
      return true;
    });
  }, [list, query, fTournament, fStatus, fCategory, fRound]);

  const facetas = useMemo(() => {
    const all = list ?? [];
    const estados = new Map<string, number>();
    for (const m of all) {
      const k = matchBucket(m);
      estados.set(k, (estados.get(k) ?? 0) + 1);
    }
    const estadoOptions = (Object.keys(BUCKET_LABEL) as MatchBucket[])
      .filter((s) => (estados.get(s) ?? 0) > 0)
      .map((s) => ({ key: s, label: BUCKET_LABEL[s], n: estados.get(s) ?? 0 }));
    const categorias = categoryFacetOfValues(all.map((m) => m.category_name));
    const rondas = new Map<string, number>();
    for (const m of all) {
      const r = jornadaKey(m.round);
      rondas.set(r, (rondas.get(r) ?? 0) + 1);
    }
    const rondaOptions = [...rondas.entries()]
      .map(([key, n]) => ({ key, label: key === "all" ? key : `Jornada ${key.slice(1)}`, n }))
      .sort((a, b) => Number(a.key.slice(1)) - Number(b.key.slice(1)));
    const porTorneo = new Map<string, number>();
    for (const m of all) porTorneo.set(m.tournament_id, (porTorneo.get(m.tournament_id) ?? 0) + 1);
    const torneoOptions = Object.entries(tournaments)
      .map(([id, t]) => ({ key: id, label: t.name, n: porTorneo.get(id) ?? 0 }))
      .filter((o) => o.n > 0)
      .sort((a, b) => b.n - a.n);
    return { estadoOptions, categoriaOptions: categorias, rondaOptions, torneoOptions };
  }, [list, tournaments]);

  /** Agrupa matches por PAREJA única (side_a o side_b) dentro del filtro */
  const pairViews = useMemo((): PairMatchView[] => {
    const map = new Map<string, PairMatchView>();
    for (const m of filtered) {
      for (const side of ["a", "b"] as const) {
        const pair = side === "a" ? m.side_a : m.side_b;
        const key = `${m.tournament_id}::${pair.pair_name}`;
        const existing = map.get(key);
        if (existing) {
          existing.matches.push(m);
        } else {
          map.set(key, {
            pairName: pair.pair_name,
            tournamentId: m.tournament_id,
            tournamentName: m.tournament_name ?? "Sin torneo",
            categoryName: m.category_name ?? SIN_CATEGORIA,
            matches: [m],
          });
        }
      }
    }
    const result = Array.from(map.values());
    // Ordenar cada lista de matches por ronda/fecha
    for (const pv of result) {
      pv.matches.sort((a, b) => {
        const ja = parseRound(a.round ?? "").jornada ?? 0;
        const jb = parseRound(b.round ?? "").jornada ?? 0;
        return ja - jb || String(a.scheduled_at ?? "").localeCompare(String(b.scheduled_at ?? ""));
      });
    }
    // Ordenar parejas: primero las que tienen partidos por capturar
    result.sort((a, b) => {
      const aPend = a.matches.filter((m) => matchBucket(m) === "pending").length;
      const bPend = b.matches.filter((m) => matchBucket(m) === "pending").length;
      return bPend - aPend || a.pairName.localeCompare(b.pairName);
    });
    return result;
  }, [filtered]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [matches, tList] = await Promise.all([db.listRecentMatches(), db.listTournaments()]);
      setList(matches);
      const map: Record<string, Tournament> = {};
      for (const t of tList) map[t.id] = t;
      setTournaments(map);
    } catch {
      toast.error("No se pudo cargar resultados");
    }
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
      const autoWinner = determineMatchWinner(form.sets, scoring);
      const manualWinner: Match["winner"] = form.winner === "a" || form.winner === "b" ? form.winner : null;
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

  const resumen = useMemo(() => {
    const all = list ?? [];
    const cuenta = (bucket: MatchBucket) => all.filter((m) => matchBucket(m) === bucket).length;
    return {
      total: all.length,
      porCapturar: cuenta("pending"),
      aMedias: cuenta("playing"),
      enJuego: cuenta("live"),
      terminados: cuenta("finished"),
    };
  }, [list]);

  const togglePair = (key: string) => {
    setExpandedPairs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getPairKey = (pv: PairMatchView) => `${pv.tournamentId}::${pv.pairName}`;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Resultados"
        description="Captura sets, juegos y tie-breaks de cada partido."
        action={
          resumen.porCapturar > 0 ? (
            <Button
              size="sm"
              variant="outline"
              aria-pressed={fStatus === "pending"}
              className={fStatus === "pending" ? "border-primary bg-primary text-primary-foreground hover:bg-primary-strong hover:text-primary-foreground" : undefined}
              onClick={() => setFStatus((s) => (s === "pending" ? "all" : "pending"))}
            >
              <ClipboardList className="h-4 w-4" />
              {resumen.porCapturar} por capturar
            </Button>
          ) : undefined
        }
      >
        <AdminStatStrip className="sm:grid-cols-5">
          <AdminStat value={resumen.total} label="Partidos" />
          <AdminStat value={resumen.porCapturar} label="Por capturar" tone={resumen.porCapturar > 0 ? "text-primary" : undefined} />
          <AdminStat value={resumen.aMedias} label="En curso" tone={resumen.aMedias > 0 ? "text-primary-strong" : undefined} />
          <AdminStat value={resumen.enJuego} label="En juego" tone={resumen.enJuego > 0 ? "text-destructive" : undefined} />
          <AdminStat value={resumen.terminados} label="Terminados" tone="text-success" />
        </AdminStatStrip>
      </AdminPageHeader>

      <Card>
        <CardHeader className="gap-3">
          <FilterBar
            search={query}
            onSearch={setQuery}
            searchPlaceholder="Buscar pareja o jugador…"
            resultCount={pairViews.length}
            resultLabel="parejas"
            activeCount={countActive(fStatus, fCategory, fRound, fTournament)}
            onClear={() => {
              setQuery("");
              setFStatus("all");
              setFCategory("all");
              setFRound("all");
              setFTournament("all");
            }}
          >
            <AdminFacets>
              <AdminFacet label="Estado" value={fStatus} onChange={setFStatus} options={facetas.estadoOptions} allLabel="Todos" />
              <AdminFacet label="Categoría" value={fCategory} onChange={setFCategory} options={facetas.categoriaOptions} allLabel="Todas" />
              <AdminFacet label="Jornada" value={fRound} onChange={setFRound} options={facetas.rondaOptions} allLabel="Todas" />
              <AdminFacet
                label="Torneo"
                value={fTournament}
                onChange={(v) => { setFTournament(v); setFCategory("all"); setFRound("all"); }}
                options={facetas.torneoOptions}
                allLabel="Todos"
              />
            </AdminFacets>
          </FilterBar>
        </CardHeader>

        <CardContent className="p-0">
          {list === null && (
            <div className="grid gap-3 lg:grid-cols-2 p-6">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          )}

          {list !== null && list.length === 0 && (
            <AdminEmptyState
              icon={<Trophy className="h-5 w-5" />}
              title="No hay resultados todavía"
              description="Los partidos se capturan desde la pestaña Jornada de cada torneo."
            />
          )}

          {list !== null && list.length > 0 && pairViews.length === 0 && (
            <AdminEmptyState
              icon={<Trophy className="h-5 w-5" />}
              title="Sin coincidencias"
              description="Ningún partido coincide con la búsqueda o el filtro."
              action={
                <Button variant="outline" size="sm" onClick={() => { setQuery(""); setFStatus("all"); setFCategory("all"); setFRound("all"); setFTournament("all"); }}>
                  Quitar filtros
                </Button>
              }
            />
          )}

          {pairViews.length > 0 && (
            <div className="space-y-2 p-4">
              {pairViews.map((pv) => {
                const key = getPairKey(pv);
                const isOpen = expandedPairs[key] ?? false;
                const pendingCount = pv.matches.filter((m) => matchBucket(m) === "pending").length;
                const playingCount = pv.matches.filter((m) => matchBucket(m) === "playing").length;
                const finishedCount = pv.matches.filter((m) => matchBucket(m) === "finished").length;

                return (
                  <div key={key} className="bg-card border rounded-xl overflow-hidden transition-shadow hover:shadow-md">
                    <button
                      onClick={() => togglePair(key)}
                      className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-expanded={isOpen}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{pv.pairName}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Trophy className="h-3 w-3" /> {pv.tournamentName}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="px-1.5 py-0.5 rounded-xs bg-muted text-muted-foreground">{pv.categoryName}</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {pendingCount > 0 && <Badge variant="default" className="text-xs">{pendingCount} por capturar</Badge>}
                        {playingCount > 0 && <Badge variant="secondary" className="text-xs">{playingCount} en curso</Badge>}
                        {finishedCount > 0 && <Badge variant="outline" className="text-xs">{finishedCount} finalizados</Badge>}
                        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t-2 border-primary/20 bg-card/40 divide-y divide-border/50">
                        {pv.matches.map((m) => {
                          const state = matchState(m);
                          const capturado = state === "finished";
                          const isSideA = m.side_a.pair_name === pv.pairName;
                          const opponent = isSideA ? m.side_b.pair_name : m.side_a.pair_name;
                          const roundLabel = parseRound(m.round ?? "");
                          const jornada = roundLabel.jornada ? `J${roundLabel.jornada}` : m.round;

                          return (
                            <div key={m.id} className="p-3 hover:bg-card transition-colors" style={{ minWidth: 0 }}>
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="text-sm font-medium truncate">{opponent}</span>
                                  <Badge
                                    variant={state === "live" ? "destructive" : state === "playing" ? "default" : "outline"}
                                    className={
                                      state === "finished"
                                        ? "bg-success text-success-foreground text-xs shrink-0"
                                        : "text-xs shrink-0"
                                    }
                                  >
                                    {state === "finished" ? "Finalizado" : state === "live" ? "En vivo" : state === "playing" ? "En curso" : "Por jugar"}
                                  </Badge>
                                </div>
                                <Button
                                  variant={capturado ? "ghost" : "default"}
                                  size="sm"
                                  className="h-7 shrink-0 gap-1.5 rounded-full px-3 text-xs"
                                  onClick={() => setEditingId(m.id)}
                                  aria-label={`${capturado ? "Ver" : "Capturar"} resultado vs ${opponent}`}
                                >
                                  {capturado ? <Eye className="h-3.5 w-3.5" /> : <ClipboardList className="h-3.5 w-3.5" />}
                                  {capturado ? "Ver" : "Capturar"}
                                </Button>
                                {editingId === m.id && <Badge variant="default" className="ml-1 animate-pulse text-xs">EDITANDO ↗</Badge>}
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                {m.scheduled_at && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(m.scheduled_at).toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "2-digit" })}
                                  </span>
                                )}
                                {m.court_name && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" /> {m.court_name}
                                  </span>
                                )}
                                <span className="font-medium tabular-nums">{jornada}</span>
                              </div>
                              {m.sets.length > 0 && (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  {m.sets.map((s, i) => {
                                    const aScore = isSideA ? (s.a ?? 0) : (s.b ?? 0);
                                    const bScore = isSideA ? (s.b ?? 0) : (s.a ?? 0);
                                    const won = aScore > bScore;
                                    const tb = isSideA ? s.tiebreak_a : s.tiebreak_b;
                                    const showTb = tb != null && (s.a ?? 0) === (s.b ?? 0);
                                    return (
                                      <div key={i} className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium border ${won ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"}`}>
                                        <span className="tabular-nums font-bold">{aScore}-{bScore}</span>
                                        <span className="text-caption opacity-80">{won ? "Ganó" : "Perdió"}</span>
                                        {showTb && <span className="text-caption opacity-70">TB {tb}</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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

interface SetInput { a: string; b: string; tiebreak_a: string; tiebreak_b: string; }
interface MatchFormData { tournament_id: string; status: string; round: string; court_name: string; scheduled_at: string; winner: string; sets: SetScore[]; }

function toSetInputs(sets: SetScore[]): SetInput[] {
  return sets.map((s) => ({ a: String(s.a ?? 0), b: String(s.b ?? 0), tiebreak_a: s.tiebreak_a != null ? String(s.tiebreak_a) : "", tiebreak_b: s.tiebreak_b != null ? String(s.tiebreak_b) : "" }));
}
function fromSetInputs(inputs: SetInput[]): SetScore[] {
  return inputs.map((s) => ({ a: Number(s.a) || 0, b: Number(s.b) || 0, tiebreak_a: s.tiebreak_a.trim() ? Number(s.tiebreak_a) : null, tiebreak_b: s.tiebreak_b.trim() ? Number(s.tiebreak_b) : null }));
}

function MatchEditDialog({ match, tournament, open, onOpenChange, onSave, submitting }: { match: Match; tournament: Tournament | undefined; open: boolean; onOpenChange: (open: boolean) => void; onSave: (id: string, data: MatchFormData) => void; submitting: boolean; }) {
  const scoring = normalizeScoring(tournament?.scoring);
  const [form, setForm] = useState<MatchFormData>(() => ({ tournament_id: match.tournament_id, status: match.status, round: match.round, court_name: match.court_name ?? "", scheduled_at: match.scheduled_at ? match.scheduled_at.slice(0, 16) : "", winner: match.winner ?? "", sets: match.sets.length > 0 ? match.sets : [{ a: 0, b: 0, tiebreak_a: null, tiebreak_b: null }] }));
  const [setInputs, setSetInputs] = useState<SetInput[]>(() => toSetInputs(form.sets));

  const update = (field: keyof MatchFormData, value: string) => setForm((f) => ({ ...f, [field]: value }));
  function updateSet(index: number, field: keyof SetInput, value: string) { setSetInputs((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))); }
  function addSet() { setSetInputs((prev) => [...prev, { a: "", b: "", tiebreak_a: "", tiebreak_b: "" }]); }
  function removeSet(index: number) { setSetInputs((prev) => prev.filter((_, i) => i !== index)); }

  const currentSets = fromSetInputs(setInputs);
  const winner = determineMatchWinner(currentSets, scoring);
  function submit() { onSave(match.id, { ...form, sets: currentSets }); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Editar resultado</DialogTitle>
          <DialogDescription>{match.side_a.pair_name} vs {match.side_b.pair_name} · {match.tournament_name}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="estado">Estado</Label><Select value={form.status} onValueChange={(v) => update("status", v)}><SelectTrigger id="estado"><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label htmlFor="ronda">Ronda</Label><Input id="ronda" value={form.round} onChange={(e) => update("round", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="cancha">Cancha</Label><Input id="cancha" value={form.court_name} onChange={(e) => update("court_name", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="fecha-y-hora">Fecha y hora</Label><DateTimePicker id="fecha-y-hora" value={form.scheduled_at} onChange={(v) => update("scheduled_at", v ?? "")} ariaLabel="Fecha y hora del partido" /></div>
          </div>
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">Sets</h3><p className="text-xs text-muted-foreground">{scoring.sets_to_win} de {scoring.sets_to_win * 2 - 1} sets · {scoring.games_per_set} juegos · tie-break a {scoring.tie_break_points} puntos</p></div><Button type="button" variant="outline" size="sm" onClick={addSet}><Plus className="h-4 w-4 mr-1" /> Añadir set</Button></div>
            {setInputs.map((set, i) => (
              <div key={i} className="rounded-lg bg-muted/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide">Set {i + 1}{i >= 2 && <span className="ml-2 text-xs font-normal normal-case text-warning-strong"> Super tie-break a 10 (dif. 2)</span>}</span>
                  {setInputs.length > 1 && <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSet(i)} aria-label={`Quitar set ${i + 1}`}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5"><p className="truncate text-xs font-bold text-primary" title={match.side_a.pair_name}>{match.side_a.pair_name}</p><Input type="text" inputMode="numeric" pattern="[0-9]*" aria-label={`Juegos de ${match.side_a.pair_name} en set ${i + 1}`} value={set.a} onChange={(e) => updateSet(i, "a", e.target.value.replace(/[^0-9]/g, ""))} /><Input type="text" inputMode="numeric" pattern="[0-9]*" aria-label={`Tie-break de ${match.side_a.pair_name} en set ${i + 1}`} placeholder="TB" className="h-8 text-xs" value={set.tiebreak_a} onChange={(e) => updateSet(i, "tiebreak_a", e.target.value.replace(/[^0-9]/g, ""))} /></div>
                  <div className="space-y-1.5"><p className="truncate text-xs font-bold text-foreground" title={match.side_b.pair_name}>{match.side_b.pair_name}</p><Input type="text" inputMode="numeric" pattern="[0-9]*" aria-label={`Juegos de ${match.side_b.pair_name} en set ${i + 1}`} value={set.b} onChange={(e) => updateSet(i, "b", e.target.value.replace(/[^0-9]/g, ""))} /><Input type="text" inputMode="numeric" pattern="[0-9]*" aria-label={`Tie-break de ${match.side_b.pair_name} en set ${i + 1}`} placeholder="TB" className="h-8 text-xs" value={set.tiebreak_b} onChange={(e) => updateSet(i, "tiebreak_b", e.target.value.replace(/[^0-9]/g, ""))} /></div>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">Caja grande = juegos ganados · TB = tie-break (solo 6-6)</p>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/5 p-3"><MatchScoreboard sideA={match.side_a.pair_name} sideB={match.side_b.pair_name} sets={currentSets} winner={winner} size="md" />{winner ? <Badge variant="default">Ganador: {winner === "a" ? match.side_a.pair_name : match.side_b.pair_name}</Badge> : <Badge variant="outline">Aún no hay ganador</Badge>}</div>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="ganador-manual-opcional">Ganador manual (opcional)</Label><Select value={form.winner || "none"} onValueChange={(v) => update("winner", v === "none" ? "" : v)}><SelectTrigger id="ganador-manual-opcional"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Automático por sets</SelectItem><SelectItem value="a">{match.side_a.pair_name}</SelectItem><SelectItem value="b">{match.side_b.pair_name}</SelectItem></SelectContent></Select></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={submit} disabled={submitting}>{submitting ? "Guardando…" : "Guardar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}