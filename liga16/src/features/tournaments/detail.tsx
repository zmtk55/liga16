import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { ArrowLeft, CalendarDays, MapPin, Trophy, Users, Check, ChevronRight, ChevronLeft, CreditCard, User } from "lucide-react";
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
  const [regStep, setRegStep] = useState(0); // 0: datos, 1: pago, 2: confirmar

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
    setRegStep(0);
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
              className="absolute left-4 top-4 shadow-md"
            >
              {tournamentStatusLabel[tournament.status]}
            </Badge>
          </div>
        )}
        <div className="space-y-3 p-6 md:p-8">
        {!tournament.cover_url && (
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{tournament.name}</h1>
            <Badge variant={tournament.status === "registration_open" ? "default" : "secondary"}>
              {tournamentStatusLabel[tournament.status]}
            </Badge>
          </div>
        )}
        {tournament.cover_url && (
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{tournament.name}</h1>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <span className="flex items-center gap-1.5 font-medium">
            <CalendarDays className="h-4 w-4 text-primary" />
            {formatDateRange(tournament.start_date, tournament.end_date)}
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <MapPin className="h-4 w-4 text-primary" />
            {tournament.club_name ?? "Club Pádel Reforma"}
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <Trophy className="h-4 w-4 text-primary" />
            {formatLabel[tournament.format]}
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <Users className="h-4 w-4 text-primary" />
            Inscripción {formatMoney(tournament.price_cents, tournament.currency)}
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
              {tournament.name} · {selectedCategory ? formatMoney(selectedCategory.price_cents, tournament.currency) : ""}
            </DialogDescription>
          </DialogHeader>

          {/* Progress steps */}
          <div className="flex items-center gap-2 py-2">
            {[
              { n: 0, label: "Datos", icon: User },
              { n: 1, label: "Pago", icon: CreditCard },
              { n: 2, label: "Confirmar", icon: Check },
            ].map((s, i) => (
              <div key={s.n} className="flex flex-1 items-center">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  i < regStep ? "bg-emerald-600 text-white" :
                  i === regStep ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {i < regStep ? <s.icon className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={`ml-1.5 hidden text-xs font-medium sm:block ${i === regStep ? "text-foreground" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
                {i < 2 && <div className={`mx-1 h-0.5 flex-1 rounded ${i < regStep ? "bg-emerald-600" : "bg-muted"}`} />}
              </div>
            ))}
          </div>

          {/* STEP 0: Datos */}
          {regStep === 0 && (
            <div className="grid gap-3 py-2">
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">📝 Datos de la pareja</p>
                <p>Necesitamos los nombres completos de ambos jugadores para la inscripción.</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="player1">Nombre del Jugador 1 *</Label>
                <Input
                  id="player1"
                  placeholder="Nombre completo"
                  value={player1}
                  onChange={(e) => setPlayer1(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="player2">Nombre del Jugador 2 *</Label>
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
                  placeholder="Ej: González / López"
                  value={pairName}
                  onChange={(e) => setPairName(e.target.value)}
                />
              </div>
              <Button onClick={() => setRegStep(1)} className="w-full">
                Siguiente <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* STEP 1: Pago */}
          {regStep === 1 && (
            <div className="grid gap-3 py-2">
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">💳 Método de pago</p>
                <p>
                  {paymentMethod === "transfer"
                    ? "Transferencia bancaria: después de inscribirte te enviamos los datos de la cuenta."
                    : "Efectivo: pagas directamente al organizer el día del torneo."}
                </p>
              </div>
              <div className="grid gap-2">
                <Label>Selecciona método de pago</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={paymentMethod === "transfer" ? "default" : "outline"}
                    onClick={() => setPaymentMethod("transfer")}
                    className="flex-1"
                  >
                    <CreditCard className="h-4 w-4 mr-1.5" />
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
                <span>
                  Acepto el reglamento del torneo y confirmo el pago de{" "}
                  <strong>
                    {selectedCategory
                      ? formatMoney(selectedCategory.price_cents, tournament.currency)
                      : ""}
                  </strong>.
                </span>
              </label>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setRegStep(0)} className="flex-1">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <Button onClick={() => setRegStep(2)} className="flex-1" disabled={!acceptedRules}>
                  Revisar <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Confirmar */}
          {regStep === 2 && (
            <div className="grid gap-3 py-2">
              <div className="rounded-lg bg-primary/10 p-3 text-sm">
                <p className="font-medium text-primary mb-2">🔍 Revisa tu inscripción</p>
                <div className="grid gap-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Torneo:</span>
                    <span className="font-medium">{tournament.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Categoría:</span>
                    <span className="font-medium">{selectedCategory?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Jugador 1:</span>
                    <span className="font-medium">{player1}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Jugador 2:</span>
                    <span className="font-medium">{player2}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pareja:</span>
                    <span className="font-medium">
                      {pairName.trim() || `${player1} / ${player2}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pago:</span>
                    <span className="font-medium">
                      {paymentMethod === "transfer" ? "Transferencia" : "Efectivo"} ·{" "}
                      {selectedCategory
                        ? formatMoney(selectedCategory.price_cents, tournament.currency)
                        : ""}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setRegStep(1)} className="flex-1">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Corregir
                </Button>
                <Button onClick={submitRegistration} disabled={submitting} className="flex-1">
                  {submitting ? "Enviando…" : <><Check className="h-4 w-4 mr-1" /> Confirmar</>}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="hidden">
            <Button variant="outline" onClick={() => setOpenDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}