import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import {
  Poem,
  allTags,
  createPoem,
  deletePoem,
  download,
  filterByTags,
  formatDate,
  loadPoems,
  normalizeTags,
  preview,
  savePoems,
  searchPoems,
  sortPoems,
  SortOption,
  toJSON,
  updatePoem,
} from "@/lib/poems";
import { format } from "date-fns";
import { ArrowDownAZ, ArrowDownWideNarrow, Filter, MoreHorizontal, Plus, Search, Star, StarOff, Upload, Download } from "lucide-react";

export default function Index() {
  const navigate = useNavigate();
  const [poems, setPoems] = useState<Poem[]>(() => loadPoems());
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    savePoems(poems);
  }, [poems]);

  const tags = useMemo(() => allTags(poems), [poems]);

  const filtered = useMemo(() => {
    const base = sortPoems(filterByTags(searchPoems(poems, query), selectedTags), sort);
    return base;
  }, [poems, query, selectedTags, sort]);

  const paginated = filtered.slice(0, page * pageSize);
  const canLoadMore = paginated.length < filtered.length;

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Poem | null>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") || "").trim();
    const content = String(fd.get("content") || "").trim();
    const date = String(fd.get("date") || format(new Date(), "yyyy-MM-dd"));
    const tags = normalizeTags(String(fd.get("tags") || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean));
    const draft = fd.get("draft") === "on";
    if (!title || !content) return;

    if (editing) {
      setPoems((prev) => updatePoem(prev, editing.id, { title, content, date, tags, draft }));
    } else {
      const poem = createPoem({ title, content, date, tags, draft });
      setPoems((prev) => [poem, ...prev]);
    }
    setOpenForm(false);
    setEditing(null);
    e.currentTarget.reset();
  };

  const toggleFavorite = (p: Poem) => {
    setPoems((prev) => updatePoem(prev, p.id, { favorite: !p.favorite }));
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this poem? This cannot be undone.")) return;
    setPoems((prev) => deletePoem(prev, id));
  };

  const exportJSON = () => download(`angelhub-poems-${Date.now()}.json`, toJSON(poems), "application/json");

  const importRef = useRef<HTMLInputElement>(null);
  const onImport = async (file: File) => {
    const text = await file.text();
    try {
      const obj = JSON.parse(text);
      const imported: Poem[] = Array.isArray(obj) ? obj : Array.isArray(obj.poems) ? obj.poems : [];
      if (!imported.length) throw new Error("No poems found");
      setPoems((prev) => {
        const map = new Map<string, Poem>(prev.map((p) => [p.id, p]));
        for (const p of imported) map.set(p.id, p);
        return sortPoems(Array.from(map.values()), sort);
      });
      alert(`Imported ${imported.length} poems`);
    } catch (err) {
      alert("Failed to import. Ensure it's a JSON export from angelhub.");
    }
  };

  return (
    <main className="container py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, tag, or content"
                className="pl-9"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest"><div className="flex items-center gap-2"><ArrowDownWideNarrow className="h-4 w-4" /> Newest</div></SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="alpha"><div className="flex items-center gap-2"><ArrowDownAZ className="h-4 w-4" /> A–Z</div></SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.currentTarget.value = "";
            }} />
            <Button variant="outline" onClick={exportJSON} className="gap-2"><Download className="h-4 w-4" /> JSON</Button>
            <Dialog open={openForm} onOpenChange={(v) => { setOpenForm(v); if (!v) setEditing(null); }}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" /> New Poem</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit poem" : "Add a new poem"}</DialogTitle>
                  <DialogDescription>Title, content, date, and tags (comma separated). Optionally mark as draft.</DialogDescription>
                </DialogHeader>
                <form className="grid gap-3" onSubmit={onSubmit}>
                  <Input name="title" placeholder="Title" defaultValue={editing?.title} required />
                  <Textarea name="content" placeholder="Poem content" defaultValue={editing?.content} required rows={8} />
                  <div className="flex gap-3">
                    <Input name="date" type="date" className="w-40" defaultValue={editing?.date || format(new Date(), "yyyy-MM-dd")} />
                    <Input name="tags" placeholder="Tags (comma separated)" defaultValue={editing?.tags.join(", ") || ""} />
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" name="draft" defaultChecked={!!editing?.draft} /> Draft
                  </label>
                  <DialogFooter>
                    <div className="flex-1" />
                    <Button type="button" variant="outline" onClick={() => importRef.current?.click()} className="gap-2"><Upload className="h-4 w-4" /> Import</Button>
                    <Button type="submit">{editing ? "Save Changes" : "Create Poem"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Filter className="h-4 w-4" /> Filter:</div>
            {tags.map((t) => {
              const active = selectedTags.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => setSelectedTags((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])}
                  className={`rounded-full border px-3 py-1 text-xs transition ${active ? "bg-primary text-primary-foreground border-transparent" : "hover:bg-accent"}`}
                >
                  #{t}
                </button>
              );
            })}
            {selectedTags.length > 0 && (
              <button className="text-xs underline ml-2 text-muted-foreground" onClick={() => setSelectedTags([])}>Clear</button>
            )}
          </div>
        )}

        <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginated.map((p) => (
            <Card key={p.id} className="group relative overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight line-clamp-1">{p.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(p.date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className={`rounded-full p-2 transition ${p.favorite ? "text-yellow-500" : "text-muted-foreground hover:text-foreground"}`}
                      onClick={() => toggleFavorite(p)}
                      aria-label={p.favorite ? "Unfavorite" : "Favorite"}
                    >
                      {p.favorite ? <Star className="h-4 w-4 fill-yellow-500" /> : <StarOff className="h-4 w-4" />}
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label="Actions"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditing(p); setOpenForm(true); }}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/poem/${p.id}`)}>Open</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(p.id)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{preview(p.content, 220)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {p.tags.map((t) => (
                    <Badge key={t} variant="secondary">{t}</Badge>
                  ))}
                </div>
                <div className="mt-4">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/poem/${p.id}`)}>Read</Button>
                </div>
              </CardContent>
              {p.draft && (
                <div className="absolute right-2 top-2 rounded-md bg-yellow-100 text-yellow-900 text-[10px] px-2 py-0.5 dark:bg-yellow-900 dark:text-yellow-100">Draft</div>
              )}
            </Card>
          ))}
        </section>

        <div className="mt-8 flex justify-center">
          {canLoadMore ? (
            <Button variant="secondary" onClick={() => setPage((x) => x + 1)}>Load more</Button>
          ) : (
            <p className="text-sm text-muted-foreground">Showing {paginated.length} of {filtered.length} poems</p>
          )}
        </div>

        {poems.length === 0 && (
          <EmptyState onCreate={() => setOpenForm(true)} />)
        }

        <footer className="mt-10 py-8 text-center text-xs text-muted-foreground">
          <div className="flex items-center justify-center gap-2">
            <span>© {new Date().getFullYear()} angelhub</span>
            <span>·</span>
            <span>Modern poetry manager</span>
          </div>
        </footer>
    </main>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-16 flex flex-col items-center justify-center gap-4 text-center">
      <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-fuchsia-500 opacity-80" />
      <h2 className="text-xl font-semibold">Start your poetry collection</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Add your first poem. Use tags like Love, Nature, Life to organize. Favorites help you pin special pieces.
      </p>
      <Button onClick={onCreate} className="gap-2"><Plus className="h-4 w-4" /> New Poem</Button>
    </div>
  );
}
