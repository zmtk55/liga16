"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { NewsItem } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Noticias</h1>
        <Button size="sm" onClick={() => { setEditing(null); setOpenCreate(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nueva noticia
        </Button>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Contenido publicado</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
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
              {list?.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-medium max-w-[200px] truncate sm:max-w-[320px]">{n.title}</TableCell>
                  <TableCell><Badge variant="secondary">{n.tag}</Badge></TableCell>
                  <TableCell className="hidden sm:table-cell">{formatDate(n.published_at)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(n); setOpenCreate(true); }}>Editar</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(n)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
            <Label>Título</Label>
            <Input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Título de la noticia" />
          </div>
          <div className="grid gap-1.5">
            <Label>Extracto</Label>
            <Input value={form.excerpt} onChange={(e) => update("excerpt", e.target.value)} placeholder="1-2 líneas que resuman la noticia" />
            <p className="text-xs text-muted-foreground">Máx ~140 caracteres para tarjetas</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Tag</Label>
              <Select value={form.tag} onValueChange={(v) => update("tag", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TAG_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Imagen (URL)</Label>
              <Input value={form.image_url} onChange={(e) => update("image_url", e.target.value)} placeholder="https://..." />
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
