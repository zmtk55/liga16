"use client";

import { useEffect, useState } from "react";
import { MapPin, Phone, Clock, Users, Calendar } from "lucide-react";
import { db } from "@/lib/data";
import type { Club } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClubsPage() {
  const [clubs, setClubs] = useState<Club[] | null>(null);

  useEffect(() => {
    let active = true;
    db.listClubs().then((data) => {
      if (active) setClubs(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const club = clubs?.[0];

  if (club === undefined) {
    return <Skeleton className="h-56 w-full" />;
  }

  if (!club) {
    return <p className="text-sm text-muted-foreground">Aún no hay padel configurado.</p>;
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Padel</h1>
        <p className="text-muted-foreground">
          La sede oficial de Liga16
        </p>
      </header>

      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-primary/5 to-background px-6 py-8 md:px-10 md:py-12 animate-slide-up">
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">{club.city}, {club.state}</span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">{club.name}</h2>
            <p className="max-w-xl text-sm text-muted-foreground">{club.description}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {club.address && (
                <Badge variant="outline" className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {club.address}</Badge>
              )}
              {club.phone && (
                <Badge variant="outline" className="flex items-center gap-1"><Phone className="h-3 w-3" /> {club.phone}</Badge>
              )}
              <Badge className="bg-emerald-600 text-white">Activo</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" /> Calendario
            </div>
            <CardTitle className="text-lg">Ver partidos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Consulta el calendario de torneos y partidos en el padel Reforma.</p>
          </CardContent>
        </Card>
        <Card className="transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" /> Jugadores
            </div>
            <CardTitle className="text-lg">Directorio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Ver jugadores, rankings y perfiles del circuito.</p>
          </CardContent>
        </Card>
        <Card className="transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" /> Horario
            </div>
            <CardTitle className="text-lg">Canchas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">8 canchas de cristal disponibles para reservación.</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
