import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";

export default function Home() {
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Liga16 Dashboard</h1>
        <p className="text-muted-foreground">Gestión completa de tu liga de fútbol 7</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Equipos" value="12" trend="+2 esta semana" />
        <StatCard title="Jugadores" value="144" trend="+8 esta semana" />
        <StatCard title="Partidos" value="24" trend="3 pendientes" />
        <StatCard title="Torneos" value="3" trend="1 activo" />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Acciones rápidas</h2>
        <div className="flex gap-4">
          <Button size="lg">Crear Partido</Button>
          <Button size="lg" variant="outline">Ver Calendario</Button>
          <Button size="lg" variant="outline">Agregar Equipo</Button>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Torneo Actual</CardTitle>
          <CardDescription>Liga16 - Temporada 2024</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Próxima fecha: Clubes Unidos vs Deportivo Cali
          </p>
        </CardContent>
      </Card>
    </section>
  );
}