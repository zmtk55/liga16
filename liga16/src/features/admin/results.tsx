"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScoreGrid } from "@/components/admin/score-grid";
import { isoToLocalInput, localInputToIso } from "@/lib/datetime";
import SlotPicker, { type SlotDay } from "@/components/kokonutui/slot-picker";
import { effectiveDurationMinutes } from "@/lib/match-duration";
import { cn } from "@/lib/utils";
import { AdminLoadFailed } from "@/components/admin/empty-state";
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
// MatchCard no longer used — pair rows use inline layout
import { matchBucket, matchState, type MatchBucket } from "@/lib/match-state";
import { historicTieBreakNote, captureRowToSet, isMatchDecided, isSuperTieBreakRow, maxSetsForMatch, setToCaptureRow, tieBreakDirectNotation } from "@/lib/match-result";
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
  SUPER_TIEBREAK_POINTS,
  validateScoring,
} from "@/lib/scoring";
import { ClipboardList, Eye, ChevronDown, ChevronUp, Calendar, MapPin, Trophy } from "lucide-react";

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

  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    try {
      const [matches, tList] = await Promise.all([db.listRecentMatches(), db.listTournaments()]);
      setList(matches);
      const map: Record<string, Tournament> = {};
      for (const t of tList) map[t.id] = t;
      setTournaments(map);
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error)?.message || "Error al cargar los partidos");
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
        scheduled_at: localInputToIso(form.scheduled_at),
        winner: autoWinner ?? manualWinner,
        sets: form.sets,
      });
      // La duración viaja aparte: la columna duration_minutes puede no existir
      // todavía (supabase/match-duration.sql). Si falta, no se rompe el
      // guardado del resto del partido; solo se avisa.
      const dur = Number(form.duration);
      if (dur > 0) {
        const durSaved = await db.saveMatchDuration(id, dur);
        if (!durSaved) toast.warning("El partido se guardó, pero la duración no: falta aplicar la migración de la base (supabase/match-duration.sql).");
      }
      toast.success("Partido actualizado");
      // Sin ganador (automático ni manual) el partido queda programado y el
      // ranking no lo cuenta: mejor decirlo que dejarlo "guardado" en silencio.
      if (autoWinner == null && manualWinner == null && form.sets.some((st) => (st.a ?? 0) + (st.b ?? 0) > 0)) {
        toast.warning("El marcador todavía no cierra el partido: sigue programado y no mueve el ranking. Si ya terminó, elige el ganador en Ganador manual.");
      }
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

  if (loadError && list === null) {
    return (
      <AdminLoadFailed
        title="Resultados"
        description="Captura sets, juegos y tie-breaks de cada partido."
        what="los partidos"
        message={loadError}
        onRetry={() => { load(); }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Resultados"
        description="Captura sets, juegos y tie-breaks de cada partido."
      >
        <AdminStatStrip loading={list === null}>
          <AdminStat value={resumen.total} label="Partidos" />
          <AdminStat value={resumen.porCapturar} label="Por capturar" tone={resumen.porCapturar > 0 ? "text-primary" : undefined} />
          <AdminStat value={resumen.aMedias} label="En curso" tone={resumen.aMedias > 0 ? "text-primary-strong" : undefined} />
          <AdminStat value={resumen.enJuego} label="En juego" tone={resumen.enJuego > 0 ? "text-destructive" : undefined} />
          <AdminStat value={resumen.terminados} label="Terminados" tone="text-success" />
        </AdminStatStrip>
      </AdminPageHeader>

      <Card className="rounded-3xl border-0 bg-transparent shadow-none">
        <CardHeader className="gap-3 px-0">
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
            <div className="grid items-start gap-4 p-0 xl:grid-cols-2">
              {pairViews.map((pv) => {
                const key = getPairKey(pv);
                const isOpen = expandedPairs[key] ?? false;
                const pendingCount = pv.matches.filter((m) => matchBucket(m) === "pending").length;
                const playingCount = pv.matches.filter((m) => matchBucket(m) === "playing").length;
                const finishedCount = pv.matches.filter((m) => matchBucket(m) === "finished").length;

                return (
                  <div key={key} className="bg-card border rounded-3xl overflow-hidden transition-shadow hover:shadow-md">
                    <button
                      onClick={() => togglePair(key)}
                      className="w-full flex flex-col items-start justify-between gap-4 p-6 sm:flex-row text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-expanded={isOpen}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-xl font-semibold break-words">{pv.pairName}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Trophy className="h-3 w-3" /> {pv.tournamentName}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="px-1.5 py-0.5 rounded-xs bg-muted text-muted-foreground">{pv.categoryName}</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
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
          allMatches={list ?? []}
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

interface SetInput { a: string; b: string; }
interface MatchFormData { tournament_id: string; status: string; round: string; court_name: string; scheduled_at: string; duration: string; winner: string; sets: SetScore[]; }

function toSetInputs(sets: SetScore[], scoring: ReturnType<typeof normalizeScoring>): SetInput[] {
  // Estilo Excel: juegos por set (7-6 directo) y super tie-break en puntos.
  return sets.map((s, i) => setToCaptureRow(s, isSuperTieBreakRow(i, scoring)));
}
function fromSetInputs(inputs: SetInput[], originalSets: SetScore[]): SetScore[] {
  return inputs.map((s, i) => captureRowToSet(s, originalSets[i]));
}

function MatchEditDialog({ match, allMatches, tournament, open, onOpenChange, onSave, submitting }: { match: Match; allMatches: Match[]; tournament: Tournament | undefined; open: boolean; onOpenChange: (open: boolean) => void; onSave: (id: string, data: MatchFormData) => void; submitting: boolean; }) {
  const scoring = normalizeScoring(tournament?.scoring);
  const tbDirect = tieBreakDirectNotation(scoring);
  // Sin duración registrada se asume la del torneo (schedule_config) o 60:
  // es un supuesto visible, no un dato histórico.
  const defaultMinutes = tournament?.schedule_config?.minutesPerMatch || 60;
  const [form, setForm] = useState<MatchFormData>(() => ({ tournament_id: match.tournament_id, status: match.status, round: match.round, court_name: match.court_name ?? "", scheduled_at: isoToLocalInput(match.scheduled_at), duration: String(match.duration_minutes ?? defaultMinutes), winner: match.winner ?? "", sets: match.sets.length > 0 ? match.sets : [{ a: 0, b: 0, tiebreak_a: null, tiebreak_b: null }] }));
  const [setInputs, setSetInputs] = useState<SetInput[]>(() => toSetInputs(form.sets, scoring));
  const [showSlots, setShowSlots] = useState(false);

  const update = (field: keyof MatchFormData, value: string) => setForm((f) => ({ ...f, [field]: value }));
  function updateSet(index: number, field: keyof SetInput, value: string) { setSetInputs((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))); }
  function addSet() { setSetInputs((prev) => [...prev, { a: "", b: "" }]); }
  function removeSet(index: number) { setSetInputs((prev) => prev.filter((_, i) => i !== index)); }

  // Huecos libres para el slot-picker de Kokonut: proximos 7 dias, ventana
  // visible 9:00-21:00 (el sorteo arranca jornadas a las 9), ocupados = los
  // demas partidos de esa cancha ese dia. Cada bloque ocupado dura lo que
  // diga duration_minutes del partido; los que no la tienen registrada se
  // toman como defaultMinutes (supuesto visible, no dato historico).
  const slotDays: SlotDay[] = useMemo(() => {
    const court = form.court_name.trim();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const busy: [number, number][] = [];
      for (const m of allMatches) {
        if (m.id === match.id || !m.scheduled_at) continue;
        if (court !== "" && (m.court_name ?? "") !== court) continue;
        const t = new Date(m.scheduled_at);
        const dayKey = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
        if (dayKey !== date) continue;
        const start = t.getHours() * 60 + t.getMinutes();
        busy.push([start, start + effectiveDurationMinutes(m, defaultMinutes)]);
      }
      return { date, open: [9 * 60, 21 * 60] as [number, number], busy };
    });
  }, [allMatches, form.court_name, match.id, defaultMinutes]);

  const currentSets = fromSetInputs(setInputs, form.sets);
  const winner = determineMatchWinner(currentSets, scoring);
  // Igual que en Jornada: con el partido definido (o el máximo de sets),
  // "Añadir set" solo lleva al error "Hay sets de más…" al guardar.
  const maxSets = maxSetsForMatch(scoring);
  const decided = isMatchDecided(currentSets, scoring);
  function submit() { onSave(match.id, { ...form, sets: currentSets }); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto grid-cols-[minmax(0,1fr)]">
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="duracion">Duración</Label>
              <Select value={form.duration} onValueChange={(v) => update("duration", v)}><SelectTrigger id="duracion"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="60">1 hora</SelectItem><SelectItem value="90">1 hora y media</SelectItem></SelectContent></Select>
              {match.duration_minutes == null && (
                <p className="text-xs text-muted-foreground">Sin duración registrada: los cruces la suponen de {defaultMinutes} min hasta que la guardes.</p>
              )}
            </div>
          </div>
          <Collapsible open={showSlots} onOpenChange={setShowSlots} className="grid gap-1.5">
            <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-start gap-2"
              aria-expanded={showSlots}
            >
              <Calendar className="h-4 w-4" />
              Explorar horarios en calendario
              <ChevronDown className={cn("h-4 w-4 transition-transform", showSlots && "rotate-180")} />
            </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="grid gap-1.5">
              <>
                <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  Ventana de exploración 9:00-21:00 en bloques de 60 o 90 min (hay partidos de hora y media). Solo marca cruces con partidos ya registrados{form.court_name.trim() ? " en esta cancha" : ""}: cada uno ocupa su duración registrada, y los que no la tienen se suponen de {defaultMinutes} min. No es disponibilidad confirmada de la sede. Al confirmar un hueco solo se llenan Fecha y hora y Duración: nada se guarda hasta Guardar.
                </p>
                <SlotPicker
                  className="max-w-none"
                  days={slotDays}
                  durations={[60, 90]}
                  timezone="America/Hermosillo"
                  host={{ name: form.court_name.trim() || "Cancha por definir", city: tournament?.city }}
                  onBook={({ date, start, minutes }) => {
                    update("scheduled_at", `${date}T${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`);
                    update("duration", String(minutes));
                  }}
                />
              </>
            </CollapsibleContent>
          </Collapsible>
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">Sets</h3><p className="text-xs text-muted-foreground">{scoring.sets_to_win} de {scoring.sets_to_win * 2 - 1} sets · {scoring.games_per_set} juegos · {tbDirect ? `tie-break a ${scoring.tie_break_points} puntos` : "sin tie-break de set"}</p></div></div>
            <ScoreGrid
              sideA={match.side_a.pair_name}
              sideB={match.side_b.pair_name}
              rows={setInputs}
              superTbIndex={(i) => isSuperTieBreakRow(i, scoring)}
              superTbTo={SUPER_TIEBREAK_POINTS}
              notes={setInputs.map((r, i) => historicTieBreakNote(match.sets[i], r, isSuperTieBreakRow(i, scoring)))}
              hint={tbDirect ? `Juegos por set. Si hubo tie-break, anota ${tbDirect}.` : "Juegos por set. Sin tie-break: anota los juegos tal cual."}
              onChange={(i, side, v) => updateSet(i, side, v)}
              onRemove={removeSet}
              onAdd={addSet}
              addLabel={setInputs.length === maxSets - 1 && maxSets > 1 ? "Super tie-break" : "Set"}
              canAdd={!(setInputs.length >= maxSets || decided)}
            />
            {decided && <p className="text-xs text-muted-foreground">El partido ya quedó definido con estos sets: no hace falta capturar más.</p>}
            <div className="flex">{winner ? <Badge variant="default" className="h-auto max-w-full whitespace-normal text-left">Ganador: {winner === "a" ? match.side_a.pair_name : match.side_b.pair_name}</Badge> : <Badge variant="outline">Aún no hay ganador</Badge>}</div>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="ganador-manual-opcional">Ganador manual (opcional)</Label><Select value={form.winner || "none"} onValueChange={(v) => update("winner", v === "none" ? "" : v)}><SelectTrigger id="ganador-manual-opcional"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Automático por sets</SelectItem><SelectItem value="a">{match.side_a.pair_name}</SelectItem><SelectItem value="b">{match.side_b.pair_name}</SelectItem></SelectContent></Select></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={submit} disabled={submitting}>{submitting ? "Guardando…" : "Guardar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
                                        }
