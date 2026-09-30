"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/data";
import type { NewsItem } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Newspaper, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminPageHeader, AdminStat, AdminStatStrip } from "@/components/admin/page-header";
import { AdminTableEmpty, AdminTableSkeleton } from "@/components/admin/table-state";
import { RowActionsMenu, RowContextMenu, type RowAction } from "@/components/admin/row-actions";

const TAG_OPTIONS = ["General", "Resultados", "Torneos", "Ligas", "Jugadores", "Clubs"];

export default function AdminNews() {
  const [list, setList] = useState<NewsItem[] | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    db.listNews().then(setList);
  }, []);

  const load = () => db.listNews().then(setList);

  async function handleSave(form: NewsForm) {
    setSubmitting(true);
    try {
      const payload = {
        title: form.title,
        excerpt: form.excerpt,
        tag: form.tag,
        image_url: form.image_url || null,
        published_at: editing?.published_at ?? new Date().toISOString(),
      };
      if (editing) {
        await db.updateNews(editing.id, payload);
        toast.success(`"${form.title}" actualizado`);
      } else {
        await db.createNews(payload as Omit<NewsItem, "id">);
        toast.success(`"${form.title}" publicado`);
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

  async function handleDelete(n: NewsItem) {
    try {
      await db.deleteNews(n.id);
      toast.success(`Noticia "${n.title}" eliminada`);
      load();
    } catch (e) {
      toast.error((e as Error).message ?? "Error al eliminar");
    }
  }

  const dialogKey = editing?.id ?? "new";
  const [deleting, setDeleting] = useState<NewsItem | null>(null);
  /** Cifras de cabecera: lo publicado y lo que aun no tiene foto ni fecha. */
  const resumen = useMemo(() => {
    const all = list ?? [];
    const hoy = new Date().toISOString().slice(0, 10);
    return {
      total: all.length,
      publicadas: all.filter((x) => (x.published_at ?? '') <= hoy).length,
      conFoto: all.filter((x) => x.image_url).length,
      esteMes: all.filter((x) => (x.published_at ?? '').slice(0, 7) === hoy.slice(0, 7)).length,
    };
  }, [list]);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Noticias"
        description="Publica novedades y resultados del circuito."
        action={
          <Button size="sm" onClick={() => { setEditing(null); setOpenCreate(true); }}>
            <Plus className="h-4 w-4" /> Nueva noticia
          </Button>
        }
      >
        <AdminStatStrip>
          <AdminStat value={resumen.total} label="Noticias" />
          <AdminStat value={resumen.publicadas} label="Publicadas" tone="text-success" />
          <AdminStat value={resumen.esteMes} label="Este mes" tone="text-primary" />
          <AdminStat
            value={resumen.conFoto}
            label="Con imagen"
            tone={resumen.conFoto > 0 ? "text-success" : "text-amber-600 dark:text-amber-400"}
          />
        </AdminStatStrip>
      </AdminPageHeader>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list === null && <AdminTableSkeleton columns={4} />}
              {list !== null && list.length === 0 && (
                <AdminTableEmpty
                  colSpan={4}
                  icon={<Newspaper className="h-5 w-5" />}
                  title="No hay noticias todavía"
                  description="Publica la primera novedad del circuito."
                  action={
                    <Button size="sm" className="mt-4" onClick={() => { setEditing(null); setOpenCreate(true); }}>
                      Crear noticia
                    </Button>
                  }
                />
              )}
              {list?.map((n) => {
                const actions: RowAction[] = [
                  {
                    label: "Editar",
                    icon: <Pencil className="h-4 w-4" />,
                    onSelect: () => { setEditing(n); setOpenCreate(true); },
                  },
                  {
                    label: "Eliminar",
                    icon: <Trash2 className="h-4 w-4" />,
                    onSelect: () => setDeleting(n),
                    destructive: true,
                    separator: true,
                  },
                ];
                return (
                <RowContextMenu key={n.id} actions={actions}>
                  <TableRow>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-3">
                      {n.image_url ? (
                        <img src={n.image_url} alt="" className="h-10 w-16 shrink-0 rounded object-cover" />
                      ) : (
                        <span className="flex h-10 w-16 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground">
                          SIN
                        </span>
                      )}
                      <span className="truncate font-medium">{n.title}</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{n.tag}</Badge></TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDate(n.published_at)}</TableCell>
                  <TableCell className="pr-2 text-right">
                    <RowActionsMenu actions={actions} label={`Acciones para ${n.title}`} />
                  </TableCell>
                  </TableRow>
                </RowContextMenu>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        onConfirm={() => deleting && handleDelete(deleting)}
        title={`¿Eliminar “${deleting?.title ?? ""}”?`}
        description="La noticia desaparecerá del sitio público. Esta acción no se puede deshacer."
      />

      <NewsFormDialog
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

interface NewsForm {
  title: string;
  excerpt: string;
  tag: string;
  image_url: string;
}

function NewsFormDialog({
  open,
  onOpenChange,
  onSave,
  onCancel,
  editing,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: NewsForm) => void;
  onCancel: () => void;
  editing: NewsItem | null;
  submitting: boolean;
}) {
  const [form, setForm] = useState<NewsForm>(() => {
    if (editing) {
      return {
        title: editing.title,
        excerpt: editing.excerpt,
        tag: editing.tag,
        image_url: editing.image_url ?? "",
      };
    }
    return {
      title: "",
      excerpt: "",
      tag: "General",
      image_url: "",
    };
  });

  const update = (field: keyof NewsForm, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar noticia" : "Nueva noticia"}</DialogTitle>
          <DialogDescription>
            {editing ? `Edita "${editing.title}"` : "Publica una nueva noticia en Liga16."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="titulo">Título</Label>
            <Input id="titulo" value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Título de la noticia" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="extracto">Extracto</Label>
            <Input id="extracto" value={form.excerpt} onChange={(e) => update("excerpt", e.target.value)} placeholder="1-2 líneas que resuman la noticia" />
            <p className="text-xs text-muted-foreground">Máx ~140 caracteres para tarjetas</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="tag">Tag</Label>
              <Select value={form.tag} onValueChange={(v) => update("tag", v)}>
                <SelectTrigger id="tag"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TAG_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="imagen-url">Imagen (URL)</Label>
              <Input id="imagen-url" value={form.image_url} onChange={(e) => update("image_url", e.target.value)} placeholder="https://..." />
              <p className="text-xs text-muted-foreground">Opcional. Recomendado 1200×630px</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); onCancel(); }}>Cancelar</Button>
          <Button onClick={() => onSave(form)} disabled={submitting || !form.title.trim()}>
            {submitting ? "Guardando…" : editing ? "Actualizar" : "Publicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
