import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { db } from "@/lib/data";
import type { Pair, Match, Tournament, TournamentCategory, Club } from "@/types";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BentoCard as Card } from "@/components/admin/bento-card";
import { BracketPanel } from "@/features/admin/tournament-bracket";
import { DrawPanel } from "@/features/admin/tournament-draw";
import { MatchResultDialog, GroupStandingsCard } from "@/features/admin/tournament-results";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DragEndEvent } from "@dnd-kit/core";

import { ChevronDown, Dice5, Pencil, Plus, Trash2, CalendarClock, UserPlus, Trophy, Check } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminEmptyState } from "@/components/admin/empty-state";
import { drawGroupsByCategory, isKnockoutRound, parseRound, type Group, type AvailabilityConfig } from "@/lib/groups";
import { groupsFromPairs, groupMatchDrafts, hasMatchActivity, reconcileMatches } from "@/lib/tournament-flow";
import { ensurePlayer } from "@/lib/players";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Court } from "@/types";
import { Checkbox } from "@/components/ui/checkbox";
import { FilterBar } from "@/components/ui/filter-bar";
import { AdminFacet, AdminFacets } from "@/components/admin/filter-facets";
import { countActive } from "@/lib/filters";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { AdminPageHeader, AdminStat, AdminStatStrip } from "@/components/admin/page-header";
import { TournamentStatusBadge } from "@/components/admin/status-badge";
import { formatCity, formatDateRange, formatLabel, formatMatchTime, SIN_CATEGORIA, tournamentStatusLabel } from "@/lib/format";
import { matchStatusKey } from "@/lib/match-state";
import { findScheduleIssues, isSlotFree, localDayKey, localTimeHHMM, rescheduleTo, todayKey, tournamentDays, assignSlotsToMatches } from "@/lib/schedule";

const TAB_LIST = "h-auto w-full flex-wrap justify-start gap-1 rounded-3xl border bg-card p-1.5";
const TAB_TRIGGER = "h-9 flex-none rounded-full px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none";

