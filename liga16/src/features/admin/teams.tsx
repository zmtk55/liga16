// Admin → Equipos: los equipos son POR TORNEO (tabla `pairs` con tournament_id).
// Un jugador pertenece al directorio global (player_profiles) pero su equipo
// solo existe dentro del torneo elegido. Otro torneo = otros equipos.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { db } from "@/lib/data";
import type { PlayerProfile, Tournament, TournamentCategory } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { RowActionsMenu, RowContextMenu, type RowAction } from "@/components/admin/row-actions";
import PlayerSlot from "@/components/players/player-slot";
import { ensurePlayer } from "@/lib/players";
import { FilterBar } from "@/components/ui/filter-bar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminPageHeader, AdminStat, AdminStatStrip } from "@/components/admin/page-header";
import ImageUpload from "@/components/ui/image-upload";
import { deleteStoredImage } from "@/lib/storage";
import { CardShell, CardIdentity, CardStat, CardFooterStrip, PairAvatars } from "@/components/cards/card-kit";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

interface EquipoForm {
  name: string;
  category_id: string;
  player1_name: string;
  player2_name: string;
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
  const [pairs, setPairs] = useState<Array<{ id: string; name: string; category_id: string | null; crest_url: string | null }> | null>(null);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string; category_id: string | null; crest_url: string | null } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // El buscador vive en el shell (SectionControl, ADR-0009) y escribe ?q=.
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const setQuery = (v: string) => {
    const next = new URLSearchParams(params);
    if (!v) next.delete("q");
    else next.set("q", v);
    setParams(next, { replace: true });
  };
  const [cat, setCat] = useState("all");

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

  const filtered = (pairs ?? []).filter((p) => {
    const q = query.trim().toLowerCase();
    if (q && !p.name.toLowerCase().includes(q)) return false;
    if (cat !== "all" && (p.category_id ?? "") !== cat) return false;
    return true;
  });

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
          const ramaEs = pairCat.sex === "M" ? "varonil" : "femenil";
          toast.error(`"${r.name}" es ${r.profile.sex === "F" ? "jugadora femenil" : "jugador varonil"} y esta categoría es ${ramaEs}`);
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
        await db.updatePair(editing.id, { name, category_id: form.category_id || null, crest_url: form.crest_url });
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

  const dialogKey = editing?.id ?? "new";

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Equipos"
        description="Las parejas inscritas viven dentro de cada torneo."
        action={
          <Button size="sm" disabled={!tid} onClick={() => { setEditing(null); setOpenCreate(true); }}>
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

      {/* Cada torneo tiene sus propios equipos: el selector es contexto, no un filtro más. */}
      <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center">
        <Trophy className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
        <Select value={tid || undefined} onValueChange={setTid}>
          <SelectTrigger className="h-9 w-full sm:w-80" aria-label="Elegir torneo">
            <SelectValue placeholder="Elige un torneo" />
          </SelectTrigger>
          <SelectContent>
            {tournaments.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tournaments.length === 0 && (
          <p className="text-sm text-muted-foreground">Crea un torneo para poder inscribir parejas.</p>
        )}
      </div>

      {!tid ? (
        <Card>
          <CardContent className="p-0">
            <Empty className="py-10">
              <EmptyHeader>
                <EmptyTitle>Elige un torneo</EmptyTitle>
                <EmptyDescription>Cada torneo tiene sus propios equipos. Selecciona uno arriba.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="gap-3">
            <FilterBar
              selects={[
                {
                  key: "cat",
                  ariaLabel: "Filtrar por categoría",
                  allLabel: "Todas las categorías",
                  value: cat,
                  onChange: setCat,
                  options: categories.map((c) => ({ value: c.id, label: c.name })),
                  className: "sm:w-48",
                },
              ]}
              resultCount={filtered.length}
              resultLabel="parejas"
              onClear={() => { setQuery(""); setCat("all"); }}
            />
          </CardHeader>
          <CardContent className="p-4">
            {pairs === null && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            )}

            {pairs !== null && pairs.length === 0 && (
              <Empty className="border-0 py-10">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Users className="h-5 w-5" />
                  </EmptyMedia>
                  <EmptyTitle className="text-base">Sin parejas en este torneo</EmptyTitle>
                  <EmptyDescription>
                    Inscribe la primera pareja para empezar.
                  </EmptyDescription>
                </EmptyHeader>
                <Button size="sm" className="mt-4" onClick={() => { setEditing(null); setOpenCreate(true); }}>
                  Inscribir pareja
                </Button>
              </Empty>
            )}

            {pairs !== null && pairs.length > 0 && filtered.length === 0 && (
              <Empty className="border-0 py-10">
                <EmptyHeader>
                  <EmptyTitle className="text-base">Sin coincidencias</EmptyTitle>
                  <EmptyDescription>
                    Ninguna pareja coincide con la búsqueda o el filtro.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}

            {/* Cards y no tabla: es la misma pieza que usa el sitio público, con
                los avatares de la pareja y la categoría a la vista. Una tabla
                de "nombre / categoría" no decía nada de un vistazo.

                Aquí NO entra la `TeamCard` (la de /equipos) a propósito: esta
                lista no son equipos del circuito sino parejas inscritas en UN
                torneo, y su forma local solo trae id/nombre/categoría/escudo —
                sin división, rama, stats ni slug, que es justo lo que la card
                con foto muestra. Además la tarjeta de foto se abre con click
                (flip) y rompería el click derecho de editar/eliminar. Mientras
                esta vista sea de gestión, prima que editar rápido. */}
            {filtered.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((p) => {
                  const [p1, p2] = p.name.split(" / ");
                  const actions: RowAction[] = [
                    {
                      label: "Editar equipo",
                      icon: <Pencil className="h-4 w-4" />,
                      onSelect: () => { setEditing(p); setOpenCreate(true); },
                    },
                    {
                      label: "Eliminar",
                      icon: <Trash2 className="h-4 w-4" />,
                      onSelect: () => setDeleting(p),
                      destructive: true,
                      separator: true,
                    },
                  ];
                  return (
                    <RowContextMenu key={p.id} actions={actions}>
                      <CardShell accent>
                        <CardContent className="p-4">
                          <CardIdentity
                            lead={<PairAvatars names={[p1, p2]} size="sm" />}
                            titleLines={[p1, p2].filter(Boolean)}
                            meta={
                              p.category_id
                                ? catNameById.get(p.category_id) ?? "Sin categoría"
                                : "Sin categoría"
                            }
                            end={
                              <RowActionsMenu
                                actions={actions}
                                label={`Acciones para ${p.name}`}
                              />
                            }
                          />
                        </CardContent>
                        <CardFooterStrip
                          stats={
                            <>
                              <CardStat
                                value={p.crest_url ? "1" : "0"}
                                label="Escudo"
                                tone={p.crest_url ? "text-success" : undefined}
                              />
                              <CardStat value={p.category_id ? "Sí" : "No"} label="Inscrita" />
                            </>
                          }
                          chip={
                            <Badge variant="outline" className="gap-1">
                              <Pencil className="h-3 w-3" /> Editar
                            </Badge>
                          }
                        />
                      </CardShell>
                    </RowContextMenu>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        onConfirm={() => deleting && handleDelete(deleting)}
        title={`¿Eliminar el equipo "${deleting?.name ?? ""}"?`}
        description="Se quita de este torneo. Sus perfiles de jugador no se borran."
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
              <SelectTrigger id="categoria"><SelectValue placeholder="Sin categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin categoría</SelectItem>
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
