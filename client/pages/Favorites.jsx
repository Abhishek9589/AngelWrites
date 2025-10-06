import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadPoems, savePoems, updatePoem, formatDate, preview } from "@/lib/poems";
import { Star, StarOff } from "lucide-react";
import { Link } from "react-router-dom";

export default function Favorites() {
  const [poems, setPoems] = useState(() => loadPoems());
  const [query, setQuery] = useState("");

  useEffect(() => { savePoems(poems); }, [poems]);

  const favorites = useMemo(() => poems.filter((p) => p.favorite), [poems]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return favorites;
    return favorites.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      p.content.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [favorites, query]);

  const toggleFavorite = (id) => setPoems((prev) => prev.map((it) => (it.id === id ? { ...it, favorite: false } : it)));

  return (
    <div className="container py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-extrabold gradient-text">Favorites</h1>
        <div className="relative w-full sm:w-72">
          <Input type="search" placeholder="Search favorites" data-variant="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <Card
            key={p.id}
            className={`group relative overflow-hidden ${p.type === "book" ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-400/30 dark:border-amber-300/15" : "bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-400/30 dark:border-indigo-300/15"}`}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight line-clamp-1">{p.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(p.date)}</p>
                </div>
                <button
                  className={`rounded-full p-2 transition text-yellow-500`}
                  onClick={() => toggleFavorite(p.id)}
                  aria-label="Remove from favorites"
                >
                  <Star className="h-4 w-4 fill-yellow-500" />
                </button>
              </div>
              <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{preview(p.content, 220)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(() => { const g = (p.tags || []).find((t) => t.toLowerCase().startsWith("genre:")); return g ? <Badge key="__genre" variant="secondary">{g.slice(6).trim()}</Badge> : null; })()}
                {p.tags.filter((t) => !t.toLowerCase().startsWith("genre:")).map((t) => (
                  <Badge key={t} variant="secondary">{t}</Badge>
                ))}
              </div>
              <div className="mt-4">
                <Link to={`${p.tags.some((t) => t.toLowerCase().startsWith("genre:")) ? "/book" : "/poem"}/${p.id}`}><Button variant="outline" size="sm">Read</Button></Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {filtered.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">No favorite poems found.</p>
      )}
    </div>
  );
}
