"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/data";
import type { PadelDivision, Sex, Team } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ChevronRight, ChevronLeft, Plus, Sparkles, Trophy, Building2, Users, Layers } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CategoryPicker, { type CategoryValue } from "@/components/ui/category-picker";
import PlayerSlot from "@/components/players/player-slot";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { sexShort } from "@/lib/format";
import type { PlayerProfile } from "@/types";

const STEPS = [
  { id: "club", label: "Sede", icon: Building2 },
  { id: "tournament", label: "Torneo", icon: Trophy },
  { id: "categories", label: "Categorías", icon: Layers },
  { id: "teams", label: "Parejas", icon: Users },
  { id: "review", label: "Revisar", icon: Check },
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

  const [teams, setTeams] = useState<TeamInput[]>([]);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);

  useEffect(() => {
    db.listPlayers().then(setPlayers).catch(() => setPlayers([]));
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

  function addTeam(division?: PadelDivision, sex?: Sex) {
    const cat = categories[0];
    setTeams((prev) => [
      ...prev,
      {
        name: "",
        division: division ?? cat?.division ?? "4ta",
        sex: sex ?? cat?.sex ?? "M",
        player1: "",
        player2: "",
      },
    ]);
  }

  /** El nombre de la pareja se arma solo con los jugadores; editable si el usuario lo sobreescribe. */
  function updatePlayer(index: number, slot: 1 | 2, value: string) {
    setTeams((prev) =>
      prev.map((t, i) => {
        if (i !== index) return t;
        const next = { ...t, [slot === 1 ? "player1" : "player2"]: value };
        const auto = [next.player1.trim(), next.player2.trim()].filter(Boolean).join(" / ");
        const currentAuto = [t.player1.trim(), t.player2.trim()].filter(Boolean).join(" / ");
        // Solo regenerar el nombre si no fue editado a mano
        const nameUntouched = !t.name || t.name === currentAuto;
        return { ...next, name: nameUntouched ? auto : t.name };
      }),
    );
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
          division: cat.division,
          sex: cat.sex,
          max_pairs: cat.max_pairs,
          min_level: null,
          max_level: null,
          registered_pairs: 0,
          price_cents: tournament.price_cents,
        } as never);
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
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-bold flex items-center gap-2"><Users className="h-5 w-5" /> Equipos (parejas)</h2>
                {categories.length > 0 ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" size="sm"><Plus className="h-4 w-4 mr-1" /> Añadir equipo</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-1" align="end">
                      <Command>
                        <CommandInput placeholder="Buscar categoría…" />
                        <CommandList>
                          <CommandEmpty>Sin categorías.</CommandEmpty>
                          {categories.map((c) => (
                            <CommandItem
                              key={`${c.division}-${c.sex}`}
                              value={`${c.division} ${sexShort(c.sex)}`}
                              onSelect={() => addTeam(c.division, c.sex)}
                            >
                              {c.division} · {sexShort(c.sex)}
                            </CommandItem>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={() => addTeam()} disabled>
                    Añadir equipo
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Un equipo es una pareja: elige la categoría y escribe o selecciona a sus 2 jugadores. El nombre del equipo se arma solo.
              </p>

              {teams.length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-6 text-center">
                  Aún no hay equipos. Añade el primero eligiendo su categoría arriba.
                </p>
              ) : (
                <div className="space-y-4">
                  {categories
                    .filter((c) => teams.some((t) => t.division === c.division && t.sex === c.sex))
                    .map((c) => {
                      const catTeams = teams
                        .map((t, i) => ({ t, i }))
                        .filter(({ t }) => t.division === c.division && t.sex === c.sex);
                      return (
                        <div key={`${c.division}-${c.sex}`} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{c.division} · {sexShort(c.sex)}</Badge>
                            <span className="text-xs text-muted-foreground">{catTeams.length} equipo(s)</span>
                          </div>
                          <div className="space-y-2">
                            {catTeams.map(({ t, i }) => (
                              <div key={i} className="rounded-xl border p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <Input
                                    value={t.name}
                                    onChange={(e) => updateTeam(i, "name", e.target.value)}
                                    placeholder="Nombre del equipo (se arma solo)"
                                    className="h-8 text-sm font-semibold"
                                  />
                                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeTeam(i)} aria-label="Quitar equipo">
                                    ×
                                  </Button>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <PlayerSlot
                                    label="Jugador 1"
                                    value={t.player1}
                                    players={players}
                                    onPick={(name) => updatePlayer(i, 1, name)}
                                    onType={(name) => updatePlayer(i, 1, name)}
                                  />
                                  <PlayerSlot
                                    label="Jugador 2"
                                    value={t.player2}
                                    players={players}
                                    onPick={(name) => updatePlayer(i, 2, name)}
                                    onType={(name) => updatePlayer(i, 2, name)}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
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
