// Admin → Equipos: los equipos son POR TORNEO (tabla `pairs` con tournament_id).
// Un jugador pertenece al directorio global (player_profiles) pero su equipo
// solo existe dentro del torneo elegido. Otro torneo = otros equipos.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { db } from "@/lib/data";
import type { PlayerProfile, Tournament, TournamentCategory } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
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
import { AlertTriangle, Pencil, Plus, Trash2, Trophy, Users } from "lucide-react";
import { checkLevelSum } from "@/lib/qualification";
import { ramaLabel } from "@/lib/categories";
import PlayerSlot from "@/components/players/player-slot";
import { ensurePlayer } from "@/lib/players";
import { FilterBar } from "@/components/ui/filter-bar";
import { AdminFacet, AdminFacets } from "@/components/admin/filter-facets";
import { countActive } from "@/lib/filters";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminPageHeader, AdminStat, AdminStatStrip } from "@/components/admin/page-header";
import ImageUpload from "@/components/ui/image-upload";
import { deleteStoredImage } from "@/lib/storage";
import { PairAvatar, CardShell, CardIdentity } from "@/components/cards/card-kit";
import { cn } from "@/lib/utils";
import { AdminEmptyState } from "@/components/admin/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SIN_CATEGORIA } from "@/lib/format";

/** Valor centinela del selector de torneo: "aún no hay torneo elegido". */
const SIN_TORNEO = "__sin_torneo__";

interface EquipoForm {
  name: string;
  category_id: string;
  player1_name: string;
  player2_name: string;
  crest_url: string | null;
}

/** Fila de `pairs` tal y como la pinta el admin. */
interface PairRow {
  id: string;
  name: string;
  category_id: string | null;
  crest_url: string | null;
}

/** Nombre automático con los jugadores; respeta edición manual. */
function autoName(f: { player1_name: string; player2_name: string }): string {
  return [f.player1_name.trim(), f.player2_name.trim()].filter(Boolean).join(" / ");
}

