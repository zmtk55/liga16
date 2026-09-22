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
import { ArrowLeft, Dice5, GripVertical, Plus, Trash2, CalendarClock, RotateCcw, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { drawGroups, suggestGroupCount, scheduleRounds, type Group } from "@/lib/groups";

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
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        aria-label="Arrastrar para mover"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 truncate">{name}</span>
      {onRemove && (
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove} aria-label="Quitar pareja">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function UnassignedPool({
  pairIds,
  nameById,
  onRemove,
}: {
  pairIds: string[];
  nameById: Record<string, string>;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: "__pool__" });
  void attributes; void listeners; void setNodeRef; void transform; void transition; void isDragging;
  return (
    <div className="space-y-2">
      {pairIds.map((id) => (
        <SortablePair key={id} id={id} name={nameById[id] ?? id} onRemove={() => onRemove(id)} />
      ))}
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
  const [newPairCategory, setNewPairCategory] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleConfig, setScheduleConfig] = useState({ courts: 2, minutesPerMatch: 60, startHour: 9 });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!slug) return;
    db.getTournament(slug).then(setTournament);
    db.listClubs().then(setClubs);
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
    db.listMatchesByTournament(tournament.id).then(setMatches).catch(() => setMatches([]));
  }, [tournament]);

  const nameById = useMemo(() => {
    const map: Record<string, string> = {};
    (pairs ?? []).forEach((p) => {
      map[p.id] = p.name;
    });
    return map;
  }, [pairs]);

  const assignedIds = useMemo(() => new Set(groups.flatMap((g) => g.pairIds)), [groups]);
  const unassigned = useMemo(
    () => (pairs ?? []).filter((p) => !assignedIds.has(p.id)),
    [pairs, assignedIds],
  );

  function handleDraw() {
    if (!pairs || pairs.length === 0) {
      toast.error("Registra al menos una pareja antes del sorteo");
      return;
    }
    const count = suggestGroupCount(pairs.length);
    setGroups(drawGroups(pairs.map((p) => p.id), count));
    toast.success(`Sorteo listo: ${count} grupos de ~${Math.ceil(pairs.length / count)} parejas`);
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
      // desde el pool hacia un grupo
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
      // reordenar dentro del mismo grupo
      setGroups((gs) =>
        gs.map((g, i) => (i === from ? { ...g, pairIds: arrayMove(g.pairIds, g.pairIds.indexOf(activeId), g.pairIds.indexOf(overId)) } : g)),
      );
    }
  }

  function addGroup() {
    const letters = "ABCDEFGHIJ";
    setGroups((gs) => [...gs, { name: `Grupo ${letters[gs.length]}`, pairIds: [] }]);
  }

  async function handleAddPair() {
    if (!tournament || !newPairName.trim()) return;
    setSaving(true);
    try {
      await db.createPair({
        tournament_id: tournament.id,
        category_id: newPairCategory || categories[0]?.id || null,
        name: newPairName.trim(),
      });
      setNewPairName("");
      toast.success("Pareja registrada");
      await reload();
    } catch (e) {
      toast.error((e as Error).message ?? "Error al registrar la pareja");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemovePair(id: string) {
    try {
      await db.deletePair(id);
      setGroups((gs) => gs.map((g) => ({ ...g, pairIds: g.pairIds.filter((x) => x !== id) })));
      await reload();
      toast.success("Pareja eliminada");
    } catch (e) {
      toast.error((e as Error).message ?? "Error al eliminar");
    }
  }

  async function handleGenerateSchedule() {
    if (!tournament || groups.length === 0) return;
    setSaving(true);
    try {
      await db.deleteMatchesByTournament(tournament.id);
      const allScheduled: Array<Omit<Match, "id">> = [];
      for (const group of groups) {
        const rounds = scheduleRounds(
          group.pairIds,
          scheduleConfig.courts,
          tournament.start_date,
          scheduleConfig.minutesPerMatch,
          scheduleConfig.startHour,
        );
        rounds.forEach((roundMatches, ri) => {
          roundMatches.forEach((m) => {
            allScheduled.push({
              tournament_id: tournament.id,
              tournament_name: tournament.name,
              round: `${group.name} · J${ri + 1}`,
              court_name: `Cancha ${m.court}`,
              scheduled_at: m.scheduled_at,
              status: "scheduled",
              side_a: { pair_id: m.a, pair_name: nameById[m.a] ?? "?" },
              side_b: { pair_id: m.b, pair_name: nameById[m.b] ?? "?" },
              sets: [],
              winner: null,
            });
          });
        });
      }
      const created = await db.createMatches(allScheduled);
      setMatches(created);
      setScheduleOpen(false);
      toast.success(`Calendario generado: ${created.length} partidos`);
    } catch (e) {
      toast.error((e as Error).message ?? "Error al generar el calendario");
    } finally {
      setSaving(false);
    }
  }

  if (!tournament) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  const club = clubs.find((c) => c.id === tournament.club_id);

  return (
    <div className="space-y-4">
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
        <Badge variant="outline">{(pairs ?? []).length} parejas</Badge>
      </header>

      <Tabs defaultValue="parejas">
        <TabsList>
          <TabsTrigger value="parejas">Parejas</TabsTrigger>
          <TabsTrigger value="grupos">Grupos y sorteo</TabsTrigger>
          <TabsTrigger value="calendario">Calendario ({matches.length})</TabsTrigger>
        </TabsList>

        {/* ============ PAREJAS ============ */}
        <TabsContent value="parejas" className="space-y-4 pt-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Registrar pareja</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1.5 flex-1 min-w-48">
                <Label htmlFor="pair-name">Nombre</Label>
                <Input
                  id="pair-name"
                  value={newPairName}
                  onChange={(e) => setNewPairName(e.target.value)}
                  placeholder="Ej: Fuentes / Rojas"
                />
              </div>
              {categories.length > 0 && (
                <div className="grid gap-1.5 w-56">
                  <Label htmlFor="pair-cat">Categoría</Label>
                  <select
                    id="pair-cat"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={newPairCategory}
                    onChange={(e) => setNewPairCategory(e.target.value)}
                  >
                    <option value="">Sin categoría</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <Button onClick={handleAddPair} disabled={saving || !newPairName.trim()}>
                <UserPlus className="h-4 w-4 mr-1" /> Registrar
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Parejas inscritas</CardTitle>
            </CardHeader>
            <CardContent>
              {!pairs ? (
                <p className="text-sm text-muted-foreground">Cargando…</p>
              ) : pairs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aún no hay parejas. Registra la primera con el formulario de arriba.
                </p>
              ) : (
                <div className="space-y-2">
                  {pairs.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                      <span className="flex-1 truncate">{p.name}</span>
                      {p.seed != null && <Badge variant="secondary">Sorpresa {p.seed}</Badge>}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemovePair(p.id)} aria-label="Eliminar pareja">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
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
              ? "El sorteo reparte todas las parejas en grupos parejos. Después puedes arrastrar cualquier pareja a otro grupo para ajustar a mano."
              : "Arrastra las parejas entre grupos para ajustar el sorteo a mano."}
          </p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            {groups.length === 0 && unassigned.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Parejas esperando sorteo</CardTitle>
                </CardHeader>
                <CardContent>
                  <SortableContext items={unassigned.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                    <UnassignedPool
                      pairIds={unassigned.map((p) => p.id)}
                      nameById={nameById}
                      onRemove={handleRemovePair}
                    />
                  </SortableContext>
                </CardContent>
              </Card>
            )}
            <div
              className={`grid gap-4 ${
                groups.length <= 2 ? "sm:grid-cols-2" : groups.length <= 4 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"
              }`}
            >
              {groups.map((g) => (
                <Card key={g.name}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      {g.name}
                      <Badge variant="outline">{g.pairIds.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SortableContext items={g.pairIds} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2 min-h-16">
                        {g.pairIds.length === 0 && (
                          <p className="text-xs text-muted-foreground py-2">Arrastra parejas aquí</p>
                        )}
                        {g.pairIds.map((id) => (
                          <SortablePair
                            key={id}
                            id={id}
                            name={nameById[id] ?? id}
                            onRemove={() => handleRemovePair(id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DndContext>
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
            <div className="space-y-2">
              {[...matches]
                .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)))
                .map((m) => (
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
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Diálogo de configuración del calendario */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generar calendario</DialogTitle>
            <DialogDescription>
              Round-robin dentro de cada grupo: todos contra todos. Se reemplazan los partidos anteriores.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="courts">Canchas disponibles</Label>
              <Input
                id="courts"
                type="number"
                min={1}
                value={scheduleConfig.courts}
                onChange={(e) => setScheduleConfig((c) => ({ ...c, courts: Number(e.target.value) }))}
              />
              <p className="text-xs text-muted-foreground">
                {club ? `${club.name}` : "Sede del torneo"} — edítalas en la sección Sede si falta alguna.
              </p>
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
              <div className="grid gap-1.5">
                <Label htmlFor="hour">Hora de inicio</Label>
                <Input
                  id="hour"
                  type="number"
                  min={0}
                  max={23}
                  value={scheduleConfig.startHour}
                  onChange={(e) => setScheduleConfig((c) => ({ ...c, startHour: Number(e.target.value) }))}
                />
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
    </div>
  );
}
