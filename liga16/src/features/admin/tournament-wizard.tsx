import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { db } from "@/lib/data";
import type { Club, Court, PadelDivision, Sex, Team, Tournament, TournamentCategory, PlayerProfile } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import CategoryMatrix, { type CategoryValue } from "@/components/ui/category-matrix";
import PlayerSlot from "@/components/players/player-slot";
import { DEFAULT_SCORING } from "@/lib/scoring";
import { drawGroups, scheduleRounds, suggestGroupCount, type Group } from "@/lib/groups";
import { sexShort } from "@/lib/format";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Dice5,
  GripVertical,
  Layers,
  Plus,
  RotateCcw,
  Trophy,
  Users,
} from "lucide-react";

const STEPS = [
  { id: "sede", label: "Sede y canchas", icon: Building2 },
  { id: "torneo", label: "Torneo", icon: Trophy },
  { id: "categorias", label: "Categorías", icon: Layers },
  { id: "equipos", label: "Equipos", icon: Users },
  { id: "sorteo", label: "Sorteo y calendario", icon: Dice5 },
] as const;

interface TeamInput {
  division: PadelDivision;
  sex: Sex;
  name: string;
  player1: string;
  player2: string;
}

function addDays(date: string, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function SortablePairCard({
  id,
  name,
  onRemove,
}: {
  id: string;
  name: string;
  onRemove: () => void;
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
        aria-label="Arrastrar para mover de grupo"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 truncate">{name}</span>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove} aria-label={`Quitar ${name}`}>
        ×
      </Button>
    </div>
  );
}

export default function TournamentWizard() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const editMode = Boolean(slug);

  const [step, setStep] = useState(editMode ? 1 : 0);
  const [saving, setSaving] = useState(false);

  // Paso 1: sede y canchas
  const [club, setClub] = useState({ name: "", city: "Ciudad de México", state: "CDMX", address: "", phone: "" });
  const [courts, setCourts] = useState<Court[]>([]);
  const [newCourt, setNewCourt] = useState("");

  // Paso 2: torneo
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [tournament, setTournament] = useState({
    name: "",
    start_date: addDays(new Date().toISOString().split("T")[0], 14),
    end_date: addDays(new Date().toISOString().split("T")[0], 16),
    registration_deadline: addDays(new Date().toISOString().split("T")[0], 7),
    format: "groups_knockout",
    status: "published",
    price_mxn: 500,
    rules_summary: "Grupos de 4 + eliminación directa. Mejor de 3 sets.",
    sets_to_win: String(DEFAULT_SCORING.sets_to_win),
    games_per_set: String(DEFAULT_SCORING.games_per_set),
    tie_break_at: String(DEFAULT_SCORING.tie_break_at),
    tie_break_points: String(DEFAULT_SCORING.tie_break_points),
  });

  // Paso 3: categorías
  const [categories, setCategories] = useState<CategoryValue[]>([]);

  // Paso 4: equipos
  const [teams, setTeams] = useState<TeamInput[]>([]);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);

  // Paso 5: sorteo
  const [groupCount, setGroupCount] = useState(2);
  const [groups, setGroups] = useState<Group[]>([]);
  const [generated, setGenerated] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Cargar contexto (sede, canchas, jugadores) y, en edición, el torneo completo
  useEffect(() => {
    db.listClubs().then((clubs: Club[]) => {
      if (clubs[0]) {
        setClub({
          name: clubs[0].name,
          city: clubs[0].city,
          state: clubs[0].state,
          address: clubs[0].address ?? "",
          phone: clubs[0].phone ?? "",
        });
      }
    });
    db.listCourts().then(setCourts).catch(() => setCourts([]));
    db.listPlayers().then(setPlayers).catch(() => setPlayers([]));

    if (slug) {
      db.getTournament(slug).then(async (t: Tournament | null) => {
        if (!t) {
          toast.error("Torneo no encontrado");
          navigate("/admin/torneos");
          return;
        }
        setTournamentId(t.id);
        setTournament((prev) => ({
          ...prev,
          name: t.name,
          start_date: t.start_date,
          end_date: t.end_date,
          registration_deadline: t.registration_deadline,
          format: t.format,
          price_mxn: t.price_cents / 100,
          rules_summary: t.rules_summary ?? "",
          sets_to_win: String(t.scoring?.sets_to_win ?? DEFAULT_SCORING.sets_to_win),
          games_per_set: String(t.scoring?.games_per_set ?? DEFAULT_SCORING.games_per_set),
          tie_break_at: String(t.scoring?.tie_break_at ?? DEFAULT_SCORING.tie_break_at),
          tie_break_points: String(t.scoring?.tie_break_points ?? DEFAULT_SCORING.tie_break_points),
        }));
        // categorías existentes → chips
        const cats = await db.getTournamentCategories(t.id).catch(() => [] as TournamentCategory[]);
        setCategories(
          (cats as unknown as Array<{ name: string; sex: Sex; category?: string }>).map((c) => ({
            division: (c.category ?? "4ta") as PadelDivision,
            sex: c.sex,
            max_pairs: 16,
          })),
        );
        // equipos existentes del club/ciudad
        const allTeams = await db.listTeams();
        setTeams(
          allTeams
            .filter((tm: Team) => tm.city === t.city)
            .map((tm) => ({
              division: tm.division,
              sex: tm.sex,
              name: tm.name,
              player1: tm.player1?.name ?? "",
              player2: tm.player2?.name ?? "",
            })),
        );
      });
    }
  }, [slug, navigate]);

  const canAdvance = useMemo(() => {
    if (step === 0) return club.name.trim().length > 0 && courts.length > 0;
    if (step === 1) return tournament.name.trim().length > 0;
    if (step === 2) return categories.length > 0;
    if (step === 3) return teams.length > 0 && teams.every((t) => t.player1.trim() && t.player2.trim());
    return groups.length > 0;
  }, [step, club, courts, tournament, categories, teams, groups]);

  function addCourt() {
    const name = newCourt.trim();
    if (!name) return;
    setSaving(true);
    db.createCourt({ club_id: undefined, name, surface: "Sintética", indoor: false } as never)
      .then((c) => {
        setCourts((prev) => [...prev, c]);
        setNewCourt("");
      })
      .catch((e: Error) => toast.error(e.message ?? "No se pudo crear la cancha"))
      .finally(() => setSaving(false));
  }

  function removeCourt(id: string) {
    setSaving(true);
    db.deleteCourt(id)
      .then(() => setCourts((prev) => prev.filter((c) => c.id !== id)))
      .catch((e: Error) => toast.error(e.message ?? "No se pudo quitar la cancha"))
      .finally(() => setSaving(false));
  }

  /** Persiste el paso actual antes de avanzar (modo edición incluido). */
  async function persistStep(target: number) {
    setSaving(true);
    try {
      if (target >= 2 && !tournamentId) {
        // Crear/actualizar torneo con scoring
        const payload = {
          name: tournament.name,
          cover_url: null,
          club_id: null,
          city: club.city,
          state: club.state,
          start_date: tournament.start_date,
          end_date: tournament.end_date,
          registration_deadline: tournament.registration_deadline,
          status: tournament.status,
          modality: "pairs",
          format: tournament.format,
          organizer_id: null,
          price_cents: Math.round(tournament.price_mxn * 100),
          currency: "MXN",
          rules_summary: tournament.rules_summary || null,
          description: null,
          scoring: {
            sets_to_win: Number(tournament.sets_to_win) || DEFAULT_SCORING.sets_to_win,
            games_per_set: Number(tournament.games_per_set) || DEFAULT_SCORING.games_per_set,
            tie_break_at: Number(tournament.tie_break_at) || DEFAULT_SCORING.tie_break_at,
            tie_break_points: Number(tournament.tie_break_points) || DEFAULT_SCORING.tie_break_points,
            win_by_two_tiebreak: DEFAULT_SCORING.win_by_two_tiebreak,
            tie_breaker_rules: DEFAULT_SCORING.tie_breaker_rules,
          },
        } as never;
        if (tournamentId) {
          const t = await db.getTournament(tournamentId);
          await db.updateTournament((t as unknown as { slug: string }).slug, payload);
        } else {
          const created = await db.createTournament(payload);
          setTournamentId((created as unknown as { id: string }).id);
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function next() {
    if (!canAdvance) return;
    await persistStep(step + 1);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  function handleDraw() {
    const pairIds = teams.map((_, i) => String(i));
    setGroups(drawGroups(pairIds, groupCount));
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;
    const findGroupOf = (id: string) => groups.findIndex((g) => g.pairIds.includes(id));
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
        gs.map((g, i) =>
          i === from
            ? { ...g, pairIds: arrayMove(g.pairIds, g.pairIds.indexOf(activeId), g.pairIds.indexOf(overId)) }
            : g,
        ),
      );
    }
  }

  function teamName(i: string | number) {
    const t = teams[Number(i)];
    return t?.name || `${t?.player1 ?? "?"} / ${t?.player2 ?? "?"}`;
  }

  async function generateCalendarAndFinish() {
    if (!tournamentId) {
      toast.error("Falta crear el torneo");
      return;
    }
    setSaving(true);
    try {
      const allMatches: Array<Parameters<typeof db.createMatches>[0][number]> = [];
      for (const group of groups) {
        const rounds = scheduleRounds(
          group.pairIds,
          courts.length || 1,
          tournament.start_date,
          60,
          9,
        );
        rounds.forEach((roundMatches, ri) => {
          roundMatches.forEach((m) => {
            allMatches.push({
              tournament_id: tournamentId,
              round: `${group.name} · J${ri + 1}`,
              court_name: `Cancha ${m.court}`,
              scheduled_at: m.scheduled_at,
              status: "scheduled",
              side_a: { pair_id: null, pair_name: teamName(m.a) },
              side_b: { pair_id: null, pair_name: teamName(m.b) },
              sets: [],
              winner: null,
            });
          });
        });
      }
      if (allMatches.length > 0) {
        await db.deleteMatchesByTournament(tournamentId);
        await db.createMatches(allMatches);
      }
      setGenerated(true);
      toast.success(`Torneo listo: ${allMatches.length} partidos generados`);
      const t = await db.getTournament(String(tournamentId));
      if (t) navigate(`/admin/torneos/${(t as unknown as { slug: string }).slug}`);
    } catch (e) {
      toast.error((e as Error).message ?? "Error generando el calendario");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/torneos")}>
        <ArrowLeft className="h-4 w-4" /> Torneos
      </Button>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {editMode ? "Editar torneo" : "Nuevo torneo"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {editMode ? "Cada paso se guarda al avanzar." : "Sede, torneo, categorías, equipos y calendario en un solo flujo."}
        </p>
      </header>

      {/* Progreso */}
      <ol className="flex items-center gap-1.5 text-xs">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex flex-1 items-center gap-1.5">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                i < step
                  ? "bg-emerald-600 text-white"
                  : i === step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
              aria-current={i === step ? "step" : undefined}
            >
              {i < step ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className={`hidden sm:block ${i === step ? "font-medium" : "text-muted-foreground"}`}>{s.label}</span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
          </li>
        ))}
      </ol>

      <Card className="animate-fade-in">
        <CardContent className="p-6">
          {/* ============ PASO 1: SEDE Y CANCHAS ============ */}
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold">Sede y canchas</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="club-name">Nombre del club</Label>
                  <Input id="club-name" value={club.name} onChange={(e) => setClub((c) => ({ ...c, name: e.target.value }))} placeholder="Club Pádel Reforma" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="club-city">Ciudad</Label>
                  <Input id="club-city" value={club.city} onChange={(e) => setClub((c) => ({ ...c, city: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="club-state">Estado</Label>
                  <Input id="club-state" value={club.state} onChange={(e) => setClub((c) => ({ ...c, state: e.target.value }))} />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="club-address">Dirección</Label>
                  <Input id="club-address" value={club.address} onChange={(e) => setClub((c) => ({ ...c, address: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Canchas disponibles ({courts.length})</Label>
                <div className="flex flex-wrap gap-2">
                  {courts.map((c) => (
                    <Badge key={c.id} variant="secondary" className="gap-1 py-1.5 pl-3 pr-1.5">
                      {c.name}
                      <button
                        type="button"
                        onClick={() => removeCourt(c.id)}
                        aria-label={`Quitar ${c.name}`}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                  {courts.length === 0 && <p className="text-xs text-muted-foreground">Registra al menos una cancha para generar el calendario.</p>}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newCourt}
                    onChange={(e) => setNewCourt(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCourt()}
                    placeholder="Nombre de la cancha (ej. Cancha Central)"
                    className="max-w-xs"
                  />
                  <Button type="button" variant="outline" onClick={addCourt} disabled={saving || !newCourt.trim()}>
                    <Plus className="h-4 w-4 mr-1" /> Añadir
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ============ PASO 2: TORNEO ============ */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold">Torneo</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="t-name">Nombre</Label>
                  <Input id="t-name" value={tournament.name} onChange={(e) => setTournament((t) => ({ ...t, name: e.target.value }))} placeholder="Copa Liga16 Apertura 2026" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="t-start">Inicio</Label>
                  <Input id="t-start" type="date" value={tournament.start_date} onChange={(e) => setTournament((t) => ({ ...t, start_date: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="t-end">Fin</Label>
                  <Input id="t-end" type="date" value={tournament.end_date} onChange={(e) => setTournament((t) => ({ ...t, end_date: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="t-deadline">Cierre de inscripción</Label>
                  <Input id="t-deadline" type="date" value={tournament.registration_deadline} onChange={(e) => setTournament((t) => ({ ...t, registration_deadline: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="t-price">Precio por equipo (MXN)</Label>
                  <Input id="t-price" type="number" min={0} value={tournament.price_mxn} onChange={(e) => setTournament((t) => ({ ...t, price_mxn: Number(e.target.value) }))} />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label>Formato</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { v: "groups_knockout", l: "Grupos + eliminación" },
                      { v: "round_robin", l: "Round robin" },
                      { v: "single_elimination", l: "Eliminación directa" },
                      { v: "americano", l: "Americano" },
                    ].map((f) => (
                      <button
                        key={f.v}
                        type="button"
                        onClick={() => setTournament((t) => ({ ...t, format: f.v }))}
                        className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                          tournament.format === f.v
                            ? "border-primary bg-primary/10 font-medium text-primary"
                            : "hover:bg-muted"
                        }`}
                      >
                        {f.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="t-rules">Reglamento resumido</Label>
                  <Input id="t-rules" value={tournament.rules_summary} onChange={(e) => setTournament((t) => ({ ...t, rules_summary: e.target.value }))} />
                </div>
              </div>

              <fieldset className="rounded-lg border p-4">
                <legend className="px-1 text-sm font-semibold">Sistema de puntuación</legend>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { k: "sets_to_win", l: "Sets para ganar" },
                    { k: "games_per_set", l: "Juegos por set" },
                    { k: "tie_break_at", l: "Tie-break a" },
                    { k: "tie_break_points", l: "Puntos TB" },
                  ].map((f) => (
                    <div key={f.k} className="grid gap-1">
                      <Label htmlFor={`sc-${f.k}`} className="text-xs text-muted-foreground">{f.l}</Label>
                      <Input
                        id={`sc-${f.k}`}
                        type="number"
                        min={1}
                        value={tournament[f.k as "sets_to_win"]}
                        onChange={(e) => setTournament((t) => ({ ...t, [f.k]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {/* ============ PASO 3: CATEGORÍAS ============ */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Categorías</h2>
              <p className="text-sm text-muted-foreground">
                Cada categoría combina división y rama. Los equipos se agruparán bajo ellas en el siguiente paso.
              </p>
              <CategoryMatrix value={categories} onChange={setCategories} />
            </div>
          )}

          {/* ============ PASO 4: EQUIPOS ============ */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold">Equipos ({teams.length})</h2>
                {categories.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" size="sm">
                        <Plus className="h-4 w-4 mr-1" /> Añadir equipo
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-1" align="end">
                      <Command>
                        <CommandInput placeholder="Buscar categoría…" />
                        <CommandList>
                          <CommandEmpty>Sin categorías.</CommandEmpty>
                          {categories.map((c) => (
                            <CommandItem
                              key={`${c.division}-${c.sex}`}
                              value={`${c.division} ${sexShort(c.sex)}`}
                              onSelect={() =>
                                setTeams((prev) => [
                                  ...prev,
                                  { division: c.division, sex: c.sex, name: "", player1: "", player2: "" },
                                ])
                              }
                            >
                              {c.division} · {sexShort(c.sex)}
                            </CommandItem>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              {teams.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Añade el primer equipo eligiendo su categoría.
                </p>
              ) : (
                <div className="space-y-4">
                  {categories
                    .filter((c) => teams.some((t) => t.division === c.division && t.sex === c.sex))
                    .map((c) => {
                      const withIndex = teams.map((t, i) => ({ t, i })).filter(({ t }) => t.division === c.division && t.sex === c.sex);
                      return (
                        <div key={`${c.division}-${c.sex}`} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{c.division} · {sexShort(c.sex)}</Badge>
                            <span className="text-xs text-muted-foreground">{withIndex.length} equipo(s)</span>
                          </div>
                          {withIndex.map(({ t, i }) => (
                            <div key={i} className="rounded-xl border p-3">
                              <div className="mb-2 flex items-center gap-2">
                                <Input
                                  value={t.name}
                                  onChange={(e) => setTeams((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                                  placeholder="Nombre del equipo (se arma solo)"
                                  className="h-8 text-sm font-semibold"
                                  aria-label={`Nombre del equipo ${i + 1}`}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  onClick={() => setTeams((prev) => prev.filter((_, j) => j !== i))}
                                  aria-label="Quitar equipo"
                                >
                                  ×
                                </Button>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <PlayerSlot
                                  label="Jugador 1"
                                  value={t.player1}
                                  players={players}
                                  onPick={(name) =>
                                    setTeams((prev) =>
                                      prev.map((x, j) => {
                                        if (j !== i) return x;
                                        const auto = [name.trim(), x.player2.trim()].filter(Boolean).join(" / ");
                                        const prevAuto = [x.player1.trim(), x.player2.trim()].filter(Boolean).join(" / ");
                                        return { ...x, player1: name, name: !x.name || x.name === prevAuto ? auto : x.name };
                                      }),
                                    )
                                  }
                                  onType={(name) =>
                                    setTeams((prev) =>
                                      prev.map((x, j) => {
                                        if (j !== i) return x;
                                        const auto = [name.trim(), x.player2.trim()].filter(Boolean).join(" / ");
                                        const prevAuto = [x.player1.trim(), x.player2.trim()].filter(Boolean).join(" / ");
                                        return { ...x, player1: name, name: !x.name || x.name === prevAuto ? auto : x.name };
                                      }),
                                    )
                                  }
                                />
                                <PlayerSlot
                                  label="Jugador 2"
                                  value={t.player2}
                                  players={players}
                                  onPick={(name) =>
                                    setTeams((prev) =>
                                      prev.map((x, j) => {
                                        if (j !== i) return x;
                                        const auto = [x.player1.trim(), name.trim()].filter(Boolean).join(" / ");
                                        const prevAuto = [x.player1.trim(), x.player2.trim()].filter(Boolean).join(" / ");
                                        return { ...x, player2: name, name: !x.name || x.name === prevAuto ? auto : x.name };
                                      }),
                                    )
                                  }
                                  onType={(name) =>
                                    setTeams((prev) =>
                                      prev.map((x, j) => {
                                        if (j !== i) return x;
                                        const auto = [x.player1.trim(), name.trim()].filter(Boolean).join(" / ");
                                        const prevAuto = [x.player1.trim(), x.player2.trim()].filter(Boolean).join(" / ");
                                        return { ...x, player2: name, name: !x.name || x.name === prevAuto ? auto : x.name };
                                      }),
                                    )
                                  }
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* ============ PASO 5: SORTEO Y CALENDARIO ============ */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">Sorteo y calendario</h2>
                <Badge variant="outline">{teams.length} equipos</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="group-count" className="text-sm text-muted-foreground">Grupos:</Label>
                  <Input
                    id="group-count"
                    type="number"
                    min={1}
                    max={10}
                    value={groupCount}
                    onChange={(e) => setGroupCount(Math.max(1, Number(e.target.value)))}
                    className="w-16"
                  />
                </div>
                <Button type="button" onClick={handleDraw} disabled={teams.length < 2}>
                  <Dice5 className="h-4 w-4 mr-1" /> Sortear al azar
                </Button>
                {groups.length > 0 && (
                  <>
                    <span className="text-xs text-muted-foreground">sugerido: {suggestGroupCount(teams.length)}</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => setGroups([])}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Vaciar
                    </Button>
                  </>
                )}
              </div>

              {groups.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Sortea los grupos y ajusta arrastrando si quieres. Luego genera el calendario.
                </p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {groups.map((g) => (
                      <div key={g.name} className="rounded-xl border p-3">
                        <p className="mb-2 flex items-center justify-between text-sm font-semibold">
                          {g.name}
                          <Badge variant="outline">{g.pairIds.length}</Badge>
                        </p>
                        <SortableContext items={g.pairIds} strategy={verticalListSortingStrategy}>
                          <div className="min-h-12 space-y-2">
                            {g.pairIds.length === 0 && <p className="py-1 text-xs text-muted-foreground">Arrastra equipos aquí</p>}
                            {g.pairIds.map((id) => (
                              <SortablePairCard key={id} id={id} name={teamName(id)} onRemove={() => setGroups((gs) => gs.map((x) => (x.name === g.name ? { ...x, pairIds: x.pairIds.filter((y) => y !== id) } : x)))} />
                            ))}
                          </div>
                        </SortableContext>
                      </div>
                    ))}
                  </div>
                </DndContext>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navegación */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={back} disabled={step === 0 || saving}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next} disabled={!canAdvance || saving}>
            {saving ? "Guardando…" : "Siguiente"} <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={generateCalendarAndFinish} disabled={!groups.length || saving || generated}>
            {saving ? "Generando…" : generated ? "Listo ✓" : "Generar calendario y terminar"}
            <Check className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
