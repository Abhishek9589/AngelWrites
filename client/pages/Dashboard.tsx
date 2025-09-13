import { useMemo, useState } from "react";
import { loadPoems, computeStats } from "@/lib/poems";
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar, CartesianGrid } from "recharts";

export default function Dashboard() {
  const [poems] = useState(() => loadPoems());
  const stats = useMemo(() => computeStats(poems), [poems]);
  const topTags = stats.tagCounts.slice(0, 8);

  return (
    <div className="container py-10">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        <div className="rounded-lg border p-6">
          <div className="text-sm text-muted-foreground">Total poems</div>
          <div className="mt-2 text-3xl font-extrabold">{stats.total}</div>
        </div>
        <div className="rounded-lg border p-6 sm:col-span-2">
          <div className="text-sm text-muted-foreground">Most used tags</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {topTags.length === 0 && (
              <div className="text-sm text-muted-foreground">No tags yet</div>
            )}
            {topTags.map((t) => (
              <span key={t.tag} className="rounded-full border px-3 py-1 text-xs">{t.tag} <span className="opacity-60">· {t.count}</span></span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border p-6">
        <div className="text-sm text-muted-foreground">Timeline (poems per month)</div>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.timeline}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-40" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} angle={-20} height={50} dy={10} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ fill: "hsl(var(--accent))" }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
