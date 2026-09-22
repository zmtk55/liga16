import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { ArrowLeft, CalendarDays, MapPin, Trophy, Users } from "lucide-react";
import { db } from "@/lib/data";
import type { Pair, Tournament, TournamentCategory } from "@/types";
import { formatMoney, formatDateRange, formatLabel, tournamentStatusLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type PairsMap = Record<string, Pair[]>;

export default function TournamentDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [categories, setCategories] = useState<TournamentCategory[]>([]);
  const [pairs, setPairs] = useState<PairsMap>({});
  const [loading, setLoading] = useState(true);

  const [openDialog, setOpenDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TournamentCategory | null>(null);
  const [player1, setPlayer1] = useState("");
  const [player2, setPlayer2] = useState("");
  const [pairName, setPairName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">("transfer");
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  const openRegister = (cat: TournamentCategory) => {
    setSelectedCategory(cat);
    setPlayer1("");
    setPlayer2("");
    setPairName("");
    setPaymentMethod("transfer");
    setAcceptedRules(false);
    setOpenDialog(true);
  };

  const submitRegistration = useCallback(async () => {
    if (!tournament || !selectedCategory) return;
    if (!player1.trim() || !player2.trim()) {
      toast.error("Captura el nombre de ambos jugadores");
      return;
    }
    if (!acceptedRules) {
      toast.error("Debes aceptar las reglas del torneo");
      return;
    }
    setSubmitting(true);
    try {
      await db.registerPair({
        tournament_id: tournament.id,
        category_id: selectedCategory.id,
        player1_name: player1,
        player2_name: player2,
        pair_name: pairName.trim() || `${player1.trim()} / ${player2.trim()}`,
        accepted_rules: acceptedRules,
        payment_method: paymentMethod,
      });
      setOpenDialog(false);
      toast.success("Inscripción enviada correctamente");
    } catch (e) {
      toast.error((e as Error).message ?? "No se pudo completar la inscripción");
    } finally {
      setSubmitting(false);
    }
  }, [tournament, selectedCategory, player1, player2, pairName, acceptedRules, paymentMethod]);

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
            El torneo que buscas no existe o está disponible sólo con datos de Supabase.
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

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{tournament.name}</h1>
          <Badge>{tournamentStatusLabel[tournament.status]}</Badge>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            {formatDateRange(tournament.start_date, tournament.end_date)}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            {tournament.club_name ?? "Club Padel Reforma"}
          </span>
          <span className="flex items-center gap-1.5">
            <Trophy className="h-4 w-4" />
            {formatLabel[tournament.format]}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            Inscripción {formatMoney(tournament.price_cents, tournament.currency)}
          </span>
        </div>
        {tournament.description && (
          <p className="max-w-3xl text-sm text-muted-foreground">
            {tournament.description}
          </p>
        )}
        {tournament.rules_summary && (
          <p className="max-w-3xl rounded-md bg-muted p-3 text-xs text-muted-foreground">
            Reglamento: {tournament.rules_summary}
          </p>
        )}
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {cats.map((cat) => {
          const catPairs = pairs[cat.id] ?? [];
          const full = cat.registered_pairs >= cat.max_pairs;
          const pct = Math.round((cat.registered_pairs / cat.max_pairs) * 100);
          return (
            <Card key={cat.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{cat.name}</CardTitle>
                  <Badge variant="secondary">
                    {cat.registered_pairs}/{cat.max_pairs} parejas
                  </Badge>
                </div>
                <div className="pt-2">
                  <Progress value={pct} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {cat.min_level != null && cat.max_level != null ? (
                    <span>Nivel {cat.min_level} a {cat.max_level}</span>
                  ) : (
                    <span>Nivel abierto</span>
                  )}
                  <span>·</span>
                  <span>{formatMoney(cat.price_cents, tournament.currency)}</span>
                </div>
                {catPairs.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Parejas inscritas
                    </p>
                    <ul className="space-y-0.5 text-sm">
                      {catPairs.map((p) => (
                        <li key={p.id} className="flex justify-between">
                          <span>{p.name}</span>
                          {p.seed != null && (
                            <span className="text-xs text-muted-foreground">
                              Siembra #{p.seed}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button
                  disabled={!canRegister || full}
                  onClick={() => openRegister(cat)}
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
            <DialogTitle>Inscripción — {selectedCategory?.name}</DialogTitle>
            <DialogDescription>
              {tournament.name}. Completa los datos de la pareja para reservar tu lugar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="player1">Jugador 1</Label>
              <Input
                id="player1"
                placeholder="Nombre completo"
                value={player1}
                onChange={(e) => setPlayer1(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="player2">Jugador 2</Label>
              <Input
                id="player2"
                placeholder="Nombre completo"
                value={player2}
                onChange={(e) => setPlayer2(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pairName">Nombre de la pareja (opcional)</Label>
              <Input
                id="pairName"
                placeholder="Apellidos / Apellidos"
                value={pairName}
                onChange={(e) => setPairName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Método de pago</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={paymentMethod === "transfer" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("transfer")}
                  className="flex-1"
                >
                  Transferencia
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === "cash" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("cash")}
                  className="flex-1"
                >
                  Efectivo
                </Button>
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={acceptedRules}
                onChange={(e) => setAcceptedRules(e.target.checked)}
                className="mt-0.5"
              />
              Acepto el reglamento del torneo y confirmo el pago de{" "}
              {selectedCategory
                ? formatMoney(selectedCategory.price_cents, tournament.currency)
                : "la inscripción"}
              .
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={submitRegistration} disabled={submitting}>
              {submitting ? "Enviando…" : "Confirmar inscripción"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}