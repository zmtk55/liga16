"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  MailSearch,
  ShieldOff,
  Trophy,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { db } from "@/lib/data";
import type { Tournament } from "@/types";
import {
  findUsersByEmail,
  listOrganizers,
  setOrganizerRole,
  setTournamentOrganizer,
  type AdminUserHit,
  type OrganizerAccount,
} from "@/lib/organizer-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FilterBar } from "@/components/ui/filter-bar";
import {
  AdminPageHeader,
  AdminStat,
  AdminStatStrip,
} from "@/components/admin/page-header";
import { AdminEmptyState, AdminLoadFailed } from "@/components/admin/empty-state";
import {
  RowActionsMenu,
  RowContextMenu,
  type RowAction,
} from "@/components/admin/row-actions";

/** Etiqueta corta del rol para la ficha de cada cuenta. */
function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case "organizer": return "Organizador";
    case "admin": return "Administrador";
    case "captain": return "Capitán";
    case "club": return "Club";
    case "sponsor": return "Patrocinador";
    default: return "Jugador";
  }
}

type AccountRef = { id: string; email: string };

export default function AdminOrganizers() {
  const [organizers, setOrganizers] = useState<OrganizerAccount[] | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Búsqueda de cuentas por correo (RPC admin-only, con debote propio).
  // El buscador vive en ?q= como en el resto de secciones admin.
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const setQuery = (v: string) => {
    const next = new URLSearchParams(params);
    if (!v) next.delete("q");
    else next.set("q", v);
    setParams(next, { replace: true });
  };
  const [results, setResults] = useState<AdminUserHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [assigning, setAssigning] = useState<AccountRef | null>(null);
  const [removing, setRemoving] = useState<AccountRef | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () =>
    Promise.all([listOrganizers(), db.listTournaments()])
      .then(([orgs, ts]) => {
        setOrganizers(orgs);
        setTournaments(ts);
        setLoadError(null);
      })
      .catch((e) =>
        setLoadError((e as Error)?.message || "Error al cargar los organizadores"),
      );

  useEffect(() => {
    load();
  }, []);

  // Búsqueda viva: a partir de 3 caracteres consulta la RPC con un debote
  // corto; por debajo, el panel vuelve al estado inicial sin llamar al server.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults(null);
      setSearching(false);
      setSearchError(null);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      findUsersByEmail(q)
        .then((r) => {
          setResults(r);
          setSearching(false);
          setSearchError(null);
        })
        .catch((e) => {
          setResults([]);
          setSearching(false);
          setSearchError((e as Error)?.message || "No se pudo buscar");
        });
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  /** Torneos agrupados por organizador, con su nombre ya resuelto. */
  const tournamentsByOrganizer = useMemo(() => {
    const map = new Map<string, Tournament[]>();
    for (const t of tournaments) {
      if (!t.organizer_id) continue;
      const list = map.get(t.organizer_id) ?? [];
      list.push(t);
      map.set(t.organizer_id, list);
    }
    return map;
  }, [tournaments]);

  const assignedCount = useMemo(
    () => tournaments.filter((t) => t.organizer_id).length,
    [tournaments],
  );

  async function handleMakeOrganizer(account: AccountRef) {
    setSubmitting(true);
    try {
      await setOrganizerRole(account.id, true);
      toast.success(
        `${account.email} ya es organizador — verá el panel al renovar su sesión`,
      );
      setResults((rs) =>
        rs?.map((r) => (r.id === account.id ? { ...r, role: "organizer" } : r)) ?? rs,
      );
      load();
    } catch (e) {
      toast.error((e as Error).message ?? "No se pudo dar el rol");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveOrganizer(account: AccountRef) {
    setSubmitting(true);
    try {
      await setOrganizerRole(account.id, false);
      toast.success(
        `${account.email} vuelve a ser jugador — el cambio aplica al renovar su sesión`,
      );
      setResults((rs) =>
        rs?.map((r) => (r.id === account.id ? { ...r, role: "player" } : r)) ?? rs,
      );
      setRemoving(null);
      load();
    } catch (e) {
      toast.error((e as Error).message ?? "No se pudo quitar el rol");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssign(tournamentId: string, userId: string | null) {
    if (!assigning) return;
    setSubmitting(true);
    const t = tournaments.find((x) => x.id === tournamentId);
    try {
      await setTournamentOrganizer(tournamentId, userId);
      toast.success(
        userId
          ? `"${t?.name ?? "Torneo"}" asignado a ${assigning.email}`
          : `"${t?.name ?? "Torneo"}" sin organizador asignado`,
      );
      load();
    } catch (e) {
      toast.error((e as Error).message ?? "No se pudo actualizar la asignación");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError && organizers === null) {
    return (
      <AdminLoadFailed
        title="Organizadores"
        description="Acceso de organizador y asignación de torneos."
        what="los organizadores"
        message={loadError}
        onRetry={() => { load(); }}
      />
    );
  }

  const accountCard = (account: AccountRef & { role: string | null }) => {
    const mine = tournamentsByOrganizer.get(account.id) ?? [];
    const isOrganizer = account.role === "organizer";
    const actions: RowAction[] = [
      ...(isOrganizer
        ? [
            {
              label: "Asignar torneo…",
              icon: <Trophy className="h-4 w-4" />,
              onSelect: () => setAssigning({ id: account.id, email: account.email }),
            } as RowAction,
            {
              label: "Quitar rol de organizador",
              icon: <ShieldOff className="h-4 w-4" />,
              onSelect: () => setRemoving({ id: account.id, email: account.email }),
              destructive: true,
              separator: true,
            } as RowAction,
          ]
        : [
            {
              label: "Hacer organizador",
              icon: <UserPlus className="h-4 w-4" />,
              onSelect: () => handleMakeOrganizer(account),
            } as RowAction,
          ]),
    ];
    return (
      <RowContextMenu key={account.id} actions={actions}>
        <article className="group overflow-hidden rounded-3xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-medium">{account.email}</p>
              <Badge variant="outline" className="rounded-full">
                {roleLabel(account.role)}
              </Badge>
            </div>
            <RowActionsMenu actions={actions} label={`Acciones para ${account.email}`} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
            {mine.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin torneos asignados</p>
            ) : (
              mine.map((t) => (
                <Badge key={t.id} variant="secondary" className="rounded-full">
                  {t.name}
                </Badge>
              ))
            )}
          </div>
        </article>
      </RowContextMenu>
    );
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Organizadores"
        description="Da acceso de organizador a una cuenta y asígnale sus torneos."
      >
        <AdminStatStrip loading={organizers === null}>
          <AdminStat value={organizers?.length ?? 0} label="Organizadores" />
          <AdminStat value={assignedCount} label="Torneos asignados" />
          <AdminStat
            value={tournaments.length - assignedCount}
            label="Sin organizador"
            tone={
              tournaments.length - assignedCount > 0
                ? "text-warning-strong"
                : undefined
            }
          />
        </AdminStatStrip>
      </AdminPageHeader>

      <Card className="rounded-3xl border-0 bg-transparent shadow-none">
        <CardHeader className="gap-3 px-0">
          <FilterBar
            search={query}
            onSearch={setQuery}
            searchPlaceholder="Buscar cuenta por correo…"
            resultCount={results?.length}
            resultLabel="cuentas"
            onClear={() => setQuery("")}
          />
        </CardHeader>
        <CardContent className="grid gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {searching &&
            Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-3xl" />
            ))}
          {!searching && searchError && (
            <AdminEmptyState
              className="col-span-full rounded-3xl bg-card"
              icon={<MailSearch className="h-6 w-6" />}
              title="No se pudo buscar"
              description={searchError}
            />
          )}
          {!searching && !searchError && results !== null && results.length === 0 && (
            <AdminEmptyState
              className="col-span-full rounded-3xl bg-card"
              icon={<MailSearch className="h-6 w-6" />}
              title="Sin coincidencias"
              description="Ninguna cuenta empieza con ese correo. Pídele a la persona que se registre primero en la app."
            />
          )}
          {!searching &&
            !searchError &&
            (results ?? []).map((r) => accountCard({ ...r }))}
          {!searching && !searchError && results === null && (
            <AdminEmptyState
              className="col-span-full rounded-3xl bg-card"
              icon={<MailSearch className="h-6 w-6" />}
              title="Busca la cuenta por correo"
              description="Escribe al menos 3 caracteres del correo con el que la persona se registró para darle acceso o asignarle torneos."
            />
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Organizadores activos</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {organizers === null &&
            Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-3xl" />
            ))}
          {organizers !== null && organizers.length === 0 && (
            <AdminEmptyState
              className="col-span-full rounded-3xl bg-card"
              icon={<Users className="h-6 w-6" />}
              title="Todavía no hay organizadores"
              description="Busca una cuenta por correo arriba y dale el rol de organizador."
            />
          )}
          {(organizers ?? []).map((o) => accountCard({ ...o, role: "organizer" }))}
        </div>
      </section>

      <AssignTournamentDialog
        key={assigning?.id ?? "closed"}
        account={assigning}
        tournaments={tournaments}
        assigned={assigning ? tournamentsByOrganizer.get(assigning.id) ?? [] : []}
        ownerEmail={(t) =>
          organizers?.find((o) => o.id === t.organizer_id)?.email ?? null
        }
        submitting={submitting}
        onAssign={handleAssign}
        onClose={() => setAssigning(null)}
      />

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => {
          if (!o) setRemoving(null);
        }}
        onConfirm={() => removing && handleRemoveOrganizer(removing)}
        title={`¿Quitar el rol de organizador a ${removing?.email ?? "esta cuenta"}?`}
        description="La cuenta vuelve a ser jugador y pierde el acceso al panel cuando renueve su sesión. Los torneos que tenga asignados deben desasignarse primero; el servidor lo exige."
        confirmLabel="Quitar rol"
        destructive
      />
    </div>
  );
}

