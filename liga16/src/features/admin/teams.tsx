import { motion, useReducedMotion } from "motion/react";
import { RowActions } from "@/components/admin/row-actions";
import { TeamSections } from "@/components/admin/team-sections";
import { FilterBar } from "@/components/ui/filter-bar";
import { AdminViewToggle, useAdminView } from "@/components/admin/view-toggle";
import { FilterMenu } from "@/components/ui/filter-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { db } from "@/lib/data";
import type { PlayerProfile, Tournament, TournamentCategory } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, Plus, Repeat, Trophy, Users } from "lucide-react";
import { checkLevelSum } from "@/lib/qualification";
import { ramaLabel } from "@/lib/categories";
import PlayerSlot from "@/components/players/player-slot";
import { ensurePlayer } from "@/lib/players";
import { BENTO_CARD, BENTO_LIGHT } from "@/components/admin/bento";
import { cn } from "@/lib/utils";
import { formatCity, formatDateRange, SIN_CATEGORIA } from "@/lib/format";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminPageHeader } from "@/components/admin/page-header";
import ImageUpload from "@/components/ui/image-upload";
import { deleteStoredImage } from "@/lib/storage";
import CardFlip from "@/components/kokonutui/card-flip";
import { AdminEmptyState } from "@/components/admin/empty-state";
import { Skeleton } from "@/components/ui/skeleton";


interface EquipoForm {
  name: string; category_id: string; player1_name: string; player2_name: string; crest_url: string | null;
}
interface PairRow { id: string; name: string; category_id: string | null; crest_url: string | null; }
function autoName(f: { player1_name: string; player2_name: string }): string {
  return [f.player1_name.trim(), f.player2_name.trim()].filter(Boolean).join(" / ");
}