export default function AdminTeams() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tid, setTid] = useState<string>("");
  const [categories, setCategories] = useState<TournamentCategory[]>([]);
  const [pairs, setPairs] = useState<PairRow[] | null>(null);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<PairRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // El buscador vive en el FilterBar de la página y escribe ?q= (estándar admin).
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const setQuery = (v: string) => {
    const next = new URLSearchParams(params);
    if (!v) next.delete("q");
    else next.set("q", v);
    setParams(next, { replace: true });
  };
  const [cat, setCat] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    db.listTournaments().then((ts) => {
      setTournaments(ts);
      // Selecciona el torneo con inscripción abierta; si no, el primero disponible.
      const active =
        ts.find((t) => t.status === "registration_open") ??
        ts.find((t) => t.status === "in_progress") ??
        ts[0];
      if (active) setTid(active.id);
    }).catch(() => setTournaments([]));
    db.listPlayers().then((p) => setPlayers(p)).catch(() => setPlayers([]));
  }, []);

  useEffect(() => {
    if (!tid) return;
    setPairs(null);
    db.getTournamentCategories(tid).then(setCategories).catch(() => setCategories([]));
    db.getTournamentPairs(tid)
      .then((ps) => setPairs(ps as unknown as Array<{ id: string; name: string; category_id: string | null; crest_url: string | null }>))
      .catch(() => setPairs([]));
  }, [tid]);

  const load = () => {
    db.getTournamentPairs(tid)
      .then((ps) => setPairs(ps as unknown as Array<{ id: string; name: string; category_id: string | null; crest_url: string | null }>))
      .catch(() => setPairs([]));
  };

  const catNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  // Un solo lugar que decide qué se muestra cuando la pareja no tiene categoría.
  // Estaba repetido tres veces con un ternario que además sobraba: `Map.get` ya
  // devuelve undefined para una clave ausente.
  const categoryOf = (id: string | null): string =>
    (id ? catNameById.get(id) : undefined) ?? SIN_CATEGORIA;

  const filtered = (pairs ?? []).filter((p) => {
    const q = query.trim().toLowerCase();
    if (q && !p.name.toLowerCase().includes(q)) return false;
    if (cat !== "all" && (p.category_id ?? "") !== cat) return false;
    return true;
  });

  /**
   * Las categorías del torneo con la cuenta de parejas de cada una. Antes era
   * un desplegable con los nombres de las categorías: para saber si el
   * torneo tenía "Suma 9" había que abrirlo y mirarlo.
   */
  const catOptions = useMemo(() => {
    const all = pairs ?? [];
    return categories
      .map((c) => ({ key: c.id, label: c.name, n: all.filter((p) => p.category_id === c.id).length }))
      .filter((o) => o.n > 0);
  }, [categories, pairs]);

  /**
   * Cifras de cabecera. Una categoría es una competencia cerrada —las parejas de
   * 4tas no juegan con las de 5tas—, así que el reparto se cuenta por categoría
   * y no como un total quemezcla divisiones.
   */
  const resumen = useMemo(() => {
    const all = pairs ?? [];
    const porCategoria = new Map<string, number>();
    for (const p of all) {
      const k = p.category_id ?? "";
      porCategoria.set(k, (porCategoria.get(k) ?? 0) + 1);
    }
    return {
      parejas: all.length,
      categorias: categories.length,
      conEscudo: all.filter((p) => p.crest_url).length,
      completas: [...porCategoria.values()].filter((n) => n >= 2).length,
    };
  }, [pairs, categories]);

  async function handleSave(form: EquipoForm) {
    const p1 = form.player1_name.trim();
    const p2 = form.player2_name.trim();
    if (p1.toLowerCase() === p2.toLowerCase()) {
      toast.error("El mismo jugador no puede estar 2 veces en el equipo");
      return;
    }
    // Rama del torneo: si la categoría define sexo (M/F), los jugadores deben coincidir
    const pairCat = categories.find((c) => c.id === (form.category_id || categories[0]?.id));
    if (pairCat && pairCat.sex !== "X") {
      const roster = [
        { name: p1, profile: players.find((pl) => pl.display_name.trim().toLowerCase() === p1.toLowerCase()) },
        { name: p2, profile: players.find((pl) => pl.display_name.trim().toLowerCase() === p2.toLowerCase()) },
      ];
      for (const r of roster) {
        if (r.profile && r.profile.sex !== "X" && r.profile.sex !== pairCat.sex) {
          // "Femenil"/"Varonil" son las ramas, no adjetivos: "jugadora femenina"
          // metía una palabra que no existe en el vocabulario del circuito.
          toast.error(`"${r.name}" juega en rama ${ramaLabel(r.profile.sex)} y esta categoría es ${ramaLabel(pairCat.sex)}`);
          return;
        }
      }
    }
    // Un jugador no puede estar en 2 equipos del mismo torneo
    const others = (pairs ?? []).filter((p) => p.id !== editing?.id);
    for (const p of others) {
      const roster = p.name.split("/").map((s) => s.trim().toLowerCase());
      const clash = [p1, p2].find((n) => roster.includes(n.toLowerCase()));
      if (clash) {
        toast.error(`"${clash}" ya juega en el equipo "${p.name}" de este torneo`);
        return;
      }
    }
    setSubmitting(true);
    try {
      // Los jugadores se registran/reutilizan en el directorio global
      const [prof1, prof2] = await Promise.all([
        ensurePlayer(p1).catch(() => null),
        ensurePlayer(p2).catch(() => null),
      ]);
      const name = form.name.trim() || autoName(form);
      const originalCrest = editing?.crest_url ?? null;
       if (editing) {
         const oldName = editing.name;
         await db.updatePair(editing.id, { name, category_id: form.category_id || null, crest_url: form.crest_url });
         // El calendario ya guardó side_a/side_b con pair_name anterior: se
         // actualizan aquí para que Resultados y el perfil del equipo sigan
         // mostrando el equipo renombrado.
         if (oldName !== name) {
           const matches = await db.listMatchesByTournament(tid).catch(() => []);
           for (const m of matches) {
             let touched = false;
             const side_a = m.side_a?.pair_id === editing.id || m.side_a?.pair_name === oldName
               ? { ...m.side_a, pair_name: name }
               : m.side_a;
             const side_b = m.side_b?.pair_id === editing.id || m.side_b?.pair_name === oldName
               ? { ...m.side_b, pair_name: name }
               : m.side_b;
             touched = side_a !== m.side_a || side_b !== m.side_b;
             if (touched) {
               try { await db.updateMatch(m.id, { side_a, side_b }); } catch { /* non-fatal */ }
             }
           }
       }
         // La foto reemplazada o quitada ya no se usa: borra el objeto de storage
         if (originalCrest && form.crest_url !== originalCrest) {
           void deleteStoredImage(originalCrest, "team-crests");
         }
         toast.success(`Equipo "${name}" actualizado`);
       } else {
        await db.createPair({ tournament_id: tid, category_id: form.category_id || null, name, player1_id: prof1?.id ?? null, player2_id: prof2?.id ?? null, crest_url: form.crest_url });
        toast.success(`Equipo "${name}" inscrito en el torneo`);
      }
      setOpenCreate(false);
      setEditing(null);
      load();
    } catch (e) {
      toast.error((e as Error).message ?? "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  }

  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  async function handleDelete(p: { id: string; name: string }) {
    try {
      await db.deletePair(p.id);
      toast.success(`Equipo "${p.name}" eliminado`);
      load();
    } catch (e) {
      toast.error((e as Error).message ?? "Error al eliminar");
    } finally {
      setDeleting(null);
    }
  }

  // Cada apertura remonta el formulario (key cambia), para que el alta en
  // blanco arranque con la categoría por defecto del torneo —las categorías
  // llegan después del primer render— y para no arrastrar datos de la
  // edición anterior.
  const [formKey, setFormKey] = useState(0);
  const openDialog = (pair: PairRow | null) => {
    setEditing(pair);
    setFormKey((k) => k + 1);
    setOpenCreate(true);
  };
  const dialogKey = `${editing?.id ?? "new"}-${formKey}`;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Equipos"
        description="Las parejas inscritas viven dentro de cada torneo."
        action={
          <Button size="sm" disabled={!tid} onClick={() => { openDialog(null); }}>
            <Plus className="h-4 w-4" /> Inscribir pareja
          </Button>
        }
      >
        <AdminStatStrip>
          <AdminStat value={resumen.parejas} label="Parejas" />
          <AdminStat value={resumen.categorias} label="Categorías" />
          <AdminStat
            value={resumen.completas}
            label="Con rival"
            tone={resumen.completas > 0 ? "text-success" : undefined}
          />
          <AdminStat value={resumen.conEscudo} label="Con escudo" />
        </AdminStatStrip>
      </AdminPageHeader>

      {/* Contexto de torneo: separado claramente del contenido; no compite con el filtro. */}
      <section aria-label="Torneo seleccionado" className="rounded-xl border bg-card p-3 sm:flex sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Trophy className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">Torneo activo</p>
            <div className="mt-1 flex items-center gap-2">
              <Select value={tid || SIN_TORNEO} onValueChange={(v) => { if (v !== SIN_TORNEO) setTid(v); }}>
                <SelectTrigger className="h-7 w-full sm:w-72 text-xs" aria-label="Elegir torneo">
                  <SelectValue placeholder="Elige un torneo" />
                </SelectTrigger>
                <SelectContent>
                  {tournaments.length === 0 && <SelectItem value={SIN_TORNEO}>Elige un torneo</SelectItem>}
                  {tournaments.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tid && (
                <span className="text-xs text-muted-foreground">· {categories.length} categorías · {pairs?.length ?? 0} parejas</span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-2 sm:mt-0 sm:ml-auto">
          <Button size="sm" disabled={!tid} onClick={() => { openDialog(null); }}>
            <Plus className="h-3.5 w-3.5" /> Inscribir pareja
          </Button>
        </div>
      </section>

      {!tid ? (
        <Card>
          <CardContent className="p-0">
            <AdminEmptyState
              icon={<Trophy className="h-5 w-5" />}
              title="Elige un torneo"
              description="Cada torneo tiene sus propios equipos. Selecciona uno arriba."
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="border-b bg-muted/50 px-4 py-3">
            <FilterBar
              search={query}
              onSearch={setQuery}
              searchPlaceholder="Buscar pareja…"
              resultCount={filtered.length}
              resultLabel="parejas"
              activeCount={countActive(cat)}
              onClear={() => { setQuery(""); setCat("all"); }}
            >
              <AdminFacets>
                <AdminFacet
                  label="Categoría"
                  value={cat}
                  onChange={setCat}
                  options={catOptions}
                  allLabel="Todas"
                />
              </AdminFacets>
            </FilterBar>
          </div>
          <CardContent className="p-0">
            {pairs === null && (
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            )}

            {pairs !== null && pairs.length === 0 && (
              <AdminEmptyState
                icon={<Users className="h-5 w-5" />}
                title="Sin parejas en este torneo"
                description="Inscribe la primera pareja para empezar."
                action={
                  <Button variant="outline" size="sm" onClick={() => { openDialog(null); }}>
                    Inscribir pareja
                  </Button>
                }
              />
            )}

            {pairs !== null && pairs.length > 0 && filtered.length === 0 && (
              <AdminEmptyState
                title="Sin coincidencias"
                description="Ninguna pareja coincide con la búsqueda o el filtro."
              />
            )}

            {filtered.length > 0 && (() => {
              const sel = filtered.find((p) => p.id === selectedId) ?? null;
              const [sp1, sp2] = (sel?.name ?? " / ").split(" / ");
              return (
                <div className="grid divide-y lg:grid-cols-[minmax(260px,320px)_1fr] lg:divide-x lg:divide-y-0">
                  <div className="max-h-[70vh] overflow-y-auto p-2 space-y-2">
                    {filtered.map((p) => {
                      const [p1, p2] = p.name.split(" / ");
                      const active = p.id === selectedId;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedId(p.id)}
                          className="w-full text-left"
                        >
                          <CardShell
                            className={cn(
                              "h-24 rounded-xl border bg-muted/50 p-3 transition-colors hover:bg-muted/60",
                              active && "accent ring-2 ring-primary/40"
                            )}
                            accent={active}
                          >
                            <CardIdentity
                              lead={<PairAvatar p1={p1} p2={p2} />}
                              title={`${p1} / ${p2 ?? "—"}`}
                              meta={categoryOf(p.category_id)}
                            />
                          </CardShell>
                        </button>
                      );
                    })}</div>

                  <div className="p-4 lg:ps-0 lg:pe-8">
                    {!sel ? (
                      <div className="flex h-full min-h-48 items-center justify-center text-sm text-muted-foreground">
                        Selecciona una pareja para ver su detalle.
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
                          {sel.crest_url ? (
                            <img src={sel.crest_url} alt="" className="h-16 w-16 rounded-full object-cover" />
                          ) : (
                            <PairAvatar p1={sp1} p2={sp2} className="h-16 w-16 text-lg" />
                          )}
                          <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-semibold leading-tight truncate">{sp1} / {sp2 || "—"}</h3>
                            <p className="text-sm text-muted-foreground mt-0.5 truncate">
                              {categoryOf(sel.category_id)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="rounded-lg border bg-card p-4 shadow-sm">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Categoría</p>
                            <p className="text-sm font-semibold">{categoryOf(sel.category_id)}</p>
                          </div>
                          <div className="rounded-lg border bg-card p-4 shadow-sm">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Escudo</p>
                            <p className="text-sm font-semibold">{sel.crest_url ? "Sí" : "No"}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3 pt-2">
                          <Button size="sm" variant="outline" className="h-9" onClick={() => { openDialog(sel); }}>
                            <Pencil className="h-4 w-4" /> Editar equipo
                          </Button>
                          <Button size="sm" variant="destructive" className="h-9" onClick={() => setDeleting(sel)}>
                            <Trash2 className="h-4 w-4" /> Eliminar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        onConfirm={() => deleting && handleDelete(deleting)}
        title={`¿Eliminar el equipo "${deleting?.name ?? ""}"?`}
        description="Se quita de este torneo. Sus perfiles de jugador no se borran."
        destructive
      />

      <EquipoDialog
        key={dialogKey}
        open={openCreate}
        onOpenChange={(o) => { if (!o) { setOpenCreate(false); setEditing(null); } }}
        onSave={handleSave}
        editing={editing}
        submitting={submitting}
        players={players}
        categories={categories}
      />
    </div>
  );
}

function EquipoDialog({
  open,
  onOpenChange,
  onSave,
  editing,
  submitting,
  players,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: EquipoForm) => void;
  editing: { id: string; name: string; category_id: string | null; crest_url: string | null } | null;
  submitting: boolean;
  players: PlayerProfile[];
  categories: TournamentCategory[];
}) {
  const [form, setForm] = useState<EquipoForm>(() => {
    if (editing) {
      const [p1, p2] = editing.name.split(" / ");
      return {
        name: editing.name,
        category_id: editing.category_id ?? "",
        player1_name: p1 ?? "",
        player2_name: p2 ?? "",
        crest_url: editing.crest_url ?? null,
      };
    }
    return { name: "", category_id: categories[0]?.id ?? "", player1_name: "", player2_name: "", crest_url: null };
  });
  // El nombre dejó de ser automático cuando el usuario lo edita a mano
  const [manualName, setManualName] = useState(Boolean(editing?.name));
  const [crest, setCrest] = useState<string | null>(editing?.crest_url ?? null);

  function setPlayers(slot: 1 | 2, name: string) {
    setForm((f) => {
      const next = { ...f, [slot === 1 ? "player1_name" : "player2_name"]: name };
      return { ...next, name: manualName ? next.name : autoName(next) };
    });
  }

  const valid = form.player1_name.trim() && form.player2_name.trim();

  // La foto del equipo viaja al padre dentro de `form`, así que se sincroniza
  // al renderizar y no en un efecto: un useEffect que llama a setState dispara
  // un segundo render en cascada en cada cambio de foto.
  // Patrón de React: ajustar estado durante el render, guardando el valor
  // anterior para que solo vuelva a Synchronizar cuando `crest` cambia de verdad.
  const [crestVisto, setCrestVisto] = useState(crest);
  if (crest !== crestVisto) {
    setCrestVisto(crest);
    setForm((f) => (f.crest_url === crest ? f : { ...f, crest_url: crest }));
  }
  const originalCrest = editing?.crest_url ?? null;

  function changeCrest(next: string | null) {
    setCrest((prev) => {
      if (prev && prev !== next && prev !== originalCrest && prev.startsWith("http")) {
        void deleteStoredImage(prev, "team-crests");
      }
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar equipo" : "Inscribir equipo"}</DialogTitle>
          <DialogDescription>
            Un equipo es una pareja de 2 jugadores. Busca a los registrados o escribe nombres nuevos — el perfil se crea solo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-3">
            <ImageUpload
              id="team-crest"
              value={crest}
              onChange={changeCrest}
              label="Foto del equipo"
              size="lg"
              bucket="team-crests"
              path="pairs"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Foto del equipo</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Logo o escudo de la pareja. Aparece en la pareja destacada de la página principal y en el perfil del equipo.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <PlayerSlot
              label="Jugador 1"
              value={form.player1_name}
              players={players}
              onPick={(n) => setPlayers(1, n)}
              onType={(n) => setPlayers(1, n)}
            />
            <PlayerSlot
              label="Jugador 2"
              value={form.player2_name}
              players={players}
              onPick={(n) => setPlayers(2, n)}
              onType={(n) => setPlayers(2, n)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="eq-name">Nombre del equipo</Label>
            <Input
              id="eq-name"
              value={form.name}
              onChange={(e) => { setManualName(true); setForm((f) => ({ ...f, name: e.target.value })); }}
              placeholder={autoName(form) || "Se arma solo con los jugadores"}
            />
            {!manualName && autoName(form) && (
              <p className="text-xs text-muted-foreground">Automático — edítalo si quieres otro nombre</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="categoria">Categoría</Label>
            <Select value={form.category_id || "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v === "__none__" ? "" : v }))}>
              <SelectTrigger id="categoria"><SelectValue placeholder={SIN_CATEGORIA} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{SIN_CATEGORIA}</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Regla de suma ("Suma 9"): aviso EN VIVO mientras se arma la pareja.
                No bloquea: el organizador decide si la inscribe de todas formas. */}
            {(() => {
              const categoria = categories.find((c) => c.id === form.category_id) ?? null;
              const nivelDe = (nombre: string) => {
                const p = players.find((pl) => pl.display_name === nombre.trim());
                return p ? (p.official_level ?? p.declared_level) : null;
              };
              const check = checkLevelSum(categoria?.name ?? null, [
                nivelDe(form.player1_name),
                nivelDe(form.player2_name),
              ]);
              return check.message ? (
                <p className="flex items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs font-semibold text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {check.message} Puedes inscribirla de todas formas si es una decisión del organizador.
                </p>
              ) : null;
            })()}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSave(form)} disabled={submitting || !valid}>
            {submitting ? "Guardando…" : editing ? "Actualizar" : "Inscribir equipo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
