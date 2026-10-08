"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { Club, Court } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MapPin, Phone, Pencil, Plus, Trash2, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminPageHeader, AdminStat, AdminStatStrip } from "@/components/admin/page-header";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export default function AdminClubs() {
  const [club, setClub] = useState<Club | null>(null);
  const [deletingCourt, setDeletingCourt] = useState<{ id: string; name: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ClubForm>({ name: "", address: "", phone: "", description: "", photo_url: "" });
  const [submitting, setSubmitting] = useState(false);
  const [courts, setCourts] = useState<Court[]>([]);
  const [newCourt, setNewCourt] = useState("");

  const reload = () => {
    db.listClubs().then((list) => {
      const c = list[0] ?? null;
      setClub(c);
      if (c) {
        setForm({ name: c.name, address: c.address ?? "", phone: c.phone ?? "", description: c.description ?? "", photo_url: c.photo_url ?? "" });
      }
    });
    db.listCourts().then(setCourts).catch(() => undefined);
  };

  useEffect(() => {
    reload();
  }, []);

  async function addCourt() {
    const name = newCourt.trim();
    if (!name || !club) return;
    try {
      await db.createCourt({ club_id: club.id, name, surface: "Sintética" } as never);
      setNewCourt("");
      toast.success(`Cancha "${name}" registrada`);
      db.listCourts().then(setCourts).catch(() => undefined);
    } catch (e) {
      toast.error((e as Error).message ?? "No se pudo crear la cancha");
    }
  }

  async function removeCourt(id: string, name: string) {
    try {
      await db.deleteCourt(id);
      setCourts((cs) => cs.filter((c) => c.id !== id));
      toast.success(`Cancha "${name}" eliminada`);
    } catch (e) {
      toast.error((e as Error).message ?? "No se pudo eliminar");
    } finally {
      setDeletingCourt(null);
    }
  }

  async function handleSave() {
    if (!club) return;
    setSubmitting(true);
    try {
      await db.updateClub(club.slug, {
        name: form.name,
        address: form.address,
        phone: form.phone,
        description: form.description,
        photo_url: form.photo_url || null,
      });
      toast.success("Sede actualizada");
      setEditing(false);
      db.listClubs().then((list) => {
        const c = list[0] ?? null;
        setClub(c);
        if (c) {
          setForm({ name: c.name, address: c.address ?? "", phone: c.phone ?? "", description: c.description ?? "", photo_url: c.photo_url ?? "" });
        }
      });
    } catch (e) {
      toast.error((e as Error).message ?? "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  }

  if (!club) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Sede"
        description="Datos del club y canchas disponibles."
        action={
          !editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Editar sede
            </Button>
          ) : undefined
        }
      >
        <AdminStatStrip>
          <AdminStat value={courts.length} label="Canchas" />
          <AdminStat
            value={club ? (club.phone ? "Sí" : "No") : "—"}
            label="Teléfono"
            tone={club && !club.phone ? "text-amber-600 dark:text-amber-400" : undefined}
          />
          <AdminStat
            value={club ? (club.city || club.address ? "Sí" : "No") : "—"}
            label="Ubicación"
            tone={club && !(club.city || club.address) ? "text-amber-600 dark:text-amber-400" : undefined}
          />
          <AdminStat value={club ? (club.photo_url ? "Sí" : "No") : "—"} label="Foto" />
        </AdminStatStrip>
      </AdminPageHeader>

      {editing ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Editar configuración de la sede</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-2">
              <Label>Logo del club</Label>
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  id="club-logo"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setForm((f) => ({ ...f, photo_url: String(reader.result) }));
                    reader.readAsDataURL(file);
                  }}
                />
                {form.photo_url ? (
                  <div className="group relative overflow-hidden rounded-xl border">
                    <img src={form.photo_url} alt={form.name} className="aspect-square w-full max-w-xs object-contain" />
                    <div className="absolute right-2 top-2 flex gap-1.5">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => document.getElementById("club-logo")?.click()}
                      >
                        Cambiar
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setForm((f) => ({ ...f, photo_url: "" }))}
                        aria-label="Quitar logo"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor="club-logo"
                    className="flex aspect-square w-full max-w-xs flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-muted/30 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground cursor-pointer"
                  >
                    <ImagePlus className="h-8 w-8" />
                    <span className="text-sm font-medium">Subir logo</span>
                    <span className="text-xs">PNG/JPG · Cuadrado se ve mejor</span>
                  </label>
                )}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="nombre-del-club">Nombre del club</Label>
              <Input id="nombre-del-club" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="direccion">Dirección</Label>
              <Input id="direccion" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Av. Reforma 245, Col. Juárez" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input id="telefono" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+52 55 1234 0001" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="club-description">Descripción</Label>
              <Textarea
                id="club-description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descripción del club"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  if (club) {
                    setForm({
                      name: club.name,
                      address: club.address ?? "",
                      phone: club.phone ?? "",
                      description: club.description ?? "",
                      photo_url: club.photo_url ?? "",
                    });
                  }
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={submitting || !form.name.trim()}>
                {submitting ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-4">
              {club.photo_url ? (
                <img src={club.photo_url} alt={club.name} className="h-16 w-16 rounded-xl object-contain" />
              ) : (
                <div className="h-16 w-16 rounded-xl border-2 border-dashed bg-muted/30 flex items-center justify-center">
                  <ImagePlus className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div>
                <CardTitle className="text-2xl">{club.name}</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {club.city}, {club.state}</Badge>
                  <Badge variant="outline" className="flex items-center gap-1"><Phone className="h-3 w-3" /> {club.phone ?? "Sin teléfono"}</Badge>
                  <Badge variant="default">Activo</Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{club.description}</p>
            {club.address && (
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {club.address}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Canchas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Canchas disponibles ({courts.length})</CardTitle>
        </CardHeader>
        <ConfirmDialog
          open={!!deletingCourt}
          onOpenChange={(o) => { if (!o) setDeletingCourt(null); }}
          onConfirm={() => deletingCourt && removeCourt(deletingCourt.id, deletingCourt.name)}
          title={`¿Quitar la cancha "${deletingCourt?.name ?? ""}"?`}
          description="Los partidos agendados en ella conservan el nombre, pero ya no aparece como disponible."
          destructive
        />
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newCourt}
              onChange={(e) => setNewCourt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCourt()}
              placeholder="Nombre de la cancha, p. ej. Cancha 3"
            />
            <Button onClick={addCourt} disabled={!newCourt.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          </div>
          {courts.length === 0 ? (
            <Empty className="border-0 py-8">
              <EmptyHeader>
                <EmptyTitle>Sin canchas registradas</EmptyTitle>
                <EmptyDescription>Agrega la primera cancha con el campo de arriba.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y rounded-lg border">
              {courts.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="font-medium">{c.name}</span>
                  <span className="flex items-center gap-2">
                    {c.surface && <Badge variant="outline">{c.surface}</Badge>}
                    <Button variant="ghost" size="icon" onClick={() => setDeletingCourt({ id: c.id, name: c.name })} aria-label={`Eliminar ${c.name}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface ClubForm {
  name: string;
  address: string;
  phone: string;
  description: string;
  photo_url: string;
}
