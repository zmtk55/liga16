"use client";

import { createLibrary, defineComponent, useRenderNode } from "@openuidev/react-lang";
import { z } from "zod/v4";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { CheckCircle, AlertTriangle, MinusCircle } from "lucide-react";

/* ---------- Componentes base ---------- */

const Stack = defineComponent({
  name: "Stack",
  description: "Contenedor vertical de componentes",
  props: z.object({ children: z.any().optional().describe("Contenido del stack") }),
  component: function StackContent({ props: { children } }) {
    const renderNode = useRenderNode();
    return <div className="space-y-4">{renderNode(children)}</div>;
  },
});

const VerdictBadge = defineComponent({
  name: "VerdictBadge",
  description: "Badge de veredicto con tono y palabra clave",
  props: z.object({
    tone: z.enum(["pass", "depends", "out"]).describe("Tono del veredicto"),
    word: z.string().describe("Palabra del veredicto"),
  }),
  component: ({ props: { tone, word } }) => {
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
    rows: z.array(z.object({ pos: z.number(), name: z.string(), pct: z.number() })).describe("Filas de la tabla"),
    highlightPos: z.number().optional().describe("Posición a resaltar"),
  }),
  component: ({ props: { rows, highlightPos } }) => {
    const fmtPct = (value: number | null | undefined): string => {
      if (value == null || !Number.isFinite(value)) return "-";
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
              <TableCell className="text-right font-mono">{fmtPct(r.pct)}</TableCell>
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
  component: ({ props: { label, value, sub } }) => (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
      {sub && <span className="text-muted-foreground text-xs">{sub}</span>}
    </div>
  ),
});

const MatchHint = defineComponent({
  name: "MatchHint",
  description: "Párrafos de la respuesta de clasificación calculada con datos reales",
  props: z.object({
    text: z.string().describe("Respuesta calculada, sin ejemplos inventados"),
  }),
  component: ({ props: { text } }) => (
    <div className="space-y-3 break-words">
      {text.split("\n\n").filter(Boolean).map((paragraph, index) => (
        <p key={index} className="max-w-[72ch] text-sm leading-relaxed">
          {paragraph.charAt(0).toUpperCase() + paragraph.slice(1)}
        </p>
      ))}
    </div>
  ),
});

export const openUILibrary = createLibrary({
  root: "Stack",
  components: [Stack, VerdictBadge, StandingsTable, MetricRow, MatchHint] as const,
});

export type OpenUIComponents = typeof openUILibrary.components;
