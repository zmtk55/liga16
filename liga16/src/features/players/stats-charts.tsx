// Gráficas del dashboard del jugador: récord (donut), juegos y forma reciente.
// Datos derivados del historial (PlayerRecord), nunca de player_cards.
// Colores como hsl(var(--token)) para que el SVG siga el tema en vivo.
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ReactNode } from "react";
import type { PlayerRecord } from "@/lib/records";

const C = {
  ok: "hsl(var(--success))",
  bad: "hsl(var(--destructive)/0.6)",
  main: "hsl(var(--primary))",
  mute: "hsl(var(--muted-foreground)/0.35)",
  fg: "hsl(var(--foreground))",
  muted: "hsl(var(--muted-foreground))",
};

function ChartTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { label: string; hint?: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-2.5 py-1.5 text-xs shadow-lg">
      <p className="font-semibold">{p.label}</p>
      {p.hint && <p className="text-muted-foreground">{p.hint}</p>}
    </div>
  );
}

function ChartBox({ title, extra, children }: { title: string; extra?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
        {extra && <span className="text-xs font-black tabular-nums">{extra}</span>}
      </div>
      {children}
    </div>
  );
}

export function PlayerStatsCharts({ record }: { record: PlayerRecord }) {
  const pct = record.played ? Math.round((record.won / record.played) * 100) : 0;

  const ring = [
    { key: "Victorias", value: record.won, fill: C.ok },
    { key: "Derrotas", value: record.lost, fill: C.mute },
  ].filter((d) => d.value > 0);

  const juegos = [
    { label: "A favor", v: record.setsFor, fill: C.main },
    { label: "En contra", v: record.setsAgainst, fill: C.mute },
  ];

  const formN = record.form.slice(-12);
  const form = formN.map((g, i) => ({
    label: `Partido ${record.form.length - formN.length + i + 1}`,
    hint: g === "G" ? "Ganó" : "Perdió",
    v: 1,
    fill: g === "G" ? C.ok : C.bad,
  }));

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <ChartBox title="Récord" extra={`${record.won}–${record.lost}`}>
        <div className="relative mx-auto h-[170px] max-w-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={ring}
                dataKey="value"
                nameKey="key"
                innerRadius="64%"
                outerRadius="92%"
                paddingAngle={3}
                stroke="none"
                startAngle={90}
                endAngle={-270}
              >
                {ring.map((d) => (
                  <Cell key={d.key} fill={d.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl font-black tabular-nums">{pct}%</span>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">efectividad</span>
          </div>
        </div>
        <div className="mt-1 flex justify-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: C.ok }} /> {record.won} PG
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: C.mute }} /> {record.lost} PP
          </span>
        </div>
      </ChartBox>

      <ChartBox title="Juegos" extra={`${record.setsFor}–${record.setsAgainst}`}>
        <div className="h-[170px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={juegos} layout="vertical" margin={{ top: 4, right: 40, bottom: 0, left: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                width={74}
                tick={{ fontSize: 12, fill: C.muted }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTip />} cursor={{ fill: "hsl(var(--muted)/0.5)" }} />
              <Bar dataKey="v" barSize={18} radius={[0, 9, 9, 0]}>
                {juegos.map((d) => (
                  <Cell key={d.label} fill={d.fill} />
                ))}
                <LabelList dataKey="v" position="right" style={{ fontSize: 12, fontWeight: 700, fill: C.fg }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartBox>

      <ChartBox title="Forma" extra={form.length ? `últimos ${form.length}` : undefined}>
        <div className="h-[170px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={form} margin={{ top: 4, right: 6, bottom: 0, left: -18 }} barCategoryGap="20%">
              <XAxis dataKey="label" hide />
              <YAxis hide domain={[0, 1]} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "hsl(var(--muted)/0.5)" }} />
              <Bar dataKey="v" barSize={16} radius={[5, 5, 0, 0]}>
                {form.map((d, i) => (
                  <Cell key={i} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-center text-xs uppercase tracking-widest text-muted-foreground">
          más antiguo ← → más reciente
        </p>
      </ChartBox>
    </div>
  );
}
