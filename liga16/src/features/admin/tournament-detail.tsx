import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router";
import { db } from "@/lib/data";
import type { Pair, Match, Tournament, TournamentCategory, Club } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  ChevronDown,
  Dice5,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  CalendarClock,
  RotateCcw,
  UserPlus,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { drawGroups, suggestGroupCount, scheduleWithAvailability, computeStandings, type Group, type AvailabilityConfig } from "@/lib/groups";
import { ensurePlayer } from "@/lib/players";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Court } from "@/types";
import { Checkbox } from "@/components/ui/checkbox";
import { FilterBar } from "@/components/ui/filter-bar";
import { DateTimePicker } from "@/components/ui/date-picker";
import { DatePicker } from "@/components/ui/date-picker";

function SortablePair({
  id,
  name,
  onRemove,
}: {
  id: string;
  name: string;
  onRemove?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm ${
        isDragging ? "opacity-60 shadow-lg" : ""
      }`}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 cursor-grab touch-none text-muted-foreground hover:text-foreground"
        aria-label="Arrastrar para mover"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </Button>
      <span className="flex-1 truncate">{name}</span>
      {onRemove && (
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove} aria-label="Quitar equipo">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export default function AdminTournamentDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [categories, setCategories] = useState<TournamentCategory[]>([]);
  const [pairs, setPairs] = useState<Pair[] | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [newPairName, setNewPairName] = useState("");
  const [newPairP1, setNewPairP1] = useState("");
  const [newPairP2, setNewPairP2] = useState("");
  const [newPairCategory, setNewPairCategory] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleConfig, setScheduleConfig] = useState<AvailabilityConfig & { dayInput: string }>({
    days: [],
    hours: [9, 11, 13, 16, 18, 20],
    courtNames: [],
    minutesPerMatch: 60,
    dayInput: "",
  });
  // Vista del calendario: lista filtrable o timeline por día
  const [calView, setCalView] = useState<"lista" | "timeline">("lista");
  const [matchDay, setMatchDay] = useState("all");
  const [matchCourt, setMatchCourt] = useState("all");
  const [matchCategory, setMatchCategory] = useState("all");
  const [matchPlayer, setMatchPlayer] = useState("all");
  const [courts, setCourts] = useState<Court[]>([]);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [jornadaDay, setJornadaDay] = useState<string>(() => new Date().toISOString().split("T")[0]);
  // Edición de fechas del torneo
  const [datesOpen, setDatesOpen] = useState(false);
  const [datesForm, setDatesForm] = useState({ start_date: "", end_date: "", registration_deadline: "" });
  // Edición de equipos
  const [editingPair, setEditingPair] = useState<Pair | null>(null);
  const [pairForm, setPairForm] = useState({ name: "", category_id: "" });
  // Filtros
  const [pairQuery, setPairQuery] = useState("");
  const [matchQuery, setMatchQuery] = useState("");
  const [matchRound, setMatchRound] = useState("all");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!slug) return;
    db.getTournament(slug).then(setTournament);
    db.listClubs().then(setClubs);
    db.listCourts().then(setCourts).catch(() => setCourts([]));
  }, [slug]);

  async function reload() {
    if (!tournament) return;
    const [p, m] = await Promise.all([
      db.getTournamentPairs(tournament.id),
      db.listMatchesByTournament(tournament.id),
    ]);
    setPairs(p);
    setMatches(m);
  }

  useEffect(() => {
    if (!tournament) return;
    db.getTournamentCategories(tournament.id).then(setCategories).catch(() => setCategories([]));
    db.getTournamentPairs(tournament.id).then(setPairs).catch(() => setPairs([]));
    db.listMatchesByTournament(tournament.id)
      .then((ms) => {
        setMatches(ms);
        // Reconstruir los grupos desde los partidos generados ("Grupo A · J1"…)
        // para que el sorteo no se pierda al recargar la página.
        setGroups((prev) => {
          if (prev.length > 0) return prev;
          const map = new Map<string, string[]>();
          ms.forEach((m) => {
            const groupName = m.round.split(" · ")[0];
            if (!groupName) return;
            if (!map.has(groupName)) map.set(groupName, []);
            [m.side_a.pair_id, m.side_b.pair_id].forEach((id) => {
              if (id && !map.get(groupName)!.includes(id)) map.get(groupName)!.push(id);
            });
          });
          if (map.size === 0) return prev;
          return [...map.entries()].map(([name, pairIds]) => ({ name, pairIds }));
        });
      })
      .catch(() => setMatches([]));
  }, [tournament]);

  const nameById = useMemo(() => {
    const map: Record<string, string> = {};
    (pairs ?? []).forEach((p) => {
      map[p.id] = p.name;
    });
    return map;
  }, [pairs]);

  const rounds = useMemo(() => [...new Set(matches.map((m) => m.round))].sort(), [matches]);

  const matchDays = useMemo(() => [...new Set(matches.map((m) => (m.scheduled_at ?? "").slice(0, 10)).filter(Boolean))].sort(), [matches]);
  const matchCourtsList = useMemo(() => [...new Set(matches.map((m) => m.court_name).filter(Boolean))] as string[], [matches]);
  const matchCategories = useMemo(() => [...new Set(matches.map((m) => m.round.split(" ·")[0]))].sort(), [matches]);
  /** Nombres de los jugadores de un partido (desde los nombres de equipos "A / B"). */
  function matchPlayerTeamNames(m: Match): string[] {
    const split = (n: string | null) => (n ?? "").split(" /").map((s) => s.trim()).filter(Boolean);
    return [...split(m.side_a.pair_name), ...split(m.side_b.pair_name)];
  }
  const matchPlayerList = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m) => matchPlayerTeamNames(m).forEach((n) => set.add(n)));
    return [...set].sort();
  }, [matches]);

  const assignedIds = useMemo(() => new Set(groups.flatMap((g) => g.pairIds)), [groups]);
  const unassigned = useMemo(
    () => (pairs ?? []).filter((p) => !assignedIds.has(p.id)),
    [pairs, assignedIds],
  );

  function handleDraw() {
    if (!pairs || pairs.length === 0) {
      toast.error("Registra al menos un equipo antes del sorteo");
      return;
    }
    const count = suggestGroupCount(pairs.length);
    setGroups(drawGroups(pairs.map((p) => p.id), count));
    toast.success(`Sorteo listo: ${count} grupos de ~${Math.ceil(pairs.length / count)} equipos`);
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const findGroupOf = (id: string) => groups.findIndex((g) => g.pairIds.includes(id));

    if (overId === "__pool__") {
      const from = findGroupOf(activeId);
      if (from === -1) return;
      setGroups((gs) =>
        gs.map((g, i) => (i === from ? { ...g, pairIds: g.pairIds.filter((x) => x !== activeId) } : g)),
      );
      return;
    }

    const from = findGroupOf(activeId);
    const to = findGroupOf(overId);
    if (from === -1 && to >= 0) {
      setGroups((gs) => gs.map((g, i) => (i === to ? { ...g, pairIds: [...g.pairIds, activeId] } : g)));
    } else if (from >= 0 && to >= 0 && from !== to) {
      setGroups((gs) =>
        gs.map((g, i) => {
          if (i === from) return { ...g, pairIds: g.pairIds.filter((x) => x !== activeId) };
          if (i === to) return { ...g, pairIds: [...g.pairIds, activeId] };
          return g;
        }),
      );
    } else if (from >= 0 && from === to) {
      setGroups((gs) =>
        gs.map((g, i) => (i === from ? { ...g, pairIds: arrayMove(g.pairIds, g.pairIds.indexOf(activeId), g.pairIds.indexOf(overId)) } : g)),
      );
    }
  }

  function addGroup() {
    const letters = "ABCDEFGHIJ";
    setGroups((gs) => [...gs, { name: `Grupo ${letters[gs.length]}`, pairIds: [] }]);
  }

  function renameGroup(index: number, name: string) {
    setGroups((gs) => gs.map((g, i) => (i === index ? { ...g, name } : g)));
  }

  /** Reasignar equipo a un grupo (o al pool) con Select — sin depender del drag. */
  function reassignPair(pairId: string, target: string) {
    setGroups((gs) => {
      const without = gs.map((g) => ({ ...g, pairIds: g.pairIds.filter((x) => x !== pairId) }));
      if (target === "__pool__") return without;
      return without.map((g) => (g.name === target ? { ...g, pairIds: [...g.pairIds, pairId] } : g));
    });
  }

  async function handleAddPair() {
    if (!tournament) return;
    // Los 2 jugadores vienen de sus inputs; el nombre se arma solo si no se tocó
    const parts = [newPairP1.trim(), newPairP2.trim()].filter(Boolean);
    if (parts.length !== 2) {
      toast.error("Un equipo son 2 personas — llena Jugador 1 y Jugador 2");
      return;
    }
    const raw = newPairName.trim() || parts.join(" / ");
    // Duplicado: mismo equipo (nombre) ya inscrito en este torneo
    const dupTeam = (pairs ?? []).find((p) => p.name.trim().toLowerCase() === raw.toLowerCase());
    if (dupTeam) {
      toast.error(`"${raw}" ya está inscrito en este torneo`);
      return;
    }
    // Duplicado: alguno de los 2 jugadores ya juega en otro equipo del torneo
    const playerSet = new Map<string, string>();
    (pairs ?? []).forEach((p) => {
      p.name.split("/").forEach((s) => {
        const n = s.trim().toLowerCase();
        if (n) playerSet.set(n, p.name);
      });
    });
    for (const part of parts) {
      const existing = playerSet.get(part.toLowerCase());
      if (existing) {
        toast.error(`"${part}" ya juega en el equipo "${existing}" de este torneo`);
        return;
      }
    }
    setSaving(true);
    try {
      // Perfiles de jugador nuevos se crean si no existen
      const [prof1, prof2] = await Promise.all([ensurePlayer(parts[0]).catch(() => null), ensurePlayer(parts[1]).catch(() => null)]);
      await db.createPair({
        tournament_id: tournament.id,
        category_id: newPairCategory || categories[0]?.id || null,
        name: parts.join(" / "),
        player1_id: prof1?.id ?? null,
        player2_id: prof2?.id ?? null,
      });
      setNewPairName("");
      setNewPairP1("");
      setNewPairP2("");
      toast.success("Equipo registrado");
      await reload();
    } catch (e) {
      toast.error((e as Error).message ?? "Error al registrar el equipo");
    } finally {
      setSaving(false);
    }
  }

  function openEditPair(p: Pair) {
    setEditingPair(p);
    setPairForm({ name: p.name, category_id: p.category_id ?? "" });
  }

  async function handleSavePair() {
    if (!editingPair || !pairForm.name.trim()) return;
    setSaving(true);
    try {
      await db.updatePair(editingPair.id, {
        name: pairForm.name.trim(),
        category_id: pairForm.category_id || null,
      });
      toast.success("Equipo actualizado");
      setEditingPair(null);
      await reload();
    } catch (e) {
      toast.error((e as Error).message ?? "Error al actualizar");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemovePair(id: string) {
    try {
      await db.deletePair(id);
      setGroups((gs) => gs.map((g) => ({ ...g, pairIds: g.pairIds.filter((x) => x !== id) })));
      await reload();
      toast.success("Equipo eliminado");
    } catch (e) {
      toast.error((e as Error).message ?? "Error al eliminar");
    }
  }

  function openEditDates() {
    if (!tournament) return;
    setDatesForm({
      start_date: tournament.start_date,
      end_date: tournament.end_date,
      registration_deadline: tournament.registration_deadline,
    });
    setDatesOpen(true);
  }

  async function handleSaveDates() {
    if (!tournament) return;
    setSaving(true);
    try {
      await db.updateTournament(tournament.slug, datesForm as never);
      setTournament({ ...tournament, ...datesForm });
      setDatesOpen(false);
      toast.success("Fechas actualizadas");
    } catch (e) {
      toast.error((e as Error).message ?? "Error al guardar las fechas");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateSchedule() {
    if (!tournament || groups.length === 0) return;
    if (scheduleConfig.days.length === 0) {
      toast.error("Marca al menos un día disponible antes de generar");
      return;
    }
    if (scheduleConfig.hours.length === 0) {
      toast.error("Marca al menos una hora disponible antes de generar");
      return;
    }
    const courtNames = scheduleConfig.courtNames.length > 0 ? scheduleConfig.courtNames : courts.map((c) => c.name);
    if (courtNames.length === 0) {
      toast.error("Registra canchas en la sección Sede primero");
      return;
    }
    setSaving(true);
    try {
      await db.deleteMatchesByTournament(tournament.id);
      const allScheduled: Array<Omit<Match, "id">> = [];
      // Reparto justo: intercalar los grupos para que las primeras jornadas de cada
      // grupo no se peleen por los mismos slots. Recorrido por ronda.
      const perGroup = groups.map((g) =>
        scheduleWithAvailability(g.pairIds, { ...scheduleConfig, courtNames, minutesPerMatch: scheduleConfig.minutesPerMatch }),
      );
      const maxLen = Math.max(0, ...perGroup.map((r) => r.length));
      const usedCourts = new Map<string, number>();
      for (let ri = 0; ri < maxLen; ri++) {
        for (let gi = 0; gi < groups.length; gi++) {
          const m = perGroup[gi][ri];
          if (!m) continue;
          // Evitar doble ocupación de cancha+hora: desplazar en minutos si choca
          const key = `${m.court}|${m.scheduled_at}`;
          const clash = usedCourts.get(key) ?? 0;
          if (clash > 0) {
            m.scheduled_at = new Date(new Date(m.scheduled_at).getTime() + clash * scheduleConfig.minutesPerMatch * 60000).toISOString();
          }
          usedCourts.set(key, clash + 1);
          allScheduled.push({
            tournament_id: tournament.id,
            tournament_name: tournament.name,
            round: `${groups[gi].name} · J${ri + 1}`,
            court_name: m.court,
            scheduled_at: m.scheduled_at,
            status: "scheduled",
            side_a: { pair_id: m.a, pair_name: nameById[m.a] ?? "?" },
            side_b: { pair_id: m.b, pair_name: nameById[m.b] ?? "?" },
            sets: [],
            winner: null,
          });
        }
      }
      const created = await db.createMatches(allScheduled);
      setMatches(created);
      setScheduleOpen(false);
      toast.success(`Calendario generado: ${created.length} partidos en ${scheduleConfig.days.length} día(s)`);
    } catch (e) {
      toast.error((e as Error).message ?? "Error al generar el calendario");
    } finally {
      setSaving(false);
    }
  }

  if (!tournament) return <Skeleton className="h-64 w-full rounded-xl" />;

  const club = clubs.find((c) => c.id === tournament.club_id);
  const catNameById = new Map(categories.map((c) => [c.id, c.name]));
  const filteredPairs = (pairs ?? []).filter((p) => {
    const q = pairQuery.trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || (catNameById.get(p.category_id ?? "") ?? "").toLowerCase().includes(q);
  });
  const filteredMatches = matches
    .filter((m) => {
      const q = matchQuery.trim().toLowerCase();
      if (q && !m.side_a.pair_name.toLowerCase().includes(q) && !m.side_b.pair_name.toLowerCase().includes(q)) return false;
      if (matchRound !== "all" && m.round !== matchRound) return false;
      if (matchDay !== "all" && !(m.scheduled_at ?? "").startsWith(matchDay)) return false;
      if (matchCourt !== "all" && m.court_name !== matchCourt) return false;
      if (matchCategory !== "all" && !m.round.startsWith(`${matchCategory} ·`)) return false;
      if (matchPlayer !== "all") {
        // Un equipo puede tener 2 jugadores con nombres distintos en cada lado — buscamos por nombre contenido
        const pl = matchPlayer.toLowerCase();
        const inA = matchPlayerTeamNames(m).some((n) => n.toLowerCase().includes(pl));
        if (!inA) return false;
      }
      return true;
    })
    .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)));

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/torneos"><ArrowLeft className="h-4 w-4" /> Torneos</Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tournament.name}</h1>
          <p className="text-sm text-muted-foreground">
            {club?.name ?? tournament.city} · {tournament.start_date} → {tournament.end_date} ·{" "}
            {tournament.format === "groups_knockout" ? "Grupos + eliminación" : tournament.format}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{(pairs ?? []).length} equipos</Badge>
          <Button variant="outline" size="sm" onClick={openEditDates}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Fechas
          </Button>
        </div>
      </header>

      <Tabs defaultValue="parejas">
        <TabsList>
          <TabsTrigger value="jornada">Jornada</TabsTrigger>
          <TabsTrigger value="parejas">Equipos</TabsTrigger>
          <TabsTrigger value="grupos">Grupos y sorteo</TabsTrigger>
          <TabsTrigger value="posiciones">Tablas de posiciones</TabsTrigger>
          <TabsTrigger value="calendario">Calendario ({matches.length})</TabsTrigger>
        </TabsList>

        {/* ============ JORNADA ============ */}
        <TabsContent value="jornada" className="space-y-4 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Día:</span>
            <DatePicker
              value={jornadaDay}
              onChange={(v) => setJornadaDay(v ?? new Date().toISOString().split("T")[0])}
              ariaLabel="Elegir día de la jornada"
            />
            <Badge variant="outline">
              {matches.filter((m) => (m.scheduled_at ?? "").startsWith(jornadaDay)).length} partidos
            </Badge>
          </div>
          {(() => {
            const dayMatches = matches
              .filter((m) => (m.scheduled_at ?? "").startsWith(jornadaDay))
              .sort((a, b) =>
                String(a.court_name).localeCompare(String(b.court_name)) ||
                String(a.scheduled_at).localeCompare(String(b.scheduled_at)),
              );
            if (dayMatches.length === 0) {
              return (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    Sin partidos este día. Genera el calendario en "Grupos y sorteo" o elige otra fecha.
                  </CardContent>
                </Card>
              );
            }
return (
                <div className="space-y-2">
                  {dayMatches.map((m) => {
                    const done = m.status === "finished" && m.winner;
                    const score = m.sets.map((x) => `${x.a}-${x.b}`).join(" ");
                    return (
                      <Button
                        key={m.id}
                        type="button"
                        variant="outline"
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:border-primary/40 hover:bg-muted/40 justify-start"
                        onClick={() => setEditingMatchId(m.id)}
                      >
                        <Badge variant="secondary" className="shrink-0">{m.court_name ?? "—"}</Badge>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {m.scheduled_at ? new Date(m.scheduled_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </span>
                        <span className={`flex-1 truncate ${done ? "line-through decoration-border" : "font-medium"}`}>
                          {m.side_a.pair_name} <span className="text-muted-foreground">vs</span> {m.side_b.pair_name}
                        </span>
                        {done ? (
                          <Badge variant="default" className="font-mono">{score}</Badge>
                        ) : (
                          <Badge variant="outline" className="font-mono text-muted-foreground">— : —</Badge>
                        )}
                      </Button>
                    );
                  })}
                </div>
            );
          })()}
        </TabsContent>

        {/* ============ PAREJAS ============ */}
        <TabsContent value="parejas" className="space-y-4 pt-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Registrar equipo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="pair-p1">Jugador 1</Label>
                  <Input
                    id="pair-p1"
                    value={newPairP1}
                    onChange={(e) => setNewPairP1(e.target.value)}
                    placeholder="Nombre y apellido"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="pair-p2">Jugador 2</Label>
                  <Input
                    id="pair-p2"
                    value={newPairP2}
                    onChange={(e) => setNewPairP2(e.target.value)}
                    placeholder="Nombre y apellido"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="grid gap-1.5 flex-1 min-w-48">
                  <Label htmlFor="pair-name">Nombre del equipo</Label>
                  <Input
                    id="pair-name"
                    value={newPairName}
                    onChange={(e) => setNewPairName(e.target.value)}
                    placeholder={[newPairP1.trim(), newPairP2.trim()].filter(Boolean).join(" / ") || "Se arma solo con los jugadores"}
                  />
                </div>
                {categories.length > 0 && (
                  <div className="grid gap-1.5 w-56">
                    <Label>Categoría</Label>
                    <Select value={newPairCategory || categories[0]?.id} onValueChange={setNewPairCategory}>
                      <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button onClick={handleAddPair} disabled={saving || !newPairP1.trim() || !newPairP2.trim()}>
                  <UserPlus className="h-4 w-4 mr-1" /> Registrar equipo
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm">
                  Inscritas ({filteredPairs.length} de {pairs?.length ?? 0})
                </CardTitle>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={pairQuery}
                    onChange={(e) => setPairQuery(e.target.value)}
                    placeholder="Buscar equipo o categoría…"
                    className="h-9 w-56 pl-8"
                    aria-label="Buscar equipos"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!pairs ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : pairs.length === 0 ? (
                <Empty className="py-10">
                  <EmptyHeader>
                    <EmptyTitle>Aún no hay equipos</EmptyTitle>
                    <EmptyDescription>Registra el primero con el formulario de arriba.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : filteredPairs.length === 0 ? (
                <Empty className="py-10">
                  <EmptyHeader>
                    <EmptyTitle>Sin coincidencias</EmptyTitle>
                    <EmptyDescription>Ningún equipo coincide con la búsqueda.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Equipo</TableHead>
                      <TableHead className="hidden sm:table-cell">Categoría</TableHead>
                      <TableHead className="text-right pr-4">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPairs.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="pl-4 font-medium">{p.name}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {p.category_id ? (
                            <Badge variant="secondary">{catNameById.get(p.category_id) ?? "—"}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sin categoría</span>
                          )}
                        </TableCell>
                        <TableCell className="pr-4 text-right space-x-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditPair(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleRemovePair(p.id)} aria-label={`Eliminar ${p.name}`}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ GRUPOS ============ */}
        <TabsContent value="grupos" className="space-y-4 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleDraw} disabled={!pairs || pairs.length < 2}>
              <Dice5 className="h-4 w-4 mr-1" /> Sortear grupos al azar
            </Button>
            <Button variant="outline" onClick={addGroup} disabled={groups.length >= 10}>
              <Plus className="h-4 w-4 mr-1" /> Añadir grupo
            </Button>
            {groups.length > 0 && (
              <Button variant="outline" onClick={() => setGroups([])}>
                <RotateCcw className="h-4 w-4 mr-1" /> Vaciar grupos
              </Button>
            )}
            {groups.length > 0 && (
              <Button variant="secondary" onClick={() => setScheduleOpen(true)} disabled={saving}>
                <CalendarClock className="h-4 w-4 mr-1" /> Generar calendario
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {groups.length === 0
              ? "El sorteo reparte todos los equipos en grupos parejos. Después puedes arrastrar o reasignar cualquiera."
              : "Arrastra los equipos entre grupos, usa el selector de grupo en cada tarjeta, o renombra el grupo con un clic en su título."}
          </p>
          {pairs && pairs.length < 2 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Tienes {pairs.length} equipo{pairs.length === 1 ? "" : "s"} inscrito{pairs.length === 1 ? "" : "s"} — se necesitan al menos 2 para sortear o generar partidos. Regístralos en la pestaña Equipos.
            </p>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            {unassigned.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Equipos sin grupo ({unassigned.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <SortableContext items={unassigned.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {unassigned.map((p) => (
                        <div key={p.id} className="space-y-1">
                          <SortablePair id={p.id} name={p.name} onRemove={() => handleRemovePair(p.id)} />
                          {groups.length > 0 && (
                            <Select value="__pool__" onValueChange={(v) => reassignPair(p.id, v)}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {groups.map((g) => (
                                  <SelectItem key={g.name} value={g.name}>→ {g.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      ))}
                    </div>
                  </SortableContext>
                </CardContent>
              </Card>
            )}
            <div
              className={`grid gap-4 ${
                groups.length <= 2 ? "sm:grid-cols-2" : groups.length <= 4 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"
              }`}
            >
              {groups.map((g, gi) => (
                <Card key={g.name}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between gap-2">
                      <Input
                        value={g.name}
                        onChange={(e) => renameGroup(gi, e.target.value)}
                        className="h-7 border-none bg-transparent px-1 font-semibold shadow-none focus-visible:ring-1"
                        aria-label={`Nombre del grupo ${gi + 1}`}
                      />
                      <Badge variant="outline">{g.pairIds.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SortableContext items={g.pairIds} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2 min-h-16">
                        {g.pairIds.length === 0 && (
                          <p className="text-xs text-muted-foreground py-2">Arrastra equipos aquí</p>
                        )}
                        {g.pairIds.map((id) => (
                          <div key={id} className="space-y-1">
                            <SortablePair id={id} name={nameById[id] ?? id} onRemove={() => handleRemovePair(id)} />
                            <Select value={g.name} onValueChange={(v) => reassignPair(id, v)}>
                              <SelectTrigger className="h-6 text-[11px] text-muted-foreground" aria-label={`Reasignar ${nameById[id]}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {groups.map((other) => (
                                  <SelectItem key={other.name} value={other.name}>
                                    {other.name}{other.name === g.name ? " (actual)" : ""}
                                  </SelectItem>
                                ))}
                                <SelectItem value="__pool__">Sin grupo</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </SortableContext>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DndContext>
        </TabsContent>

        {/* ============ TABLAS DE POSICIONES ============ */}
        <TabsContent value="posiciones" className="space-y-4 pt-2">
          {groups.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Aún no hay grupos. Ve a "Grupos y sorteo" y sortea los equipos.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <GroupStandingsCard key={g.name} group={g} matches={matches} nameById={nameById} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ============ CALENDARIO ============ */}
        <TabsContent value="calendario" className="space-y-4 pt-2">
          {matches.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Sin partidos generados. Ve a la pestaña de grupos, sortea y pulsa "Generar calendario".
              </CardContent>
            </Card>
          ) : (
            <>
              <FilterBar
                search={matchQuery}
                onSearch={setMatchQuery}
                searchPlaceholder="Buscar equipo o jugador…"
                selects={[
                  {
                    key: "cat",
                    ariaLabel: "Filtrar por categoría",
                    allLabel: "Todas las categorías",
                    value: matchCategory,
                    onChange: setMatchCategory,
                    options: matchCategories.filter(Boolean).map((c) => ({ value: c, label: c })),
                    className: "w-44",
                  },
                  {
                    key: "player",
                    ariaLabel: "Filtrar por jugador",
                    allLabel: "Todos los jugadores",
                    value: matchPlayer,
                    onChange: setMatchPlayer,
                    options: matchPlayerList.map((p) => ({ value: p, label: p })),
                    className: "w-48",
                  },
                  {
                    key: "day",
                    ariaLabel: "Filtrar por día",
                    allLabel: "Todos los días",
                    value: matchDay,
                    onChange: setMatchDay,
                    options: matchDays.map((d) => ({
                      value: d,
                      label: new Date(`${d}T12:00:00`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" }),
                    })),
                    className: "w-44",
                  },
                  {
                    key: "court",
                    ariaLabel: "Filtrar por cancha",
                    allLabel: "Todas las canchas",
                    value: matchCourt,
                    onChange: setMatchCourt,
                    options: matchCourtsList.map((c) => ({ value: c, label: c })),
                    className: "w-40",
                  },
                  {
                    key: "round",
                    ariaLabel: "Filtrar por ronda",
                    allLabel: "Todas las rondas",
                    value: matchRound,
                    onChange: setMatchRound,
                    options: rounds.map((r) => ({ value: r, label: r })),
                    className: "w-48",
                  },
                ]}
                resultCount={filteredMatches.length}
                resultLabel="partidos"
                onClear={() => {
                  setMatchQuery("");
                  setMatchCategory("all");
                  setMatchPlayer("all");
                  setMatchDay("all");
                  setMatchCourt("all");
                  setMatchRound("all");
                }}
              >
                <div className="ml-auto flex items-center gap-1 rounded-lg border p-1">
                  {(["lista", "timeline"] as const).map((v) => (
                    <Button key={v} type="button" size="sm" variant={calView === v ? "secondary" : "ghost"} className="h-7 text-xs capitalize" onClick={() => setCalView(v)}>
                      {v}
                    </Button>
                  ))}
                </div>
              </FilterBar>
              {calView === "timeline" ? (
                (() => {
                  const days = matchDay !== "all" ? [matchDay] : matchDays;
                  const courtCols = matchCourt !== "all" ? [matchCourt] : matchCourtsList;
                  if (days.length === 0 || courtCols.length === 0) {
                    return <p className="py-6 text-center text-sm text-muted-foreground">Sin partidos para este filtro.</p>;
                  }
                  return (
                    <div className="space-y-6">
                      {days.map((day) => {
                        const dayMatches = filteredMatches.filter((m) => (m.scheduled_at ?? "").startsWith(day));
                        if (dayMatches.length === 0) return null;
                        const times = [...new Set(dayMatches.map((m) => (m.scheduled_at ?? "").slice(11, 16)))].sort();
                        return (
                          <div key={day} className="overflow-x-auto rounded-xl border">
                            <p className="border-b bg-muted/40 px-4 py-2 text-sm font-semibold">
                              {new Date(`${day}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
                              <span className="ml-2 text-xs font-normal text-muted-foreground">{dayMatches.length} partidos</span>
                            </p>
                            <table className="w-full min-w-160 text-sm">
                              <thead>
                                <tr className="border-b text-left text-xs text-muted-foreground">
                                  <th className="w-16 px-3 py-2 font-medium">Hora</th>
                                  {courtCols.map((c) => (
                                    <th key={c} className="px-3 py-2 font-medium">{c}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {times.map((t) => (
                                  <tr key={t} className="border-b last:border-0">
                                    <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{t}</td>
                                    {courtCols.map((c) => {
                                      const m = dayMatches.find((x) => x.court_name === c && (x.scheduled_at ?? "").slice(11, 16) === t);
                                      if (!m) return <td key={c} className="px-3 py-2" />;
                                      const done = m.status === "finished" && m.winner;
                                      return (
                                        <td key={c} className="px-2 py-1.5">
                                          <Button
                                            type="button"
                                            variant={done ? "secondary" : "outline"}
                                            className="w-full flex-col items-start gap-0.5 px-2.5 py-1.5 text-left text-xs hover:border-primary/40 hover:bg-muted/40"
                                            onClick={() => setEditingMatchId(m.id)}
                                          >
                                            <span className={`block max-w-full truncate font-normal ${done ? "line-through decoration-border" : ""}`}>
                                              {m.side_a.pair_name} vs {m.side_b.pair_name}
                                            </span>
                                            <span className="block max-w-full truncate text-[10px] font-normal text-muted-foreground">{m.round}{done ? ` · ${m.sets.map((s) => `${s.a}-${s.b}`).join(" ")}` : ""}</span>
                                          </Button>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              ) : (
                <div className="space-y-2">
                {filteredMatches.map((m) => (
                  <Card key={m.id}>
                    <CardContent className="flex flex-wrap items-center gap-3 py-3 text-sm">
                      <span className="font-medium flex-1 min-w-48">
                        {m.side_a.pair_name} <span className="text-muted-foreground">vs</span> {m.side_b.pair_name}
                      </span>
                      <Badge variant="outline">{m.round}</Badge>
                      {m.court_name && <Badge variant="secondary">{m.court_name}</Badge>}
                      {m.scheduled_at && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(m.scheduled_at).toLocaleString("es-MX", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                      <Button variant="outline" size="sm" onClick={() => setEditingMatchId(m.id)}>
                        {m.status === "finished" ? "Ver resultado" : "Editar / Capturar"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Diálogo: editar fechas del torneo */}
      <Dialog open={datesOpen} onOpenChange={setDatesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar fechas</DialogTitle>
            <DialogDescription>Se aplican al calendario y a la ficha pública del torneo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Inicio</Label>
              <DatePicker value={datesForm.start_date} onChange={(v) => setDatesForm((f) => ({ ...f, start_date: v ?? f.start_date }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Fin</Label>
              <DatePicker value={datesForm.end_date} onChange={(v) => setDatesForm((f) => ({ ...f, end_date: v ?? f.end_date }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Cierre de inscripción</Label>
              <DatePicker value={datesForm.registration_deadline} onChange={(v) => setDatesForm((f) => ({ ...f, registration_deadline: v ?? f.registration_deadline }))} clearable />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDatesOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveDates} disabled={saving || !datesForm.start_date || !datesForm.end_date}>
              {saving ? "Guardando…" : "Guardar fechas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: editar pareja */}
      <Dialog open={!!editingPair} onOpenChange={(o) => { if (!o) setEditingPair(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar equipo</DialogTitle>
            <DialogDescription>Cambia el nombre o la categoría; los partidos ya generados no se tocan.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ep-name">Nombre</Label>
              <Input id="ep-name" value={pairForm.name} onChange={(e) => setPairForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Categoría</Label>
              <Select value={pairForm.category_id || "__none__"} onValueChange={(v) => setPairForm((f) => ({ ...f, category_id: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin categoría</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPair(null)}>Cancelar</Button>
            <Button onClick={handleSavePair} disabled={saving || !pairForm.name.trim()}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de configuración del calendario */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generar calendario</DialogTitle>
            <DialogDescription>
              Define la disponibilidad real: qué días y qué horas hay juego, y con qué canchas. Se reemplazan los partidos anteriores.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Días disponibles */}
            <div className="grid gap-2">
              <Label>Días con juego</Label>
              {(() => {
                const start = new Date(`${tournament?.start_date ?? new Date().toISOString().slice(0, 10)}T00:00:00`);
                const end = new Date(`${tournament?.end_date ?? tournament?.start_date ?? new Date().toISOString().slice(0, 10)}T00:00:00`);
                const options: string[] = [];
                for (let d = new Date(start); d <= end && options.length < 21; d.setDate(d.getDate() + 1)) {
                  options.push(d.toISOString().slice(0, 10));
                }
                const toggle = (day: string, on: boolean) =>
                  setScheduleConfig((c) => ({ ...c, days: on ? [...c.days, day].sort() : c.days.filter((x) => x !== day) }));
                return (
                  <>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {options.map((day) => (
                        <label key={day} className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors hover:bg-muted/50 has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary/5">
                          <Checkbox checked={scheduleConfig.days.includes(day)} onCheckedChange={(v) => toggle(day, v === true)} />
                          {new Date(`${day}T12:00:00`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })}
                        </label>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={scheduleConfig.dayInput}
                        onChange={(e) => setScheduleConfig((c) => ({ ...c, dayInput: e.target.value }))}
                        className="h-8 w-40 text-xs"
                        aria-label="Añadir otro día"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!scheduleConfig.dayInput}
                        onClick={() => {
                          if (scheduleConfig.dayInput && !scheduleConfig.days.includes(scheduleConfig.dayInput)) {
                            toggle(scheduleConfig.dayInput, true);
                          }
                          setScheduleConfig((c) => ({ ...c, dayInput: "" }));
                        }}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Añadir día
                      </Button>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Horas disponibles */}
            <div className="grid gap-2">
              <Label>Horas disponibles</Label>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 15 }, (_, i) => i + 8).map((h) => (
                  <label key={h} className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors hover:bg-muted/50 has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary/5">
                    <Checkbox
                      checked={scheduleConfig.hours.includes(h)}
                      onCheckedChange={(v) =>
                        setScheduleConfig((c) => ({
                          ...c,
                          hours: v === true ? [...c.hours, h].sort((a, b) => a - b) : c.hours.filter((x) => x !== h),
                        }))
                      }
                    />
                    {String(h).padStart(2, "0")}:00
                  </label>
                ))}
              </div>
            </div>

            {/* Canchas */}
            <div className="grid gap-2">
              <Label>Canchas a usar</Label>
              {courts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay canchas registradas — se usará "Cancha 1". Regístralas en la sección Sede.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {courts.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors hover:bg-muted/50 has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary/5">
                      <Checkbox
                        checked={scheduleConfig.courtNames.includes(c.name)}
                        onCheckedChange={(v) =>
                          setScheduleConfig((cfg) => ({
                            ...cfg,
                            courtNames: v === true ? [...cfg.courtNames, c.name] : cfg.courtNames.filter((x) => x !== c.name),
                          }))
                        }
                      />
                      {c.name}
                    </label>
                  ))}
                  {scheduleConfig.courtNames.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">Sin canchas marcadas se usarán todas.</p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="mins">Minutos por partido</Label>
                <Input
                  id="mins"
                  type="number"
                  min={15}
                  value={scheduleConfig.minutesPerMatch}
                  onChange={(e) => setScheduleConfig((c) => ({ ...c, minutesPerMatch: Number(e.target.value) }))}
                />
              </div>
              <div className="grid items-end">
                <p className="text-xs text-muted-foreground">
                  Capacidad: {scheduleConfig.days.length} día(s) × {scheduleConfig.hours.length} hora(s) × {scheduleConfig.courtNames.length || courts.length || 1} cancha(s) ={" "}
                  <strong>{scheduleConfig.days.length * scheduleConfig.hours.length * (scheduleConfig.courtNames.length || courts.length || 1)}</strong> partidos posibles
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>Cancelar</Button>
            <Button onClick={handleGenerateSchedule} disabled={saving}>
              {saving ? "Generando…" : "Generar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Captura de resultado por partido — encadenada a la jornada */}
      {editingMatchId && (
        <MatchResultDialog
          match={matches.find((m) => m.id === editingMatchId)!}
          nextMatchId={
            matches
              .filter((m) => (m.scheduled_at ?? "").startsWith(jornadaDay) && m.status !== "finished")
              .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)))
              .find((m) => m.id !== editingMatchId)?.id ?? null
          }
          courts={courts}
          open={!!editingMatchId}
          onOpenChange={(o) => { if (!o) setEditingMatchId(null); }}
          onAdvance={(nextId) => {
            void reload();
            setEditingMatchId(nextId);
          }}
        />
      )}
    </div>
  );
}

/** Captura y edición de marcador, cancha, fecha y hora desde el calendario del torneo. */
function MatchResultDialog({
  match,
  nextMatchId,
  courts,
  open,
  onOpenChange,
  onAdvance,
}: {
  match: Match;
  nextMatchId: string | null;
  courts: Court[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdvance: (nextMatchId: string | null) => void;
}) {
  const [sets, setSets] = useState<Array<{ a: string; b: string }>>(() =>
    match.sets.length > 0 ? match.sets.map((s) => ({ a: String(s.a), b: String(s.b) })) : [{ a: "", b: "" }],
  );
  const [courtName, setCourtName] = useState(match.court_name ?? "");
  const [scheduledAt, setScheduledAt] = useState(match.scheduled_at ? match.scheduled_at.slice(0, 16) : "");
  const [saving, setSaving] = useState(false);

  const finishedSets = sets.filter((s) => s.a !== "" && s.b !== "");
  const validSets = finishedSets.map((s) => ({ a: Number(s.a), b: Number(s.b), tiebreak_a: null, tiebreak_b: null }));
  const setsA = validSets.filter((s) => s.a > s.b).length;
  const setsB = validSets.filter((s) => s.b > s.a).length;
  const winner = setsA > setsB ? "a" : setsB > setsA ? "b" : null;

  async function save(status: Match["status"]) {
    if (status === "finished" && !winner) {
      toast.error("Marca los sets: deben ganar más sets una pareja para cerrar el partido");
      return;
    }
    setSaving(true);
    try {
      await db.updateMatch(match.id, {
        sets: status === "finished" ? validSets : match.sets,
        winner: status === "finished" ? winner : match.winner,
        status,
        court_name: courtName || null,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      });
      toast.success(status === "finished" ? (nextMatchId ? "Guardado — siguiente partido" : "Resultado guardado") : "Partido actualizado");
      onAdvance(status === "finished" ? nextMatchId : null);
    } catch (e) {
      toast.error((e as Error).message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar partido</DialogTitle>
          <DialogDescription>
            {match.side_a.pair_name} vs {match.side_b.pair_name} · {match.round}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          {sets.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <div className="grid gap-1">
                <Label className="text-xs">Set {i + 1} — {match.side_a.pair_name}</Label>
                <Input
                  type="number"
                  min={0}
                  value={s.a}
                  onChange={(e) => setSets((arr) => arr.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))}
                  aria-label={`Juegos de ${match.side_a.pair_name} en el set ${i + 1}`}
                />
              </div>
              <span className="pb-2 text-muted-foreground">–</span>
              <div className="grid gap-1">
                <Label className="text-xs">{match.side_b.pair_name}</Label>
                <Input
                  type="number"
                  min={0}
                  value={s.b}
                  onChange={(e) => setSets((arr) => arr.map((x, j) => (j === i ? { ...x, b: e.target.value } : x)))}
                  aria-label={`Juegos de ${match.side_b.pair_name} en el set ${i + 1}`}
                />
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSets((arr) => [...arr, { a: "", b: "" }])}
              disabled={sets.length >= 5}
            >
              <Plus className="h-4 w-4 mr-1" /> Añadir set
            </Button>
{winner && (
                <Badge variant="default">
                  Gana: {winner === "a" ? match.side_a.pair_name : match.side_b.pair_name}
                </Badge>
              )}
          </div>
          <div className="grid grid-cols-2 gap-3 border-t pt-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Cancha</Label>
              <Select value={courtName} onValueChange={setCourtName}>
                <SelectTrigger><SelectValue placeholder="Sin cancha" /></SelectTrigger>
                <SelectContent>
                  {courts.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Fecha y hora</Label>
              <DateTimePicker
                value={scheduledAt}
                onChange={(v) => setScheduledAt(v ?? "")}
                ariaLabel="Fecha y hora del partido"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => save("scheduled")} disabled={saving}>
            Guardar sin jugar
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => save("finished")} disabled={saving}>
              {saving ? "Guardando…" : "Guardar resultado"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Tabla de posiciones de un grupo: compacta por defecto, completa al expandir. */
function GroupStandingsCard({
  group,
  matches,
  nameById,
}: {
  group: Group;
  matches: Match[];
  nameById: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const standings = computeStandings(group.pairIds, matches, nameById);
  const groupMatches = matches.filter(
    (m) => group.pairIds.includes(m.side_a.pair_id ?? "") && group.pairIds.includes(m.side_b.pair_id ?? ""),
  );
  const played = groupMatches.filter((m) => m.status === "finished").length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2">
            {group.name}
            <Badge variant="outline">{played}/{groupMatches.length} jugados</Badge>
          </span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setExpanded((e) => !e)}>
            {expanded ? "Ver básico" : "Ver completa"}
            <ChevronDown className={`ml-1 h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4 w-8">#</TableHead>
              <TableHead>Equipo</TableHead>
              {/* Compacta: PJ · Sets · Pts. Completa: todo. */}
              {!expanded && (
                <>
                  <TableHead className="text-center w-28">Forma</TableHead>
                  <TableHead className="text-right">PJ</TableHead>
                  <TableHead className="text-right">Sets</TableHead>
                  <TableHead className="text-right pr-4">Pts</TableHead>
                </>
              )}
              {expanded && (
                <>
                  <TableHead className="text-center w-28">Forma</TableHead>
                  <TableHead className="text-right">PJ</TableHead>
                  <TableHead className="text-right">PG</TableHead>
                  <TableHead className="text-right">PP</TableHead>
                  <TableHead className="text-right">Sets G</TableHead>
                  <TableHead className="text-right">Sets P</TableHead>
                  <TableHead className="text-right">Dif sets</TableHead>
                  <TableHead className="text-right">Juegos G</TableHead>
                  <TableHead className="text-right">Juegos P</TableHead>
                  <TableHead className="text-right">Dif juegos</TableHead>
                  <TableHead className="text-right pr-4">Pts</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {standings.map((row, i) => {
              const difSets = row.setsFor - row.setsAgainst;
              const difGames = row.gamesFor - row.gamesAgainst;
              return (
                <TableRow key={row.pairId} className={i === 0 ? "bg-primary/5" : ""}>
                  <TableCell className="pl-4 font-medium">{i + 1}</TableCell>
                  <TableCell className="font-medium max-w-52 truncate">{nameById[row.pairId] ?? "?"}</TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex gap-0.5">
                      {row.form.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      {row.form.map((f, fi) => (
                        <span
                          key={fi}
                          className={`flex h-4.5 w-4.5 items-center justify-center rounded text-[9px] font-bold text-white ${
                            f === "G" ? "bg-emerald-600" : "bg-rose-500"
                          }`}
                          title={f === "G" ? "Victoria" : "Derrota"}
                        >
                          {f}
                        </span>
                      ))}
                    </span>
                  </TableCell>
                  {!expanded && (
                    <>
                      <TableCell className="text-right tabular-nums">{row.played}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.setsFor}-{row.setsAgainst}</TableCell>
                      <TableCell className="text-right pr-4 font-bold tabular-nums">{row.points}</TableCell>
                    </>
                  )}
                  {expanded && (
                    <>
                      <TableCell className="text-right tabular-nums">{row.played}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">{row.won}</TableCell>
                      <TableCell className="text-right tabular-nums text-rose-600">{row.lost}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.setsFor}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.setsAgainst}</TableCell>
                      <TableCell className={`text-right tabular-nums ${difSets > 0 ? "text-emerald-600" : difSets < 0 ? "text-rose-600" : ""}`}>
                        {difSets > 0 ? "+" : ""}{difSets}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.gamesFor}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.gamesAgainst}</TableCell>
                      <TableCell className={`text-right tabular-nums ${difGames > 0 ? "text-emerald-600" : difGames < 0 ? "text-rose-600" : ""}`}>
                        {difGames > 0 ? "+" : ""}{difGames}
                      </TableCell>
                      <TableCell className="text-right pr-4 font-bold tabular-nums">{row.points}</TableCell>
                    </>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
