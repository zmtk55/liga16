"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { Club, Court } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Phone, Edit3, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminClubs() {
  const [club, setClub] = useState<Club | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ClubForm>({ name: "", address: "", phone: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [courts, setCourts] = useState<Court[]>([]);
  const [newCourt, setNewCourt] = useState("");

  const reload = () => {
    db.listClubs().then((list) => {
      const c = list[0] ?? null;
      setClub(c);
      if (c) {
        setForm({ name: c.name, address: c.address ?? "", phone: c.phone ?? "", description: c.description ?? "" });
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
    if (!confirm(`¿Quitar la cancha "${name}"?`)) return;
    try {
      await db.deleteCourt(id);
      setCourts((cs) => cs.filter((c) => c.id !== id));
      toast.success(`Cancha "${name}" eliminada`);
    } catch (e) {
      toast.error((e as Error).message ?? "No se pudo eliminar");
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
      });
      toast.success("Sede actualizada");
      setEditing(false);
      db.listClubs().then((list) => {
        const c = list[0] ?? null;
        setClub(c);
        if (c) {
          setForm({ name: c.name, address: c.address ?? "", phone: c.phone ?? "", description: c.description ?? "" });
        }
      });
    } catch (e) {
      toast.error((e as Error).message ?? "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  }

  if (!club) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Sede</h1>
        {!editing ? (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Edit3 className="h-4 w-4 mr-1" /> Editar
          </Button>
        ) : null}
      </div>

      {editing ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Editar configuración de la sede</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Nombre del club</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Dirección</Label>
              <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Av. Reforma 245, Col. Juárez" />
            </div>
            <div className="grid gap-1.5">
              <Label>Teléfono</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+52 55 1234 0001" />
            </div>
            <div className="grid gap-1.5">
              <Label>Descripción</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Descripción del club" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setEditing(false); if (club) setForm({ name: club.name, address: club.address ?? "", phone: club.phone ?? "", description: club.description ?? "" }); }}>Cancelar</Button>
              <Button onClick={handleSave} disabled={submitting || !form.name.trim()}>
                {submitting ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl">{club.name}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {club.city}, {club.state}</Badge>
              <Badge variant="outline" className="flex items-center gap-1"><Phone className="h-3 w-3" /> {club.phone ?? "Sin teléfono"}</Badge>
              <Badge className="bg-emerald-600 text-white">Activo</Badge>
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
            <p className="text-sm text-muted-foreground">Sin canchas registradas todavía.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {courts.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="font-medium">{c.name}</span>
                  <span className="flex items-center gap-2">
                    {c.surface && <Badge variant="outline">{c.surface}</Badge>}
                    <Button variant="ghost" size="icon" onClick={() => removeCourt(c.id, c.name)} aria-label={`Eliminar ${c.name}`}>
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
}
