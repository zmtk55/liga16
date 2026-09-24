import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { db } from "@/lib/data";
import type { Club, Court, PadelDivision, Sex, Tournament, PlayerProfile, Pair } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { GripVertical } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CategoryMatrix, { type CategoryValue } from "@/components/ui/category-matrix";
import { categoriasValidas } from "@/lib/categories";
import PlayerSlot from "@/components/players/player-slot";
import { DEFAULT_SCORING } from "@/lib/scoring";
import { scheduleRounds, type Group } from "@/lib/groups";
import { sexShort } from "@/lib/format";
import { toast } from "sonner";
import { ensurePlayer } from "@/lib/players";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Dice5,
  ImagePlus,
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

const GRUPO_LETRAS = "ABCDEFGHIJ".split("");

interface TeamInput {
  division: PadelDivision;
  sex: Sex;
  name: string;
  player1: string;
  player2: string;
  logo: string | null;
  group: string | null; // "Grupo A"… si el admin lo asigna a mano
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
  groups,
  currentGroup,
  onReassign,
}: {
  id: string;
  name: string;
  onRemove: () => void;
  groups: string[];
  currentGroup: string;
  onReassign: (target: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`space-y-1 ${isDragging ? "opacity-60 shadow-lg z-10 relative" : ""}`}
    >
      <div className="flex items-center gap-1 rounded-lg border bg-card px-2 py-2 text-sm">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          aria-label={`Arrastrar ${name}`}
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
      {groups.length > 1 && (
        <Select value={currentGroup} onValueChange={onReassign}>
          <SelectTrigger className="h-6 border-none bg-transparent px-1 text-[11px] text-muted-foreground shadow-none" aria-label={`Mover ${name} a otro grupo`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectItem key={g} value={g}>{g}{g === currentGroup ? " (actual)" : ""}</SelectItem>
            ))}
            <SelectItem value="__pool__">Sin grupo</SelectItem>
          </SelectContent>
        </Select>
      )}
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
  const [clubId, setClubId] = useState<string | null>(null);
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
  // ids reales de categorías ya guardadas (para editar/sincronizar)
  const [catIds, setCatIds] = useState<Map<string, string>>(new Map());

  // Paso 4: equipos — formulario único (draft) + lista compacta de agregados
  const [teams, setTeams] = useState<TeamInput[]>([]);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const emptyDraft = (): TeamInput => ({
    division: (categories[0]?.label ?? "4ta") as PadelDivision,
    sex: categories[0]?.sex ?? "M",
    name: "",
    player1: "",
    player2: "",
    logo: null,
    group: null,
  });
  const [draft, setDraft] = useState<TeamInput>(emptyDraft);
  const draftWasManual = useRef(false);

  /** Auto-nombre del draft con los jugadores; respeta edición manual. */
  function updateDraftPlayers(slot: 1 | 2, name: string) {
    setDraft((d) => {
      const next = { ...d, [slot === 1 ? "player1" : "player2"]: name };
      const auto = [next.player1.trim(), next.player2.trim()].filter(Boolean).join(" / ");
      return { ...next, name: draftWasManual.current ? next.name : auto };
    });
  }

  /** Agrega el draft a la lista y limpia el formulario para el siguiente. */
  function commitDraft() {
    const t = { ...draft, name: draft.name.trim() || [draft.player1.trim(), draft.player2.trim()].filter(Boolean).join(" / ") };
    if (!t.player1.trim() || !t.player2.trim() || !t.division) return;
    setTeams((prev) => [...prev, t]);
    setDraft(emptyDraft());
    draftWasManual.current = false;
  }

  function initialsEquipo(t: TeamInput) {
    return (t.player1 || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  }

  // Paso 5: sorteo
  const [groups, setGroups] = useState<Group[]>([]);

  // Cargar contexto (sede, canchas, jugadores) y, en edición, el torneo completo
  useEffect(() => {
    db.listClubs().then((clubs: Club[]) => {
      if (clubs[0]) {
        setClubId(clubs[0].id);
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
        // categorías existentes → filas (name libre)
        const cats = await db.getTournamentCategories(t.id).catch(() => []);
        const rows: CategoryValue[] = (cats as unknown as Array<{ id: string; name: string; sex: Sex }>).map((c) => ({
          label: c.name,
          sex: c.sex,
        }));
        setCategories(rows);
        setCatIds(new Map((cats as unknown as Array<{ id: string; name: string }>).map((c) => [c.name.toLowerCase(), c.id])));
      });
    }
  }, [slug, navigate]);

  /** Qué falta en el paso actual — para avisar al usuario en vez de dejar el botón mudo. */
  const missingReason = useMemo(() => {
    if (step === 0) {
      if (!club.name.trim()) return "Escribe el nombre de la sede";
      if (courts.length === 0) return "Registra al menos una cancha";
    }
    if (step === 1 && !tournament.name.trim()) return "Escribe el nombre del torneo";
    if (step === 2 && !categoriasValidas(categories)) return "Añade al menos una categoría válida";
    if (step === 3) {
      if (teams.length === 0) return "Añade al menos un equipo";
      const bad = teams.find((t) => !t.player1.trim() || !t.player2.trim() || !t.division || !t.sex);
      if (bad) return `Equipo incompleto: "${bad.name || "(sin nombre)"}" — faltan jugadores o categoría`;
    }
    if (step === 4 && groups.length === 0) return "Ejecuta el sorteo para crear los grupos";
    return null;
  }, [step, club, courts, tournament, categories, teams, groups]);

  const canAdvance = useMemo(() => missingReason === null, [missingReason]);

  async function next() {
    if (!canAdvance) {
      if (missingReason) toast.warning(missingReason);
      return;
    }
    // Navegar al instante; la persistencia corre en segundo plano con toasts de error.
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    void persistStep(step + 1);
  }

  function addCourt() {
    const name = newCourt.trim();
    if (!name) return;
    setSaving(true);
    db.createCourt({ club_id: clubId ?? "", name, surface: "Sintética" } as never)
      .then((c) => {
        setCourts((prev) => [...prev, c]);
        setNewCourt("");
        toast.success(`Cancha "${name}" registrada`);
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
          const t = await db.getTournament(String(tournamentId));
          await db.updateTournament((t as unknown as { slug: string }).slug, payload);
        } else {
          const created = await db.createTournament(payload);
          setTournamentId((created as unknown as { id: string }).id);
        }
      }
      // Sincronizar categorías al pasar del paso 3
      if (target >= 3 && tournamentId) {
        // Quitar en BD las que borró el usuario
        const dbCats = await db.getTournamentCategories(String(tournamentId));
        for (const dbCat of dbCats as unknown as Array<{ id: string; name: string }>) {
          if (!categories.some((c) => c.label.trim().toLowerCase() === dbCat.name.toLowerCase())) {
            await db.deleteTournamentCategory(dbCat.id).catch(() => undefined);
          }
        }
        // Crear las nuevas (o actualizar el nombre de las existentes via create)
        const nextIds = new Map(catIds);
        for (const c of categories) {
          const key = c.label.trim().toLowerCase();
          const existingId = nextIds.get(key);
          if (!existingId) {
            const created = await db.createTournamentCategory({
              tournament_id: tournamentId,
              name: c.label.trim(),
              sex: c.sex,
              min_level: null,
              max_level: null,
              max_pairs: 0,
              registered_pairs: 0,
              price_cents: Math.round(tournament.price_mxn * 100),
            } as never);
            nextIds.set(key, (created as unknown as { id: string }).id);
          }
        }
        setCatIds(nextIds);
      }
      // Persistir equipos al pasar del paso 4 (antes estaban solo en memoria)
      if (target >= 4 && tournamentId) {
        const existing = await db.getTournamentPairs(String(tournamentId));
        const existingNames = new Set((existing as Pair[]).map((p) => p.name.toLowerCase()));
        for (const t of teams) {
          const name = t.name.trim();
          if (!name || existingNames.has(name.toLowerCase())) continue;
          // Perfiles de jugadores nuevos se crean aquí si no existen
          await Promise.all([
            ensurePlayer(t.player1, t.division).catch(() => null),
            ensurePlayer(t.player2, t.division).catch(() => null),
          ]);
          await db
            .createPair({
              tournament_id: String(tournamentId),
              category_id: catIds.get(t.division.toLowerCase()) ?? null,
              name,
            })
            .catch((e: Error) => toast.error(`${name}: ${e.message ?? "no se pudo registrar"}`));
        }
      }
    } finally {
      setSaving(false);
    }
  }

  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  /** Sorteo por categoría: baraja dentro de cada categoría, respeta los grupos asignados a mano. */
  function handleDraw() {
    const byCat = new Map<string, TeamInput[]>();
    teams.forEach((t) => {
      const k = `${t.division}|${t.sex}`;
      if (!byCat.has(k)) byCat.set(k, []);
      byCat.get(k)!.push(t);
    });

    const result: Group[] = [];
    const takenNames = new Set<string>();
    for (const [catKey, catTeams] of byCat) {
      const catLabel = categories.find((c) => `${c.label}|${c.sex}` === catKey)?.label ?? "";
      const multiCat = byCat.size > 1;
      const gname = (letra: string) => {
        const base = multiCat && catLabel ? `${catLabel} · Grupo ${letra}` : `Grupo ${letra}`;
        return base;
      };
      // Los ya asignados a mano se quedan; los libres se barajan
      const assigned = catTeams.filter((t) => t.group);
      const free = catTeams.filter((t) => !t.group);
      const shuffled = [...free].sort(() => Math.random() - 0.5);
      const pool = [...assigned, ...shuffled];

      // Grupos de la categoría: los que tengan asignados + suficientes para el resto
      const usedGroupNames = new Set(assigned.map((t) => t.group!));
      const extraNeeded = Math.max(0, Math.ceil(free.length / 4) - usedGroupNames.size);
      const catGroupNames: string[] = [...usedGroupNames];
      let li = 0;
      while (catGroupNames.length < usedGroupNames.size + extraNeeded && li < GRUPO_LETRAS.length) {
        const name = gname(GRUPO_LETRAS[li]);
        if (!takenNames.has(name)) catGroupNames.push(name);
        li++;
      }
      catGroupNames.forEach((n) => takenNames.add(n));

      const catGroups: Group[] = catGroupNames.map((name) => ({ name, pairIds: [] }));
      pool.forEach((t, i) => {
        const targetName = t.group ?? catGroupNames[i % catGroupNames.length];
        const g = catGroups.find((x) => x.name === targetName);
        if (g) g.pairIds.push(String(teams.indexOf(t)));
      });
      result.push(...catGroups);
    }
    setGroups(result);
  }

  function removeTeamFromGroups(index: string) {
    setGroups((gs) => gs.map((g) => ({ ...g, pairIds: g.pairIds.filter((x) => x !== index) })));
  }

  /** Reasignar equipo entre grupos (o al pool) con el selector — sin depender del drag. */
  function reassignTeam(teamIdx: string, target: string) {
    setGroups((gs) => {
      const without = gs.map((g) => ({ ...g, pairIds: g.pairIds.filter((x) => x !== teamIdx) }));
      if (target === "__pool__") return without;
      return without.map((g) => (g.name === target ? { ...g, pairIds: [...g.pairIds, teamIdx] } : g));
    });
    // Sincronizar el grupo asignado del equipo
    setTeams((prev) =>
      prev.map((t, i) => (String(i) === teamIdx ? { ...t, group: target === "__pool__" ? null : target } : t)),
    );
  }

  function addGroupManual() {
    setGroups((gs) => {
      const multiCat = new Set(teams.map((t) => `${t.division}|${t.sex}`)).size > 1;
      const catLabel = multiCat ? (categories[0]?.label ? `${categories[0].label} · ` : "") : "";
      return [...gs, { name: `${catLabel}Grupo ${GRUPO_LETRAS[gs.length % GRUPO_LETRAS.length]}`, pairIds: [] }];
    });
  }

  function renameGroupInWizard(index: number, name: string) {
    setGroups((gs) => gs.map((g, i) => (i === index ? { ...g, name } : g)));
  }

  const wizardSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleWizardDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const findGroupOf = (id: string) => groups.findIndex((g) => g.pairIds.includes(id));

    if (overId === "__pool__") {
      reassignTeam(activeId, "__pool__");
      return;
    }

    const from = findGroupOf(activeId);
    const to = findGroupOf(overId);
    if (from === -1 && to >= 0) {
      const targetName = groups[to]?.name ?? null;
      setGroups((gs) => gs.map((g, i) => (i === to ? { ...g, pairIds: [...g.pairIds, activeId] } : g)));
      setTeams((prev) => prev.map((t, i) => (String(i) === activeId ? { ...t, group: targetName } : t)));
    } else if (from >= 0 && to >= 0 && from !== to) {
      const targetName = groups[to]?.name ?? null;
      setGroups((gs) =>
        gs.map((g, i) => {
          if (i === from) return { ...g, pairIds: g.pairIds.filter((x) => x !== activeId) };
          if (i === to) return { ...g, pairIds: [...g.pairIds, activeId] };
          return g;
        }),
      );
      setTeams((prev) => prev.map((t, i) => (String(i) === activeId ? { ...t, group: targetName } : t)));
    } else if (from >= 0 && from === to) {
      setGroups((gs) =>
        gs.map((g, i) => (i === from ? { ...g, pairIds: arrayMove(g.pairIds, g.pairIds.indexOf(activeId), g.pairIds.indexOf(overId)) } : g)),
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
    if (groups.length === 0) {
      toast.warning("Primero sortea los grupos con el botón \"Sortear al azar\"");
      return;
    }
    const conRivales = groups.filter((g) => g.pairIds.length >= 2).length;
    if (conRivales === 0) {
      toast.warning("Necesitas al menos 2 equipos por grupo para generar partidos. Añade más equipos en el paso anterior.");
      return;
    }
    if (groups.some((g) => g.pairIds.length === 1)) {
      toast.warning("Hay grupos con un solo equipo: no tendrán partidos. Ajústalos o quita ese equipo.");
    }
    setSaving(true);
    try {
      const allMatches: Array<Parameters<typeof db.createMatches>[0][number]> = [];
      for (const group of groups) {
        if (group.pairIds.length < 2) continue;
        const rounds = scheduleRounds(group.pairIds, courts.length || 1, tournament.start_date, 60, 9);
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
      toast.success(`Torneo listo: ${allMatches.length} partidos generados`);
      navigate(`/admin/torneos/${tournamentId}`);
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
              <CategoryMatrix value={categories} onChange={setCategories} />
            </div>
          )}

          {/* ============ PASO 4: EQUIPOS — formulario único + lista compacta ============ */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Formulario de captura (se limpia al agregar) */}
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="mb-3 text-sm font-semibold">Agregar equipo</p>
                <div className="space-y-3">
                  {/* Fila 1: logo + jugadores */}
                  <div className="flex items-center gap-3">
                  <input
                    type="file"
                    id="logo-nuevo"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setDraft((d) => ({ ...d, logo: String(reader.result) }));
                      reader.readAsDataURL(file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById("logo-nuevo")?.click()}
                    className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background transition-colors hover:border-primary/60"
                    aria-label="Subir logo del equipo"
                    title="Subir logo"
                  >
                    {draft.logo ? (
                      <img src={draft.logo} alt="" className="h-full w-full object-contain p-1" />
                    ) : (
                      <ImagePlus className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1 grid gap-3 sm:grid-cols-2">
                    <PlayerSlot
                      label="Jugador 1"
                      value={draft.player1}
                      players={players}
                      onPick={(name) => updateDraftPlayers(1, name)}
                      onType={(name) => updateDraftPlayers(1, name)}
                    />
                    <PlayerSlot
                      label="Jugador 2"
                      value={draft.player2}
                      players={players}
                      onPick={(name) => updateDraftPlayers(2, name)}
                      onType={(name) => updateDraftPlayers(2, name)}
                    />
                  </div>
                  </div>
                  {/* Fila 2: categoría + grupo, siempre a lo ancho */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Categoría</Label>
                      <Select
                        value={categories.some((c) => `${c.label}|${c.sex}` === `${draft.division}|${draft.sex}`) ? `${draft.division}|${draft.sex}` : ""}
                        onValueChange={(v) => {
                          const [division, sex] = v.split("|") as [PadelDivision, Sex];
                          setDraft((d) => ({ ...d, division, sex }));
                        }}
                      >
                        <SelectTrigger className="h-9 bg-background">
                          <SelectValue placeholder="Elegir categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={`${c.label}-${c.sex}`} value={`${c.label}|${c.sex}`}>
                              {c.label} · {sexShort(c.sex)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Grupo (opcional)</Label>
                      <Select
                        value={draft.group ?? "none"}
                        onValueChange={(v) => setDraft((d) => ({ ...d, group: v === "none" ? null : v }))}
                      >
                        <SelectTrigger className="h-9 bg-background">
                          <SelectValue placeholder="Sin grupo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin grupo</SelectItem>
                          {GRUPO_LETRAS.map((l) => (
                            <SelectItem key={l} value={`Grupo ${l}`}>Grupo {l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* Fila 3: acción */}
                  <div className="flex items-center justify-between gap-3">
                    {draft.name ? (
                      <p className="min-w-0 truncate text-xs text-muted-foreground">Se agregará como "{draft.name}"</p>
                    ) : <span />}
                    <Button
                      type="button"
                      onClick={commitDraft}
                      disabled={!draft.player1.trim() || !draft.player2.trim() || !draft.division}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Agregar a la lista
                    </Button>
                  </div>
                </div>
              </div>

              {/* Lista compacta de agregados */}
              <div>
                <p className="mb-2 text-sm font-semibold">Equipos inscritos ({teams.length})</p>
                {teams.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Llena el formulario de arriba y presiona "Agregar a la lista". Puedes inscribir todos los que necesites seguidos.
                  </p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {teams.map((t, i) => (
                      <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <span className="w-6 text-center text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                        {t.logo ? (
                          <img src={t.logo} alt="" className="h-7 w-7 rounded object-contain" />
                        ) : (
                          <span className="flex h-7 w-7 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground">{initialsEquipo(t)}</span>
                        )}
                        <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
                        <Badge variant="outline" className="shrink-0">{t.division} · {sexShort(t.sex)}</Badge>
                        {t.group && <Badge variant="secondary" className="shrink-0">{t.group}</Badge>}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => setTeams((prev) => prev.filter((_, j) => j !== i))}
                          aria-label={`Quitar ${t.name}`}
                        >
                          ×
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
                <Button type="button" onClick={handleDraw} disabled={teams.length < 2} title={teams.length < 2 ? "Necesitas al menos 2 equipos" : undefined}>
                  <Dice5 className="h-4 w-4 mr-1" /> Sortear al azar
                </Button>
                <Button type="button" variant="outline" onClick={addGroupManual} disabled={teams.length === 0}>
                  <Plus className="h-4 w-4 mr-1" /> Crear grupo vacío
                </Button>
                {groups.length > 0 && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setGroups([])}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Vaciar
                  </Button>
                )}
                {teams.length < 2 && (
                  <p className="self-center text-sm text-amber-600 dark:text-amber-400">Añade al menos 2 equipos para poder sortear.</p>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                El sorteo baraja dentro de cada categoría y respeta los grupos que asignaste a mano. Después mueve
                equipos arrastrándolos entre grupos o con el selector de cada tarjeta. Puedes crear más grupos en cualquier momento.
              </p>

              {groups.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="text-sm text-muted-foreground">Sin grupos todavía: sortea o crea grupos vacíos y arrastra los equipos.</p>
                </div>
              ) : (
                <DndContext sensors={wizardSensors} collisionDetection={closestCenter} onDragEnd={handleWizardDragEnd}>
                  {/* Pool: equipos sin grupo */}
                  {(() => {
                    const assigned = new Set(groups.flatMap((g) => g.pairIds));
                    const pool = teams.map((_, i) => String(i)).filter((i) => !assigned.has(i));
                    if (pool.length === 0) return null;
                    return (
                      <div className="rounded-xl border border-dashed p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sin grupo ({pool.length}) — arrástralos a un grupo</p>
                        <SortableContext items={pool} strategy={verticalListSortingStrategy}>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {pool.map((idx) => (
                              <SortablePairCard
                                key={idx}
                                id={idx}
                                name={teamName(idx)}
                                onRemove={() => setTeams((prev) => prev.filter((_, j) => j !== Number(idx)))}
                                groups={groups.map((g) => g.name)}
                                currentGroup="__pool__"
                                onReassign={(target) => reassignTeam(idx, target)}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </div>
                    );
                  })()}

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {groups.map((g, gi) => (
                      <div key={g.name} className="rounded-xl border p-3">
                        <p className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold">
                          <Input
                            value={g.name}
                            onChange={(e) => renameGroupInWizard(gi, e.target.value)}
                            className="h-7 border-none bg-transparent px-1 font-semibold shadow-none focus-visible:ring-1"
                            aria-label={`Nombre del grupo ${gi + 1}`}
                          />
                          <span className="flex items-center gap-1">
                            <Badge variant="outline">{g.pairIds.length}</Badge>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setGroups((gs) => gs.filter((_, i) => i !== gi))}
                              aria-label={`Eliminar ${g.name}`}
                            >
                              ×
                            </Button>
                          </span>
                        </p>
                        <SortableContext items={g.pairIds} strategy={verticalListSortingStrategy}>
                          <div className="min-h-16 space-y-2 rounded-lg p-1">
                            {g.pairIds.length === 0 && <p className="py-2 text-xs text-muted-foreground">Arrastra equipos aquí</p>}
                            {g.pairIds.map((id) => (
                              <SortablePairCard
                                key={id}
                                id={id}
                                name={teamName(id)}
                                onRemove={() => removeTeamFromGroups(id)}
                                groups={groups.map((x) => x.name)}
                                currentGroup={g.name}
                                onReassign={(target) => reassignTeam(id, target)}
                              />
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
        <Button variant="outline" onClick={back} disabled={step === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next} title={missingReason ?? undefined} variant={canAdvance ? "default" : "outline"}>
            {canAdvance ? ("Siguiente") : missingReason} <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={generateCalendarAndFinish} disabled={!groups.length || saving}>
            {saving ? "Generando…" : "Generar calendario y terminar"}
            <Check className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
