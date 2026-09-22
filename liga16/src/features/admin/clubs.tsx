import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { Club } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export default function AdminClubs() {
  const [list, setList] = useState<Club[] | null>(null);
  useEffect(() => { db.listClubs().then(setList); }, []);
  if (!list) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Clubes</h2><Button size="sm" onClick={() => toast.info("Demo: alta de club + validación dirección")}>Nuevo club</Button></div>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Sedes del circuito</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Ciudad</TableHead><TableHead>Tel</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {list.map((c) => (
                <TableRow key={c.id}><TableCell className="font-medium">{c.name}</TableCell><TableCell>{c.city}</TableCell><TableCell>{c.phone ?? "—"}</TableCell><TableCell><Button variant="ghost" size="sm" onClick={() => toast.success(`Demo editar ${c.slug}`)}>Editar</Button></TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}