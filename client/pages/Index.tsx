import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
const RichEditor = lazy(() => import("@/components/RichEditor"));
import { Badge } from "@/components/ui/badge";
import { LoadingScreen } from "@/components/ui/loading";
import { POET_SARCASTIC_MESSAGES } from "@/lib/messages";
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
  updatePoemWithVersion,
} from "@/lib/poems";
import { format, parse, isValid } from "date-fns";
import { ArrowDownAZ, ArrowUpAZ, ArrowDownWideNarrow, ArrowUpWideNarrow, Filter, MoreHorizontal, Plus, Search, Star, StarOff, Upload } from "lucide-react";
import { toast } from "sonner";

export default function Index() {
  const STORAGE_KEYS = { query: "poems:query", sort: "poems:sort" } as const;
  const [poems, setPoems] = useState<Poem[]>(() => loadPoems());
  const [query, setQuery] = useState<string>(() => localStorage.getItem(STORAGE_KEYS.query) ?? "");
  const [sort, setSort] = useState<SortOption>(() => {
    const s = localStorage.getItem(STORAGE_KEYS.sort) as SortOption | null;
    return s === "newest" || s === "oldest" || s === "alpha" || s === "ztoa" ? s : "newest";
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 9;

  useEffect(() => {
    savePoems(poems);
  }, [poems]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.query, query);
  }, [query]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sort, sort);
  }, [sort]);

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
  const [writeOpen, setWriteOpen] = useState(false);
  const [writingPoem, setWritingPoem] = useState<Poem | null>(null);
  const [writingContent, setWritingContent] = useState("");
  const [hasImported, setHasImported] = useState(false);
  const [importing, setImporting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Controlled fields for Add/Edit dialog
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formTags, setFormTags] = useState("");
  const [formDraft, setFormDraft] = useState(false);

  useEffect(() => {
    if (openForm) {
      setFormTitle(editing?.title ?? "");
      setFormDate(editing?.date || format(new Date(), "yyyy-MM-dd"));
      setFormTags(editing ? editing.tags.join(", ") : "");
      setFormDraft(!!editing?.draft);
      setTimeout(() => titleRef.current?.focus(), 0);
    }
  }, [openForm, editing]);

  const saveWriting = () => {
    if (writingPoem) {
      setPoems((prev) => updatePoemWithVersion(prev, writingPoem.id, { content: writingContent }, { snapshot: true }));
    }
    setWriteOpen(false);
    setWritingPoem(null);
    setWritingContent("");
  };

  // Autosave while writing (debounced)
  useEffect(() => {
    if (!writeOpen || !writingPoem) return;
    const t = window.setTimeout(() => {
      if (writingContent !== writingPoem.content) {
        setPoems((prev) => updatePoemWithVersion(prev, writingPoem.id, { content: writingContent }, { snapshot: true }));
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [writeOpen, writingPoem, writingContent]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const metaS = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
      if (writeOpen) {
        if (metaS) {
          e.preventDefault();
          saveWriting();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setWriteOpen(false);
          setWritingPoem(null);
          setWritingContent("");
          return;
        }
      }

      if (openForm) {
        if (e.key === "Escape") {
          e.preventDefault();
          setOpenForm(false);
          setEditing(null);
          return;
        }
      }

      if (!openForm && !writeOpen) {
        const target = e.target as HTMLElement | null;
        const isTyping =
          !!target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            (target as HTMLElement).isContentEditable ||
            !!target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
        if (isTyping) return;

        if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === "/") {
          e.preventDefault();
          searchRef.current?.focus();
          return;
        }
        if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "n") {
          e.preventDefault();
          setOpenForm(true);
          return;
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openForm, writeOpen, writingPoem, writingContent]);

  const applyCreateOrEdit = (title: string, date: string, tags: string[], draft: boolean): boolean => {
    if (!title.trim()) {
      toast.error("Title is required");
      return false;
    }
    if (editing) {
      const nextTitle = title.trim();
      const prevTitle = editing.title;
      const prevDate = editing.date || "";
      const prevDraft = !!editing.draft;
      const prevTags = editing.tags || [];
      const sameTitle = nextTitle === prevTitle;
      const sameDate = (date || "") === prevDate;
      const sameDraft = !!draft === prevDraft;
      const sameTags = prevTags.length === tags.length && prevTags.every((t, i) => t === tags[i]);
      if (sameTitle && sameDate && sameDraft && sameTags) {
        toast.info("No changes have been made");
        return false;
      }
      setPoems((prev) => updatePoem(prev, editing.id, { title: nextTitle, date, tags, draft }));
      toast.success("Poem updated");
    } else {
      const poem = createPoem({ title: title.trim(), content: "", date, tags, draft });
      setPoems((prev) => [poem, ...prev]);
      if (!hasImported) {
        setWritingPoem(poem);
        setWritingContent("");
        setWriteOpen(true);
      }
      toast.success("Poem created");
    }
    setOpenForm(false);
    setEditing(null);
    return true;
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const title = (titleRef.current?.value ?? formTitle).toString();
    const date = (formDate || format(new Date(), "yyyy-MM-dd")).toString();
    const tags = normalizeTags(formTags.split(",").map((t) => t.trim()).filter(Boolean));
    const draft = formDraft;

    const ok = applyCreateOrEdit(title, date, tags, draft);
    if (ok) {
      setFormTitle("");
      setFormDate(format(new Date(), "yyyy-MM-dd"));
      setFormTags("");
      setFormDraft(false);
    }
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
    setImporting(true);
    try {
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
            toast.error(`Failed to import JSON file: ${file.name}`);
          }
        } else if (isDOCX) {
          try {
            const arrayBuffer = await file.arrayBuffer();
            const { docxArrayBufferToHTML } = await import("@/lib/docx");
            const html = await docxArrayBufferToHTML(arrayBuffer);
            const { sanitizeHtml } = await import("@/lib/html");
            const title = file.name.replace(/\.docx$/i, "");
            const poem = createPoem({
              title,
              content: sanitizeHtml(html),
              date: format(new Date(), "yyyy-MM-dd"),
              tags: [],
            });
            created.push(poem);
          } catch {
            toast.error(`Failed to import DOCX file: ${file.name}`);
          }
        }
      }
      if (jsonCount === 0 && created.length === 0) {
        toast.error("No supported files imported. Please select .json or .docx files.");
        return;
      }
      setPoems((prev) => {
        const map = new Map<string, Poem>(prev.map((p) => [p.id, p]));
        importedMap.forEach((p) => map.set(p.id, p));
        const next = Array.from(map.values());
        const combined = created.length ? [...created, ...next] : next;
        return sortPoems(combined, sort);
      });
      setHasImported(true);
      setOpenForm(false);
      setEditing(null);
      const parts: string[] = [];
      if (jsonCount) parts.push(`JSON: ${jsonCount}`);
      if (created.length) parts.push(`DOCX: ${created.length}`);
      toast.success(`Imported ${parts.join(" and ")}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <main className="container py-10 animate-in fade-in-0 slide-in-from-bottom-2 duration-700">
        <section className="relative overflow-hidden rounded-3xl p-8 md:p-12 mb-6 glass">
          <div className="relative z-10">
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight gradient-text">Welcome to AngelWrites</h1>
            <p className="mt-2 md:mt-3 max-w-2xl text-sm md:text-base text-muted-foreground">A quiet, gentle home for your words. Gather your poems like petals—write when the moment stirs, keep your favorites close, and return to them when the light is right.</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button className="gap-2" onClick={() => setOpenForm(true)}><Plus className="h-4 w-4" /> New Poem</Button>
              <Button variant="outline" className="gap-2" onClick={() => importRef.current?.click()}><Upload className="h-4 w-4" /> Bring Poems</Button>
            </div>
          </div>
          <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-gradient-to-tr from-cyan-400/40 via-fuchsia-500/30 to-pink-500/30 dark:from-cyan-400/20 dark:via-fuchsia-500/16 dark:to-pink-500/16 blur-3xl"></div>
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-gradient-to-tr from-emerald-300/40 via-cyan-400/30 to-indigo-400/30 dark:from-emerald-300/20 dark:via-cyan-400/16 dark:to-indigo-400/16 blur-3xl"></div>
        </section>

        {poems.length > 0 && (
        <div className="flex items-center justify-center">
          <div className="flex items-center justify-center gap-2">
            <div className="relative w-72 md:w-96">
              <Input
                ref={searchRef}
                type="search"
                aria-label="Search poems"
                placeholder="Search by title, tag, or content"
                data-variant="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select value={sort} onValueChange={(v) => { setSort(v as SortOption); setPage(1); }}>
              <SelectTrigger aria-label="Sort poems" className="w-48 rounded-2xl border border-white/30 dark:border-white/10 bg-white/40 dark:bg-white/10 backdrop-blur-md focus:ring-0 focus:ring-offset-0 focus:outline-none shadow-sm hover:brightness-105">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest"><div className="flex items-center gap-2"><ArrowDownWideNarrow className="h-4 w-4" /> Newest</div></SelectItem>
                <SelectItem value="oldest"><div className="flex items-center gap-2"><ArrowUpWideNarrow className="h-4 w-4" /> Oldest</div></SelectItem>
                <SelectItem value="alpha"><div className="flex items-center gap-2"><ArrowDownAZ className="h-4 w-4" /> A–Z</div></SelectItem>
                <SelectItem value="ztoa"><div className="flex items-center gap-2"><ArrowUpAZ className="h-4 w-4" /> Z–A</div></SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        )}

        <input ref={importRef} type="file" accept=".docx,application/json" multiple className="hidden" onChange={(e) => {
          const fs = e.target.files;
          if (fs && fs.length) onImportFiles(fs);
          e.currentTarget.value = "";
        }} />

        <Dialog open={openForm} onOpenChange={(v) => { setOpenForm(v); if (!v) setEditing(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit poem" : "Add a new poem"}</DialogTitle>
              <DialogDescription>Provide title, date, tags (comma separated), and draft. After creating, a full-screen editor opens to write the poem.</DialogDescription>
            </DialogHeader>
            <form ref={formRef} className="grid gap-3" onSubmit={onSubmit}>
              <Input ref={titleRef} name="title" placeholder="Title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0 focus:ring-offset-0" />
              <div className="flex gap-3">
                <Input name="date" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-40 focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0 focus:ring-offset-0" />
                <Input name="tags" placeholder="Tags (comma separated)" value={formTags} onChange={(e) => setFormTags(e.target.value)} className="focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0 focus:ring-offset-0" />
              </div>
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox id="draft" name="draft" checked={formDraft} onCheckedChange={(v) => setFormDraft(!!v)} className="h-5 w-5" />
                <Label htmlFor="draft" className="text-sm text-muted-foreground">Draft</Label>
              </div>
              <button type="submit" className="hidden" aria-hidden="true" />
              <DialogFooter>
                <div className="flex-1" />
                <Button type="button" variant="outline" onClick={() => importRef.current?.click()} className="gap-2"><Upload className="h-4 w-4" /> Bring Poems</Button>
                <Button
                  type="button"
                  onClick={() => {
                    const title = (titleRef.current?.value ?? formTitle).toString();
                    const draft = formDraft;
                    const tags = normalizeTags(formTags.split(",").map((t) => t.trim()).filter(Boolean));
                    const date = formDate || format(new Date(), "yyyy-MM-dd");
                    const ok = applyCreateOrEdit(title, date, tags, draft);
                    if (ok) {
                      setFormTitle("");
                      setFormDate(format(new Date(), "yyyy-MM-dd"));
                      setFormTags("");
                      setFormDraft(false);
                    }
                  }}
                >
                  {editing ? "Save Changes" : "Create Poem"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Filter className="h-4 w-4" /> Filter:</div>
            {tags.map((t) => {
              const active = selectedTags.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => { setSelectedTags((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]); setPage(1); }}
                  aria-pressed={active}
                  aria-label={`Filter by tag: ${t}${active ? " (selected)" : ""}`}
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



        {filtered.length > 0 && (
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
        )}



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

        {importing && (
          <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur">
            <LoadingScreen messages={POET_SARCASTIC_MESSAGES} />
          </div>
        )}

        {writeOpen && writingPoem && (
          <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur overflow-y-auto" role="dialog" aria-modal="true" aria-label={`Edit poem: ${writingPoem.title}`}>
            <div className="container mx-auto flex h-full min-h-0 flex-col">
              <div className="flex items-center justify-between py-4">
                <h2 className="text-lg font-semibold">Write: {writingPoem.title}</h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => { setWriteOpen(false); setWritingPoem(null); setWritingContent(""); }}>Close</Button>
                  <Button onClick={saveWriting}>Save</Button>
                </div>
              </div>
              <div className="flex-1 pb-[3px]">
                <Suspense fallback={<LoadingScreen fullscreen={false} messages={POET_SARCASTIC_MESSAGES} />}>
                  <RichEditor value={writingContent} onChange={setWritingContent} placeholder="Start writing your poem..." />
                </Suspense>
              </div>
            </div>
          </div>
        )}

        {totalPages > 1 && (
          <div className="fixed bottom-4 right-4 z-40">
            <div className="flex items-center gap-2 rounded-md border bg-background/95 px-3 py-2 shadow-lg">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <label htmlFor="pageInput" className="sr-only">Page</label>
                <input
                  id="pageInput"
                  type="number"
                  min={1}
                  max={totalPages}
                  value={currentPage}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                      e.preventDefault();
                    }
                  }}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isNaN(n)) setPage(Math.min(Math.max(1, n), totalPages));
                  }}
                  onBlur={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isNaN(n)) setPage(Math.min(Math.max(1, n), totalPages));
                  }}
                  onKeyUp={(e) => {
                    if (e.key === "Enter") {
                      const n = Number((e.target as HTMLInputElement).value);
                      if (!Number.isNaN(n)) setPage(Math.min(Math.max(1, n), totalPages));
                    }
                  }}
                  className="w-14 rounded-2xl border bg-background px-2 py-1 text-center text-sm"
                />
                <span>/ {totalPages}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
            </div>
          </div>
        )}

    </main>
  );
}
