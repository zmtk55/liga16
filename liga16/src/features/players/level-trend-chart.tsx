import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function LevelTrendChart({ data }: { data: { i: number; v: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ left: -28, right: 8 }}>
        <XAxis dataKey="i" hide />
        <YAxis domain={[0, "auto"]} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="v"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}