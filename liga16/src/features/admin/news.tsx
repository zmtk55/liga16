import { useSearchParams } from "react-router";

import { AdminLoadFailed } from "@/components/admin/empty-state";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/data";
import type { NewsItem } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Newspaper, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminPageHeader, AdminStat, AdminStatStrip } from "@/components/admin/page-header";
import { AdminEmptyState } from "@/components/admin/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { RowActionsMenu, RowContextMenu, type RowAction } from "@/components/admin/row-actions";
import { FilterBar } from "@/components/ui/filter-bar";
import { AdminFacet, AdminFacets } from "@/components/admin/filter-facets";
import { countActive } from "@/lib/filters";

const TAG_OPTIONS = ["General", "Resultados", "Torneos", "Ligas", "Jugadores", "Clubs"];

export default function AdminNews() {
  const [list, setList] = useState<NewsItem[] | null>(null);
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const setQuery = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set("q", value); else next.delete("q");
    setParams(next, { replace: true });
  };
  const [fTag, setFTag] = useState("all");
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  const load = () =>
    db.listNews()
      .then((l) => { setList(l); setLoadError(null); })
      .catch((e) => setLoadError((e as Error)?.message || "Error al cargar las noticias"));

  useEffect(() => {
    load();
  }, []);

  async function handleSave(form: NewsForm) {
    if (!form.title?.trim()) {
      toast.error("El título es obligatorio");
      return;
    }
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
    const now = new Date();
    const hoy = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    return {
      total: all.length,
      publicadas: all.filter((x) => !!x.published_at && x.published_at.slice(0, 10) <= hoy).length,
      conFoto: all.filter((x) => x.image_url).length,
      esteMes: all.filter((x) => (x.published_at ?? '').slice(0, 7) === hoy.slice(0, 7)).length,
    };
  }, [list]);

  const filtered = (list ?? []).filter((n) => {
    const q = query.trim().toLowerCase();
    if (q && !n.title.toLowerCase().includes(q)) return false;
    if (fTag !== "all" && n.tag !== fTag) return false;
    return true;
  });

  /** Los tags que hay, con su cuenta. Los que no se usan no se ofrecen. */
  const tagOptions = useMemo(() => {
    const all = list ?? [];
    return TAG_OPTIONS
      .map((t) => ({ key: t, label: t, n: all.filter((n) => n.tag === t).length }))
      .filter((o) => o.n > 0)
      .sort((a, b) => b.n - a.n);
  }, [list]);

  if (loadError && list === null) {
    return (
      <AdminLoadFailed
        title="Noticias"
        description="Publica novedades y resultados del circuito."
        what="las noticias"
        message={loadError}
        onRetry={load}
      />
    );
  }

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
        <AdminStatStrip loading={list === null}>
          <AdminStat value={resumen.total} label="Noticias" />
          <AdminStat value={resumen.publicadas} label="Publicadas" tone="text-success" />
          <AdminStat value={resumen.esteMes} label="Este mes" tone="text-primary" />
          <AdminStat
            value={resumen.conFoto}
            label="Con imagen"
            tone={resumen.conFoto > 0 ? "text-success" : "text-warning-strong"}
          />
        </AdminStatStrip>
      </AdminPageHeader>
      <Card className="rounded-3xl border-0 bg-transparent shadow-none">
        <CardHeader className="gap-3 px-0">
          <FilterBar
            search={query}
            onSearch={setQuery}
            searchPlaceholder="Buscar noticia…"
            resultCount={filtered.length}
            resultLabel="noticias"
            activeCount={countActive(fTag)}
            onClear={() => { setQuery(""); setFTag("all"); }}
          >
            <AdminFacets>
              <AdminFacet
                label="Tag"
                value={fTag}
                onChange={setFTag}
                options={tagOptions}
                allLabel="Todos"
              />
            </AdminFacets>
          </FilterBar>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {list === null && <>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-72 rounded-3xl" />)}</>}
              {list !== null && list.length === 0 && (
                <AdminEmptyState className="col-span-full rounded-3xl bg-card"
                  icon={<Newspaper className="h-5 w-5" />}
                  title="No hay noticias todavía"
                  description="Publica la primera novedad del circuito."
                  action={
                    <Button variant="outline" size="sm" onClick={() => { setEditing(null); setOpenCreate(true); }}>
                      Crear noticia
                    </Button>
                  }
                />
              )}
              {list !== null && list.length > 0 && filtered.length === 0 && (
                <AdminEmptyState className="col-span-full rounded-3xl bg-card"
                  icon={<Newspaper className="h-5 w-5" />}
                  title="Sin coincidencias"
                  description="Ninguna noticia coincide con la búsqueda."
                />
              )}
              {filtered.map((n) => {
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
<article className="group h-full overflow-hidden rounded-3xl border bg-card transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
                    <div className="relative flex h-44 items-center justify-center overflow-hidden bg-zinc-950 text-primary">
                      {n.image_url ? <img src={n.image_url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <Newspaper className="h-16 w-16 opacity-60" strokeWidth={1} />}
                      <Badge className="absolute bottom-4 left-4 rounded-full bg-card text-foreground">{n.tag}</Badge>
                      <div className="absolute right-3 top-3 rounded-full bg-card/95 text-foreground"><RowActionsMenu actions={actions} label={`Acciones para ${n.title}`} /></div>
                    </div>
                    <div className="space-y-3 p-5">
                      <p className="text-xs text-muted-foreground">{formatDate(n.published_at)}</p>
                      <h2 className="font-display text-xl font-semibold leading-snug">{n.title}</h2>
                      <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{n.excerpt}</p>
                      <Button variant="ghost" size="sm" className="px-0" onClick={() => { setEditing(n); setOpenCreate(true); }}>Editar noticia <Pencil className="ml-2 h-3 w-3" /></Button>
                    </div>
                  </article>
                </RowContextMenu>
                );
              })}
            </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        onConfirm={() => deleting && handleDelete(deleting)}
        title={`¿Eliminar “${deleting?.title ?? ""}”?`}
        description="La noticia desaparecerá del sitio público. Esta acción no se puede deshacer."
        destructive
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
