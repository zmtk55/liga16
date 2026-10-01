import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { db } from "@/lib/data";
import type { Tournament } from "@/types";
import { TournamentCard } from "@/components/cards/resource-card";
import { PageHero } from "@/components/page-hero";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Trophy, Filter, Users } from "lucide-react";

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null);
  // El buscador del header (variante "search", ADR-0009) escribe aquí; los
  // filtros de la página usan los mismos parámetros, para que la URL sea la
  // única fuente y el filtro se pueda compartir.
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const status = params.get("status") ?? "all";
  const setStatus = (v: string) => setParam("status", v);
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
        (format === "all" || t.format === format) &&
        (!q ||
          (t.name + " " + (t.club_name ?? "") + " " + (t.city ?? ""))
            .toLowerCase()
            .includes(q.toLowerCase())),
    );
  }, [tournaments, status, format, q]);

  const abiertos = tournaments?.filter((t) => t.status === "registration_open").length ?? 0;

  return (
    <div className="animate-fade-in space-y-8">
      <PageHero
        eyebrow="Calendario"
        title="Torneos"
        subtitle="Las fechas del circuito. Inscripciones abiertas, sedes y formatos de cada evento."
        ghost="16"
        stats={[
          { k: "Torneos", v: tournaments?.length ?? "…" },
          { k: "Inscripción abierta", v: abiertos },
          { k: "Formatos", v: tournaments ? new Set(tournaments.map((t) => t.format)).size : "…" },
        ]}
      />

      <div className="relative z-10 -mt-4 flex flex-wrap gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="registration_open"><Calendar className="mr-2 h-3 w-3" /> Inscripciones abiertas</SelectItem>
            <SelectItem value="registration_closed"><Calendar className="mr-2 h-3 w-3" /> Inscripciones cerradas</SelectItem>
            <SelectItem value="published"><Trophy className="mr-2 h-3 w-3" /> Publicado</SelectItem>
            <SelectItem value="in_progress"><Trophy className="mr-2 h-3 w-3" /> En juego</SelectItem>
            <SelectItem value="finished"><Trophy className="mr-2 h-3 w-3" /> Finalizado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={format} onValueChange={setFormat}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Formato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all"><Filter className="mr-2 h-3 w-3" /> Todos los formatos</SelectItem>
            <SelectItem value="single_elimination"><Trophy className="mr-2 h-3 w-3" /> Eliminación directa</SelectItem>
            <SelectItem value="groups_knockout"><Users className="mr-2 h-3 w-3" /> Grupos + eliminación</SelectItem>
            <SelectItem value="americano"><Trophy className="mr-2 h-3 w-3" /> Americano</SelectItem>
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
            <Trophy className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-lg font-medium">No hay torneos con este filtro</p>
            <p className="mt-1">Prueba con otros filtros o <Button variant="ghost" size="sm" onClick={() => { setStatus("all"); setFormat("all"); }}>ver todos</Button></p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      )}
    </div>
  );
}