export default function AdminTeams() {
  const reduced=useReducedMotion();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tid, setTidState] = useState<string>("");
  const [categories, setCategories] = useState<TournamentCategory[]>([]);
  const [pairs, setPairs] = useState<PairRow[] | null>(null);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [protectedTournaments, setProtectedTournaments] = useState<Set<string> | null>(null);
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
  const [view, setView] = useAdminView("equipos", ["cards", "tabla", "compacta"], "compacta");

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
    db.listIndividualRegistrations().then(rows=>setProtectedTournaments(new Set(rows.map(r=>r.tournament_id)))).catch(()=>setProtectedTournaments(null));
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
  const [matchCount, setMatchCount] = useState<Map<string, number> | null>(null);
  useEffect(() => {
    if (!tid) { setMatchCount(null); return; }
    let cancelled = false;
    setMatchCount(null);
    db.listMatchesByTournament(tid).then((ms) => {
      if (cancelled) return;
      const m = new Map<string, number>();
      for (const x of ms) for (const id of [x.side_a?.pair_id, x.side_b?.pair_id]) if (id) m.set(id, (m.get(id) ?? 0) + 1);
      setMatchCount(m);
    }).catch(() => { if (!cancelled) setMatchCount(null); });
    return () => { cancelled = true; };
  }, [tid, pairs]);
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

  const torneo = tournaments.find((t) => t.id === tid) ?? null;
  const torneoEstado =
    torneo?.status === "in_progress" ? "En juego" : torneo?.status === "registration_open" ? "Inscripciones abiertas" : null;
  const conteoPorCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pairs ?? []) m.set(p.category_id ?? "", (m.get(p.category_id ?? "") ?? 0) + 1);
    return m;
  }, [pairs]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Equipos"
        description="Las parejas inscritas viven dentro de cada torneo."
        action={
          <>
            <Button disabled={!tid} onClick={() => openDialog(null)}><Plus className="h-4 w-4" /> Inscribir pareja</Button>
          </>
        }
      />

      <TeamSections />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="min-w-0"><p className="text-xs uppercase tracking-wide text-muted-foreground">Torneo seleccionado</p><h2 className="break-words font-sans text-base font-semibold">{torneo?.name ?? "Elige un torneo"}</h2><p className="text-xs text-muted-foreground">{torneo ? `${formatDateRange(torneo.start_date, torneo.end_date)} · ${torneo.club_name ?? formatCity(torneo.city)}` : "Cada torneo conserva sus propias parejas"}</p></div>
        <div className="flex flex-wrap gap-4 text-sm"><span><strong className="tabular-nums">{resumen.parejas}</strong> parejas</span><span><strong className="tabular-nums">{resumen.categorias}</strong> categorías</span><span><strong className="tabular-nums">{resumen.completas}</strong> categorías con rival</span><span><strong className="tabular-nums">{resumen.conEscudo}</strong> con escudo</span>{torneoEstado && <span className="text-primary-strong">{torneoEstado}</span>}</div>
      </div>

      {error ? (
        <section className={cn(BENTO_CARD, BENTO_LIGHT)}>
          <AdminEmptyState
            icon={<AlertTriangle className="h-5 w-5" />}
            title={tid ? "No se pudieron cargar las parejas" : "No se pudieron cargar los torneos"}
            description={error}
            action={<Button variant="outline" size="sm" onClick={reintentar}>Reintentar</Button>}
          />
        </section>
      ) : !tid ? (
        <section className={cn(BENTO_CARD, BENTO_LIGHT)}>
          <AdminEmptyState icon={<Trophy className="h-5 w-5" />} title="Elige un torneo" description="Cada torneo tiene sus propias parejas." />
        </section>
      ) : (
        <section aria-label="Equipos del torneo" className="space-y-4">
          <FilterBar className="rounded-none border-0 bg-transparent p-0" search={query} onSearch={setQuery} searchPlaceholder="Buscar pareja…" resultCount={filtered.length} resultLabel="parejas" activeCount={Number(cat !== "all")} onClear={() => { setQuery(""); setCat("all"); }} controls={<AdminViewToggle value={view} onChange={setView} views={["cards", "tabla", "compacta"]} />}>
            <FilterMenu label="Torneo" value={tid || "all"} onChange={(v) => { if (v !== "all") setTid(v); }} options={tournaments.map((t) => ({ key: t.id, label: t.name }))} allLabel="Elegir torneo" />
            <FilterMenu label="Categoría" value={cat} onChange={setCat} options={categories.map((c) => ({ key: c.id, label: c.name, n: conteoPorCategoria.get(c.id) ?? 0 }))} allLabel="Todas" />
          </FilterBar>

          <motion.div key={view} initial={reduced ? false : {opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{duration:0.14}}>
          {pairs === null && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Cargando parejas">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-3xl" />)}
            </div>
          )}
          {pairs !== null && pairs.length === 0 && (
            <div className={cn(BENTO_CARD, BENTO_LIGHT)}>
              <AdminEmptyState icon={<Users className="h-5 w-5" />} title="Sin parejas" description="Inscribe la primera pareja." action={<Button variant="outline" size="sm" onClick={() => openDialog(null)}>Inscribir pareja</Button>} />
            </div>
          )}
          {pairs !== null && pairs.length > 0 && filtered.length === 0 && (
            <div className={cn(BENTO_CARD, BENTO_LIGHT)}>
              <AdminEmptyState title="Sin coincidencias" description="Ninguna pareja coincide con la búsqueda o el filtro." action={<Button variant="outline" size="sm" onClick={() => { setQuery(""); setCat("all"); }}>Limpiar</Button>} />
            </div>
          )}
          {filtered.length > 0 && view === "cards" && (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => {
                const [p1, p2] = p.name.split(" / ");
                const ini = `${p1?.trim().charAt(0) ?? "?"}${p2?.trim().charAt(0) ?? ""}`.toUpperCase();
                const partidos = matchCount ? matchCount.get(p.id) ?? 0 : null;
                return (
                  <li key={p.id}>
                    <CardFlip
                      label={`Pareja ${p.name}`}
                      className="h-56 w-full"
                      faceClassName="rounded-3xl border-border bg-card text-card-foreground dark:border-border dark:bg-card dark:text-card-foreground"
                      front={(
                        <div className="flex h-full flex-col gap-3 p-3">
                          {/* Portada: el escudo o foto si hay; si no, un póster oscuro con las iniciales. */}
                          <div className="relative h-24 shrink-0 overflow-hidden rounded-2xl bg-[#141414]">
                            {p.crest_url ? (
                              <img src={p.crest_url} alt={`Escudo de ${p.name}`} loading="lazy" className="h-full w-full object-cover" />
                            ) : (
                              <>
                                <div className="liga16-stripe" aria-hidden />
                                <span aria-hidden className="absolute inset-0 flex items-center justify-center font-display text-5xl font-bold leading-none tracking-[-0.04em] text-primary">{ini}</span>
                                <span aria-hidden className="absolute -bottom-8 -right-5 h-20 w-20 rounded-full bg-primary/15" />
                              </>
                            )}
                            <span className="absolute left-3 top-3 max-w-[70%] truncate rounded-full bg-black/60 px-2.5 py-1 text-caption text-white backdrop-blur">{categoryOf(p.category_id)}</span>
                            <span aria-hidden className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white backdrop-blur"><Repeat className="h-4 w-4" /></span>
                          </div>
                          <div className="min-w-0 flex-1 space-y-2 px-3 pb-1">
                            <h3 className="font-display text-xl font-bold leading-[1.05] tracking-tight">
                              <span className="block truncate">{p1}</span>
                              <span className="flex items-center gap-2 text-muted-foreground">
                                <span aria-hidden className="text-primary">&amp;</span>
                                <span className="truncate">{p2 ?? "—"}</span>
                              </span>
                            </h3>
                            <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                              <span className="tabular-nums">{partidos === null ? "Partidos: –" : `${partidos} ${partidos === 1 ? "partido" : "partidos"}`}</span>
                              <span className="inline-flex items-center gap-1 font-medium text-primary"><Repeat className="h-3.5 w-3.5" aria-hidden /> Ver acciones</span>
                            </div>
                          </div>
                        </div>
                      )}
                      back={(
                        <div className="flex h-full flex-col gap-3 p-4">
                          <div className="flex items-center gap-3">
                            <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 font-display text-base font-bold text-primary">{ini}</span>
                            <div className="min-w-0">
                              <h3 className="truncate font-display text-base font-bold leading-tight">{p.name}</h3>
                              <p className="truncate text-xs text-muted-foreground">{categoryOf(p.category_id)}</p>
                            </div>
                          </div>
                          <dl className="space-y-1.5 border-t border-border/60 pt-2 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <dt className="text-muted-foreground">Partidos</dt>
                              <dd className="tabular-nums font-medium">{partidos === null ? "–" : partidos}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <dt className="text-muted-foreground">Escudo</dt>
                              <dd className="font-medium">{p.crest_url ? "Con escudo" : "Sin escudo"}</dd>
                            </div>
                          </dl>
                          <div className="mt-auto flex justify-end"><RowActions name={p.name} onEdit={()=>openDialog(p)} onDelete={()=>setDeleting({id:p.id,name:p.name})} deleteDisabled={!protectedTournaments || protectedTournaments.has(tid)}/></div>
                        </div>
                      )}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          {filtered.length > 0 && view === "tabla" && (
            <div className="overflow-hidden rounded-2xl border bg-card">
              <Table aria-label="Equipos del torneo"><TableHeader><TableRow><TableHead>Pareja</TableHead><TableHead>Categoría</TableHead><TableHead>Partidos</TableHead><TableHead>Escudo</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                <TableBody>{filtered.map((p) => <TableRow key={p.id}><TableCell className="min-w-48 font-medium">{p.name}</TableCell><TableCell>{categoryOf(p.category_id)}</TableCell><TableCell>{matchCount?.get(p.id) ?? (matchCount ? 0 : "–")}</TableCell><TableCell>{p.crest_url ? "Con escudo" : "Sin escudo"}</TableCell><TableCell><div className="flex justify-end"><RowActions name={p.name} onEdit={()=>openDialog(p)} onDelete={()=>setDeleting({id:p.id,name:p.name})} deleteDisabled={!protectedTournaments || protectedTournaments.has(tid)}/></div></TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
          )}
          {filtered.length > 0 && view === "compacta" && (
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card">{filtered.map((p) => <li key={p.id} className="flex flex-wrap items-center gap-3 p-3"><span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 font-semibold text-primary">{p.crest_url ? <img src={p.crest_url} alt="" className="h-full w-full object-cover" /> : p.name.slice(0, 2).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{categoryOf(p.category_id)} · {matchCount?.get(p.id) ?? (matchCount ? 0 : "–")} partidos</p></div><RowActions name={p.name} onEdit={()=>openDialog(p)} onDelete={()=>setDeleting({id:p.id,name:p.name})} deleteDisabled={!protectedTournaments || protectedTournaments.has(tid)}/></li>)}</ul>
          )}
          </motion.div>
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
