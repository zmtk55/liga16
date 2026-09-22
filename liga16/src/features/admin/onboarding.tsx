"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { PadelDivision, Sex, Team } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ChevronRight, ChevronLeft, Sparkles, Trophy, Building2, Users, Layers } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CategoryPicker, { type CategoryValue } from "@/components/ui/category-picker";
import { sexShort } from "@/lib/format";

const STEPS = [
  { id: "club", label: "Sede", icon: Building2 },
  { id: "tournament", label: "Torneo", icon: Trophy },
  { id: "categories", label: "Categorías", icon: Layers },
  { id: "teams", label: "Parejas", icon: Users },
  { id: "review", label: "Revisar", icon: Check },
];

const divisions: PadelDivision[] = ["1ra", "2da", "3ra", "4ta", "5ta", "6ta", "Novatos"];
const sexes: { value: Sex; label: string }[] = [
  { value: "M", label: "Varonil" },
  { value: "F", label: "Femenil" },
  { value: "X", label: "Mixto" },
];



interface TeamInput {
  name: string;
  division: PadelDivision;
  sex: Sex;
  player1: string;
  player2: string;
}

function generateSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function addDays(date: string, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export default function AdminOnboarding() {
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const [club, setClub] = useState({
    name: "Club Pádel Reforma",
    slug: "club-padel-reforma",
    city: "Ciudad de México",
    state: "CDMX",
    address: "Av. Reforma 245, Col. Juárez",
    phone: "+52 55 1234 0001",
  });

  const [tournament, setTournament] = useState({
    name: "Copa Liga16 Apertura 2026",
    start_date: today,
    end_date: addDays(today, 3),
    registration_deadline: addDays(today, -3),
    format: "groups_knockout" as const,
    modality: "pairs" as const,
    status: "registration_open" as const,
    price_cents: 80000,
    description: "Primer torneo oficial del circuito Liga16.",
    rules_summary: "Grupos de 4 + eliminación directa. Mejor de 3 sets.",
  });

  const [categories, setCategories] = useState<CategoryValue[]>([
    { division: "4ta", sex: "M", max_pairs: 16 },
    { division: "4ta", sex: "F", max_pairs: 12 },
    { division: "Novatos", sex: "X", max_pairs: 12 },
  ]);

  const [teams, setTeams] = useState<TeamInput[]>([
    { name: "Fuentes / Rojas", division: "4ta", sex: "M", player1: "Diego Fuentes", player2: "Martín Rojas" },
    { name: "Camacho / Suárez", division: "4ta", sex: "F", player1: "Sofía Camacho", player2: "Paola Suárez" },
  ]);

  useEffect(() => {
    db.listClubs().then((clubs) => {
      if (clubs.length > 0) {
        const c = clubs[0];
        setClub({
          name: c.name,
          slug: c.slug,
          city: c.city,
          state: c.state,
          address: c.address ?? "",
          phone: c.phone ?? "",
        });
      }
    });
  }, []);



  function updateTeam(index: number, field: keyof TeamInput, value: string) {
    setTeams((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    );
  }

  function addTeam() {
    setTeams((prev) => [
      ...prev,
      { name: "", division: "4ta", sex: "M", player1: "", player2: "" },
    ]);
  }

  function removeTeam(index: number) {
    setTeams((prev) => prev.filter((_, i) => i !== index));
  }

  async function finish() {
    setSubmitting(true);
    try {
      // 1. Club
      let clubId: string;
      const existingClubs = await db.listClubs();
      if (existingClubs.length > 0) {
        const updated = await db.updateClub(existingClubs[0].slug, {
          name: club.name,
          city: club.city,
          state: club.state,
          address: club.address,
          phone: club.phone,
        });
        clubId = updated?.id ?? existingClubs[0].id;
      } else {
        // demo provider no tiene createClub; en supabase se crea por SQL
        clubId = "club-1";
      }

      // 2. Torneo
      const createdTournament = await db.createTournament({
        ...tournament,
        cover_url: null,
        club_id: clubId,
        city: club.city,
        state: club.state,
        organizer_id: null,
        currency: "MXN",
      });

      // 3. Categorías
      const categoryMap = new Map<string, string>();
      for (const cat of categories) {
        const created = await db.createTournamentCategory({
          tournament_id: createdTournament.id,
          name: `${cat.division} ${sexShort(cat.sex)}`,
          sex: cat.sex,
          max_pairs: cat.max_pairs,
          min_level: null,
          max_level: null,
          registered_pairs: 0,
          price_cents: tournament.price_cents,
        });
        categoryMap.set(`${cat.division}-${cat.sex}`, created.id);
      }

      // 4. Equipos/parejas
      for (const team of teams) {
        await db.createTeam({
          name: team.name,
          crest_url: null,
          city: club.city,
          club_id: clubId,
          division: team.division,
          sex: team.sex,
          player1: { player_id: "", name: team.player1, level: 0 },
          player2: { player_id: "", name: team.player2, level: 0 },
          position: 0,
          points: 0,
          played: 0,
          won: 0,
          lost: 0,
          sets_for: 0,
          sets_against: 0,
          titles: 0,
        } as Omit<Team, "id" | "slug">);
      }

      setCompleted(true);
      toast.success("¡Liga configurada! Ya puedes gestionar torneos y parejas.");
    } catch (e) {
      toast.error((e as Error).message ?? "Error en onboarding");
    } finally {
      setSubmitting(false);
    }
  }

  function canAdvance() {
    if (step === 0) return club.name && club.city;
    if (step === 1) return tournament.name && tournament.start_date && tournament.end_date;
    if (step === 2) return categories.length > 0 && categories.every((c) => c.max_pairs > 0);
    if (step === 3) return teams.length > 0 && teams.every((t) => t.name && t.player1 && t.player2);
    return true;
  }

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <Check className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold">¡Configuración completa!</h2>
        <p className="text-muted-foreground max-w-md">
          Tu liga está lista. Los jugadores ya pueden registrarse e inscribir sus parejas en el torneo.
        </p>
        <Button onClick={() => window.location.href = "/admin"}>Ir al dashboard</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <header className="text-center space-y-2">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold">Configuración inicial</h1>
        <p className="text-muted-foreground">Crea tu sede, torneo, categorías y primeras parejas.</p>
      </header>

      <div className="flex items-center justify-between">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                i < step
                  ? "bg-emerald-600 text-white"
                  : i === step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
            </div>
            <span
              className={`ml-2 hidden text-xs font-medium sm:block ${
                i === step ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`mx-2 h-0.5 w-4 sm:w-8 rounded ${i < step ? "bg-emerald-600" : "bg-muted"}`} />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2"><Building2 className="h-5 w-5" /> Sede / Club</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre del club</Label>
                  <Input value={club.name} onChange={(e) => setClub((c) => ({ ...c, name: e.target.value, slug: generateSlug(e.target.value) }))} />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input value={club.phone} onChange={(e) => setClub((c) => ({ ...c, phone: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <Input value={club.city} onChange={(e) => setClub((c) => ({ ...c, city: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input value={club.state} onChange={(e) => setClub((c) => ({ ...c, state: e.target.value }))} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Dirección</Label>
                  <Input value={club.address} onChange={(e) => setClub((c) => ({ ...c, address: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2"><Trophy className="h-5 w-5" /> Primer torneo</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Nombre del torneo</Label>
                  <Input value={tournament.name} onChange={(e) => setTournament((t) => ({ ...t, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Fecha inicio</Label>
                  <Input type="date" value={tournament.start_date} onChange={(e) => setTournament((t) => ({ ...t, start_date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Fecha fin</Label>
                  <Input type="date" value={tournament.end_date} onChange={(e) => setTournament((t) => ({ ...t, end_date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Cierre de inscripción</Label>
                  <Input type="date" value={tournament.registration_deadline} onChange={(e) => setTournament((t) => ({ ...t, registration_deadline: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Precio por pareja (MXN)</Label>
                  <Input type="number" value={tournament.price_cents / 100} onChange={(e) => setTournament((t) => ({ ...t, price_cents: Number(e.target.value) * 100 }))} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Reglamento resumido</Label>
                  <Input value={tournament.rules_summary} onChange={(e) => setTournament((t) => ({ ...t, rules_summary: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2"><Layers className="h-5 w-5" /> Categorías</h2>
              <p className="text-sm text-muted-foreground">
                Cada categoría combina una división con una rama (varonil, femenil o mixto). Busca y selecciona las que necesites; el cupo se puede ajustar por chip.
              </p>
              <CategoryPicker value={categories} onChange={setCategories} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2"><Users className="h-5 w-5" /> Parejas iniciales</h2>
                <Button type="button" variant="outline" size="sm" onClick={addTeam}>Añadir pareja</Button>
              </div>
              <p className="text-sm text-muted-foreground">Registra las primeras parejas que competirán. Después los jugadores podrán inscribirse desde el torneo.</p>
              <div className="space-y-3">
                {teams.map((team, i) => (
                  <div key={i} className="grid gap-3 sm:grid-cols-5 items-end rounded-lg border p-3">
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-xs">Nombre de la pareja</Label>
                      <Input value={team.name} onChange={(e) => updateTeam(i, "name", e.target.value)} placeholder="Ej: Fuentes / Rojas" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">División</Label>
                      <Select value={team.division} onValueChange={(v) => updateTeam(i, "division", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {divisions.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Rama</Label>
                      <Select value={team.sex} onValueChange={(v) => updateTeam(i, "sex", v as Sex)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {sexes.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" size="icon" className="mb-0.5" onClick={() => removeTeam(i)}>×</Button>
                    </div>
                    <div className="space-y-2 sm:col-span-3">
                      <Label className="text-xs">Jugador 1</Label>
                      <Input value={team.player1} onChange={(e) => updateTeam(i, "player1", e.target.value)} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-xs">Jugador 2</Label>
                      <Input value={team.player2} onChange={(e) => updateTeam(i, "player2", e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Resumen</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Sede</p>
                  <p className="text-lg font-bold">{club.name}</p>
                  <p className="text-xs text-muted-foreground">{club.city}, {club.state}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Torneo</p>
                  <p className="text-lg font-bold">{tournament.name}</p>
                  <p className="text-xs text-muted-foreground">{tournament.start_date} → {tournament.end_date}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Categorías</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {categories.map((c, i) => (
                      <Badge key={i} variant="secondary">{c.division} {sexShort(c.sex)} · {c.max_pairs} cupo</Badge>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Parejas</p>
                  <p className="text-2xl font-bold">{teams.length}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={!canAdvance()}>
            Siguiente <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={finish} disabled={submitting || !canAdvance()}>
            <Check className="h-4 w-4 mr-1" /> {submitting ? "Creando…" : "Completar"}
          </Button>
        )}
      </div>
    </div>
  );
}
