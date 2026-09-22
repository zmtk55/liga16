import { useEffect, useState } from "react";
import { MapPin, Phone } from "lucide-react";
import { db } from "@/lib/data";
import type { Club } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Padel</h1>
        <p className="text-muted-foreground">
          La sede oficial de Liga16
        </p>
      </header>

      {club === undefined ? (
        <Skeleton className="h-56 w-full" />
      ) : club ? (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle className="text-2xl">{club.name}</CardTitle>
            <CardDescription>
              {club.city}, {club.state}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{club.description}</p>
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {club.address ?? "Dirección por confirmar"}
            </p>
            {club.phone && (
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {club.phone}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">Aún no hay padel configurado.</p>
      )}
    </section>
  );
}