function AssignTournamentDialog({
  account,
  tournaments,
  assigned,
  ownerEmail,
  submitting,
  onAssign,
  onClose,
}: {
  account: AccountRef | null;
  tournaments: Tournament[];
  assigned: Tournament[];
  /** Correo del organizador que hoy tiene el torneo, si no es esta cuenta. */
  ownerEmail: (t: Tournament) => string | null;
  submitting: boolean;
  onAssign: (tournamentId: string, userId: string | null) => void;
  onClose: () => void;
}) {
  const [tid, setTid] = useState("");
  const candidates = useMemo(
    () => [...tournaments].sort((a, b) => a.name.localeCompare(b.name)),
    [tournaments],
  );
  return (
    <Dialog open={!!account} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Torneos de {account?.email}</DialogTitle>
          <DialogDescription>
            Asigna un torneo a este organizador o retíraselo. El organizador solo
            ve y administra los torneos que tiene asignados.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Select value={tid} onValueChange={setTid}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Elige un torneo…" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((t) => {
                  const owner = t.organizer_id && t.organizer_id !== account?.id ? ownerEmail(t) : null;
                  const mine = t.organizer_id === account?.id;
                  return (
                    <SelectItem key={t.id} value={t.id} disabled={mine}>
                      {t.name}
                      {owner ? ` — hoy: ${owner}` : mine ? " — ya asignado" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!tid || submitting}
              onClick={() => {
                onAssign(tid, account?.id ?? null);
                setTid("");
              }}
            >
              <Trophy className="h-4 w-4" /> Asignar
            </Button>
          </div>
          {assigned.length > 0 && (
            <div className="space-y-1.5 border-t pt-3">
              <p className="text-xs text-muted-foreground">Torneos asignados</p>
              {assigned.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2"
                >
                  <span className="truncate text-sm">{t.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={submitting}
                    onClick={() => onAssign(t.id, null)}
                    aria-label={`Quitar ${t.name}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
        }
