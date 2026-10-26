import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { db } from "@/lib/data";
import type { PlayerProfile, Tournament, TournamentCategory } from "@/types";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { PairAvatar } from "@/components/cards/card-kit";
import { RowActionsMenu } from "@/components/admin/row-actions";
import { AdminEmptyState } from "@/components/admin/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SIN_CATEGORIA } from "@/lib/format";

const SIN_TORNEO = "__sin_torneo__";
interface EquipoForm {
  name: string; category_id: string; player1_name: string; player2_name: string; crest_url: string | null;
}
interface PairRow { id: string; name: string; category_id: string | null; crest_url: string | null; }
function autoName(f: { player1_name: string; player2_name: string }): string {
  return [f.player1_name.trim(), f.player2_name.trim()].filter(Boolean).join(" / ");
}

export default function AdminTeams() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tid, setTidState] = useState<string>("");
  const [categories, setCategories] = useState<TournamentCategory[]>([]);
  const [pairs, setPairs] = useState<PairRow[] | null>(null);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<PairRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const setQuery = (v: string) => {
    const next = new URLSearchParams(params);
    if (!v) next.delete("q"); else next.set("q", v);
    setParams(next, { replace: true });
  };
  const [cat, setCat] = useState("all");

  // Cambiar de torneo: se guarda en ?torneo= y se limpian búsqueda y filtro,
  // para no filtrar el torneo nuevo con el texto del anterior.
  const setTid = (v: string) => {
    setTidState(v);
    setCat("all");
    const next = new URLSearchParams(params);
    if (!v) next.delete("torneo"); else next.set("torneo", v);
    next.delete("q");
    setParams(next, { replace: true });
  };

  const cargarTorneos = () => {
    setError(null);
    db.listTournaments().then((ts) => {
      setTournaments(ts);
      const fromUrl = params.get("torneo");
      const elegido = (fromUrl && ts.find((t) => t.id === fromUrl)) ??
        ts.find((t) => t.status === "registration_open") ??
        ts.find((t) => t.status === "in_progress") ?? ts[0];
      if (elegido) setTidState(elegido.id);
    }).catch((e) => {
      setTournaments([]);
      setError((e as Error)?.message ?? "Error al cargar los torneos");
    });
  };

  useEffect(() => {
    cargarTorneos();
    db.listPlayers().then((p) => setPlayers(p)).catch(() => setPlayers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = () => {
    if (!tid) return;
    setError(null);
    db.getTournamentPairs(tid).then((ps) => setPairs(
      ps as unknown as Array<{ id: string; name: string; category_id: string | null; crest_url: string | null }>
    )).catch((e) => {
      setPairs([]);
      setError((e as Error)?.message ?? "Error al cargar las parejas");
    });
  };

  useEffect(() => {
    if (!tid) return;
    setPairs(null);
    setError(null);
    db.getTournamentCategories(tid).then(setCategories).catch(() => setCategories([]));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid]);

  // Reintentar tras un error: si hay torneo elegido se recargan sus parejas;
  // si ni los torneos cargaron, se vuelve a pedir todo.
  const reintentar = () => {
    if (tid) load();
    else cargarTorneos();
  };

  const catNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const categoryOf = (id: string | null): string => (id ? catNameById.get(id) : undefined) ?? SIN_CATEGORIA;
  const filtered = (pairs ?? []).filter((p) => {
    const q = query.trim().toLowerCase();
    if (q && !p.name.toLowerCase().includes(q)) return false;
    if (cat !== "all" && (p.category_id ?? "") !== cat) return false;
    return true;
  });
  const resumen = useMemo(() => {
    const all = pairs ?? [];
    const porCategoria = new Map<string, number>();
    for (const p of all) { const k = p.category_id ?? ""; porCategoria.set(k, (porCategoria.get(k) ?? 0) + 1); }
    return { parejas: all.length, categorias: categories.length, conEscudo: all.filter((p) => p.crest_url).length, completas: [...porCategoria.values()].filter((n) => n >= 2).length };
  }, [pairs, categories]);

  async function handleSave(form: EquipoForm) {
    const p1 = form.player1_name.trim(); const p2 = form.player2_name.trim();
    if (p1.toLowerCase() === p2.toLowerCase()) { toast.error("El mismo jugador no puede estar 2 veces en la pareja"); return; }
    const pairCat = categories.find((c) => c.id === (form.category_id || categories[0]?.id));
    if (pairCat && pairCat.sex !== "X") {
      const roster = [
        { name: p1, profile: players.find((pl) => pl.display_name.trim().toLowerCase() === p1.toLowerCase()) },
        { name: p2, profile: players.find((pl) => pl.display_name.trim().toLowerCase() === p2.toLowerCase()) },
      ];
      for (const r of roster) {
        if (r.profile && r.profile.sex !== "X" && r.profile.sex !== pairCat.sex) {
          toast.error(`"${r.name}" juega en rama ${ramaLabel(r.profile.sex)} y esta categoría es ${ramaLabel(pairCat.sex)}`); return;
        }
      }
    }
    const others = (pairs ?? []).filter((p) => p.id !== editing?.id);
    for (const p of others) {
      const roster = p.name.split("/").map((s) => s.trim().toLowerCase());
      const clash = [p1, p2].find((n) => roster.includes(n.toLowerCase()));
      if (clash) { toast.error(`"${clash}" ya juega en la pareja "${p.name}" de este torneo`); return; }
    }
    setSubmitting(true);
    try {
      const [prof1, prof2] = await Promise.all([ensurePlayer(p1).catch(() => null), ensurePlayer(p2).catch(() => null)]);
      const name = form.name.trim() || autoName(form); const originalCrest = editing?.crest_url ?? null;
      if (editing) {
        const oldName = editing.name;
        await db.updatePair(editing.id, { name, category_id: form.category_id || null, crest_url: form.crest_url });
        if (oldName !== name) {
          const matches = await db.listMatchesByTournament(tid).catch(() => []);
          let fallos = 0;
          for (const m of matches) {
            const side_a = m.side_a?.pair_id === editing.id || m.side_a?.pair_name === oldName ? { ...m.side_a, pair_name: name } : m.side_a;
            const side_b = m.side_b?.pair_id === editing.id || m.side_b?.pair_name === oldName ? { ...m.side_b, pair_name: name } : m.side_b;
            if (side_a !== m.side_a || side_b !== m.side_b) {
              // TODO: mover la propagación del renombre a una RPC transaccional
              // en Supabase; hoy es un update por partido y una falla a la
              // mitad deja nombres viejos y nuevos mezclados.
              try { await db.updateMatch(m.id, { side_a, side_b }); } catch { fallos++; }
            }
          }
          if (fallos > 0) {
            toast.error(`El nombre se actualizó, pero ${fallos} ${fallos === 1 ? "partido conserva" : "partidos conservan"} el nombre anterior`);
          }
        }
        if (originalCrest && form.crest_url !== originalCrest) { void deleteStoredImage(originalCrest, "team-crests"); }
        toast.success(`Pareja "${name}" actualizada`);
      } else {
        await db.createPair({ tournament_id: tid, category_id: form.category_id || null, name, player1_id: prof1?.id ?? null, player2_id: prof2?.id ?? null, crest_url: form.crest_url });
        toast.success(`Pareja "${name}" inscrita en el torneo`);
      }
      setOpenCreate(false); setEditing(null); load();
    } catch (e) { toast.error((e as Error).message ?? "Error al guardar"); } finally { setSubmitting(false); }
  }

  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [deletingMatches, setDeletingMatches] = useState<number | null>(null);

  // Al abrir la confirmación de eliminar se cuenta en cuántos partidos aparece
  // la pareja: el partido guarda pair_id + pair_name, y al borrar la pareja el
  // resultado queda con un pair_id colgado. Se avisa, no se bloquea.
  useEffect(() => {
    if (!deleting || !tid) { setDeletingMatches(null); return; }
    let cancelled = false;
    db.listMatchesByTournament(tid).then((ms) => {
      if (cancelled) return;
      const n = ms.filter((m) => m.side_a?.pair_id === deleting.id || m.side_b?.pair_id === deleting.id).length;
      setDeletingMatches(n);
    }).catch(() => { if (!cancelled) setDeletingMatches(null); });
    return () => { cancelled = true; };
  }, [deleting, tid]);

  async function handleDelete(p: { id: string; name: string }) {
    try { await db.deletePair(p.id); toast.success(`Pareja "${p.name}" eliminada`); load(); } catch (e) { toast.error((e as Error).message ?? "Error al eliminar"); } finally { setDeleting(null); }
  }

  const [formKey, setFormKey] = useState(0);
  const openDialog = (pair: PairRow | null) => { setEditing(pair); setFormKey((k) => k + 1); setOpenCreate(true); };
  const dialogKey = `${editing?.id ?? "new"}-${formKey}`;

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Equipos" description="Las parejas inscritas viven dentro de cada torneo." action={
        <Button size="sm" disabled={!tid} onClick={() => openDialog(null)}><Plus className="h-3.5 w-3.5" /> Inscribir pareja</Button>
      }>
        <AdminStatStrip>
          <AdminStat value={resumen.parejas} label="Parejas" />
          <AdminStat value={resumen.categorias} label="Categorías" />
          <AdminStat value={resumen.completas} label="Categorías con rival" tone={resumen.completas > 0 ? "text-success" : undefined} />
          <AdminStat value={resumen.conEscudo} label="Con escudo" />
        </AdminStatStrip>
      </AdminPageHeader>

      {/* Contexto */}
      <section aria-label="Contexto del torneo" className="rounded-lg border bg-card p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Trophy className="h-4 w-4" /></span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">Torneo</p>
            <div className="mt-1 flex items-center gap-2">
              <Select value={tid || SIN_TORNEO} onValueChange={(v) => { if (v !== SIN_TORNEO) setTid(v); }}>
                <SelectTrigger className="h-8 w-full sm:w-72 text-xs"><SelectValue placeholder="Elige un torneo" /></SelectTrigger>
                <SelectContent>
                  {tournaments.length === 0 && <SelectItem value={SIN_TORNEO}>Elige un torneo</SelectItem>}
                  {tournaments.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {tid && <span className="text-caption text-muted-foreground whitespace-nowrap">· {categories.length} categorías · {pairs?.length ?? 0} parejas</span>}
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <Card><CardContent className="p-0">
          <AdminEmptyState
            icon={<AlertTriangle className="h-5 w-5" />}
            title={tid ? "No se pudieron cargar las parejas" : "No se pudieron cargar los torneos"}
            description={error}
            action={<Button variant="outline" size="sm" onClick={reintentar}>Reintentar</Button>}
          />
        </CardContent></Card>
      ) : !tid ? (
        <Card><CardContent className="p-0"><AdminEmptyState icon={<Trophy className="h-5 w-5" />} title="Elige un torneo" description="Cada torneo tiene sus propias parejas." /></CardContent></Card>
      ) : (
        <section aria-label="Equipos del torneo" className="mx-auto w-full max-w-3xl space-y-4">
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
              <AdminFacet label="Categoría" value={cat} onChange={setCat} options={categories.map(c => ({ key: c.id, label: c.name }))} allLabel="Todas" />
            </AdminFacets>
          </FilterBar>

          <Card>
            <CardContent className="p-0">
              <div className="space-y-3 p-4">
                {pairs === null && (
                  <div className="space-y-3" aria-label="Cargando parejas">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                        <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {pairs !== null && pairs.length === 0 && (
                  <AdminEmptyState icon={<Users className="h-5 w-5" />} title="Sin parejas" description="Inscribe la primera pareja." action={<Button variant="outline" size="sm" onClick={() => openDialog(null)}>Inscribir pareja</Button>} />
                )}
                {pairs !== null && pairs.length > 0 && filtered.length === 0 && (
                  <AdminEmptyState title="Sin coincidencias" description="Ninguna pareja coincide con la búsqueda o el filtro." />
                )}
                {filtered.length > 0 && (
                  <div className="space-y-3">
                    {filtered.map(p => {
                      const [p1, p2] = p.name.split(" / ");
                      return (
                        <div key={p.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                          <PairAvatar p1={p1} p2={p2} className="h-12 w-12 shrink-0 text-lg" />
                          <div className="min-w-0 flex-1">
                            <h4 className="truncate font-semibold">{p1} / {p2 ?? "—"}</h4>
                            <p className="text-xs text-muted-foreground">{categoryOf(p.category_id)}</p>
                          </div>
                          <RowActionsMenu
                            label={`Acciones para ${p.name}`}
                            actions={[
                              { label: "Editar", icon: <Pencil className="h-4 w-4" />, onSelect: () => openDialog(p) },
                              { label: "Eliminar", icon: <Trash2 className="h-4 w-4" />, onSelect: () => setDeleting({ id: p.id, name: p.name }), destructive: true, separator: true },
                            ]}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="border-t pt-3"><p className="text-xs text-muted-foreground">Total: {resumen.parejas} · Categorías con rival: {resumen.completas}</p></CardFooter>
          </Card>
        </section>
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        onConfirm={() => deleting && handleDelete(deleting)}
        title={`¿Eliminar la pareja "${deleting?.name ?? ""}"?`}
        description={
          deletingMatches
            ? `"${deleting?.name ?? ""}" tiene ${deletingMatches} ${deletingMatches === 1 ? "partido registrado" : "partidos registrados"}. Al eliminarla, esos resultados quedan guardados pero sin pareja ligada.`
            : "Se quita de este torneo. Sus perfiles no se borran."
        }
        destructive
      />
      <EquipoDialog key={dialogKey} open={openCreate} onOpenChange={(o) => { if (!o) { setOpenCreate(false); setEditing(null); } }} onSave={handleSave} editing={editing} submitting={submitting} players={players} categories={categories} />
    </div>
  );
}

function EquipoDialog({ open, onOpenChange, onSave, editing, submitting, players, categories }: { open: boolean; onOpenChange: (open: boolean) => void; onSave: (data: EquipoForm) => void; editing: { id: string; name: string; category_id: string | null; crest_url: string | null } | null; submitting: boolean; players: PlayerProfile[]; categories: TournamentCategory[]; }) {
  const [form, setForm] = useState<EquipoForm>(() => {
    if (editing) {
      const [p1, p2] = editing.name.split(" / ");
      return { name: editing.name, category_id: editing.category_id ?? "", player1_name: p1 ?? "", player2_name: p2 ?? "", crest_url: editing.crest_url ?? null };
    }
    return { name: "", category_id: categories[0]?.id ?? "", player1_name: "", player2_name: "", crest_url: null };
  });
  const [manualName, setManualName] = useState(Boolean(editing?.name));
  const [crest, setCrest] = useState<string | null>(editing?.crest_url ?? null);
  function setPlayers(slot: 1 | 2, name: string) {
    setForm((f) => { const next = { ...f, [slot === 1 ? "player1_name" : "player2_name"]: name }; return { ...next, name: manualName ? next.name : autoName(next) }; });
  }
  const valid = form.player1_name.trim() && form.player2_name.trim();
  const [crestVisto, setCrestVisto] = useState(crest);
  if (crest !== crestVisto) { setCrestVisto(crest); setForm((f) => (f.crest_url === crest ? f : { ...f, crest_url: crest })); }
  const originalCrest = editing?.crest_url ?? null;
  function changeCrest(next: string | null) {
    setCrest((prev) => { if (prev && prev !== next && prev !== originalCrest && prev.startsWith("http")) { void deleteStoredImage(prev, "team-crests"); } return next; });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar pareja" : "Inscribir pareja"}</DialogTitle>
          <DialogDescription>Una pareja de 2 jugadores. Escribe nombres nuevos o busca registrados.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-3">
            <ImageUpload id="team-crest" value={crest} onChange={changeCrest} label="Foto de la pareja" size="lg" bucket="team-crests" path="pairs" />
            <div className="min-w-0"><p className="text-sm font-semibold">Foto de la pareja</p><p className="text-xs leading-relaxed text-muted-foreground">Logo o escudo de la pareja.</p></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <PlayerSlot label="Jugador 1" value={form.player1_name} players={players} onPick={(n) => setPlayers(1, n)} onType={(n) => setPlayers(1, n)} />
            <PlayerSlot label="Jugador 2" value={form.player2_name} players={players} onPick={(n) => setPlayers(2, n)} onType={(n) => setPlayers(2, n)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="eq-name">Nombre de la pareja</Label>
            <Input id="eq-name" value={form.name} onChange={(e) => { setManualName(true); setForm((f) => ({ ...f, name: e.target.value })); }} placeholder={autoName(form) || "Se arma con los jugadores"} />
            {!manualName && autoName(form) && <p className="text-xs text-muted-foreground">Automático - edítalo si quieres</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="categoria">Categoría</Label>
            <Select value={form.category_id || "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v === "__none__" ? "" : v }))}>
              <SelectTrigger id="categoria"><SelectValue placeholder={SIN_CATEGORIA} /></SelectTrigger>
              <SelectContent><SelectItem value="__none__">{SIN_CATEGORIA}</SelectItem>{categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
            </Select>
            {(() => {
              const categoria = categories.find((c) => c.id === form.category_id) ?? null;
              const nivelDe = (nombre: string) => { const p = players.find((pl) => pl.display_name === nombre.trim()); return p ? (p.official_level ?? p.declared_level) : null; };
              const check = checkLevelSum(categoria?.name ?? null, [nivelDe(form.player1_name), nivelDe(form.player2_name)]);
              return check.message ? (
                <p className="flex items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs font-semibold text-destructive"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{check.message} Puedes inscribirla de todas formas.</p>
              ) : null;
            })()}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSave(form)} disabled={submitting || !valid}>{submitting ? "Guardando…" : editing ? "Actualizar" : "Inscribir pareja"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
