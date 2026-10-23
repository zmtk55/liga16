"use client";

import { createLibrary, defineComponent } from "@openuidev/react-lang";
import { z } from "zod/v4";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { CheckCircle, AlertTriangle, MinusCircle } from "lucide-react";

/* ---------- Componentes base ---------- */

const Stack = defineComponent({
  name: "Stack",
  description: "Contenedor vertical de componentes",
  props: z.object({ children: z.any().optional().describe("Contenido del stack") }),
  component: ({ children }: { children?: React.ReactNode }) => <div className="space-y-4">{children}</div>,
});

const VerdictBadge = defineComponent({
  name: "VerdictBadge",
  description: "Badge de veredicto con tono y palabra clave",
  props: z.object({
    tone: z.enum(["pass", "depends", "out"]).describe("Tono del veredicto"),
    word: z.string().describe("Palabra del veredicto"),
  }),
  component: ({ tone, word }: { tone: "pass" | "depends" | "out"; word: string }) => {
    const icons = { pass: CheckCircle, depends: MinusCircle, out: AlertTriangle };
    const colors = {
      pass: "bg-emerald-100 text-emerald-800 border-emerald-200",
      depends: "bg-amber-100 text-amber-800 border-amber-200",
      out: "bg-rose-100 text-rose-800 border-rose-200",
    };
    const Icon = icons[tone];
    return (
      <Badge className={`gap-1.5 ${colors[tone]} border`}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {word}
      </Badge>
    );
  },
});

const StandingsTable = defineComponent({
  name: "StandingsTable",
  description: "Tabla de posiciones con formato de porcentaje",
  props: z.object({
    rows: z
      .array(z.object({ pos: z.number(), name: z.string(), pct: z.number() }))
      .describe("Filas de la tabla"),
    highlightPos: z.number().optional().describe("Posición a resaltar"),
  }),
  component: ({ rows, highlightPos }: { rows: Array<{ pos: number; name: string; pct: number }>; highlightPos?: number }) => {
    const fmtPct = (value: number | null | undefined): string => {
      if (value == null || !Number.isFinite(value)) return "—";
      const rounded = Math.round(value * 10) / 10;
      return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)}%`;
    };
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Pos</TableHead>
            <TableHead>Pareja</TableHead>
            <TableHead className="w-28 text-right">Rendimiento</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.pos} className={r.pos === highlightPos ? "bg-primary/5 font-medium" : ""}>
              <TableCell>{r.pos}°</TableCell>
              <TableCell>{r.name}</TableCell>
              <TableCell className="text-right font-mono">{fmtPct(r.pct)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  },
});

const MetricRow = defineComponent({
  name: "MetricRow",
  description: "Fila con etiqueta, valor y subtexto opcional",
  props: z.object({
    label: z.string().describe("Etiqueta"),
    value: z.string().describe("Valor"),
    sub: z.string().optional().describe("Subtexto opcional"),
  }),
  component: ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
      {sub && <span className="text-muted-foreground text-xs">{sub}</span>}
    </div>
  ),
});

const MatchHint = defineComponent({
  name: "MatchHint",
  description: "Texto de sugerencia para el usuario — PERSONALIZADO POR EQUIPO",
  props: z.object({
    text: z.string().describe("Texto del hint"),
    teamName: z.string().optional().describe("Nombre del equipo actual"),
    opponent: z.string().optional().describe("Nombre del rival simulado"),
    result: z.enum(["win", "loss", "draw"]).optional().describe("Resultado simulado"),
  }),
  component: ({ text, teamName, opponent, result }: { text: string; teamName?: string; opponent?: string; result?: "win" | "loss" | "draw" }) => (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <p className="text-sm font-medium">{teamName ? `Equipo: ${teamName}` : "Simulación"}</p>
      {opponent && <p className="text-sm text-muted-foreground">vs {opponent}</p>}
      <p className="text-sm text-muted-foreground italic">{text}</p>
      {result && (
        <div className="flex gap-2 mt-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
            result === "win" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
            result === "loss" ? "bg-rose-100 text-rose-800 border-rose-200" :
            "bg-amber-100 text-amber-800 border-amber-200"
          }`}>
            {result === "win" ? "Ganó" : result === "loss" ? "Perdió" : "Empate"}
          </span>
          {teamName && <span className="text-xs text-muted-foreground">• Ejemplo real: {teamName} vs {opponent}</span>}
        </div>
      )}
    </div>
  ),
});

export const openUILibrary = createLibrary({
  root: "Stack",
  components: [Stack, VerdictBadge, StandingsTable, MetricRow, MatchHint] as const,
});

export type OpenUIComponents = typeof openUILibrary.components;