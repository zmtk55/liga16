// Tendencia de juegos por partido: área con degradado del tema y tooltip propio.
// (Antes usaba var(--chart-1), que no existe en el tema: salía sin color.)
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function LevelTrendChart({ data }: { data: { i: number; v: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ left: -18, right: 6, top: 6, bottom: 0 }}>
        <defs>
          <linearGradient id="lvlFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="i" hide />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            fontSize: 12,
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
            color: "hsl(var(--foreground))",
          }}
          labelFormatter={() => "Partido"}
        />
        <Area
          type="monotone"
          dataKey="v"
          stroke="hsl(var(--primary))"
          strokeWidth={2.5}
          fill="url(#lvlFill)"
          dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }}
          activeDot={{ r: 4.5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
