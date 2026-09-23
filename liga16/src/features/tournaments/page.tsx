import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/data";
import type { Tournament } from "@/types";
import { TournamentCard } from "@/components/cards/resource-card";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null);
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

  const filtered = useMemo(() => {
    if (!tournaments) return [] as Tournament[];
    return tournaments.filter(
      (t) =>
        (status === "all" || t.status === status) &&
        (format === "all" || t.format === format),
    );
  }, [tournaments, status, format]);

  return (
    <section className="animate-fade-in space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Torneos</h1>
        <p className="text-muted-foreground">
          Calendario del circuito — inscríbete en las fechas abiertas
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No hay torneos con este estado y formato. Prueba otros filtros.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      )}
    </section>
  );
}
