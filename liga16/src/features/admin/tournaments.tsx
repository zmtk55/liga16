import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { Tournament } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tournamentStatusLabel } from "@/lib/format";
import { toast } from "sonner";

export default function AdminTournaments() {
  const [list, setList] = useState<Tournament[] | null>(null);
  useEffect(() => { db.listTournaments().then(setList); }, []);
  if (!list) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Torneos</h2>
        <Button size="sm" onClick={() => toast.info("Demo: crear torneo conecta a Supabase + RLS organizer")}>Nuevo torneo</Button>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Todos los torneos — demo CRUD</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Nombre</TableHead><TableHead>Sede</TableHead><TableHead>Estado</TableHead><TableHead>Acciones</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {list.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.club_name ?? t.city}</TableCell>
                  <TableCell><Badge variant="outline">{tournamentStatusLabel[t.status]}</Badge></TableCell>
                  <TableCell className="space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => toast.success(`Demo editar ${t.slug}`)}>Editar</Button>
                    <Button variant="ghost" size="sm" onClick={() => toast.error("Demo: borrar requiere confirm + RLS")}>Borrar</Button>
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