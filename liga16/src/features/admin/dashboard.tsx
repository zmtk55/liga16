import { useEffect, useState } from "react";
import { Link } from "react-router";
import { db } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Building2, Newspaper, TrendingUp, TrendingDown, ArrowRight, Zap, BarChart3 } from "lucide-react";

interface StatCard {
  title: string;
  value: number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  trend?: { value: number; positive: boolean };
  action?: { label: string; to: string };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<{ t: number; p: number; c: number; n: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([db.listTournaments(), db.listPlayers(), db.listClubs(), db.listNews()])
      .then(([t, p, c, n]) => {
        setStats({ t: t.length, p: p.length, c: c.length, n: n.length });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const cards: StatCard[] = [
    {
      title: "Torneos",
      value: stats?.t ?? 0,
      icon: <Trophy className="h-5 w-5" />,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      trend: { value: 12, positive: true },
      action: { label: "Gestionar", to: "/admin/torneos" },
    },
    {
      title: "Jugadores",
      value: stats?.p ?? 0,
      icon: <Users className="h-5 w-5" />,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600",
      trend: { value: 8, positive: true },
      action: { label: "Directorio", to: "/admin/jugadores" },
    },
    {
      title: "Sede",
      value: stats?.c ?? 0,
      icon: <Building2 className="h-5 w-5" />,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600",
      action: { label: "Configurar", to: "/admin/padel" },
    },
    {
      title: "Noticias",
      value: stats?.n ?? 0,
      icon: <Newspaper className="h-5 w-5" />,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600",
      trend: { value: 3, positive: true },
      action: { label: "Publicar", to: "/admin/noticias" },
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Panel Operativo</h1>
          <p className="text-sm text-muted-foreground">
            Resumen del padel Reforma — gestión de torneos, jugadores y contenido
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/onboarding" className="gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Onboarding
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/admin/padel">
              <Building2 className="h-3.5 w-3.5" /> Sede
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <Card
            key={card.title}
            className="overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.iconBg} ${card.iconColor}`}>
                {card.icon}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold tracking-tight">
                  {loading ? "—" : card.value.toLocaleString()}
                </p>
                {card.trend && !loading && (
                  <Badge variant={card.trend.positive ? "default" : "destructive"} className="text-xs font-medium">
                    {card.trend.positive ? (
                      <TrendingUp className="mr-1 h-3 w-3" />
                    ) : (
                      <TrendingDown className="mr-1 h-3 w-3" />
                    )}
                    {Math.abs(card.trend.value)}%
                  </Badge>
                )}
              </div>
              {card.action && (
                <Button asChild variant="ghost" size="sm" className="mt-2 p-0 h-7">
                  <Link to={card.action.to}>
                    {card.action.label}
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Acciones rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button asChild variant="default"><Link to="/admin/torneos">Gestionar torneos</Link></Button>
              <Button asChild variant="outline"><Link to="/admin/padel">Configurar padel</Link></Button>
              <Button asChild variant="outline"><Link to="/admin/jugadores">Jugadores</Link></Button>
              <Button asChild variant="outline"><Link to="/admin/equipos">Equipos</Link></Button>
              <Button asChild variant="outline"><Link to="/admin/ranking">Ranking</Link></Button>
              <Button asChild variant="outline"><Link to="/admin/resultados">Resultados</Link></Button>
              <Button asChild variant="outline"><Link to="/admin/noticias">Noticias</Link></Button>
              <Button asChild variant="outline"><Link to="/admin/onboarding">Onboarding</Link></Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado del Sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Modo de datos</span>
                  <Badge variant={isSupabaseConfigured ? "default" : "secondary"}>
                    {isSupabaseConfigured ? "Supabase" : "Demo"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Usuarios activos</span>
                  <span className="font-medium">{stats?.p ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Torneos activos</span>
                  <span className="font-medium">{stats?.t ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Noticias publicadas</span>
                  <span className="font-medium">{stats?.n ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sedes</span>
                  <span className="font-medium">{stats?.c ?? 0}</span>
                </div>
                <div className="border-t pt-4 mt-2">
                  <p className="text-xs text-muted-foreground">
                    El área valida RLS cuando Supabase está configurado; en demo todo es local.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