export default function AdminTournamentDetail() {
  const { slug } = useParams<{ slug: string }>();
  // La pestaña viva en la URL: cualquier vista es enlazable y se abre directa.
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "jornada";
  const setTab = (value: string) =>
    setParams(value === "jornada" ? {} : { tab: value }, { replace: true });
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [categories, setCategories] = useState<TournamentCategory[]>([]);
  const [pairs, setPairs] = useState<Pair[] | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  /** Número de grupos que quiere el admin por cada categoría (1–4, 0 = sugerido). */
  const [removeFromGroup, setRemoveFromGroup] = useState<string | null>(null);
  const [groupsPerCat, setGroupsPerCat] = useState(0);
  const [newPairName, setNewPairName] = useState("");
  const [newPairP1, setNewPairP1] = useState("");
  const [newPairP2, setNewPairP2] = useState("");
  const [newPairCategory, setNewPairCategory] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  /**
   * La disponibilidad de ESTE torneo: qué días hay juego, a qué horas y con
   * qué canchas. Cada torneo juega distinto, así que vive en el torneo (columna
   * `schedule_config`) y no en un valor único para toda la app.
   *
   * Antes de que el torneo tenga disponibilidad guardada, se deduce de lo que
   * ya está agendado: los días y las horas donde hay partidos y las canchas en
   * uso. Así el diálogo abre con lo que el torneo ya tiene, y no con los
   * defaults de siempre.
   */
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
  const [courts, setCourts] = useState<Court[]>([]);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  /** Reprogramar: día, hora y cancha de un partido, sin entrar al diálogo de captura. */
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [reschedule, setReschedule] = useState({ day: "", time: "", court: "" });

  function openReschedule(m: Match) {
    setReschedule({
      day: localDayKey(m.scheduled_at ?? "") || todayKey(),
      time: localTimeHHMM(m.scheduled_at ?? "") || "19:00",
      court: m.court_name ?? "",
    });
    setRescheduleId(m.id);
  }

  async function saveReschedule() {
    if (!rescheduleId || !reschedule.day || !reschedule.time) return;
    const scheduled_at = rescheduleTo(reschedule.day, reschedule.time);
    try {
      const updated = await db.updateMatch(rescheduleId, {
        scheduled_at,
        court_name: reschedule.court || null,
      });
      setMatches((prev) => prev.map((m) => (m.id === rescheduleId ? { ...m, ...updated } : m)));
      setRescheduleId(null);
      toast.success(
        `Reprogramado al ${new Date(`${reschedule.day}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })} a las ${reschedule.time}`,
      );
    } catch (e) {
      toast.error((e as Error).message ?? "No se pudo reprogramar el partido");
    }
  }
  const [jornadaDay, setJornadaDay] = useState<string>(() => todayKey());
  /**
   * La jornada se abre en un día que tenga partidos, no en "hoy": si el torneo se
   * agendó para el sábado y hoy es martes, entrar y ver un día vacío era leer
   * "no pasa nada" cuando en realidad había cuatro partidos esperando captura.
   * Solo salta una vez; después manda lo que elija la persona.
   */
  const [jornadaAutoOpened, setJornadaAutoOpened] = useState(false);
  // Edición de fechas del torneo
  const [datesOpen, setDatesOpen] = useState(false);
  const [datesForm, setDatesForm] = useState({ start_date: "", end_date: "", registration_deadline: "" });
  // Edición de equipos
  const [editingPair, setEditingPair] = useState<Pair | null>(null);
  const [pairForm, setPairForm] = useState({ name: "", category_id: "" });
  // Filtros
  const [pairQuery, setPairQuery] = useState("");
  /** Categoría de la lista de parejas: cada equipo juega en una sola. */
  const [pairCategory, setPairCategory] = useState("all");
  const [matchQuery, setMatchQuery] = useState("");
  const [matchRound, setMatchRound] = useState("all");


  useEffect(() => {
    if (!slug) return;
    db.getTournament(slug).then((t) => {
      setTournament(t);
      // La disponibilidad guardada del torneo es la que manda: es lo que el
      // organizador definió para ESTE torneo. Si no hay ninguna, se deja la que
      // haya y se deduce de los partidos ya agendados.
      const cfg = t?.schedule_config;
      if (cfg) {
        setScheduleConfig((c) => ({
          ...c,
          days: cfg.days ?? [],
          hours: cfg.hours?.length ? cfg.hours : c.hours,
          courtNames: cfg.courtNames ?? [],
          minutesPerMatch: cfg.minutesPerMatch || c.minutesPerMatch,
        }));
      }
    });
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
    db.getTournamentPairs(tournament.id).then((p) => { setPairs(p); setGroups(groupsFromPairs(p)); }).catch(() => setPairs([]));
    db.listMatchesByTournament(tournament.id).then(setMatches).catch(() => setMatches([]));
  }, [tournament]);

  const nameById = useMemo(() => {
    const map: Record<string, string> = {};
    (pairs ?? []).forEach((p) => {
      map[p.id] = p.name;
    });
    return map;
  }, [pairs]);

  useEffect(() => {
    if (jornadaAutoOpened || matches.length === 0) return;
    setJornadaAutoOpened(true);
    const byDay = new Map<string, number>();
    for (const m of matches) {
      const d = localDayKey(m.scheduled_at ?? "");
      if (!d) continue;
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    }
    const days = [...byDay.keys()].sort();
    if (days.length === 0) return;
    // Se abre en un día que tenga partidos, no en "hoy" a secas: si el torneo
    // se agendó para el sábado y hoy es martes, entrar y ver un día vacío era
    // leer una jornada que no existe. Y si hoy tiene partidos, hoy: es el día
    // vivo del torneo. Si no, el día con MÁS partidos, que es donde está el
    // trabajo. Antes se abría en el primero por fecha, que en un torneo de 11
    // días podía tener un solo partido y hacía ver la jornada vacía.
    const hoy = todayKey();
    const masCargado = days.reduce((a, b) => ((byDay.get(b) ?? 0) > (byDay.get(a) ?? 0) ? b : a));
    setJornadaDay(days.includes(hoy) ? hoy : masCargado);
  }, [matches, jornadaAutoOpened]);

  const catNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  /** Las categorías del torneo con la cuenta de parejas de cada una. */
  const pairCategoryOptions = useMemo(() => {
    const all = pairs ?? [];
    return categories
      .map((c) => ({ key: c.id, label: c.name, n: all.filter((p) => p.category_id === c.id).length }))
      .filter((o) => o.n > 0);
  }, [categories, pairs]);

  // El día de un partido es el día LOCAL: `scheduled_at` es un instante UTC y su
  // prefijo de fecha apunta al día siguiente para todo partido de la tarde noche.
  const matchDays = useMemo(() => [...new Set(matches.map((m) => localDayKey(m.scheduled_at ?? "")).filter(Boolean))].sort(), [matches]);
  /** Chques de cancha/hora y partidos sin cancha, por id: se pintan en la fila. */
  const scheduleIssues = useMemo(() => findScheduleIssues(matches), [matches]);
  const matchCourtsList = useMemo(() => [...new Set(matches.map((m) => m.court_name).filter(Boolean))] as string[], [matches]);
  /**
   * La categoría de un partido: la que se guardó al crearlo. En los partidos
   * antiguos, que no la traían, se cae al nombre del grupo —el sorteo los nombra
   * "4ta Varonil · Grupo A" cuando el torneo tiene varias categorías.
   */
  function matchCategoryName(m: Match): string {
    if (m.category_name) return m.category_name;
    return parseRound(m.round ?? "").group.split(" · ")[0];
  }
  /**
   * Las facetas de la jornada, con la cuenta de partidos de cada una.
   *
   * Eran cuatro desplegables: para saber qué días había o qué canchas se
   * usaban había que abrirlos uno por uno. Con la barra, de un vistazo.
   */
  const matchCategoryOptions = useMemo(() => {
    const n = new Map<string, number>();
    for (const m of matches) {
      const c = matchCategoryName(m);
      if (!c) continue;
      n.set(c, (n.get(c) ?? 0) + 1);
    }
    return [...n.entries()].map(([key, count]) => ({ key, label: key, n: count }));
  }, [matches]);

  const matchDayOptions = useMemo(() => {
    const n = new Map<string, number>();
    for (const m of matches) {
      const d = localDayKey(m.scheduled_at ?? "");
      if (!d) continue;
      n.set(d, (n.get(d) ?? 0) + 1);
    }
    return [...n.entries()]
      .map(([key, count]) => ({
        key,
        label: new Date(`${key}T12:00:00`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" }),
        n: count,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [matches]);

  const matchCourtOptions = useMemo(() => {
    const n = new Map<string, number>();
    for (const m of matches) {
      const c = m.court_name;
      if (!c) continue;
      n.set(c, (n.get(c) ?? 0) + 1);
    }
    return [...n.entries()].map(([key, count]) => ({ key, label: key, n: count }));
  }, [matches]);

  const matchRoundOptions = useMemo(() => {
    // La jornada es la del round-robin dentro del grupo: J1, J2, J3… El round
    // completo lleva la categoría y el grupo ("Sexta femenina · Grupo A · J1"),
    // así que usarlo de eje daba 20 opciones redundantes con el de categoría.
    const n = new Map<string, number>();
    for (const m of matches) {
      const j = parseRound(m.round ?? "").jornada;
      if (!j) continue;
      const key = `J${j}`;
      n.set(key, (n.get(key) ?? 0) + 1);
    }
    return [...n.entries()]
      .map(([key, count]) => ({ key, label: key.replace("J", "Jornada "), n: count }))
      .sort((a, b) => Number(a.key.slice(1)) - Number(b.key.slice(1)));
  }, [matches]);

  const assignedIds = useMemo(() => new Set(groups.flatMap((g) => g.pairIds)), [groups]);
  const unassigned = useMemo(
    () => (pairs ?? []).filter((p) => !assignedIds.has(p.id)),
    [pairs, assignedIds],
  );

  async function editableGroups() {
    if (!tournament || saving) return false;
    const current = await db.listMatchesByTournament(tournament.id);
    if (current.some((m) => hasMatchActivity(m) || isKnockoutRound(m.round))) {
      toast.error("El sorteo está bloqueado: ya hay actividad o eliminatorias. No se cambiarán los cruces.");
      return false;
    }
    return true;
  }

  async function saveGroups(next: Group[]) {
    if (!pairs) return;
    const names = new Map(next.flatMap((g) => g.pairIds.map((id) => [id, g.name] as const)));
    try {
      for (const p of pairs) {
        const name = names.get(p.id) ?? null;
        if (name !== p.group_name) await db.updatePair(p.id, { group_name: name });
      }
      setPairs(await db.getTournamentPairs(tournament!.id));
      setGroups(next);
    } catch (e) {
      const p = await db.getTournamentPairs(tournament!.id);
      setPairs(p); setGroups(groupsFromPairs(p));
      throw e;
    }
  }

  async function syncGroupMatches(next: Group[], current: Match[]) {
    if (!tournament || !pairs) return;
    const plan = reconcileMatches(current.filter((m) => !isKnockoutRound(m.round)), groupMatchDrafts(next, pairs, tournament.id, catNameById));
    // Insert first: an insert error cannot erase the previous calendar.
    if (plan.create.length) await db.createMatches(plan.create);
    for (const m of plan.remove) await db.deleteMatchById(m.id);
  }

  async function handleDraw() {
    if (!pairs || pairs.length < 2 || !await editableGroups()) return;
    setSaving(true);
    try {
      const drawn = drawGroupsByCategory(pairs.map((p) => ({
        id: p.id, category_id: p.category_id ?? null,
        categoryName: catNameById.get(p.category_id) ?? "Sin categoría",
      })), groupsPerCat > 0 ? (ps) => Math.min(groupsPerCat, ps.length) : undefined, false);
      await saveGroups(drawn);
      await syncGroupMatches(drawn, await db.listMatchesByTournament(tournament!.id));
      await reload();
      toast.success(`Sorteo listo: ${drawn.length} grupos y sus cruces generados. Reparte el calendario para asignar horas.`);
    } catch (e) { toast.error((e as Error).message); await reload(); }
    finally { setSaving(false); }
  }

  async function clearGroups() {
    if (!await editableGroups()) return;
    setSaving(true);
    try { await saveGroups([]); await syncGroupMatches([], await db.listMatchesByTournament(tournament!.id)); await reload(); toast.success("Grupos vaciados. Los equipos siguen inscritos."); }
    catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleDragEnd(e: DragEndEvent) {
    if (!e.over || !pairs || !await editableGroups()) return;
    const id = String(e.active.id), target = String(e.over.id);
    const pair = pairs.find((p) => p.id === id);
    if (!pair || target === id) return;
    const to = target.startsWith("group:") ? Number(target.slice(6)) : groups.findIndex((g) => g.pairIds.includes(target));
    const pool = target === "__pool__" || (to < 0 && pairs.some((p) => p.id === target && !p.group_name));
    if (!pool && (to < 0 || !groups[to])) return;
    if (!pool) {
      const g = groups[to];
      const cat = g.categoryId ?? pairs.find((p) => g.pairIds.includes(p.id))?.category_id;
      if (cat !== undefined && cat !== (pair.category_id ?? "")) { toast.error("No se pueden mezclar categorías"); return; }
    }
    const next = groups.map((g, i) => ({ ...g, pairIds: g.pairIds.filter((x) => x !== id).concat(!pool && i === to ? [id] : []),
      categoryId: !pool && i === to ? (pair.category_id ?? "") : g.categoryId }));
    setSaving(true);
    try { await saveGroups(next); await syncGroupMatches(next, await db.listMatchesByTournament(tournament!.id)); await reload(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  function addGroup() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const name = [...letters].map((letter) => `Grupo ${letter}`).find((name) => !groups.some((g) => g.name === name));
    if (name) setGroups((gs) => [...gs, { name, pairIds: [] }]);
  }

  async function renameGroup(index: number, raw: string) {
    const name = raw.trim();
    if (!name || groups.some((g, i) => i !== index && g.name === name)) { toast.error("Usa un nombre de grupo único y no vacío"); return; }
    if (!await editableGroups()) return;
    setSaving(true);
    try { const next = groups.map((g, i) => i === index ? { ...g, name } : g); await saveGroups(next); await syncGroupMatches(next, await db.listMatchesByTournament(tournament!.id)); await reload(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  async function ungroupPair(id: string) {
    if (!await editableGroups()) return;
    setSaving(true);
    try { const next = groups.map((g) => ({ ...g, pairIds: g.pairIds.filter((x) => x !== id) })); await saveGroups(next); await syncGroupMatches(next, await db.listMatchesByTournament(tournament!.id)); await reload(); toast.success("Equipo sin grupo; sigue inscrito"); }
    catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
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
      const oldName = editingPair.name;
      await db.updatePair(editingPair.id, {
        name: pairForm.name.trim(),
        category_id: pairForm.category_id || null,
      });
      // El calendario ya guardó side_a/side_b con el nombre anterior: se
      // actualizan aquí para que Resultados y el rol del equipo muestren el
      // equipo renombrado sin tener que regenerar partidos.
      if (oldName !== pairForm.name.trim() && tournament) {
        const matches = await db.listMatchesByTournament(tournament.id).catch(() => []);
        for (const m of matches) {
          let touched = false;
          const side_a = m.side_a?.pair_id === editingPair.id || m.side_a?.pair_name === oldName
            ? { ...m.side_a, pair_name: pairForm.name.trim() }
            : m.side_a;
          const side_b = m.side_b?.pair_id === editingPair.id || m.side_b?.pair_name === oldName
            ? { ...m.side_b, pair_name: pairForm.name.trim() }
            : m.side_b;
          touched = side_a !== m.side_a || side_b !== m.side_b;
          if (touched) {
            try { await db.updateMatch(m.id, { side_a, side_b }); } catch { /* non-fatal */ }
          }
        }
      }
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
      const courtNames = scheduleConfig.courtNames.length > 0 ? scheduleConfig.courtNames : courts.map((c) => c.name);
      if (courtNames.length === 0) {
        toast.error("Registra canchas en la sección Sede primero");
        return;
      }
      const existing = await db.listMatchesByTournament(tournament.id);
      const plan = reconcileMatches(existing.filter((m) => !isKnockoutRound(m.round)), groupMatchDrafts(groups, pairs ?? [], tournament.id, catNameById));
      const retained = existing.filter((m) => !plan.remove.some((x) => x.id === m.id));
      // Only untouched group games receive new slots. Reserve every other game's slot.
      const pending = retained.filter((m) => !isKnockoutRound(m.round) && !hasMatchActivity(m));
      const protectedMatches = retained.filter((m) => isKnockoutRound(m.round) || hasMatchActivity(m));
      const drafts = plan.create.map((m, i) => ({ ...m, id: `new:${i}` }));
      const scheduled = [...pending, ...drafts];
      const { assignments, missing, slots } = assignSlotsToMatches(
        scheduled.map((m) => ({ id: m.id, jornada: parseRound(m.round).jornada ?? 0, category: m.category_name })),
        { days: scheduleConfig.days, hours: scheduleConfig.hours, courtNames },
        protectedMatches,
      );
      if (missing > 0) { toast.error(`Faltan huecos: ${missing} partidos no caben en ${slots} huecos libres. Marca más días u horas.`); return; }
      const byId = new Map(assignments.map((a) => [a.id, a]));
      const newMatches = drafts.map(({ id, ...m }) => ({ ...m, scheduled_at: byId.get(id)!.at, court_name: byId.get(id)!.court }));
      if (newMatches.length) await db.createMatches(newMatches);
      for (const m of plan.remove) await db.deleteMatchById(m.id);
      for (const m of pending) {
        const a = byId.get(m.id)!;
        await db.updateMatch(m.id, { scheduled_at: a.at, court_name: a.court });
      }
      // La disponibilidad queda guardada EN el torneo: cada torneo juega
      // distinto, y al volver a abrirlo tiene que abrir con sus mismos días,
      // sus mismas horas y sus mismas canchas.
      const guardado = await db
        .saveTournamentScheduleConfig(tournament.id, {
          days: scheduleConfig.days,
          hours: scheduleConfig.hours,
          courtNames,
          minutesPerMatch: scheduleConfig.minutesPerMatch,
        })
        .catch(() => false);
      const updated = await db.listMatchesByTournament(tournament.id);
      setMatches(updated);
      setScheduleOpen(false);
      toast.success(
        `Calendario listo: ${assignments.length} partidos repartidos en ${scheduleConfig.days.length} día(s), ${scheduleConfig.hours.length} hora(s) y ${courtNames.length} cancha(s). Los resultados se conservaron.${
          guardado ? "" : " La disponibilidad no se pudo guardar (falta aplicar la migración de la base)."
        }`,
      );
    } catch (e) {
      toast.error((e as Error).message ?? "Error al generar el calendario");
    } finally {
      setSaving(false);
    }
  }

  const STATUS_TRANSITIONS: Record<Tournament["status"], { label: string; target: Tournament["status"] }[]> = {
    draft: [
      { label: "Publicar", target: "published" },
      { label: "Cancelar", target: "cancelled" },
    ],
    published: [
      { label: "Abrir inscripciones", target: "registration_open" },
      { label: "Pasar a borrador", target: "draft" },
      { label: "Cancelar", target: "cancelled" },
    ],
    registration_open: [
      { label: "Cerrar inscripciones", target: "registration_closed" },
      { label: "Iniciar torneo", target: "in_progress" },
      { label: "Volver a publicar", target: "published" },
    ],
    registration_closed: [
      { label: "Abrir inscripciones", target: "registration_open" },
      { label: "Iniciar torneo", target: "in_progress" },
      { label: "Volver a publicar", target: "published" },
    ],
    in_progress: [
      { label: "Finalizar", target: "finished" },
      { label: "Cancelar", target: "cancelled" },
    ],
    finished: [{ label: "Reabrir", target: "registration_open" }],
    cancelled: [{ label: "Reactivar", target: "draft" }],
  };

  const [changingStatus, setChangingStatus] = useState<{ target: Tournament["status"] } | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  async function handleStatusChange(target: Tournament["status"]) {
    if (!tournament) return;
    setStatusSaving(true);
    try {
      await db.updateTournament(tournament.slug, { status: target });
      setTournament({ ...tournament, status: target });
      toast.success(`Torneo cambiado a ${tournamentStatusLabel[target]}`);
    } catch (e) {
      toast.error((e as Error).message ?? "Error al cambiar estado");
    } finally {
      setStatusSaving(false);
      setChangingStatus(null);
    }
  }

  if (!tournament) return <Skeleton className="h-64 w-full rounded-3xl" />;

  const club = clubs.find((c) => c.id === tournament.club_id);
  const filteredPairs = (pairs ?? []).filter((p) => {
    const q = pairQuery.trim().toLowerCase();
    if (pairCategory !== "all" && (p.category_id ?? "") !== pairCategory) return false;
    return !q || p.name.toLowerCase().includes(q) || (catNameById.get(p.category_id ?? "") ?? "").toLowerCase().includes(q);
  });
  const filteredMatches = matches
    .filter((m) => {
      const q = matchQuery.trim().toLowerCase();
      if (q && !m.side_a.pair_name.toLowerCase().includes(q) && !m.side_b.pair_name.toLowerCase().includes(q)) return false;
      // La jornada se compara con la del round ("J2"), no con el round entero:
      // el round lleva la categoría y el grupo, y el filtro de jornada es el
      // número de ronda dentro del grupo.
      if (matchRound !== "all" && `J${parseRound(m.round ?? "").jornada ?? ""}` !== matchRound) return false;
      // El día se compara con `localDayKey`, no con el prefijo UTC del string:
      // `scheduled_at` es un instante UTC y el filtro lista días locales. Con
      // `startsWith` todos los partidos de la tarde-noche (18:00 en adelante) se
      // escondían del día que de verdad son, y el contador de arriba no cuadraba
      // con la lista.
      if (matchDay !== "all" && localDayKey(m.scheduled_at ?? "") !== matchDay) return false;
      if (matchCourt !== "all" && m.court_name !== matchCourt) return false;
      // La categoría se lee del partido, no del texto de la ronda: es el dato,
      // no una convención de nombres.
      if (matchCategory !== "all" && matchCategoryName(m) !== matchCategory) return false;
      // La búsqueda por texto ya cubre jugadores: el nombre de la pareja
      // es "Jugador1 / Jugador2", así que teclear un nombre filtra sus partidos.
      return true;
    })
    .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)));

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title={tournament.name}
        description={`${club?.name ?? formatCity(tournament.city)} · ${formatDateRange(tournament.start_date, tournament.end_date)} · ${formatLabel[tournament.format] ?? tournament.format}`}
        backTo="/admin/torneos"
        backLabel="Torneos"
        action={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={statusSaving}>
                  <TournamentStatusBadge status={tournament.status} />
                  <ChevronDown className="h-3.5 w-3.5 ms-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(STATUS_TRANSITIONS[tournament.status] ?? []).map((tr) => (
                  <DropdownMenuItem
                    key={tr.target}
                    onClick={() => setChangingStatus({ target: tr.target })}
                    disabled={statusSaving}
                  >
                    <Check className="h-3.5 w-3.5 ms-2" />
                    {tr.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {tournament.semifinal_slots != null && (
              <Badge variant="outline" className="h-8 gap-1.5 px-3">
                <Trophy className="h-3.5 w-3.5" />
                {tournament.semifinal_slots} a semifinales
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={openEditDates}>
              <Pencil className="h-3.5 w-3.5" /> Fechas
            </Button>
          </>
        }
      >
        <AdminStatStrip loading={!pairs}>
          <AdminStat value={(pairs ?? []).length} label="Parejas" />
          <AdminStat value={matches.length} label="Partidos" />
          <AdminStat
            value={matches.filter((m) => matchStatusKey(m) === "finished").length}
            label="Jugados"
            tone="text-success"
          />
          <AdminStat
            value={matches.filter((m) => matchStatusKey(m) !== "finished").length}
            label="Por jugar"
            tone="text-primary"
          />
        </AdminStatStrip>
      </AdminPageHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className={TAB_LIST}>
          <TabsTrigger value="jornada" className={TAB_TRIGGER}>Jornada</TabsTrigger>
          <TabsTrigger value="parejas" className={TAB_TRIGGER}>Parejas</TabsTrigger>
          <TabsTrigger value="grupos" className={TAB_TRIGGER}>Grupos y sorteo</TabsTrigger>
          <TabsTrigger value="posiciones" className={TAB_TRIGGER}>Posiciones</TabsTrigger>
          <TabsTrigger value="calendario" className={TAB_TRIGGER}>Calendario ({matches.length})</TabsTrigger>
          <TabsTrigger value="bracket" className={TAB_TRIGGER}>Bracket</TabsTrigger>
        </TabsList>

        {/* ============ BRACKET ============ */}
        <TabsContent value="bracket" className="space-y-4 pt-2">
          <BracketPanel
            pairs={pairs ?? []}
            matches={matches}
            categories={categories}
            scoring={tournament.scoring}
            slots={tournament.semifinal_slots ?? 4}
            tournamentId={tournament.id}
            onReload={reload}
            onEditMatch={setEditingMatchId}
          />
        </TabsContent>

        {/* ============ JORNADA ============ */}
        <TabsContent value="jornada" className="space-y-4 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Día:</span>
            <DatePicker
              value={jornadaDay}
              onChange={(v) => setJornadaDay(v ?? todayKey())}
              ariaLabel="Elegir día de la jornada"
            />
            <Badge variant="outline">
              {(() => {
                const n = matches.filter((m) => localDayKey(m.scheduled_at ?? "") === jornadaDay).length;
                return `${n} ${n === 1 ? "partido" : "partidos"}`;
              })()}
            </Badge>
          </div>
          {(() => {
            const dayMatches = matches
              .filter((m) => localDayKey(m.scheduled_at ?? "") === jornadaDay)
              .sort((a, b) =>
                String(a.court_name).localeCompare(String(b.court_name)) ||
                String(a.scheduled_at).localeCompare(String(b.scheduled_at)),
              );
            if (dayMatches.length === 0) {
              return (
                <Card>
                  <CardContent className="p-0">
                    <AdminEmptyState
                      icon={<CalendarClock className="h-5 w-5" />}
                      title="Sin partidos este día"
                      description="Genera el calendario en «Grupos y sorteo» o elige otra fecha de la jornada."
                      action={
                        <Button variant="outline" size="sm" onClick={() => setTab("grupos")}>
                          <Dice5 className="h-4 w-4" /> Ir a Grupos y sorteo
                        </Button>
                      }
                    />
                  </CardContent>
                </Card>
              );
            }
return (
                  <div className="space-y-2">
                    {dayMatches.map((m) => {
                      const done = matchStatusKey(m) === "finished" && m.winner;
                      const score = m.sets.map((x) => `${x.a}-${x.b}`).join(" ");
                      // Extraer grupo y jornada del campo round: "Grupo A · J1"
                      const { group: groupName, jornada } = parseRound(m.round ?? "");
                      const jornadaNum = jornada ? `J${jornada}` : "";
                      const courtDisplay = m.court_name?.trim() || "Sin cancha";
                      const timeDisplay = m.scheduled_at ? formatMatchTime(m.scheduled_at) : "—";
                      return (
                        /* h-auto: el Button trae `h-9` fijo (36px) y esta fila
                           apila dos columnas de badges: con el alto fijo, la
                           segunda línea se salía de la caja y el partido
                           quedaba cortado a media altura. */
                        <Button
                          key={m.id}
                          type="button"
                          variant="outline"
                          className="h-auto w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-3xl bg-card px-5 py-4 text-start text-sm hover:border-primary/40 hover:bg-muted/40"
                          onClick={() => setEditingMatchId(m.id)}
                        >
                          <span className="flex min-w-0 shrink-0 flex-col items-start gap-1">
                            <Badge variant="secondary" className="max-w-full truncate text-xs font-normal">
                              {groupName || "Sin grupo"}
                            </Badge>
                            {jornadaNum && (
                              <Badge variant="outline" className="text-xs font-normal">{jornadaNum}</Badge>
                            )}
                          </span>
                          <span className="flex min-w-0 shrink-0 flex-col items-start gap-1">
                            <span className="text-xs tabular-nums text-muted-foreground">{timeDisplay}</span>
                            <Badge variant="secondary" className="text-xs font-normal">{courtDisplay}</Badge>
                          </span>
                          <span className={`min-w-0 flex-1 truncate ${done ? "line-through decoration-border" : "font-medium"}`}>
                            {m.side_a.pair_name} <span className="text-muted-foreground"> vs </span> {m.side_b.pair_name}
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
                    <Label htmlFor="categoria">Categoría</Label>
                    <Select value={newPairCategory || categories[0]?.id} onValueChange={setNewPairCategory}>
                      <SelectTrigger id="categoria"><SelectValue placeholder={SIN_CATEGORIA} /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button onClick={handleAddPair} disabled={saving || !newPairP1.trim() || !newPairP2.trim()}>
                  <UserPlus className="h-4 w-4 ms-1" /> Registrar equipo
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-3">
              <FilterBar
                search={pairQuery}
                onSearch={setPairQuery}
                searchPlaceholder="Buscar equipo o categoría…"
                resultCount={filteredPairs.length}
                resultLabel="parejas"
                activeCount={countActive(pairCategory)}
                onClear={() => { setPairQuery(""); setPairCategory("all"); }}
              >
                <AdminFacets>
                  <AdminFacet
                    label="Categoría"
                    value={pairCategory}
                    onChange={setPairCategory}
                    options={pairCategoryOptions}
                    allLabel="Todas"
                  />
                </AdminFacets>
              </FilterBar>
            </CardHeader>
            <CardContent className="p-0">
              {!pairs ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : pairs.length === 0 ? (
                <AdminEmptyState
                  icon={<UserPlus className="h-5 w-5" />}
                  title="Aún no hay equipos"
                  description="Registra el primero con el formulario de arriba."
                />
              ) : filteredPairs.length === 0 ? (
                <AdminEmptyState
                  icon={<UserPlus className="h-5 w-5" />}
                  title="Sin coincidencias"
                  description="Ningún equipo coincide con la búsqueda."
                />
              ) : (
                <ul className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredPairs.map((p) => (
                    <li key={p.id} className="flex min-h-28 flex-col justify-between gap-4 rounded-3xl border bg-card p-5">
                      <span className="font-display text-lg font-semibold leading-snug">{p.name}</span>
                      <span className="flex items-center justify-between gap-2">
                        {p.category_id ? (
                          <Badge variant="secondary" className="rounded-full">{catNameById.get(p.category_id) ?? "—"}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">{SIN_CATEGORIA}</span>
                        )}
                        <span className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditPair(p)} aria-label={`Editar ${p.name}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleRemovePair(p.id)} aria-label={`Eliminar ${p.name}`}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ GRUPOS ============ */}
        <TabsContent value="grupos" className="space-y-4 pt-2">
          <DrawPanel
            pairs={pairs}
            categories={categories}
            groups={groups}
            unassigned={unassigned}
            nameById={nameById}
            groupsPerCat={groupsPerCat}
            setGroupsPerCat={setGroupsPerCat}
            saving={saving}
            onDraw={handleDraw}
            onAddGroup={addGroup}
            onClear={clearGroups}
            onSchedule={() => {
              // Al abrir se marcan los días donde YA hay partidos: es la
              // disponibilidad real del torneo. Si no hay partidos todavía, se
              // marcan los días del torneo.
              setScheduleConfig((c) => ({
                ...c,
                days: c.days.length > 0 ? c.days : matchDays.length > 0 ? matchDays : tournamentDays(tournament),
              }));
              setScheduleOpen(true);
            }}
            onRename={renameGroup}
            onRemovePair={setRemoveFromGroup}
            onDragEnd={handleDragEnd}
          />
        </TabsContent>

        {/* ============ TABLAS DE POSICIONES ============ */}
        <TabsContent value="posiciones" className="space-y-4 pt-2">
          {groups.length === 0 ? (
            <Card>
              <CardContent className="p-0">
                <AdminEmptyState
                  icon={<Trophy className="h-5 w-5" />}
                  title="Aún no hay grupos"
                  description="Ve a «Grupos y sorteo» y sortea los equipos para ver las posiciones."
                  action={
                    <Button variant="outline" size="sm" onClick={() => setTab("grupos")}>
                      <Dice5 className="h-4 w-4" /> Ir a Grupos y sorteo
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <GroupStandingsCard
                  key={g.name}
                  group={g}
                  matches={matches}
                  nameById={nameById}
                  pairs={pairs ?? []}
                  categories={categories}
                  tournament={tournament}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ============ CALENDARIO ============ */}
        <TabsContent value="calendario" className="space-y-4 pt-2">
          {matches.length === 0 ? (
            <Card>
              <CardContent className="p-0">
                <AdminEmptyState
                  icon={<CalendarClock className="h-5 w-5" />}
                  title="Sin partidos generados"
                  description="Ve a la pestaña de grupos, sortea y pulsa «Generar calendario»."
                  action={
                    <Button variant="outline" size="sm" onClick={() => setTab("grupos")}>
                      <Dice5 className="h-4 w-4" /> Ir a Grupos y sorteo
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Lo primero que necesita ver quien entra al calendario: qué falta
                  capturar y qué está chocado, antes de la lista. */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {matches.filter((m) => matchStatusKey(m) !== "finished").length} sin capturar
                </Badge>
                <Badge variant="outline">
                  {matchDays.length} día{matchDays.length === 1 ? "" : "s"}
                </Badge>
                <Badge variant="outline">
                  {matchCourtsList.length} cancha{matchCourtsList.length === 1 ? "" : "s"}
                </Badge>
                {scheduleIssues.size > 0 ? (
                  <Badge variant="outline" className="border-destructive/50 text-destructive">
                    {scheduleIssues.size} con problema{scheduleIssues.size === 1 ? "" : "s"}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-success/50 text-success">
                    Sin choques
                  </Badge>
                )}
              </div>
              <FilterBar
                search={matchQuery}
                onSearch={setMatchQuery}
                searchPlaceholder="Buscar equipo o jugador…"
                resultCount={filteredMatches.length}
                resultLabel="partidos"
                activeCount={countActive(matchCategory, matchDay, matchCourt, matchRound)}
                onClear={() => {
                  setMatchQuery("");
                  setMatchCategory("all");
                  setMatchDay("all");
                  setMatchCourt("all");
                  setMatchRound("all");
                }}
              >
                <AdminFacets>
                  <AdminFacet
                    label="Categoría"
                    value={matchCategory}
                    onChange={setMatchCategory}
                    options={matchCategoryOptions}
                    allLabel="Todas"
                  />
                  <AdminFacet
                    label="Día"
                    value={matchDay}
                    onChange={setMatchDay}
                    options={matchDayOptions}
                    allLabel="Todos"
                  />
                  <AdminFacet
                    label="Cancha"
                    value={matchCourt}
                    onChange={setMatchCourt}
                    options={matchCourtOptions}
                    allLabel="Todas"
                  />
                  <AdminFacet
                    label="Jornada"
                    value={matchRound}
                    onChange={setMatchRound}
                    options={matchRoundOptions}
                    allLabel="Todas"
                  />
                </AdminFacets>
                {/* El conmutador de vista va a la derecha y ajustado a su
                    contenido: estirado a todo el ancho dejaba una franja
                    vacía bajo las barras de filtro. */}
                <div className="flex justify-end">
                  <div className="flex items-center gap-1 rounded-lg border p-1">
                    {(["lista", "timeline"] as const).map((v) => (
                      <Button key={v} type="button" size="sm" variant={calView === v ? "secondary" : "ghost"} className="h-7 text-xs capitalize" onClick={() => setCalView(v)}>
                        {v}
                      </Button>
                    ))}
                  </div>
                </div>
              </FilterBar>
              {calView === "timeline" ? (
                (() => {
                  const days = matchDay !== "all" ? [matchDay] : matchDays;
                  const courtCols = matchCourt !== "all" ? [matchCourt] : matchCourtsList;
                  if (days.length === 0 || courtCols.length === 0) {
                    return (
                      <AdminEmptyState
                        icon={<CalendarClock className="h-5 w-5" />}
                        title="Sin partidos para este filtro"
                        description="Ningún partido cae en el día y la cancha que elegiste."
                        action={
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setMatchQuery("");
                              setMatchCategory("all");
                              setMatchDay("all");
                              setMatchCourt("all");
                              setMatchRound("all");
                            }}
                          >
                            Quitar filtros
                          </Button>
                        }
                      />
                    );
                  }
                  return (
                    <div className="space-y-6">
                      {days.map((day) => {
                        const dayMatches = filteredMatches.filter((m) => localDayKey(m.scheduled_at ?? "") === day);
                        if (dayMatches.length === 0) return null;
                        const times = [...new Set(dayMatches.map((m) => localTimeHHMM(m.scheduled_at ?? "")))].sort();
                        return (
                          <div key={day} className="overflow-x-auto rounded-xl border">
                            <p className="border-b bg-muted/40 px-4 py-2 text-sm font-semibold">
                              {new Date(`${day}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
                              <span className="ms-2 text-xs font-normal text-muted-foreground">{dayMatches.length} partidos</span>
                            </p>
                            <table className="w-full min-w-160 text-sm">
                              <thead>
                                <tr className="border-b text-start text-xs text-muted-foreground">
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
                                      const m = dayMatches.find((x) => x.court_name === c && localTimeHHMM(x.scheduled_at ?? "") === t);
                                      if (!m) return <td key={c} className="px-3 py-2" />;
                                      const done = matchStatusKey(m) === "finished" && m.winner;
                                      return (
                                        <td key={c} className="px-2 py-1.5">
                                          <Button
                                            type="button"
                                            variant={done ? "secondary" : "outline"}
                                            className="w-full flex-col items-start gap-0.5 px-2.5 py-1.5 text-start text-xs hover:border-primary/40 hover:bg-muted/40"
                                            onClick={() => setEditingMatchId(m.id)}
                                          >
                                            <span className={`block max-w-full truncate font-normal ${done ? "line-through decoration-border" : ""}`}>
                                              {m.side_a.pair_name} vs {m.side_b.pair_name}
                                            </span>
                                            <span className="block max-w-full truncate text-xs font-normal text-muted-foreground">{m.round}{done ? ` · ${m.sets.map((s) => `${s.a}-${s.b}`).join(" ")}` : ""}</span>
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
                (() => {
                  // La fecha del partido es la etiqueta real; "Jornada N" queda
                  // como filtro, no como etiqueta visual. Agrupamos por día.
                  const groups: { key: string; label: string; items: typeof filteredMatches }[] = [];
                  for (const m of filteredMatches) {
                    const key = m.scheduled_at ? localDayKey(m.scheduled_at) : "sin-fecha";
                    const label = m.scheduled_at
                      ? new Date(`${key}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })
                      : "Sin fecha";
                    const g = groups.find((x) => x.key === key);
                    if (g) g.items.push(m);
                    else groups.push({ key, label, items: [m] });
                  }
                  const plural = (n: number) => (n === 1 ? "partido" : "partidos");
                  return (
                    <div className="space-y-6">
                      {groups.length === 0 && (
                        <AdminEmptyState
                          icon={<CalendarClock className="h-5 w-5" />}
                          title="Sin partidos para este filtro"
                          description="Ningún partido cae en la categoría, el día o la jornada que elegiste."
                          action={
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setMatchQuery("");
                                setMatchCategory("all");
                                setMatchDay("all");
                                setMatchCourt("all");
                                setMatchRound("all");
                              }}
                            >
                              Quitar filtros
                            </Button>
                          }
                        />
                      )}
                      {groups.map((g) => (
                        <section key={g.key} className="space-y-2">
                          <p className="flex flex-wrap items-baseline gap-x-2 border-b pb-1.5 text-sm font-semibold">
                            {g.label}
                            <span className="text-xs font-normal text-muted-foreground">{plural(g.items.length)}</span>
                          </p>
                          {g.items.map((m) => (
                            <Card key={m.id} className="overflow-hidden">
                              <CardContent className="flex items-center gap-3 px-3 py-2 text-sm">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                  <div className="flex shrink-0 flex-col items-center rounded-md bg-muted/60 px-1 py-1">
                                    <span className="text-sm font-bold tabular-nums leading-none">{m.scheduled_at ? localTimeHHMM(m.scheduled_at) : "--:--"}</span>
                                    <span className="mt-0.5 text-caption font-medium uppercase tracking-wide text-muted-foreground">{m.court_name ?? "S/C"}</span>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium leading-tight">
                                      {m.side_a.pair_name} <span className="text-muted-foreground">vs</span> {m.side_b.pair_name}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {club?.name ?? "—"} {m.round ? `· ${m.round}` : ""}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  {(scheduleIssues.get(m.id) ?? []).map((issue, i) => (
                                    <Badge key={i} variant="outline" className="border-destructive/50 text-destructive">
                                      {issue.label}
                                    </Badge>
                                  ))}
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => openReschedule(m)} aria-label={`Reprogramar ${m.side_a.pair_name} contra ${m.side_b.pair_name}`}>
                                      <CalendarClock className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setEditingMatchId(m.id)}>
                                      {matchStatusKey(m) === "finished" ? "Ver" : "Editar"}
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </section>
                      ))}
                    </div>
                  );
                })()
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Diálogo: reprogramar un partido (día · hora · cancha). Es la pieza que
          faltaba: cambiarle el día a un partido no debería obligar a entrar al
          diálogo de captura, que es para otra cosa. */}
      <Dialog
        open={!!rescheduleId}
        onOpenChange={(o) => {
          if (!o) setRescheduleId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reprogramar partido</DialogTitle>
            <DialogDescription>
              {(() => {
                const m = matches.find((x) => x.id === rescheduleId);
                return m ? `${m.side_a.pair_name} contra ${m.side_b.pair_name}` : "Cambia el día, la hora o la cancha.";
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="repro-dia">Día</Label>
              <Input
                id="repro-dia"
                type="date"
                value={reschedule.day}
                onChange={(e) => setReschedule((r) => ({ ...r, day: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="repro-hora">Hora</Label>
              <Input
                id="repro-hora"
                type="time"
                value={reschedule.time}
                onChange={(e) => setReschedule((r) => ({ ...r, time: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="repro-cancha">Cancha</Label>
              <Select
                value={reschedule.court || "__none__"}
                onValueChange={(v) => setReschedule((r) => ({ ...r, court: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger id="repro-cancha">
                  <SelectValue placeholder="Sin cancha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin cancha</SelectItem>
                  {[...new Set([...courts.map((c) => c.name), ...matchCourtsList])]
                    .filter(Boolean)
                    .sort()
                    .map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {(() => {
              if (!reschedule.day || !reschedule.time || !reschedule.court) return null;
              const libre = isSlotFree(matches, {
                day: reschedule.day,
                time: reschedule.time,
                court: reschedule.court,
                ignoreId: rescheduleId ?? undefined,
              });
              return (
                <p className={libre ? "text-xs text-muted-foreground" : "text-xs font-medium text-destructive"}>
                  {libre
                    ? `${reschedule.court} está libre a esa hora.`
                    : `Ya hay otro partido en ${reschedule.court} a esa hora.`}
                </p>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleId(null)}>
              Cancelar
            </Button>
            <Button onClick={saveReschedule} disabled={!reschedule.day || !reschedule.time}>
              Guardar cambio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: editar fechas del torneo */}
      <Dialog open={datesOpen} onOpenChange={setDatesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar fechas</DialogTitle>
            <DialogDescription>Se aplican al calendario y a la ficha pública del torneo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="inicio">Inicio</Label>
              <DatePicker id="inicio" value={datesForm.start_date} onChange={(v) => setDatesForm((f) => ({ ...f, start_date: v ?? f.start_date }))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fin">Fin</Label>
              <DatePicker id="fin" value={datesForm.end_date} onChange={(v) => setDatesForm((f) => ({ ...f, end_date: v ?? f.end_date }))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cierre-de-inscripcion">Cierre de inscripción</Label>
              <DatePicker id="cierre-de-inscripcion" value={datesForm.registration_deadline} onChange={(v) => setDatesForm((f) => ({ ...f, registration_deadline: v ?? f.registration_deadline }))} clearable />
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
              <Label htmlFor="categoria-2">Categoría</Label>
              <Select value={pairForm.category_id || "__none__"} onValueChange={(v) => setPairForm((f) => ({ ...f, category_id: v === "__none__" ? "" : v }))}>
                <SelectTrigger id="categoria-2"><SelectValue placeholder={SIN_CATEGORIA} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{SIN_CATEGORIA}</SelectItem>
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
            <DialogTitle>Repartir el calendario</DialogTitle>
            <DialogDescription>
              Define la disponibilidad real: qué días y qué horas hay juego, y con qué canchas. Los
              partidos se reparten en esos huecos sin que dos caigan en el mismo. El emparejamiento y
              los resultados ya capturados no se tocan.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Días disponibles */}
            <div className="grid gap-2">
              <Label id="lbl-dias-con-juego">Días con juego</Label>
              {(() => {
                // Los días que salen aquí son exactamente los que precargueé al
                // abrir el diálogo: una sola regla para "qué días tiene el torneo".
                const options: string[] = tournamentDays(tournament);
                if (options.length === 0) options.push(todayKey());
                const toggle = (day: string, on: boolean) =>
                  setScheduleConfig((c) => ({ ...c, days: on ? [...c.days, day].sort() : c.days.filter((x) => x !== day) }));
                return (
                  <>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" role="group" aria-labelledby="lbl-dias-con-juego">
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
                        <Plus className="h-3.5 w-3.5 ms-1" /> Añadir día
                      </Button>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Horas disponibles */}
            <div className="grid gap-2">
              <Label id="lbl-horas-disponibles">Horas disponibles</Label>
              <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="lbl-horas-disponibles">
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
              <Label id="lbl-canchas-a-usar">Canchas a usar</Label>
              {courts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay canchas registradas — se usará "Cancha 1". Regístralas en la sección Sede.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="lbl-canchas-a-usar">
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
                    <p className="text-xs text-warning-strong">Sin canchas marcadas se usarán todas.</p>
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
                  Capacidad: {scheduleConfig.days.length} día(s) × {scheduleConfig.hours.length} hora(s) ×{" "}
                  {scheduleConfig.courtNames.length || courts.length || 1} cancha(s) ={" "}
                  <strong>
                    {scheduleConfig.days.length *
                      scheduleConfig.hours.length *
                      (scheduleConfig.courtNames.length || courts.length || 1)}
                  </strong>{" "}
                  huecos
                  {(() => {
                    const capacidad =
                      scheduleConfig.days.length *
                      scheduleConfig.hours.length *
                      (scheduleConfig.courtNames.length || courts.length || 1);
                    const faltan = matches.length - capacidad;
                    // Las horas marcadas tienen que estar al menos un partido
                    // aparte: si no, el segundo turno empieza cuando el
                    // primero sigue en la cancha.
                    const horas = [...scheduleConfig.hours].sort((a, b) => a - b);
                    const huecoMin = horas.length > 1 ? Math.min(...horas.slice(1).map((h, i) => h - horas[i])) : Infinity;
                    if (huecoMin * 60 < scheduleConfig.minutesPerMatch) {
                      return (
                        <span className="mt-1 block font-medium text-destructive">
                          Las horas marcadas están menos de {scheduleConfig.minutesPerMatch} min aparte: dos
                          partidos se enciman.
                        </span>
                      );
                    }
                    if (faltan > 0) {
                      return (
                        <span className="mt-1 block font-medium text-destructive">
                          Faltan {faltan} huecos para los {matches.length} partidos: marca más días u horas.
                        </span>
                      );
                    }
                    return (
                      <span className="mt-1 block font-medium text-success">
                        Alcanza para los {matches.length} partidos.
                      </span>
                    );
                  })()}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>Cancelar</Button>
            <Button onClick={handleGenerateSchedule} disabled={saving}>
              {saving ? "Repartiendo…" : "Repartir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Captura de resultado por partido — encadenada a la jornada */}
      {editingMatchId && (
<MatchResultDialog
             // Sin `key`, el diálogo se reutilizaba al encadenar al siguiente
             // partido: el encabezado cambiaba al partido 2 pero las cajas de
             // sets, la cancha y la hora seguían con los del partido 1, y al
             // guardar se escribía el resultado del partido anterior encima del
             // nuevo. La `key` lo remonta y el estado se rearma desde cero.
             key={editingMatchId}
             match={matches.find((m) => m.id === editingMatchId)!}
          nextMatchId={tab === "bracket" ? null :
            matches
              .filter((m) => localDayKey(m.scheduled_at ?? "") === jornadaDay && matchStatusKey(m) !== "finished")
              .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)))
              .find((m) => m.id !== editingMatchId)?.id ?? null
          }
          courts={courts}
          scoring={tournament?.scoring}
          open={!!editingMatchId}
          onOpenChange={(o) => { if (!o) setEditingMatchId(null); }}
          onAdvance={(nextId) => {
            void reload();
            setEditingMatchId(nextId);
          }}
        />
      )}

      <ConfirmDialog open={!!removeFromGroup} onOpenChange={(o) => { if (!o) setRemoveFromGroup(null); }}
        title="¿Quitar equipo del grupo?" description="Seguirá inscrito en el torneo, en Sin grupo. No se borrarán sus resultados."
        confirmLabel="Quitar del grupo" onConfirm={() => { if (removeFromGroup) void ungroupPair(removeFromGroup); }} />
      <ConfirmDialog
        open={!!changingStatus}
        onOpenChange={(o) => { if (!o) setChangingStatus(null); }}
        onConfirm={() => changingStatus && handleStatusChange(changingStatus.target)}
        title={changingStatus ? `¿Cambiar estado a "${tournamentStatusLabel[changingStatus.target]}"?` : ""}
        description="Esta acción afecta la visibilidad y accesibilidad del torneo."
        confirmLabel="Confirmar"
      />
    </div>
  );
}
