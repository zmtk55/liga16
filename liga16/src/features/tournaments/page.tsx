import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { db } from "@/lib/data";
import type { Tournament } from "@/types";
import { PageHero } from "@/components/page-hero";
import { Card, CardContent } from "@/components/ui/card";
import { CardShell, CardIdentity } from "@/components/cards/card-kit";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FilterMenu } from "@/components/ui/filter-menu";
import { formatCity, formatDateRange, formatLabel, formatMoney, tournamentStatusLabel } from "@/lib/format";
import { Trophy } from "lucide-react";

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
  const format = params.get("format") ?? "all";
  const setFormat = (v: string) => setParam("format", v);

  useEffect(() => {
    let active = true;
    db.listTournaments().then((data) => {
      if (active) setTournaments(data);
    }).catch(() => { if (active) setTournaments([]); });
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

  return (
    <div className="animate-fade-in space-y-8">
      <PageHero
        title="Torneos"
        subtitle="Las fechas del circuito. Inscripciones abiertas, sedes y formatos de cada evento."
        ghost="16"
      />

      <div className="relative z-10 -mt-4 flex flex-wrap items-center gap-2">
        <FilterMenu
          label="Estado"
          value={status}
          onChange={setStatus}
          options={[
            { key: "registration_open", label: "Inscripciones abiertas" },
            { key: "registration_closed", label: "Inscripciones cerradas" },
            { key: "published", label: "Publicados" },
            { key: "in_progress", label: "En juego" },
            { key: "finished", label: "Finalizados" },
          ]}
          allLabel="Todos los estados"
        />
        <FilterMenu
          label="Formato"
          value={format}
          onChange={(v) => setFormat(v)}
          options={[
            { key: "single_elimination", label: "Eliminación directa" },
            { key: "groups_knockout", label: "Grupos + eliminación" },
            { key: "americano", label: "Americano" },
          ]}
          allLabel="Todos los formatos"
        />
      </div>

      {tournaments === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <Link key={t.id} to={`/torneos/${t.slug}`} className="group min-w-0">
              <CardShell
                banner={t.cover_url}
                bannerAlt={`Portada del torneo ${t.name}`}
                className="h-full"
              >
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <CardIdentity
                    lead={
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold uppercase text-primary-strong">
                        {t.club_name?.charAt(0) || formatCity(t.city).charAt(0) || "16"}
                      </span>
                    }
                    title={t.name}
                    meta={
                      `${formatDateRange(t.start_date, t.end_date)} · ${formatLabel[t.format] ?? t.format}`
                    }
                    end={
                      <Badge variant={t.status === "registration_open" ? "default" : "secondary"}>
                        {tournamentStatusLabel[t.status]}
                      </Badge>
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {t.club_name || formatCity(t.city) || "Sede por confirmar"}
                  </p>
                  {t.price_cents > 0 && (
                    <p className="mt-auto font-mono text-sm font-bold tabular-nums text-primary">
                      {formatMoney(t.price_cents, t.currency)}
                    </p>
                  )}
                </CardContent>
              </CardShell>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
