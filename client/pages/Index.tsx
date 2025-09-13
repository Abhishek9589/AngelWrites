import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
  filterByTags,
  formatDate,
  loadPoems,
  normalizeTags,
  preview,
  savePoems,
  searchPoems,
  sortPoems,
  SortOption,
  updatePoem,
} from "@/lib/poems";
import { format } from "date-fns";
import { ArrowDownAZ, ArrowDownWideNarrow, Filter, MoreHorizontal, Plus, Search, Star, StarOff, Upload } from "lucide-react";
import * as mammoth from "mammoth";

export default function Index() {
  const [poems, setPoems] = useState<Poem[]>(() => loadPoems());
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 9;

  useEffect(() => {
    savePoems(poems);
  }, [poems]);

  const tags = useMemo(() => allTags(poems), [poems]);

  const filtered = useMemo(() => {
    const base = sortPoems(filterByTags(searchPoems(poems, query), selectedTags), sort);
    return base;
  }, [poems, query, selectedTags, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Poem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
    setDeleteId(id);
  };
  const confirmDelete = () => {
    if (!deleteId) return;
    setPoems((prev) => deletePoem(prev, deleteId));
    setDeleteId(null);
  };


  const importRef = useRef<HTMLInputElement>(null);
  const onImportFiles = async (files: FileList) => {
    const arr = Array.from(files);
    let jsonCount = 0;
    const created: Poem[] = [];
    const importedMap = new Map<string, Poem>();
    for (const file of arr) {
      const isJSON = file.type === "application/json" || /\.json$/i.test(file.name);
      const isDOCX = /\.docx$/i.test(file.name);
      if (isJSON) {
        try {
          const text = await file.text();
          const obj = JSON.parse(text);
          const imported: Poem[] = Array.isArray(obj) ? obj : Array.isArray(obj.poems) ? obj.poems : [];
          imported.forEach((p) => importedMap.set(p.id, p));
          jsonCount += imported.length;
        } catch {
          alert(`Failed to import JSON file: ${file.name}`);
        }
      } else if (isDOCX) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          const title = file.name.replace(/\.docx$/i, "");
          const poem = createPoem({
            title,
            content: (result.value || "").trim(),
            date: format(new Date(), "yyyy-MM-dd"),
            tags: [],
          });
          created.push(poem);
        } catch {
          alert(`Failed to import DOCX file: ${file.name}`);
        }
      }
    }
    if (jsonCount === 0 && created.length === 0) {
      alert("No supported files imported. Please select .json or .docx files.");
      return;
    }
    setPoems((prev) => {
      const map = new Map<string, Poem>(prev.map((p) => [p.id, p]));
      importedMap.forEach((p) => map.set(p.id, p));
      const next = Array.from(map.values());
      const combined = created.length ? [...created, ...next] : next;
      return sortPoems(combined, sort);
    });
    const parts: string[] = [];
    if (jsonCount) parts.push(`JSON: ${jsonCount}`);
    if (created.length) parts.push(`DOCX: ${created.length}`);
    alert(`Imported ${parts.join(" and ")}`);
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
            <Select value={sort} onValueChange={(v) => { setSort(v as SortOption); setPage(1); }}>
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
            <input ref={importRef} type="file" accept=".docx,application/json" multiple className="hidden" onChange={(e) => {
              const fs = e.target.files;
              if (fs && fs.length) onImportFiles(fs);
              e.currentTarget.value = "";
            }} />
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
                  onClick={() => { setSelectedTags((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]); setPage(1); }}
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
                        <DropdownMenuItem asChild><Link to={`/poem/${p.id}`}>Open</Link></DropdownMenuItem>
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
                  <Link to={`/poem/${p.id}`}><Button variant="outline" size="sm">Read</Button></Link>
                </div>
              </CardContent>
              {p.draft && (
                <div className="absolute right-2 top-2 rounded-md bg-yellow-100 text-yellow-900 text-[10px] px-2 py-0.5 dark:bg-yellow-900 dark:text-yellow-100">Draft</div>
              )}
            </Card>
          ))}
        </section>

        <div className="mt-8 flex flex-col items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {filtered.length > 0 ? `Showing ${start + 1}–${Math.min(start + paginated.length, filtered.length)} of ${filtered.length} poems` : "Showing 0 of 0 poems"}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
            <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
          </div>
        </div>

        {poems.length === 0 && (
          <EmptyState onCreate={() => setOpenForm(true)} />)
        }

        <Dialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete poem</DialogTitle>
              <DialogDescription>Are you sure you want to delete this poem? This action cannot be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
