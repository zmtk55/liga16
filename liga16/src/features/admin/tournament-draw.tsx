import { useMemo, useState } from "react";
import type { Pair, TournamentCategory } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DndContext, closestCenter, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, Check, Dice5, GripVertical, Plus, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminEmptyState } from "@/components/admin/empty-state";
import { BENTO_CARD, BENTO_DARK, BENTO_LIGHT, BENTO_METRIC_MD } from "@/components/admin/bento";
import type { Group } from "@/lib/groups";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SIN_CATEGORIA } from "@/lib/format";

function SortablePair({ id, name, onRemove }: { id: string; name: string; onRemove?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-1.5 rounded-full border bg-background/70 py-1 pe-2 ps-1 text-sm",
        isDragging && "opacity-60 shadow-lg",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 cursor-grab touch-none rounded-full text-muted-foreground hover:text-foreground"
        aria-label="Arrastrar para mover"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </Button>
      <span className="flex-1 truncate font-medium">{name}</span>
      {onRemove && (
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onRemove} aria-label="Quitar equipo">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function DropZone({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={cn("min-h-20 rounded-lg", isOver && "ring-2 ring-primary")}>{children}</div>;
}
function GroupName({ name, onSave }: { name: string; onSave: (name: string) => void }) {
  const [value, setValue] = useState(name);
  return <Input key={name} value={value} onChange={(e) => setValue(e.target.value)} onBlur={() => { if (value !== name) onSave(value); }}
    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} aria-label={`Nombre de ${name}`} className="h-9 font-semibold" />;
}

/**
 * Grupos y sorteo en orden de uso: primero se define cuántos grupos, luego se
 * sortea, luego se ajusta arrastrando y al final se reparte el calendario.
 * Los grupos se muestran por categoría porque las categorías nunca se mezclan.
 */
export function DrawPanel({
  pairs,
  categories,
  groups,
  unassigned,
  nameById,
  groupsPerCat,
  setGroupsPerCat,
  saving,
  onDraw,
  onAddGroup,
  onClear,
  onSchedule,
  onRename,
  onRemovePair,
  onDragEnd,
}: {
  pairs: Pair[] | null;
  categories: TournamentCategory[];
  groups: Group[];
  unassigned: Pair[];
  nameById: Record<string, string>;
  groupsPerCat: number;
  setGroupsPerCat: (n: number) => void;
  saving: boolean;
  onDraw: () => void;
  onAddGroup: () => void;
  onClear: () => void;
  onSchedule: () => void;
  onRename: (index: number, name: string) => void;
  onRemovePair: (id: string) => void;
  onDragEnd: (e: DragEndEvent) => void;
}) {
  const [confirm, setConfirm] = useState<"draw" | "clear" | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const total = pairs?.length ?? 0;
  const canDraw = total >= 2;

  const catNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const catOfPair = useMemo(() => new Map((pairs ?? []).map((p) => [p.id, p.category_id ?? ""])), [pairs]);

  // Los grupos agrupados por la categoría de sus parejas, en el orden del torneo.
  const sections = useMemo(() => {
    const order = new Map(categories.map((c, i) => [c.id, i]));
    const buckets = new Map<string, { gi: number; g: Group }[]>();
    groups.forEach((g, gi) => {
      const key = g.categoryId ?? g.pairIds.map((id) => catOfPair.get(id)).find((c) => c !== undefined) ?? "";
      buckets.set(key, [...(buckets.get(key) ?? []), { gi, g }]);
    });
    return [...buckets.entries()]
      .sort(([a], [b]) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
      .map(([key, items]) => ({ key, label: key ? (catNameById.get(key) ?? "") : SIN_CATEGORIA, items }));
  }, [groups, catOfPair, catNameById, categories]);

  const steps = [
    { n: 1, label: "Elige cuántos grupos", done: groupsPerCat >= 0 && groups.length > 0 },
    { n: 2, label: "Sortea al azar", done: groups.length > 0 },
    { n: 3, label: "Ajusta arrastrando", done: groups.length > 0 && unassigned.length === 0 },
    { n: 4, label: "Reparte el calendario", done: false },
  ];
  const activo = steps.find((s) => !s.done)?.n ?? 4;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-12">
        <section className={cn(BENTO_CARD, BENTO_DARK, "flex flex-col justify-between gap-6 lg:col-span-7")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-2xl font-bold leading-none">Sorteo</h3>
              <p className="mt-2 max-w-md text-sm opacity-75">
                Las categorías no se mezclan: 4tas y 5tas nunca caen en el mismo grupo.
              </p>
            </div>
            <div className="flex gap-6">
              <div>
                <p className={BENTO_METRIC_MD}>{total}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-widest opacity-70">Parejas</p>
              </div>
              <div>
                <p className={BENTO_METRIC_MD}>{groups.length}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-widest opacity-70">Grupos</p>
              </div>
              <div>
                <p className={BENTO_METRIC_MD}>
                  <span className={cn(unassigned.length > 0 && groups.length > 0 && "text-primary")}>
                    {groups.length > 0 ? unassigned.length : total}
                  </span>
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-widest opacity-70">Sin grupo</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button className="rounded-full" onClick={() => groups.length ? setConfirm("draw") : onDraw()} disabled={!canDraw || saving}>
              <Dice5 className="h-4 w-4" /> {groups.length > 0 ? "Volver a sortear" : "Sortear grupos"}
            </Button>
            <Button variant="outline" className="rounded-full bg-transparent" onClick={onAddGroup} disabled={saving || groups.length >= 10}>
              <Plus className="h-4 w-4" /> Añadir grupo
            </Button>
            {groups.length > 0 && (
              <Button variant="outline" className="rounded-full bg-transparent" onClick={() => setConfirm("clear")}>
                <RotateCcw className="h-4 w-4" /> Vaciar
              </Button>
            )}
            {groups.length > 0 && (
              <Button variant="secondary" className="rounded-full" onClick={onSchedule} disabled={saving}>
                <CalendarClock className="h-4 w-4" /> Repartir calendario
              </Button>
            )}
          </div>
        </section>

        <section className={cn(BENTO_CARD, BENTO_LIGHT, "space-y-4 lg:col-span-5")}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Grupos por categoría</p>
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Grupos por categoría">
              {[0, 1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setGroupsPerCat(n)}
                  aria-pressed={groupsPerCat === n}
                  title={n === 0 ? "Auto (1 grupo por cada 4 parejas)" : `${n} grupo${n === 1 ? "" : "s"}`}
                  className={cn(
                    "h-9 min-w-9 rounded-full border px-3.5 text-sm font-semibold tabular-nums transition-colors",
                    groupsPerCat === n ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  {n === 0 ? "Auto" : n}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Auto: 1 grupo por cada 4 parejas (16 parejas = 4 grupos de 4).</p>
          </div>
          <ol className="space-y-1.5">
            {steps.map((s) => (
              <li key={s.n} className={cn("flex items-center gap-3 text-sm", s.n === activo ? "font-semibold" : "text-muted-foreground")}>
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    s.done ? "bg-success text-white" : s.n === activo ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {s.done ? <Check className="h-3.5 w-3.5" /> : s.n}
                </span>
                {s.label}
              </li>
            ))}
          </ol>
        </section>
      </div>

      {pairs && total < 2 && (
        <p className="rounded-full border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-warning-strong">
          Tienes {total} equipo{total === 1 ? "" : "s"} inscrito{total === 1 ? "" : "s"}: se necesitan al menos 2 para sortear o generar partidos.
        </p>
      )}

      {groups.length === 0 ? (
        <div className={cn(BENTO_CARD, BENTO_LIGHT, "p-0")}>
          <AdminEmptyState
            icon={<Dice5 className="h-5 w-5" />}
            title="Aún no hay grupos"
            description="Pulsa «Sortear grupos» para crearlos o añádelos a mano."
            action={
              <Button className="rounded-full" onClick={() => groups.length ? setConfirm("draw") : onDraw()} disabled={!canDraw || saving}>
                <Dice5 className="h-4 w-4" /> Sortear grupos
              </Button>
            }
          />
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={[...unassigned.map((p) => p.id), ...groups.flatMap((g) => g.pairIds)]}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
              <DropZone id="__pool__">
                {unassigned.length > 0 ? (
                  <section className={cn(BENTO_CARD, BENTO_LIGHT, "space-y-3 border-primary/50 p-5")}>
                    <h4 className="flex items-center justify-between font-display text-base font-bold">
                      Sin grupo
                      <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs text-primary-foreground">{unassigned.length}</span>
                    </h4>
                    <p className="text-xs text-muted-foreground">Arrástralas a un grupo.</p>
                    <div className="space-y-2">
                      {unassigned.map((p) => (
                        <SortablePair key={p.id} id={p.id} name={p.name} />
                      ))}
                    </div>
                  </section>
                ) : (
                  <section className={cn(BENTO_CARD, BENTO_LIGHT, "p-5 text-center text-sm text-success")}>
                    <Check className="me-1 inline h-4 w-4 align-[-2px]" />
                    Todas las parejas tienen grupo.
                  </section>
                )}
              </DropZone>
              <div className="space-y-5">
                {sections.map((sec) => (
                  <div key={sec.key || "__sin__"} className="space-y-3">
                    {sections.length > 1 && (
                      <h4 className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-foreground px-4 py-1.5 font-display text-sm font-bold text-background">{sec.label}</span>
                        <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
                          {sec.items.length} {sec.items.length === 1 ? "grupo" : "grupos"} ·{" "}
                          {sec.items.reduce((n, { g }) => n + g.pairIds.length, 0)} parejas
                        </span>
                      </h4>
                    )}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {sec.items.map(({ g, gi }) => (
                        <DropZone key={gi} id={`group:${gi}`}><section className={cn(BENTO_CARD, BENTO_LIGHT, "space-y-3 p-4")}>
                          <div className="flex items-center justify-between gap-2">
                            <GroupName key={g.name} name={g.name} onSave={(name) => onRename(gi, name)} />
                            <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground">
                              {g.pairIds.length}
                            </span>
                          </div>
                          <div className="min-h-16 space-y-2">
                            {g.pairIds.length === 0 && (
                              <p className="rounded-2xl border border-dashed py-4 text-center text-xs text-muted-foreground">
                                Arrastra parejas aquí
                              </p>
                            )}
                            {g.pairIds.map((id) => (
                              <SortablePair key={id} id={id} name={nameById[id] ?? id} onRemove={() => onRemovePair(id)} />
                            ))}
                          </div>
                        </section></DropZone>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SortableContext>
        </DndContext>
      )}
      <ConfirmDialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}
        title={confirm === "draw" ? "¿Volver a sortear?" : "¿Vaciar los grupos?"}
        description="Se cambiarán las asignaciones de grupo. Los equipos siguen inscritos. Si ya hay resultados, la acción se bloqueará."
        confirmLabel="Continuar" onConfirm={() => confirm === "draw" ? onDraw() : onClear()} />
    </div>
  );
                }
