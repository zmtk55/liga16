import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { CalendarDays, MapPin, Trophy } from "lucide-react";
import { db } from "@/lib/data";
import type { Tournament } from "@/types";
import { formatMoney, formatDateRange, formatLabel, tournamentStatusLabel } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusVariant: Record<
  Tournament["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  published: "secondary",
  registration_open: "default",
  registration_closed: "outline",
  in_progress: "destructive",
  finished: "outline",
  cancelled: "outline",
};

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null);
  const [city, setCity] = useState("all");
  const [status, setStatus] = useState("all");
  const [format, setFormat] = useState("all");

  useEffect(() => {
    let active = true;
    db.listTournaments().then((data) => {
      if (active) setTournaments(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const cities = useMemo(() => {
    if (!tournaments) return [] as string[];
    return Array.from(new Set(tournaments.map((t) => t.city))).sort();
  }, [tournaments]);

  const filtered = useMemo(() => {
    if (!tournaments) return [] as Tournament[];
    return tournaments.filter(
      (t) =>
        (city === "all" || t.city === city) &&
        (status === "all" || t.status === status) &&
        (format === "all" || t.format === format),
    );
  }, [tournaments, city, status, format]);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Torneos</h1>
        <p className="text-muted-foreground">
          Próximas fechas del circuito Liga16
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Select value={city} onValueChange={setCity}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Ciudad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las ciudades</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="registration_open">Inscripciones abiertas</SelectItem>
            <SelectItem value="registration_closed">Inscripciones cerradas</SelectItem>
            <SelectItem value="published">Publicado</SelectItem>
            <SelectItem value="in_progress">En juego</SelectItem>
            <SelectItem value="finished">Finalizado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={format} onValueChange={setFormat}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Formato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los formatos</SelectItem>
            <SelectItem value="single_elimination">Eliminación directa</SelectItem>
            <SelectItem value="groups_knockout">Grupos + eliminación</SelectItem>
            <SelectItem value="americano">Americano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {tournaments === null ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">No hay torneos con esos filtros.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((t) => (
            <Card key={t.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg leading-snug">{t.name}</CardTitle>
                  <Badge variant={statusVariant[t.status]}>
                    {tournamentStatusLabel[t.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {formatDateRange(t.start_date, t.end_date)}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {t.city}, {t.state} · {t.club_name}
                  </p>
                  <p className="flex items-center gap-2">
                    <Trophy className="h-4 w-4" />
                    {formatLabel[t.format]} · {formatMoney(t.price_cents, t.currency)}
                  </p>
                </div>
                <div className="mt-auto">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/torneos/${t.slug}`}>Ver torneo</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}