"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/data";
import type { Sponsor } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MoreHorizontal, Pencil, Plus, Trash2, ImagePlus, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminPageHeader, AdminStat, AdminStatStrip } from "@/components/admin/page-header";
import { AdminTableEmpty, AdminTableSkeleton } from "@/components/admin/table-state";

const TIER_OPTIONS = [
  { value: "principal", label: "Principal" },
  { value: "oro", label: "Oro" },
  { value: "plata", label: "Plata" },
  { value: "bronce", label: "Bronce" },
] as const;

export default function AdminSponsors() {
  const [list, setList] = useState<Sponsor[] | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Sponsor | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<Sponsor | null>(null);

  useEffect(() => {
    db.listSponsors().then(setList);
  }, []);

  const load = () => db.listSponsors().then(setList);

  /** Cifras de cabecera: el patrocinio que se publica y el que todavia no. */
  const resumen = useMemo(() => {
    const all = list ?? [];
    return {
      total: all.length,
      conLogo: all.filter((p) => p.logo_url).length,
      principales: all.filter((p) => p.tier === 'principal').length,
      conSitio: all.filter((p) => p.website).length,
    };
  }, [list]);

  async function handleSave(form: SponsorForm) {
    setSubmitting(true);
    try {
      if (editing) {
        await db.updateSponsor(editing.id, form);
        toast.success(`Patrocinador "${form.name}" actualizado`);
      } else {
        await db.createSponsor(form as Omit<Sponsor, "id">);
        toast.success(`Patrocinador "${form.name}" agregado`);
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

  async function handleDelete(s: Sponsor) {
    try {
      await db.deleteSponsor(s.id);
      toast.success(`Patrocinador "${s.name}" eliminado`);
      load();
    } catch (e) {
      toast.error((e as Error).message ?? "Error al eliminar");
    }
  }

  const dialogKey = editing?.id ?? "new";

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Patrocinadores"
        description="Gestiona los logos y tiers de los patrocinadores que aparecen en la landing page."
        action={
          <Button size="sm" onClick={() => { setEditing(null); setOpenCreate(true); }}>
            <Plus className="h-4 w-4" /> Nuevo patrocinador
          </Button>
        }
      >
        <AdminStatStrip>
          <AdminStat value={resumen.total} label="Patrocinadores" />
          <AdminStat
            value={resumen.conLogo}
            label="Con logo"
            tone={resumen.conLogo > 0 ? "text-success" : "text-amber-600 dark:text-amber-400"}
          />
          <AdminStat value={resumen.principales} label="Principales" tone="text-primary" />
          <AdminStat value={resumen.conSitio} label="Con sitio web" />
        </AdminStatStrip>
      </AdminPageHeader>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Logo</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Website</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list === null && <AdminTableSkeleton columns={5} />}
              {list !== null && list.length === 0 && (
                <AdminTableEmpty
                  colSpan={5}
                  icon={<ImagePlus className="h-5 w-5" />}
                  title="No hay patrocinadores todavía"
                  description="Agrega el primero para que aparezca en la landing page."
                  action={
                    <Button size="sm" className="mt-4" onClick={() => { setEditing(null); setOpenCreate(true); }}>
                      Agregar patrocinador
                    </Button>
                  }
                />
              )}
              {list?.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    {s.logo_url ? (
                      <img src={s.logo_url} alt={s.name} className="h-10 w-auto max-w-[120px] shrink-0 rounded object-contain" />
                    ) : (
                      <span className="flex h-10 w-16 shrink-0 items-center justify-center rounded bg-muted text-xs font-bold text-muted-foreground">
                        SIN
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                    <Badge variant={s.tier === "principal" ? "default" : s.tier === "oro" ? "secondary" : s.tier === "plata" ? "outline" : "destructive"}>
                      {s.tier}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {s.website ? (
                      <a href={s.website} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                        {s.website.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      <span>—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-2 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Acciones para ${s.name}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditing(s); setOpenCreate(true); }}>
                          <Pencil className="h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleting(s)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        onConfirm={() => deleting && handleDelete(deleting)}
        title={`¿Eliminar el patrocinador "${deleting?.name ?? ""}"?`}
        description="Desaparecerá de la landing page y no se puede deshacer."
        destructive
      />

      <SponsorFormDialog
        key={dialogKey}
        open={openCreate}
        onOpenChange={(o) => { if (!o) { setOpenCreate(false); setEditing(null); } }}
        onSave={handleSave}
        onCancel={() => setEditing(null)}
        editing={editing}
        submitting={submitting}
      />
    </div>
  );
}

interface SponsorForm {
  name: string;
  logo_url: string | null;
  tier: Sponsor["tier"];
  website: string;
}

function SponsorFormDialog({
  open,
  onOpenChange,
  onSave,
  onCancel,
  editing,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: SponsorForm) => void;
  onCancel: () => void;
  editing: Sponsor | null;
  submitting: boolean;
}) {
  const [form, setForm] = useState<SponsorForm>(() => ({
    name: editing?.name ?? "",
    logo_url: editing?.logo_url ?? null,
    tier: editing?.tier ?? "principal",
    website: editing?.website ?? "",
  }));
  const [, setLogoFile] = useState<File | null>(null);

  const update = (field: keyof SponsorForm, value: SponsorForm[keyof SponsorForm]) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  function handleLogoChange(file: File | null) {
    if (!file) {
      setForm((f) => ({ ...f, logo_url: null }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, logo_url: String(reader.result) }));
    };
    reader.readAsDataURL(file);
    setLogoFile(file);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar patrocinador" : "Nuevo patrocinador"}</DialogTitle>
          <DialogDescription>
            {editing ? `Edita "${editing.name}"` : "Agrega un patrocinador para la landing page."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Nombre</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Nombre del patrocinador" />
          </div>

          <div className="grid gap-2">
            <Label>Logo</Label>
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                id="sponsor-logo"
                onChange={(e) => handleLogoChange(e.target.files?.[0] ?? null)}
              />
              {form.logo_url ? (
                <div className="group relative overflow-hidden rounded-xl border">
                  <img src={form.logo_url} alt={form.name} className="aspect-square w-full max-w-xs object-contain" />
                  <div className="absolute right-2 top-2 flex gap-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => document.getElementById("sponsor-logo")?.click()}
                    >
                      Cambiar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => update("logo_url", "")}
                      aria-label="Quitar logo"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <label
                  htmlFor="sponsor-logo"
                  className="flex aspect-square w-full max-w-xs flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-muted/30 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground cursor-pointer"
                >
                  <ImagePlus className="h-8 w-8" />
                  <span className="text-sm font-medium">Subir logo</span>
                  <span className="text-xs">PNG/JPG · Cuadrado se ve mejor</span>
                </label>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Tier</Label>
              <Select value={form.tier} onValueChange={(v) => update("tier", v as Sponsor["tier"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIER_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Website</Label>
              <Input value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="https://..." />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); onCancel(); }}>Cancelar</Button>
          <Button onClick={() => onSave(form)} disabled={submitting || !form.name.trim()}>
            {submitting ? "Guardando…" : editing ? "Actualizar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}