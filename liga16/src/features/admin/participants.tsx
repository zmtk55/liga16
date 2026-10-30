import { preparePaymentOperation, type PendingPaymentOperation } from '@/lib/payment-operation';
import {createEntryResource,ensureTournamentEntry,entryPaymentRelease,listEntryPayments,recordEntryPayment,type IndividualEntryRecord,type EntryPayment} from '@/lib/entry-payment-service';
import { parsePaymentCents } from '@/lib/payment-input';
import { RowActions } from "@/components/admin/row-actions";
import { identifyIndividualRegistrations, groupRegistrationCandidates, type IndividualRegistrationRow } from "@/lib/individual-registrations";
import { useAuth } from "@/contexts/AuthContext";
import { canManageTournament } from "@/lib/access";
import { TeamSections } from "@/components/admin/team-sections";
// Admin -> Participantes: todas las parejas de TODOS los torneos en una sola vista.
// Categorias como se registran (5ta, 4ta, Suma 9...), jugadores visibles y
// gestion de pagos desde aqui. Nada se renombra: lo que el torneo guardó es
// lo que se muestra.
import { AdminLoadFailed } from "@/components/admin/empty-state";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { db } from "@/lib/data";
import type { AllPair } from "@/lib/data/provider";
import type { Pair,PaymentMethod, PlayerProfile, RegistrationStatus, Tournament, TournamentCategory } from "@/types";
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
import { AdminEmptyState } from "@/components/admin/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { AdminPageHeader } from "@/components/admin/page-header";
import { formatMoney, registrationStatusLabel, SIN_CATEGORIA } from "@/lib/format";
import { FolderInput, UsersRound, UserPlus, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import PlayerSlot from "@/components/players/player-slot";
import { resolveTournamentPlayer } from "@/lib/players";


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
  const { user } = useAuth();
  const [pairs, setPairs] = useState<AllPair[] | null>(null);
  const [entryRecords,setEntryRecords]=useState<IndividualEntryRecord[]>([]);
  const [selectedEntry,setSelectedEntry]=useState<IndividualEntryRecord|null>(null);
  const [registrations, setRegistrations] = useState<IndividualRegistrationRow[]>([]);
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
  const [draft, setDraft] = useState({ name: "", category_id: "", player1: "", player2: "",player1Id:"",player2Id:"" });
  const [draftTournament, setDraftTournament] = useState("");
  const [creating, setCreating] = useState(false);
  const createOperations=useRef({player1:crypto.randomUUID(),player2:crypto.randomUUID(),pair:crypto.randomUUID()});
  const pendingPair=useRef<{id:string,signature:string}|null>(null);
  // Gestionar pago de un registro (flujo público).
  const paymentOperation = useRef<PendingPaymentOperation | null>(null);
  const openedPaymentRevision = useRef<number | undefined>(undefined);
  const [paying, setPaying] = useState<AllPair | null>(null);
  const [payForm, setPayForm] = useState<{ method: PaymentMethod; status: RegistrationStatus; amount: string }>({
    method: "cash",
    status: "paid",
    amount: "",
  });

  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [allPairs, ts, ps, rs, entries] = await Promise.all([db.listAllPairs(), db.listTournaments(), db.listPlayers(), db.listIndividualRegistrations(),listEntryPayments()]);

      const owned = ts.filter(t => canManageTournament(user, t));
      const ids = new Set(owned.map(t=>t.id));
      setEntryRecords(user?.role==="organizer"?entries.filter(e=>ids.has(e.tournament_id)):entries);
      setPairs(user?.role === "organizer" ? allPairs.filter(p=>p.tournament_id && ids.has(p.tournament_id)) : allPairs);
      setTournaments(owned);
      setRegistrations(user?.role === "organizer" ? rs.filter(r=>ids.has(r.tournament_id)) : rs);
      setPlayers(ps);
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error)?.message || "Error al cargar las parejas");
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

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

  const filteredEntries=entryRecords.filter(e=>{const p=players.find(p=>p.id===e.player_id),t=tournaments.find(t=>t.id===e.tournament_id);return (fTournament==="all"||e.tournament_id===fTournament)&&(!query.trim()||`${p?.display_name??""} ${t?.name??""}`.toLowerCase().includes(query.trim().toLowerCase()));});
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
    if(entryPaymentRelease.available)return tournaments.map(t=>({key:t.id,label:t.name,n:entryRecords.filter(e=>e.tournament_id===t.id).length})).filter(o=>o.n>0);
    return tournaments
      .map((t) => ({ key: t.id, label: t.name, n: all.filter((p) => p.tournament_id === t.id).length }))
      .filter((o) => o.n > 0)
      .sort((a, b) => b.n - a.n);
  }, [pairs, tournaments,entryRecords]);

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
    const individual = groupRegistrationCandidates(identifyIndividualRegistrations(registrations, players)).filter(g=>!g.needsReview);
    return {
      parejas: all.length,
      torneos: new Set(conTorneo.map((p) => p.tournament_id)).size,
      sinTorneo: all.length - conTorneo.length,
      sinCategoria: all.filter((p) => !p.category_id).length,
      sinJugadores: all.filter((p) => !p.player1_id && !p.player2_id).length,
      pagadas: entryPaymentRelease.available?entryRecords.filter(e=>e.payment.status==="paid").length:individual.filter(g=>g.records[0].status === "paid").length,
      pendientes: entryPaymentRelease.available?entryRecords.filter(e=>["payment_pending","payment_review"].includes(e.payment.status)).length:individual.filter(g=>["payment_pending","payment_review"].includes(g.records[0].status)).length,
    };
  }, [pairs, registrations, players,entryRecords]);

  async function handleDelete(p: AllPair) {
    if(registrations.some(r=>r.tournament_id===p.tournament_id)||entryRecords.some(e=>e.tournament_id===p.tournament_id)){toast.error("Se conserva el historial de pagos; borrado no habilitado");return;}
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
    if (user?.role === "organizer") { toast.info("Los cambios de torneo los hace el administrador general"); return; }
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
    if ((draft.player1Id&&draft.player2Id)?draft.player1Id===draft.player2Id:p1.toLowerCase() === p2.toLowerCase()) {
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
      const resolve = (name:string,id:string,key:string) => resolveTournamentPlayer(name,id||undefined,players,draftTournament,user?.role==="organizer",undefined,key);
      const [prof1, prof2] = await Promise.all([resolve(p1,draft.player1Id,createOperations.current.player1), resolve(p2,draft.player2Id,createOperations.current.player2)]);
      if (!prof1 || !prof2) throw new Error("No se pudieron resolver los jugadores");
      setPlayers(existing=>[...existing.filter(p=>p.id!==prof1.id&&p.id!==prof2.id),prof1,prof2]);
      setDraft(existing=>({...existing,player1Id:prof1.id,player2Id:prof2.id}));
      const signature=JSON.stringify([draftTournament,draft.category_id,draft.name,prof1.id,prof2.id]);
      if(pendingPair.current&&pendingPair.current.signature!==signature)throw new Error('Reintenta el alta pendiente antes de cambiar los datos');
      if(!pendingPair.current){const data={
        tournament_id: draftTournament,
        category_id: draft.category_id || null,
        name: draft.name.trim() || (p1 + " / " + p2),
        player1_id: prof1?.id ?? null,
        player2_id: prof2?.id ?? null,
      };const created=entryPaymentRelease.available?await createEntryResource(draftTournament,createOperations.current.pair,"pair",{name:data.name,category_id:data.category_id,player1_id:data.player1_id,player2_id:data.player2_id}) as Pair:await db.createPair(data);pendingPair.current={id:created.id,signature};}
      await ensureTournamentEntry(draftTournament,prof1.id);
      await ensureTournamentEntry(draftTournament,prof2.id);
      pendingPair.current=null;createOperations.current={player1:crypto.randomUUID(),player2:crypto.randomUUID(),pair:crypto.randomUUID()};
      toast.success("Equipo inscrito");
      setOpenCreate(false);
      setDraft({ name: "", category_id: "", player1: "", player2: "",player1Id:"",player2Id:"" });
      setDraftTournament("");
      load();
    } catch (e) {
      toast.error((e as Error).message ?? "Error al inscribir");
    } finally {
      setCreating(false);
    }
  }

  function openPay(p: AllPair, entry?:IndividualEntryRecord) {
    if(paymentOperation.current && selectedEntry?.id!==entry?.id){toast.error("Confirma primero el guardado pendiente del otro jugador");return;}
    setSelectedEntry(entry ?? null);
    openedPaymentRevision.current = entry?.payment.revision;
    setPaying(p);
    setPayForm({
      method: p.payment_method ?? "cash",
      status: p.registration_status ?? "payment_pending",
      amount: p.amount_cents == null ? "" : String(p.amount_cents / 100),
    });
  }

  async function handleMarkPaid() {
    if (!paying || !paying.registration_id) {
      toast.error("Este jugador no tiene una inscripción individual vinculada.");
      return;
    }
    setBusy(true);
    try {
      const amountCents = parsePaymentCents(payForm.amount);
      if (entryPaymentRelease.available) {
      if (!selectedEntry) throw new Error('Falta la inscripción individual. No se cambió el pago.');
      const operation = preparePaymentOperation(paymentOperation, openedPaymentRevision.current, {id:selectedEntry.id,status:payForm.status,method:payForm.method,amount:amountCents});
      await recordEntryPayment(selectedEntry.id, {status:payForm.status as EntryPayment['status'],payment_method:payForm.method,amount_cents:amountCents}, operation);
      paymentOperation.current = null;
      } else {
        if (selectedEntry) throw new Error('El modo de pagos cambió. Recarga antes de guardar.');
        await db.updateRegistrationPayment(paying.registration_id, {
          status: payForm.status, payment_method: payForm.method, amount_cents: amountCents,
          paid_at: payForm.status === 'paid' ? new Date().toISOString() : null,
        });
      }
      toast.success("Estado de pago actualizado");
      setPaying(null);
      load();
    } catch (e) {
      toast.error((e as Error).message ?? "Error al guardar");
    } finally {
      setBusy(false);
    }
  }

  if (loadError && pairs === null) {
    return (
      <AdminLoadFailed
        title="Equipos"
        description="Inscripciones y pagos individuales por torneo."
        what="las parejas"
        message={loadError}
        onRetry={() => { load(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Equipos"
        description="Inscripciones y pagos individuales por torneo."
        action={
          <Button size="sm" onClick={() => { setDraft({ name: "", category_id: "", player1: "", player2: "",player1Id:"",player2Id:"" }); setDraftTournament(""); setOpenCreate(true); }}>
            <UserPlus className="h-4 w-4" /> Inscribir pareja
          </Button>
        }
      >
      </AdminPageHeader>
      <TeamSections />
      <div aria-label="Resumen de inscripciones" className="flex flex-wrap gap-x-5 gap-y-2 border-b pb-3">{(entryPaymentRelease.available?[["Inscripciones",entryRecords.length],["Torneos",new Set(entryRecords.map(e=>e.tournament_id)).size],["Pagadas",resumen.pagadas],["Pago pendiente",resumen.pendientes],["Canceladas",entryRecords.filter(e=>e.payment.status==="cancelled").length],["Reembolsadas",entryRecords.filter(e=>e.payment.status==="refunded").length]]:[
        ["Parejas", resumen.parejas], ["Torneos", resumen.torneos], ["Sin torneo", resumen.sinTorneo], ["Sin jugadores", resumen.sinJugadores], ["Jugadores pagados", resumen.pagadas], ["Por cobrar", resumen.pendientes],
      ]).map(([label, value]) => <div key={label} className="flex items-baseline gap-2"><p className="text-xs text-muted-foreground">{label}</p><p className="font-sans text-base font-semibold tabular-nums">{pairs === null ? "–" : value}</p></div>)}</div>

      <section className="space-y-3">
        <div>
          <FilterBar
            className="rounded-none border-0 bg-transparent p-0"
            search={query}
            onSearch={setQuery}
            searchPlaceholder={entryPaymentRelease.available?"Buscar jugador o torneo…":"Buscar pareja o torneo…"}
            resultCount={entryPaymentRelease.available?filteredEntries.length:filtered.length}
            resultLabel={entryPaymentRelease.available?"inscripciones":"parejas"}
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
              {!entryPaymentRelease.available&&<AdminFacet
                label="Categoría"
                value={fCategory}
                onChange={setFCategory}
                options={categoryOptions}
                allLabel="Todas"
              />}
            </AdminFacets>
          </FilterBar>
        </div>
        <div>
          {entryPaymentRelease.available && <div className="divide-y border-y" aria-label="Pagos individuales por torneo">
            {filteredEntries.map(entry=>{
              const person=players.find(p=>p.id===entry.player_id);
              const tournament=tournaments.find(t=>t.id===entry.tournament_id);
              const contexts=(pairs??[]).filter(p=>p.tournament_id===entry.tournament_id&&(p.player1_id===entry.player_id||p.player2_id===entry.player_id));
              const display={id:entry.id,name:person?.display_name??"Jugador sin perfil visible",tournament_id:entry.tournament_id,registration_id:entry.id,registration_status:entry.payment.status,payment_method:entry.payment.payment_method,amount_cents:entry.payment.amount_cents} as AllPair;
              return <div key={entry.id} className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-3 sm:grid-cols-[minmax(140px,1fr)_minmax(110px,1fr)_minmax(130px,1fr)_auto]">
                <div className="min-w-0"><p className="text-sm font-medium">{display.name}</p><p className="text-xs text-muted-foreground">{tournament?.name??"Torneo"}{contexts.length?` · ${contexts.map(p=>p.name).join(", ")}`:" · Sin pareja asignada"}</p></div>
                <div>{paymentBadge(display)}</div>
                <p className="text-xs text-muted-foreground">{entry.payment.amount_cents==null?"Monto sin registrar":formatMoney(entry.payment.amount_cents,tournament?.currency??"MXN")}{entry.payment.payment_method?` · ${entry.payment.payment_method==="cash"?"Efectivo":entry.payment.payment_method==="transfer"?"Transferencia":entry.payment.payment_method}`:""}</p>
                <Button size="sm" variant="ghost" className="min-h-11 justify-self-end" aria-label={`Gestionar pago de ${display.name}`} onClick={()=>openPay(display,entry)}>Gestionar</Button>
              </div>;
            })}
            {pairs!==null&&filteredEntries.length===0&&<p className="py-4 text-sm text-muted-foreground">Sin inscripciones individuales. El historial anterior no se convierte en pagos nuevos.</p>}
            {registrations.length>0&&<p className="py-3 text-xs text-muted-foreground">Hay registros anteriores conservados para conciliación. No se copiaron sus importes.</p>}
          </div>}

          {pairs === null && (
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          )}

          {!entryPaymentRelease.available && pairs !== null && pairs.length === 0 && (
            <AdminEmptyState
              icon={<UsersRound className="h-5 w-5" />}
              title="No hay participantes todavía"
              description="Las parejas se inscriben desde el asistente de torneos o desde aquí."
            />
          )}

          {!entryPaymentRelease.available && pairs !== null && pairs.length > 0 && filtered.length === 0 && (
            <AdminEmptyState
              icon={<UsersRound className="h-5 w-5" />}
              title="Sin coincidencias"
              description="Ninguna pareja coincide con la búsqueda o el filtro."
            />
          )}

          {!entryPaymentRelease.available && filtered.length > 0 && <div className="divide-y border-y" aria-label="Inscripciones individuales">
            {filtered.map(pair => <section key={pair.id} className="py-2" aria-label={pair.name}>
              <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 px-1">
                <div className="min-w-0"><h3 className="font-sans text-sm font-semibold">{pair.name}</h3><p className="text-xs text-muted-foreground">{pair.tournament_name ?? "Sin torneo"} · {categoryDisplay(pair)}</p></div>
                <div className="flex flex-wrap items-center gap-2">
                {user?.role === "admin" && pair.registration_id && <Button size="sm" variant="outline" onClick={()=>openPay(pair)} aria-label={`Gestionar pago de ${pair.name}`}>Gestionar pago</Button>}
                <RowActions name={pair.name} onMove={user?.role === "admin" ? ()=>openMove(pair) : undefined} onDelete={()=>setDeleting(pair)} deleteDisabled={registrations.some(r=>r.tournament_id===pair.tournament_id)||entryRecords.some(e=>e.tournament_id===pair.tournament_id)}/></div>

              </div>
              {[pair.player1_id,pair.player2_id].map((id,index)=>{
                const person=players.find(p=>p.id===id);
                const name=person?.display_name ?? pair.name.split(" / ")[index] ?? `Jugador ${index+1}`;
                const candidate=groupRegistrationCandidates(identifyIndividualRegistrations(registrations,players)).find(g=>g.records.some(r=>r.tournament_id===pair.tournament_id && r.player_id===id && id));
                const history=candidate?.records[0];
                const matches=entryRecords.filter(e=>e.tournament_id===pair.tournament_id&&e.player_id===id);
                const current=matches.length===1?matches[0]:null;
                const record=entryPaymentRelease.available?(current?{...current.payment,status:current.payment.status}:undefined):history;
                return <div key={id ?? index} className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-t border-dashed px-1 py-2 sm:grid-cols-[minmax(140px,1fr)_minmax(150px,1fr)_minmax(130px,1fr)_auto]">
                  <p className="text-sm font-medium">{name}</p>
                  <div className="justify-self-end sm:justify-self-start">{!record ? <span className="text-xs text-muted-foreground">Sin registro</span> : candidate?.needsReview ? <span className="text-xs text-warning-strong">Revisar registros</span> : paymentBadge({...pair,registration_status:record.status})}</div>
                  <p className="text-xs text-muted-foreground">{!record ? "Sin pago vinculado" : candidate?.needsReview ? "No combinar importes" : `${record.amount_cents==null ? "Monto sin registrar" : formatMoney(record.amount_cents,pair.currency)}${record.payment_method ? ` · ${record.payment_method === "cash" ? "Efectivo" : record.payment_method === "transfer" ? "Transferencia" : record.payment_method}` : ""}`}</p>
                  {entryRecords.filter(e=>e.tournament_id===pair.tournament_id&&e.player_id===id).map(entry=><Button key={entry.id} size="sm" variant="ghost" className="min-h-11 justify-self-end" aria-label={`Gestionar pago de ${name}`} onClick={()=>openPay({...pair,name,registration_id:entry.id,registration_status:entry.payment.status,payment_method:entry.payment.payment_method,amount_cents:entry.payment.amount_cents},entry)}>Gestionar</Button>)}
                  {history&&<span className="text-xs text-muted-foreground">Registro anterior al corte individual</span>}
                </div>;
              })}
              {identifyIndividualRegistrations(registrations,players).some(r=>r.pair_id===pair.id && r.identity_status!=="linked") && <p className="py-2 text-xs text-warning-strong">Hay pagos sin jugador identificado. Revisar vínculo.</p>}
            </section>)}
          </div>}

        </div>
      </section>

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
              onType={(v) => setDraft((d) => ({ ...d, player1: v,player1Id:"" }))}
              onPick={(v,id) => setDraft((d) => ({ ...d, player1: v,player1Id:id }))}
            />
            <PlayerSlot
              label="Jugador 2"
              value={draft.player2}
              players={players}
              onType={(v) => setDraft((d) => ({ ...d, player2: v,player2Id:"" }))}
              onPick={(v,id) => setDraft((d) => ({ ...d, player2: v,player2Id:id }))}
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
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> {entryPaymentRelease.available ? "Gestionar pago individual" : "Gestionar pago"}</DialogTitle>
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
