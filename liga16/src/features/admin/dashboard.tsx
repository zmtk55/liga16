import { useEffect, useState } from "react";
import { Link } from "react-router";
import { db } from "@/lib/data";
import { Button } from "@/components/ui/button";
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
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4" /> Torneos</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats?.t ?? "—"}</p><Badge variant="secondary" className="mt-1">Gestionar</Badge></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Jugadores</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats?.p ?? "—"}</p><p className="text-xs text-muted-foreground">Directorio completo</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Padel</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats?.c ?? "—"}</p><p className="text-xs text-muted-foreground">Sede activa</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Newspaper className="h-4 w-4" /> Noticias</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats?.n ?? "—"}</p><p className="text-xs text-muted-foreground">Publicadas</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Acciones rápidas</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button asChild><Link to="/admin/torneos">Gestionar torneos</Link></Button>
            <Button asChild variant="outline"><Link to="/admin/padel">Configurar padel</Link></Button>
            <Button asChild variant="outline"><Link to="/admin/jugadores">Jugadores</Link></Button>
            <Button asChild variant="outline"><Link to="/admin/equipos">Equipos</Link></Button>
            <Button asChild variant="outline"><Link to="/admin/ranking">Ranking</Link></Button>
            <Button asChild variant="outline"><Link to="/admin/resultados">Resultados</Link></Button>
            <Button asChild variant="outline"><Link to="/admin/noticias">Noticias</Link></Button>
            <Button asChild variant="outline"><Link to="/admin/onboarding">⚡ Onboarding</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
