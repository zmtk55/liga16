import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { Club } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AdminClubs() {
  const [list, setList] = useState<Club[] | null>(null);
  useEffect(() => { db.listClubs().then(setList); }, []);
  if (!list) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  const club = list[0];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Padel</h2>
        <span className="text-xs text-muted-foreground">Única sede</span>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Configuración del padel</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Nombre</TableHead><TableHead>Ciudad</TableHead><TableHead>Tel</TableHead><TableHead>Estado</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {club ? (
                <TableRow>
                  <TableCell className="font-medium">{club.name}</TableCell>
                  <TableCell>{club.city}</TableCell>
                  <TableCell>{club.phone ?? "—"}</TableCell>
                  <TableCell><span className="text-emerald-600 dark:text-emerald-400">Activo</span></TableCell>
                </TableRow>
              ) : (
                <TableRow><TableCell colSpan={4} className="text-muted-foreground">No hay padel configurado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
