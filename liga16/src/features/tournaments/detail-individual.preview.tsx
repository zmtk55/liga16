import { IndividualEntry } from "./individual-entry";
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { ArrowLeft, CalendarDays, MapPin, Trophy, Users } from "lucide-react";
import { db } from "@/lib/data";
import type { Pair, Tournament, TournamentCategory } from "@/types";
import { formatDateRange, formatLabel, tournamentStatusLabel, formatCity } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PairsMap = Record<string, Pair[]>;

export default function TournamentDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [categories, setCategories] = useState<TournamentCategory[]>([]);
  const [pairs, setPairs] = useState<PairsMap>({});
  const [loading, setLoading] = useState(true);

  const [openDialog, setOpenDialog] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const t = await db.getTournament(slug);
        if (!active) return;
        if (!t) {
          setTournament(null);
          setLoading(false);
          return;
        }
        setTournament(t);
        const [cats, allPairs] = await Promise.all([
          db.getTournamentCategories(t.id),
          db.getTournamentPairs(t.id).catch(() => [] as Pair[]),
        ]);
        if (!active) return;
        setCategories(cats);
        const grouped: PairsMap = {};
        cats.forEach((c) => {
          grouped[c.id] = allPairs.filter((p) => p.category_id === c.id);
        });
        setPairs(grouped);
      } catch {
        if (active) setTournament(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  const openRegister = () => setOpenDialog(true);

  if (loading) {
    return (
      <section className="space-y-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </section>
    );
  }

  if (!tournament) {
    return (
      <section className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/torneos">
            <ArrowLeft className="h-4 w-4" /> Torneos
          </Link>
        </Button>
        <div className="flex flex-col items-center gap-3 pt-10 text-center">
          <h1 className="text-2xl font-bold">Torneo no encontrado</h1>
          <p className="text-muted-foreground">
            El torneo que buscas no existe o fue retirado del circuito.
          </p>
        </div>
      </section>
    );
  }

  const cats = categories;
  const canRegister = tournament.status === "registration_open";

  return (
    <section className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/torneos">
          <ArrowLeft className="h-4 w-4" /> Torneos
        </Link>
      </Button>

      <header className="overflow-hidden rounded-2xl border bg-gradient-to-br from-card to-muted/30">
        {tournament.cover_url && (
          <div className="relative">
            <img
              src={tournament.cover_url}
              alt={tournament.name}
              className="aspect-video max-h-72 w-full object-cover md:max-h-96"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <Badge
              variant={tournament.status === "registration_open" ? "default" : "secondary"}
              className="absolute inset-inline-start-4 top-4 shadow-md"
            >
              {tournamentStatusLabel[tournament.status]}
            </Badge>
          </div>
        )}
        <div className="space-y-3 p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{tournament.name}</h1>
            <Badge variant={tournament.status === "registration_open" ? "default" : "secondary"}>
              {tournamentStatusLabel[tournament.status]}
            </Badge>
          </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <span className="flex items-center gap-1.5 font-medium">
            <CalendarDays className="h-4 w-4 text-primary" />
            {formatDateRange(tournament.start_date, tournament.end_date)}
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <MapPin className="h-4 w-4 text-primary" />
            {tournament.club_name ?? (formatCity(tournament.city) || "Sede por confirmar")}
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <Trophy className="h-4 w-4 text-primary" />
            {formatLabel[tournament.format]}
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <Users className="h-4 w-4 text-primary" />
            Un pago individual por torneo
          </span>
        </div>
        {tournament.description && (
          <p className="max-w-3xl text-sm text-muted-foreground">
            {tournament.description}
          </p>
        )}
        {tournament.rules_summary && (
          <div className="max-w-3xl rounded-lg border bg-card p-3">
            <p className="text-xs font-semibold mb-1">📜 Reglamento</p>
            <p className="text-xs text-muted-foreground">{tournament.rules_summary}</p>
          </div>
        )}
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {cats.map((cat) => {
          const catPairs = pairs[cat.id] ?? [];
          const hasCap = cat.max_pairs != null && cat.max_pairs > 0;
          const full = hasCap && cat.registered_pairs >= cat.max_pairs;
          const pct = hasCap ? Math.round((cat.registered_pairs / cat.max_pairs) * 100) : 0;
          return (
            <Card key={cat.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{cat.name}</CardTitle>
                  {hasCap ? (
                    <Badge variant="secondary" className="shrink-0 tabular-nums">
                      {cat.registered_pairs}/{cat.max_pairs} parejas
                    </Badge>
                  ) : cat.registered_pairs != null ? (
                    <Badge variant="secondary" className="shrink-0 tabular-nums">
                      {cat.registered_pairs} parejas
                    </Badge>
                  ) : null}
                </div>
                {hasCap && (
                  <div className="pt-2">
                    <Progress value={pct} />
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {cat.min_level != null && cat.max_level != null ? (
                    <span>Nivel {cat.min_level} a {cat.max_level}</span>
                  ) : (
                    <span>Nivel abierto</span>
                  )}

                </div>
                {catPairs.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Parejas inscritas
                    </p>
                    <ul className="space-y-0.5 text-sm">
                      {catPairs.map((p) => (
                        <li key={p.id}>
                          <span>{p.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button
                  disabled={!canRegister || full}
                  onClick={openRegister}
                  className="w-full sm:w-auto"
                >
                  {full ? "Cupo lleno" : canRegister ? "Inscribirse" : "Inscripciones cerradas"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Inscripción individual</DialogTitle>
            <DialogDescription>{tournament.name}</DialogDescription>
          </DialogHeader>
          <IndividualEntry tournamentId={tournament.id} onClose={()=>setOpenDialog(false)} />
        </DialogContent>
      </Dialog>
    </section>
  );
}