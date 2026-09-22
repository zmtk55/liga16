import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { NewsItem } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export default function AdminNews() {
  const [list, setList] = useState<NewsItem[] | null>(null);
  useEffect(() => { db.listNews().then(setList); }, []);
  if (!list) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Noticias</h2><Button size="sm" onClick={() => toast.info("Demo: publicar noticia + tag")}>Nueva noticia</Button></div>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Contenido publicado</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Título</TableHead><TableHead>Tag</TableHead><TableHead>Fecha</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {list.map((n) => (
                <TableRow key={n.id}><TableCell className="font-medium max-w-[320px] truncate">{n.title}</TableCell><TableCell><Badge variant="secondary">{n.tag}</Badge></TableCell><TableCell>{formatDate(n.published_at)}</TableCell><TableCell><Button variant="ghost" size="sm" onClick={() => toast.success(`Demo editar ${n.id}`)}>Editar</Button></TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}