// Admin -> Participantes: todas las parejas de TODOS los torneos en una sola vista.
// Categorias como se registran (5ta, 4ta, Suma 9...), jugadores visibles y
// gestion de pagos desde aqui. Nada se renombra: lo que el torneo guardó es
// lo que se muestra.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { db } from "@/lib/data";
import type { AllPair } from "@/lib/data/provider";
import type { PaymentMethod, PlayerProfile, RegistrationStatus, Tournament, TournamentCategory } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { FilterBar } from "@/components/ui/filter-bar";
import { AdminFacet, AdminFacets } from "@/components/admin/filter-facets";
import { countActive } from "@/lib/filters";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PairAvatar, CardShell, CardIdentity } from "@/components/cards/card-kit";
import { cn } from "@/lib/utils";
import { AdminEmptyState } from "@/components/admin/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { AdminPageHeader, AdminStat, AdminStatStrip } from "@/components/admin/page-header";
import { formatMoney, registrationStatusLabel, SIN_CATEGORIA } from "@/lib/format";
import { FolderInput, Trash2, UsersRound, UserPlus, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import PlayerSlot from "@/components/players/player-slot";
import { ensurePlayer } from "@/lib/players";

const AMBER = "text-warning-strong";

/** Estado de pago de un registro, para el badge de la fila. */
function paymentBadge(pair: AllPair) {
  const status = pair.registration_status;
  if (!status) return <Badge variant="outline" className="text-xs">Sin registro</Badge>;
  if (status === "paid") return <Badge variant="default" className="gap-1 text-xs"><CheckCircle2 className="h-3 w-3" /> {registrationStatusLabel.paid}</Badge>;
  if (status === "payment_review") return <Badge variant="secondary" className="gap-1 text-xs"><Clock className="h-3 w-3" /> {registrationStatusLabel.payment_review}</Badge>;
  if (status === "payment_pending") return <Badge variant="outline" className="gap-1 text-xs text-warning-strong border-warning/30"><AlertTriangle className="h-3 w-3" /> {registrationStatusLabel.payment_pending}</Badge>;
  if (status === "cancelled" || status === "refunded") return <Badge variant="destructive" className="text-xs">{registrationStatusLabel.cancelled}</Badge>;
  return <Badge variant="secondary" className="text-xs">{registrationStatusLabel[status] ?? status}</Badge>;
}

/** Categoría tal como el torneo la guardó. Nunca se le cambia el nombre. */
function categoryDisplay(pair: AllPair): string {
  return pair.category_name?.trim() || SIN_CATEGORIA;
}
export default function AdminParticipants() {
  const [pairs, setPairs] = useState<AllPair[] | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [categories, setCategories] = useState<TournamentCategory[]>([]);
  // El buscador vive en el FilterBar de la página y escribe ?q= (estándar admin).
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const setQuery = (v: string) => {
    const next = new URLSearchParams(params);
    if (!v) next.delete("q");
    else next.set("q", v);
    setParams(next, { replace: true });
  };
  const [fTournament, setFTournament] = useState("all");
  const [fCategory, setFCategory] = useState("all");
  const [deleting, setDeleting] = useState<AllPair | null>(null);
  const [moving, setMoving] = useState<AllPair | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>("");
  const [busy, setBusy] = useState(false);
  // Crear pareja desde esta misma vista (el hueco que faltaba).
  const [openCreate, setOpenCreate] = useState(false);
  const [draft, setDraft] = useState({ name: "", category_id: "", player1: "", player2: "" });
  const [draftTournament, setDraftTournament] = useState("");
  const [creating, setCreating] = useState(false);
  // Gestionar pago de un registro (flujo público).
  const [paying, setPaying] = useState<AllPair | null>(null);
  const [payForm, setPayForm] = useState<{ method: PaymentMethod; status: RegistrationStatus; amount: string }>({
    method: "cash",
    status: "paid",
    amount: "",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function load() {
    try {
      const [allPairs, ts, ps] = await Promise.all([db.listAllPairs(), db.listTournaments(), db.listPlayers()]);
      setPairs(allPairs);
      setTournaments(ts);
      setPlayers(ps);
    } catch (e) {
      toast.error((e as Error).message ?? "Error cargando participantes");
      setPairs([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  /**
   * Categorías de TODOS los torneos, no solo de los que ya tienen parejas.
   *
   * Antes se armaba la lista con los `tournament_id` que aparecían en las
   * parejas, así que un torneo recién creado —sin ninguna pareja inscrita— no
   * tenía categorías: el desplegable del alta salía vacío, sin aviso, y la
   * pareja se guardaba sin categoría para siempre ("Sin categoría" en la lista).
   */
  useEffect(() => {
    if (!tournaments) return;
    Promise.all(
      tournaments.map((t) => db.getTournamentCategories(t.id).catch(() => [] as TournamentCategory[])),
    ).then((lists) => setCategories(lists.flat()));
  }, [tournaments]);

  const filterCats = useMemo(() => {
    if (fTournament === "all") return categories;
    return categories.filter((c) => c.tournament_id === fTournament);
  }, [categories, fTournament]);

  const filtered = (pairs ?? []).filter((p) => {
    const q = query.trim().toLowerCase();
    if (q && !p.name.toLowerCase().includes(q) && !(p.tournament_name ?? "").toLowerCase().includes(q)) return false;
    if (fTournament !== "all" && p.tournament_id !== fTournament) return false;
    if (fCategory !== "all" && (p.category_id ?? "") !== fCategory) return false;
    return true;
  });

  /**
   * Las facetas con su cuenta: cuántos parejas hay en cada torneo y en cada
   * categoría. Con la cuenta a la vista, el filtro dice de entrada cuántos
   * pares se van a ver.
   */
  const tournamentOptions = useMemo(() => {
    const all = pairs ?? [];
    return tournaments
      .map((t) => ({ key: t.id, label: t.name, n: all.filter((p) => p.tournament_id === t.id).length }))
      .filter((o) => o.n > 0)
      .sort((a, b) => b.n - a.n);
  }, [pairs, tournaments]);

  const categoryOptions = useMemo(() => {
    const all = pairs ?? [];
    return filterCats
      .map((c) => ({ key: c.id, label: c.name, n: all.filter((p) => p.category_id === c.id).length }))
      .filter((o) => o.n > 0)
      .sort((a, b) => b.n - a.n);
  }, [pairs, filterCats]);

  /**
   * Cifras de cabecera. Se cuenta por torneo —cada torneo es su propio
   * circuito— y no un total que mezcle todos los torneos en un solo número.
   */
  const resumen = useMemo(() => {
    const all = pairs ?? [];
    const conTorneo = all.filter((p) => Boolean(p.tournament_id));
    const conRegistro = all.filter((p) => p.registration_status);
    return {
      parejas: all.length,
      torneos: new Set(conTorneo.map((p) => p.tournament_id)).size,
      sinTorneo: all.length - conTorneo.length,
      sinCategoria: all.filter((p) => !p.category_id).length,
      sinJugadores: all.filter((p) => !p.player1_id && !p.player2_id).length,
      pagadas: conRegistro.filter((p) => p.registration_status === "paid").length,
      pendientes: conRegistro.filter((p) => p.registration_status && p.registration_status !== "paid").length,
    };
  }, [pairs]);

  async function handleDelete(p: AllPair) {
    setBusy(true);
    try {
      await db.deletePair(p.id);
      toast.success("Pareja \"" + p.name + "\" eliminada");
      load();
    } catch (e) {
      toast.error((e as Error).message ?? "Error al eliminar");
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  }

  function openMove(p: AllPair) {
    setMoving(p);
    setMoveTarget("");
  }

  async function handleMove() {
    if (!moving || !moveTarget) return;
    if (moveTarget === moving.tournament_id) {
      toast.info("La pareja ya está en ese torneo");
      return;
    }
    setBusy(true);
    try {
      // La categoría del torneo destino no existe aquí → se deja null para
      // que el admin la reasigne desde la pestaña Equipos del torneo destino.
      await db.updatePair(moving.id, { tournament_id: moveTarget });
      toast.success("\"" + moving.name + "\" movida a otro torneo");
      setMoving(null);
      load();
    } catch (e) {
      toast.error((e as Error).message ?? "Error al mover");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    const p1 = draft.player1.trim();
    const p2 = draft.player2.trim();
    if (!p1 || !p2) {
      toast.error("Captura ambos jugadores");
      return;
    }
    if (p1.toLowerCase() === p2.toLowerCase()) {
      toast.error("El mismo jugador no puede estar 2 veces en el equipo");
      return;
    }
    if (!draftTournament) {
      toast.error("Elige un torneo");
      return;
    }
    // La categoría tiene que ser DEL torneo elegido. El desplegable ya se
    // filtraba, pero `draft.category_id` sobrevive al cambio de torneo: se podía
    // elegir "4ta" en el torneo A, cambiar al B y guardar la categoría de A en B.
    if (draft.category_id) {
      const cat = categories.find((c) => c.id === draft.category_id);
      if (cat && cat.tournament_id !== draftTournament) {
        toast.error("La categoría elegida es de otro torneo");
        return;
      }
    }
    setCreating(true);
    try {
      const [prof1, prof2] = await Promise.all([ensurePlayer(p1).catch(() => null), ensurePlayer(p2).catch(() => null)]);
      await db.createPair({
        tournament_id: draftTournament,
        category_id: draft.category_id || null,
        name: draft.name.trim() || (p1 + " / " + p2),
        player1_id: prof1?.id ?? null,
        player2_id: prof2?.id ?? null,
      });
      toast.success("Equipo inscrito");
      setOpenCreate(false);
      setDraft({ name: "", category_id: "", player1: "", player2: "" });
      setDraftTournament("");
      load();
    } catch (e) {
      toast.error((e as Error).message ?? "Error al inscribir");
    } finally {
      setCreating(false);
    }
  }

  function openPay(p: AllPair) {
    setPaying(p);
    setPayForm({
      method: p.payment_method ?? "cash",
      status: p.registration_status ?? "payment_pending",
      amount: p.amount_cents ? String(p.amount_cents / 100) : "",
    });
  }

  async function handleMarkPaid() {
    if (!paying || !paying.registration_id) {
      toast.error("Esta pareja no tiene registro de inscripción (se creó desde el admin).");
      return;
    }
    setBusy(true);
    try {
      await db.updateRegistrationPayment(paying.registration_id, {
        status: payForm.status,
        payment_method: payForm.method,
        amount_cents: payForm.amount ? Math.round(Number(payForm.amount) * 100) : null,
        paid_at: payForm.status === "paid" ? new Date().toISOString() : null,
      });
      toast.success("Estado de pago actualizado");
      setPaying(null);
      load();
    } catch (e) {
      toast.error((e as Error).message ?? "Error al guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Participantes"
        description="Todas las parejas de todos los torneos, en una sola vista."
        action={
          <Button size="sm" onClick={() => { setDraft({ name: "", category_id: "", player1: "", player2: "" }); setDraftTournament(""); setOpenCreate(true); }}>
            <UserPlus className="h-4 w-4" /> Inscribir pareja
          </Button>
        }
      >
        <AdminStatStrip>
          <AdminStat value={resumen.parejas} label="Parejas" />
          <AdminStat value={resumen.torneos} label="Torneos" />
          <AdminStat
            value={resumen.sinTorneo}
            label="Sin torneo"
            tone={resumen.sinTorneo > 0 ? AMBER : undefined}
          />
          <AdminStat
            value={resumen.sinJugadores}
            label="Sin jugadores"
            tone={resumen.sinJugadores > 0 ? AMBER : undefined}
          />
          <AdminStat
            value={resumen.pagadas}
            label="Pagadas"
            tone={resumen.pagadas > 0 ? "text-success" : undefined}
          />
          <AdminStat
            value={resumen.pendientes}
            label="Por cobrar"
            tone={resumen.pendientes > 0 ? AMBER : undefined}
          />
        </AdminStatStrip>
      </AdminPageHeader>

      <Card>
        <CardHeader className="gap-3">
          <FilterBar
            search={query}
            onSearch={setQuery}
            searchPlaceholder="Buscar pareja o torneo…"
            resultCount={filtered.length}
            resultLabel="parejas"
            activeCount={countActive(fTournament, fCategory)}
            onClear={() => { setQuery(""); setFTournament("all"); setFCategory("all"); }}
          >
            <AdminFacets>
              <AdminFacet
                label="Torneo"
                value={fTournament}
                onChange={(v) => { setFTournament(v); setFCategory("all"); }}
                options={tournamentOptions}
                allLabel="Todos"
              />
              <AdminFacet
                label="Categoría"
                value={fCategory}
                onChange={setFCategory}
                options={categoryOptions}
                allLabel="Todas"
              />
            </AdminFacets>
          </FilterBar>
        </CardHeader>
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
              icon={<UsersRound className="h-5 w-5" />}
              title="No hay participantes todavía"
              description="Las parejas se inscriben desde el asistente de torneos o desde aquí."
            />
          )}

          {pairs !== null && pairs.length > 0 && filtered.length === 0 && (
            <AdminEmptyState
              icon={<UsersRound className="h-5 w-5" />}
              title="Sin coincidencias"
              description="Ninguna pareja coincide con la búsqueda o el filtro."
            />
          )}

          {filtered.length > 0 && (() => {
            const sel = filtered.find((p) => p.id === selectedId) ?? null;
            const selP1 = sel?.name.split(" / ")[0] ?? "";
            const selP2 = sel?.name.split(" / ")[1] ?? "";
            const prof1 = sel ? players.find((pl) => pl.id === sel.player1_id) : undefined;
            const prof2 = sel ? players.find((pl) => pl.id === sel.player2_id) : undefined;
            return (
              <div className="grid divide-y lg:grid-cols-[minmax(260px,320px)_1fr] lg:divide-x lg:divide-y-0">
                <div className="max-h-[70vh] overflow-y-auto p-2">
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
                            "h-20 rounded-xl border bg-muted/50 p-3 transition-colors hover:bg-muted/60",
                            active && "accent ring-2 ring-primary/40"
                          )}
                          accent={active}
                        >
                          <CardIdentity
                            lead={<PairAvatar p1={p1} p2={p2} />}
                            title={`${p1} / ${p2 ?? "—"}`}
                            meta={`${categoryDisplay(p)} · ${p.tournament_name ?? "Sin torneo"}`}
                          />
                          <div className="mt-2 flex items-center justify-end">
                            {paymentBadge(p)}
                          </div>
                        </CardShell>
                      </button>
                    );
                  })}
                </div>

                <div className="p-4">
                  {!sel ? (
                    <div className="flex h-full min-h-48 items-center justify-center text-sm text-muted-foreground">
                      Selecciona una pareja para ver su detalle.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold">{selP1} / {selP2 || "—"}</h3>
                          <p className="text-xs text-muted-foreground">{categoryDisplay(sel)} · {sel.tournament_name ?? "Sin torneo"}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {[
                              { name: selP1, level: prof1 ? (prof1.official_level ?? prof1.declared_level) : null },
                              { name: selP2, level: prof2 ? (prof2.official_level ?? prof2.declared_level) : null },
                            ].filter((c) => c.name).map((c) => (
                              <span key={c.name} className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs">
                                <PairAvatar p1={c.name} className="h-6 w-6 border text-xs" />
                                <span className="font-medium">{c.name}</span>
                                {c.level != null && <span className="text-muted-foreground">Nv {c.level}</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                        <span className="shrink-0">{paymentBadge(sel)}</span>
                      </div>

                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                        <div><dt className="text-xs text-muted-foreground">Torneo</dt><dd className="truncate">{sel.tournament_name ?? "—"}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Categoría</dt><dd className="truncate">{categoryDisplay(sel)}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Monto</dt><dd>{sel.amount_cents != null ? formatMoney(sel.amount_cents, sel.currency) : "—"}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Método</dt><dd>{sel.payment_method ?? "—"}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Jugador 1</dt><dd className="truncate">{prof1?.display_name ?? selP1}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Jugador 2</dt><dd className="truncate">{prof2?.display_name ?? selP2 ?? "—"}</dd></div>
                      </dl>

                      <div className="flex flex-wrap gap-2 border-t pt-3">
                        {sel.registration_id && (
                          <Button size="sm" variant="outline" onClick={() => openPay(sel)}>
                            <CheckCircle2 className="h-4 w-4" /> Gestionar pago
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openMove(sel)}>
                          <FolderInput className="h-4 w-4" /> Mover a otro torneo
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setDeleting(sel)}>
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

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        onConfirm={() => deleting && handleDelete(deleting)}
        title={`¿Eliminar la pareja "${deleting?.name ?? ""}"?`}
        description="Se quita del torneo donde está inscrita. Sus perfiles de jugador no se borran."
        destructive
      />

      <Dialog open={!!moving} onOpenChange={(o) => { if (!o) setMoving(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FolderInput className="h-5 w-5" /> Mover pareja</DialogTitle>
            <DialogDescription>
              Mueve "{moving?.name ?? ""}" a otro torneo. Al llegar se queda sin categoría asignada hasta que la reasignes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Select value={moveTarget} onValueChange={setMoveTarget}>
              <SelectTrigger aria-label="Torneo destino">
                <SelectValue placeholder="Elige el torneo destino" />
              </SelectTrigger>
              <SelectContent>
                {tournaments
                  .filter((t) => t.id !== moving?.tournament_id)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoving(null)}>Cancelar</Button>
            <Button onClick={handleMove} disabled={!moveTarget || busy}>
              {busy ? "Moviendo…" : "Mover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Inscribir pareja</DialogTitle>
            <DialogDescription>
              Crea una pareja en un torneo. Si los jugadores ya existen, se ligan; si no, se registran.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {/* Cambiar de torneo limpia la categoría: si no, se quedaba la del torneo
                anterior y el alta fallaba o guardaba una categoría ajena. */}
            <Select
              value={draftTournament}
              onValueChange={(v) => {
                setDraftTournament(v);
                setDraft((d) => ({ ...d, category_id: "" }));
              }}
            >
              <SelectTrigger aria-label="Torneo">
                <SelectValue placeholder="Torneo" />
              </SelectTrigger>
              <SelectContent>
                {tournaments.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={draft.category_id}
              onValueChange={(v) => setDraft((d) => ({ ...d, category_id: v }))}
            >
              <SelectTrigger aria-label="Categoría">
                <SelectValue placeholder="Categoría (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {/* Se usan TODAS las categorías del torneo elegido, no
                    `filterCats`: ese ya viene recortado por el filtro de la
                    LISTA, así que si filtrabas la lista por el torneo A y en el
                    alta elegías el B, el desplegable salía vacío. */}
                {(!draftTournament
                  ? categories
                  : categories.filter((c) => c.tournament_id === draftTournament)
                ).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <PlayerSlot
              label="Jugador 1"
              value={draft.player1}
              players={players}
              onType={(v) => setDraft((d) => ({ ...d, player1: v }))}
              onPick={(v) => setDraft((d) => ({ ...d, player1: v }))}
            />
            <PlayerSlot
              label="Jugador 2"
              value={draft.player2}
              players={players}
              onType={(v) => setDraft((d) => ({ ...d, player2: v }))}
              onPick={(v) => setDraft((d) => ({ ...d, player2: v }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Inscribiendo…" : "Inscribir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!paying} onOpenChange={(o) => { if (!o) setPaying(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> Gestionar pago</DialogTitle>
            <DialogDescription>
              {paying?.name} — {paying?.tournament_name ?? "Sin torneo"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Select
              value={payForm.status}
              onValueChange={(v) => setPayForm((f) => ({ ...f, status: v as RegistrationStatus }))}
            >
              <SelectTrigger aria-label="Estado">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="payment_pending">Pendiente</SelectItem>
                <SelectItem value="payment_review">{registrationStatusLabel.payment_review}</SelectItem>
                <SelectItem value="paid">Pagado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
                <SelectItem value="refunded">Reembolsado</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={payForm.method}
              onValueChange={(v) => setPayForm((f) => ({ ...f, method: v as PaymentMethod }))}
            >
              <SelectTrigger aria-label="Método de pago">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Efectivo</SelectItem>
                <SelectItem value="transfer">Transferencia</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="mercado_pago">Mercado Pago</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Monto (en pesos, opcional)"
              value={payForm.amount}
              onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)}>Cancelar</Button>
            <Button onClick={handleMarkPaid} disabled={busy}>
              {busy ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

