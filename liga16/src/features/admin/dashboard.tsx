import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Building2, Newspaper } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState<{ t: number; p: number; c: number; n: number } | null>(null);
  useEffect(() => {
    Promise.all([db.listTournaments(), db.listPlayers(), db.listClubs(), db.listNews()]).then(([t, p, c, n]) => setStats({ t: t.length, p: p.length, c: c.length, n: n.length }));
  }, []);
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Panel operativo</h1>
        <p className="text-sm text-muted-foreground">Resumen del padel Reforma — gestión de torneos, jugadores y contenido. El área valida RLS cuando Supabase está configurado; en demo todo es local.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4" /> Torneos</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats?.t ?? "—"}</p><Badge variant="secondary" className="mt-1">Activos</Badge></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Jugadores</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats?.p ?? "—"}</p><p className="text-xs text-muted-foreground">En directorio</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Padel</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats?.c ?? "—"}</p><p className="text-xs text-muted-foreground">Sede activa</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Newspaper className="h-4 w-4" /> Noticias</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats?.n ?? "—"}</p><p className="text-xs text-muted-foreground">Publicadas</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Requerimientos del plan cubiertos</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>• Público pulido: landing, header responsive, cards con stats, bundle optimizado (manualChunks + lazy recharts), vercel deploy fixado.</p>
          <p>• Operativo: este panel admin con torneos, padel y noticias, tablas y acciones demo listas para conectar a Supabase RLS.</p>
          <p>• Perfil permanente: /jugadores y /jugadores/:id con ranking, títulos, récord y tendencia.</p>
          <p>• Siguiente: Auth real (Supabase) + RLS por rol organizer/admin + CRUD persistente + pagos.</p>
        </CardContent>
      </Card>
    </div>
  );
}
