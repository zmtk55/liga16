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

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Clubes</h1>
        <p className="text-muted-foreground">
          Sedes y clubes del circuito Liga16
        </p>
      </header>

      {clubs === null ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {clubs.map((club) => (
            <Card key={club.id}>
              <CardHeader>
                <CardTitle className="text-lg">{club.name}</CardTitle>
                <CardDescription>
                  {club.city}, {club.state}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {club.description && <p>{club.description}</p>}
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
          ))}
        </div>
      )}
    </section>
  );
}