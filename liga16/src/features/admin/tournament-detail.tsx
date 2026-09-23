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
import { drawGroups, suggestGroupCount, scheduleRounds, computeStandings, type Group } from "@/lib/groups";
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
  const [courts, setCourts] = useState<Court[]>([]);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [jornadaDay, setJornadaDay] = useState<string>(() => new Date().toISOString().split("T")[0]);

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
        <Badge variant="outline">{(pairs ?? []).length} parejas</Badge>
      </header>

      <Tabs defaultValue="parejas">
        <TabsList>
          <TabsTrigger value="jornada">Jornada</TabsTrigger>
          <TabsTrigger value="parejas">Parejas</TabsTrigger>
          <TabsTrigger value="grupos">Grupos y sorteo</TabsTrigger>
          <TabsTrigger value="posiciones">Tablas de posiciones</TabsTrigger>
          <TabsTrigger value="calendario">Calendario ({matches.length})</TabsTrigger>
        </TabsList>

        {/* ============ JORNADA (agenda del día + captura encadenada) ============ */}
        <TabsContent value="jornada" className="space-y-4 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="jornada-day" className="text-sm text-muted-foreground">Día:</Label>
            <Input
              id="jornada-day"
              type="date"
              value={jornadaDay}
              onChange={(e) => setJornadaDay(e.target.value)}
              className="w-40"
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
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setEditingMatchId(m.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors hover:border-primary/40 hover:bg-muted/40 ${
                        done ? "opacity-75" : ""
                      }`}
                    >
                      <Badge variant="secondary" className="shrink-0">{m.court_name ?? "—"}</Badge>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {m.scheduled_at ? new Date(m.scheduled_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </span>
                      <span className={`flex-1 truncate ${done ? "line-through decoration-border" : "font-medium"}`}>
                        {m.side_a.pair_name} <span className="text-muted-foreground">vs</span> {m.side_b.pair_name}
                      </span>
                      {done ? (
                        <Badge className="bg-emerald-600 font-mono">{score}</Badge>
                      ) : (
                        <Badge variant="outline" className="font-mono text-muted-foreground">— : —</Badge>
                      )}
                    </button>
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

        {/* ============ TABLAS DE POSICIONES ============ */}
        <TabsContent value="posiciones" className="space-y-4 pt-2">
          {groups.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Aún no hay grupos. Ve a "Grupos y sorteo" y sortea las parejas.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {groups.map((g) => {
                const standings = computeStandings(g.pairIds, matches, nameById);
                const groupMatches = matches.filter((m) =>
                  g.pairIds.includes(m.side_a.pair_id ?? "") && g.pairIds.includes(m.side_b.pair_id ?? ""),
                );
                return (
                  <Card key={g.name}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        {g.name}
                        <Badge variant="outline">{groupMatches.filter((m) => m.status === "finished").length}/{groupMatches.length} jugados</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-4">#</TableHead>
                            <TableHead>Pareja</TableHead>
                            <TableHead className="text-right">PJ</TableHead>
                            <TableHead className="text-right">PG</TableHead>
                            <TableHead className="text-right">Sets</TableHead>
                            <TableHead className="text-right pr-4">Pts</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {standings.map((row, i) => (
                            <TableRow key={row.pairId} className={i === 0 ? "bg-primary/5" : ""}>
                              <TableCell className="pl-4 font-medium">{i + 1}</TableCell>
                              <TableCell className="font-medium max-w-40 truncate">{nameById[row.pairId] ?? "?"}</TableCell>
                              <TableCell className="text-right">{row.played}</TableCell>
                              <TableCell className="text-right text-emerald-600">{row.won}</TableCell>
                              <TableCell className="text-right tabular-nums">{row.setsFor}-{row.setsAgainst}</TableCell>
                              <TableCell className="text-right pr-4 font-bold tabular-nums">{row.points}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}
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
                      <Button variant="outline" size="sm" onClick={() => setEditingMatchId(m.id)}>
                        {m.status === "finished" ? "Ver resultado" : "Capturar resultado"}
                      </Button>
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
            setEditingMatchId(nextId); // siguiente partido o cierre
          }}
        />
      )}
    </div>
  );
}

/** Captura rápida de marcador, cancha y hora desde el calendario del torneo. */
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
      toast.error((e as Error).message ?? "Error al guardar el resultado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Capturar resultado</DialogTitle>
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
              <Badge className="bg-emerald-600">
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
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
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
