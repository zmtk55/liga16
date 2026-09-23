import { useEffect, useState } from "react";
import { Link } from "react-router";
import { db } from "@/lib/data";
import type { Tournament } from "@/types";
import { tournamentStatusLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Building2, Newspaper, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";

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
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([db.listTournaments(), db.listPlayers(), db.listClubs(), db.listNews()])
      .then(([t, p, c, n]) => {
        setStats({ t: t.length, p: p.length, c: c.length, n: n.length });
        setTournaments(t as Tournament[]);
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
          <Button asChild size="sm">
            <Link to="/admin/torneos/nuevo">
              <Trophy className="h-3.5 w-3.5" /> Nuevo torneo
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
              <Trophy className="h-4 w-4" /> Últimos torneos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : tournaments.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground mb-3">Aún no hay torneos.</p>
                <Button asChild variant="outline" size="sm">
                  <Link to="/admin/torneos/nuevo">Crear el primero</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {tournaments.slice(0, 5).map((t) => (
                  <Link
                    key={t.id}
                    to={`/admin/torneos/${t.slug}`}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 hover:bg-muted/40 rounded-md px-1 -mx-1 transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{t.name}</span>
                      <span className="block text-xs text-muted-foreground">{t.start_date} → {t.end_date}</span>
                    </span>
                    <Badge variant="outline" className="shrink-0">{tournamentStatusLabel[t.status]}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
