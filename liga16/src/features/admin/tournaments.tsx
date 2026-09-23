import { useEffect, useState } from "react";
import { Link } from "react-router";
import { db } from "@/lib/data";
import type { Tournament } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { tournamentStatusLabel } from "@/lib/format";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminTournaments() {
  const [list, setList] = useState<Tournament[] | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    db.listTournaments().then(setList);
  }, []);

  const filtered = (list ?? []).filter((t) => {
    const q = query.trim().toLowerCase();
    if (q && !t.name.toLowerCase().includes(q) && !(t.club_name ?? t.city ?? "").toLowerCase().includes(q)) return false;
    if (status !== "all" && t.status !== status) return false;
    return true;
  });

  async function handleDelete(t: Tournament) {
    if (!confirm(`¿Eliminar el torneo "${t.name}"? Se borran sus partidos y categorías.`)) return;
    try {
      await db.deleteTournament(t.slug);
      toast.success(`Torneo "${t.name}" eliminado`);
      db.listTournaments().then(setList);
    } catch (e) {
      toast.error((e as Error).message ?? "Error al eliminar");
    }
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Torneos</h1>
        <Button size="sm" asChild>
          <Link to="/admin/torneos/nuevo">
            <Plus className="h-4 w-4 mr-1" /> Nuevo torneo
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm">
              {filtered.length} de {list?.length ?? 0} torneos
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar torneo o sede…"
                  className="h-9 w-52 pl-8"
                  aria-label="Buscar torneos"
                />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 w-44" aria-label="Filtrar por estado">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {Object.entries(tournamentStatusLabel).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Nombre</TableHead>
                <TableHead className="hidden sm:table-cell">Sede</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden md:table-cell">Fechas</TableHead>
                <TableHead className="text-right pr-4">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list === null && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              )}
              {list !== null && list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No hay torneos todavía. Crea el primero con el asistente.
                  </TableCell>
                </TableRow>
              )}
              {list !== null && list.length > 0 && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    Ningún torneo coincide con el filtro.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="pl-4 font-medium">
                    <Link to={`/admin/torneos/${t.slug}`} className="hover:underline">{t.name}</Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{t.club_name ?? t.city}</TableCell>
                  <TableCell><Badge variant="outline">{tournamentStatusLabel[t.status]}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                    {t.start_date} → {t.end_date}
                  </TableCell>
                  <TableCell className="pr-4 text-right space-x-1">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/admin/torneos/${t.slug}`}>Abrir</Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/admin/torneos/${t.slug}/editar`}>Editar</Link>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(t)} aria-label={`Eliminar ${t.name}`}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
