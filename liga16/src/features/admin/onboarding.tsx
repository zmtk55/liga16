"use client";

import { useState } from "react";
import { db } from "@/lib/data";
import type { PlayerProfile } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";

const STEPS = [
  { id: "venue", label: "Sede" },
  { id: "players", label: "Jugadores" },
  { id: "teams", label: "Equipos" },
  { id: "tournament", label: "Torneo" },
  { id: "review", label: "Revisión" },
];

export default function AdminOnboarding() {
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [venue, setVenue] = useState({ name: "Club Pádel Reforma", address: "Av. Reforma 245, Col. Juárez", phone: "+52 55 1234 0001" });
  const [playersCount, setPlayersCount] = useState<string>("12");
  const [teamsCount, setTeamsCount] = useState<string>("4");
  const [tournamentName, setTournamentName] = useState("Copa Liga16 Apertura 2026");

  async function finish() {
    try {
      await db.updateClub("club-padel-reforma", {
        name: venue.name,
        address: venue.address,
        phone: venue.phone,
      });
      const existing = await db.listPlayers();
      if (existing.length === 0) {
        const names = ["Diego Fuentes", "Martín Rojas", "Sofía Camacho", "Andrés Valle", "Lucía Herrera", "Emilio Garza"];
        for (const name of names) {
          await db.createPlayer({
            display_name: name,
            username: name.toLowerCase().replace(/\s+/g, ""),
            sex: name.includes("Sofía") || name.includes("Lucía") ? "F" : "M",
            declared_level: 4.0 + Math.random() * 1.5,
            dominant_hand: Math.random() > 0.5 ? "right" : "left",
            preferred_position: ["drive", "reves", "both"][Math.floor(Math.random() * 3)] as PlayerProfile["preferred_position"],
            city: "Ciudad de México",
            state: "CDMX",
            is_public: true,
          } as Omit<PlayerProfile, "id" | "user_id">);
        }
      }
      setCompleted(true);
      toast.success("¡Onboarding completado!");
    } catch (e) {
      toast.error((e as Error).message ?? "Error en onboarding");
    }
  }

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <Check className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold">¡Configuración completa!</h2>
        <p className="text-muted-foreground max-w-md">
          Tu liga está lista para jugar. Puedes gestionar todo desde el panel de administración.
        </p>
        <Button onClick={() => window.location.reload()}>Ir al dashboard</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <header className="text-center space-y-2">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold">Configuración inicial</h1>
        <p className="text-muted-foreground">Completa estos pasos para tener Liga16 listo</p>
      </header>

      <div className="flex items-center justify-between">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              i < step ? "bg-emerald-600 text-white" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`ml-2 hidden text-xs font-medium sm:block ${i === step ? "text-foreground" : "text-muted-foreground"}`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`mx-2 h-0.5 w-4 sm:w-8 rounded ${i < step ? "bg-emerald-600" : "bg-muted"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="min-h-[200px]">
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Sede</h2>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">🏢 Información básica del club</p>
              <p>Estos datos aparecerán en tu perfil público y en la documentación de la liga.</p>
            </div>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Nombre del club</Label>
                <Input value={venue.name} onChange={(e) => setVenue((v) => ({ ...v, name: e.target.value }))} placeholder="Ej: Club Pádel Reforma" />
              </div>
              <div className="grid gap-1.5">
                <Label>Dirección</Label>
                <Input value={venue.address} onChange={(e) => setVenue((v) => ({ ...v, address: e.target.value }))} placeholder="Ej: Av. Reforma 245, Col. Juárez" />
              </div>
              <div className="grid gap-1.5">
                <Label>Teléfono</Label>
                <Input value={venue.phone} onChange={(e) => setVenue((v) => ({ ...v, phone: e.target.value }))} placeholder="Ej: +52 55 1234 0001" />
              </div>
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Jugadores</h2>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">👥 ¿Cuántos jugadores participarán?</p>
              <p>Esto te ayuda a planificar la liga. Puedes agregar o editar jugadores después.</p>
            </div>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Cantidad estimada</Label>
                <Input type="number" min="1" value={playersCount} onChange={(e) => setPlayersCount(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Ejemplos comunes:</Label>
                <div className="flex gap-2 flex-wrap">
                  <Button type="button" variant="outline" size="sm" onClick={() => setPlayersCount("8")}>8 jugadores</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPlayersCount("12")}>12 jugadores</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPlayersCount("16")}>16 jugadores</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPlayersCount("24")}>24 jugadores</Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Puedes agregar más después desde Administración → Jugadores.
              </p>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Equipos</h2>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">🏈 ¿Cuántos equipos competirán?</p>
              <p>Se crearán automáticamente con nombres genéricos (Equipo 1, Equipo 2...) que después puedes editar.</p>
            </div>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Cantidad de equipos</Label>
                <Input type="number" min="2" value={teamsCount} onChange={(e) => setTeamsCount(e.target.value)} />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" onClick={() => setTeamsCount("2")}>2 equipos</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setTeamsCount("4")}>4 equipos</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setTeamsCount("8")}>8 equipos</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Puedes crear más desde Administración → Equipos.
              </p>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Primer torneo</h2>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">🏆 Configura tu primer torneo</p>
              <p>Se creará con formato grupos + eliminación, inscripciones abiertas por categoría.</p>
            </div>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Nombre del torneo</Label>
                <Input value={tournamentName} onChange={(e) => setTournamentName(e.target.value)} placeholder="Ej: Copa Liga16 Apertura 2026" />
              </div>
              <p className="text-xs text-muted-foreground">
                El registro será de $800 MXN por pareja. Puedes editar todo después desde Administración → Torneos.
              </p>
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Resumen</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm font-semibold">Sede</p>
                <p className="text-2xl font-bold">{venue.name}</p>
                <p className="text-xs text-muted-foreground">{venue.address}</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm font-semibold">Jugadores estimados</p>
                <p className="text-2xl font-bold">{playersCount}</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm font-semibold">Equipos</p>
                <p className="text-2xl font-bold">{teamsCount}</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm font-semibold">Torneo</p>
                <p className="text-lg font-bold truncate">{tournamentName}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
            Siguiente <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={finish}>
            <Check className="h-4 w-4 mr-1" /> Completar
          </Button>
        )}
      </div>
    </div>
  );
}
