import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Props {
  title: string;
  data: Record<string, number>;
  color?: string;
}

export function DistributionChart({ title, data, color = "#6366f1" }: Props) {
  const rows = Object.entries(data)
    .filter(([, value]) => value !== 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  return (
    <section className="card chart-card">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="muted">Sin datos todavía.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 32)}>
          <BarChart data={rows} layout="vertical" margin={{ left: 24, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" allowDecimals={false} stroke="var(--muted)" />
            <YAxis type="category" dataKey="name" width={140} stroke="var(--muted)" />
            <Tooltip
              contentStyle={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                borderRadius: "var(--r-sm)",
              }}
              cursor={{ fill: "var(--accent-dim)" }}
            />
            <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
