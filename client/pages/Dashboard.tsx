import { useMemo, useState } from "react";
import { loadPoems, computeStats, Poem } from "@/lib/poems";
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Tag as TagIcon, FileText, ClipboardList } from "lucide-react";

export default function Dashboard() {
  const [poems] = useState(() => loadPoems());
  const stats = useMemo(() => computeStats(poems), [poems]);
  const topTags = stats.tagCounts.slice(0, 10);
  const favorites = useMemo(() => poems.filter((p) => p.favorite).length, [poems]);
  const drafts = useMemo(() => poems.filter((p) => p.draft).length, [poems]);
  const recent = useMemo(() => [...poems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5), [poems]);

  return (
    <div className="container py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold gradient-text">Dashboard</h1>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total poems" value={stats.total} icon={<FileText className="h-5 w-5" />} />
        <StatCard title="Favorites" value={favorites} icon={<Star className="h-5 w-5" />} />
        <StatCard title="Drafts" value={drafts} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard title="Tags" value={stats.tagCounts.length} icon={<TagIcon className="h-5 w-5" />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
            <CardDescription>Poems created per month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Tags</CardTitle>
            <CardDescription>Most used across your poems</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {topTags.length === 0 && (
                <div className="text-sm text-muted-foreground">No tags yet</div>
              )}
              {topTags.map((t) => (
                <Badge key={t.tag} variant="secondary" className="flex items-center gap-1">
                  <TagIcon className="h-3.5 w-3.5" /> {t.tag}
                  <span className="opacity-70">{t.count}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent poems</CardTitle>
          <CardDescription>Your latest additions</CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 && (
            <div className="text-sm text-muted-foreground">No poems yet</div>
          )}
          <ul className="divide-y">
            {recent.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(p.date).toLocaleDateString()}</p>
                </div>
                {p.favorite && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-extrabold">{value}</div>
      </CardContent>
    </Card>
  );
}
