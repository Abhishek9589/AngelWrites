import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  updatePoem,
  updatePoemWithVersion,
  setLastOpenedPoemId,
} from "@/lib/poems";
import { format } from "date-fns";
import { ArrowDownAZ, ArrowUpAZ, ArrowDownWideNarrow, ArrowUpWideNarrow, Filter, MoreHorizontal, Plus, Search, Star, StarOff, Upload } from "lucide-react";
import { toast } from "sonner";

export default function Index() {
  const STORAGE_KEYS = { query: "poems:query", sort: "poems:sort" };
  const navigate = useNavigate();
  const [poems, setPoems] = useState(() => loadPoems());
  const [query, setQuery] = useState(() => localStorage.getItem(STORAGE_KEYS.query) ?? "");
  const [sort, setSort] = useState(() => {
    const s = localStorage.getItem(STORAGE_KEYS.sort);
    return s === "newest" || s === "oldest" || s === "alpha" || s === "ztoa" ? s : "newest";
  });
  const [selectedTags, setSelectedTags] = useState([]);
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

  const paginated = useMemo(() => filtered.slice(0, pageSize), [filtered]);

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [writeOpen, setWriteOpen] = useState(false);
  const [writingPoem, setWritingPoem] = useState(null);
  const [writingContent, setWritingContent] = useState("");
  const [hasImported, setHasImported] = useState(false);
  const [importing, setImporting] = useState(false);
  const formRef = useRef(null);
  const searchRef = useRef(null);
  const titleRef = useRef(null);

  // Controlled fields for Add/Edit dialog
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formTags, setFormTags] = useState("");
  const [formDraft, setFormDraft] = useState(false);
  const [formPieceType, setFormPieceType] = useState('poem');
  const [formGenre, setFormGenre] = useState("");

  useEffect(() => {
    if (openForm) {
      setFormTitle(editing?.title ?? "");
      setFormDate(editing?.date || format(new Date(), "yyyy-MM-dd"));
      const genreTag = (editing?.tags || []).find((t) => t.toLowerCase().startsWith("genre:"));
      const detectedType = editing?.type ?? (genreTag ? "book" : "poem");
      setFormPieceType(detectedType);
      if (detectedType === "book") {
        setFormGenre(genreTag ? genreTag.slice(6).trim() : "");
        const nonGenre = (editing?.tags || []).filter((t) => !t.toLowerCase().startsWith("genre:"));
        setFormTags(nonGenre.join(", "));
      } else {
        setFormGenre("");
        setFormTags(editing ? editing.tags.join(", ") : "");
      }
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
    const onKey = (e) => {
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
        const target = e.target;
        const isTyping =
          !!target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable ||
            !!target.closest && !!target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
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

  const applyCreateOrEdit = (title, date, tags, draft) => {
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
      setPoems((prev) => updatePoem(prev, editing.id, { title: nextTitle, date, tags, draft, type: formPieceType }));
      toast.success("Saved");
    } else {
      const poem = createPoem({ title: title.trim(), content: "", date, tags, draft, type: formPieceType });
      setPoems((prev) => {
        const next = [poem, ...prev];
        savePoems(next);
        return next;
      });
      setLastOpenedPoemId(poem.id);
      toast.success("Created");
      navigate("/quill");
    }
    setOpenForm(false);
    setEditing(null);
    return true;
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const title = (titleRef.current?.value ?? formTitle).toString();
    const date = (formDate || format(new Date(), "yyyy-MM-dd")).toString();
    const draft = formDraft;
    let tags = [];
    if (formPieceType === "book") {
      tags = formGenre ? normalizeTags([`genre:${formGenre}`]) : [];
    } else {
      tags = normalizeTags(formTags.split(",").map((t) => t.trim()).filter(Boolean));
    }

    const ok = applyCreateOrEdit(title, date, tags, draft);
    if (ok) {
      setFormTitle("");
      setFormDate(format(new Date(), "yyyy-MM-dd"));
      setFormTags("");
      setFormGenre("");
      setFormPieceType('poem');
      setFormDraft(false);
    }
  };

  const toggleFavorite = (p) => {
    setPoems((prev) => prev.map((it) => (it.id === p.id ? { ...it, favorite: !p.favorite } : it)));
  };

  const handleDelete = (id) => {
    setDeleteId(id);
  };
  const confirmDelete = () => {
    if (!deleteId) return;
    setPoems((prev) => deletePoem(prev, deleteId));
    setDeleteId(null);
  };

  const importRef = useRef(null);
  const onImportFiles = async (files) => {
    setImporting(true);
    try {
      const arr = Array.from(files);
      let jsonCount = 0;
      const created = [];
      const importedMap = new Map();
      for (const file of arr) {
        const isJSON = file.type === "application/json" || file.type === "text/plain" || /\.json$/i.test(file.name);
        const isDOCX = /\.(docx|doc)$/i.test(file.name);
        if (isJSON) {
          try {
            const text = await file.text();
            const obj = JSON.parse(text);
            const imported = Array.isArray(obj) ? obj : Array.isArray(obj.poems) ? obj.poems : [];
            imported.forEach((p) => {
              const it = { ...p };
              if (!it.id) it.id = generateId();
              if (!Array.isArray(it.tags)) it.tags = [];
              if (typeof it.title !== "string") it.title = "Untitled";
              if (typeof it.content !== "string") it.content = "";
              if (typeof it.date !== "string" || !/\d{4}-\d{2}-\d{2}/.test(it.date)) it.date = format(new Date(), "yyyy-MM-dd");
              it.type = it.type === "book" ? "book" : "poem";
              importedMap.set(it.id, it);
            });
            jsonCount += imported.length;
          } catch (e) {
            console.error("Failed to import JSON file", file.name, e);
            toast.error(`Failed to import JSON file: ${file.name}: ${e?.message || 'Invalid JSON'}`);
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
              type: "poem",
            });
            created.push(poem);
          } catch (e) {
            console.error("Failed to import DOCX file", file.name, e);
            toast.error(`Failed to import DOCX file: ${file.name}: ${e?.message || 'Parsing error'}`);
          }
        }
      }
      if (jsonCount === 0 && created.length === 0) {
        toast.error("No supported files imported. Please select .json or .docx files.");
        return;
      }
      setPoems((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        importedMap.forEach((p) => map.set(p.id, p));
        const next = Array.from(map.values());
        const combined = created.length ? [...created, ...next] : next;
        const sorted = sortPoems(combined, sort);
        savePoems(sorted);
        return sorted;
      });
      setHasImported(true);
      setOpenForm(false);
      setEditing(null);
      const parts = [];
      if (jsonCount) parts.push(`JSON: ${jsonCount}`);
      if (created.length) parts.push(`DOCX: ${created.length}`);
      toast.success(`Imported ${parts.join(" and ")}`);
      navigate("/library");
    } finally {
      setImporting(false);
    }
  };


  return (
    <main className="container py-10 animate-in fade-in-0 slide-in-from-bottom-2 duration-700">
        <section className="relative overflow-hidden rounded-3xl p-8 md:p-12 mb-6 glass">
          <div className="relative z-10">
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight gradient-text">Welcome to AngelWrites</h1>
            <p className="mt-2 md:mt-3 max-w-2xl text-sm md:text-base text-muted-foreground">A calm home for your writing—poems, chapters, and full books. Capture ideas as they come, tag and organize them, keep favorites close, and return when you're ready to shape them.</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button className="gap-2" onClick={() => setOpenForm(true)}><Plus className="h-4 w-4" /> New Piece</Button>
              <Button variant="outline" className="gap-2" onClick={() => {
                const sorted = [...poems].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                const last = sorted[0];
                if (!last) { navigate("/library"); return; }
                const href = `${last.type === "book" ? "/book" : "/poem"}/${last.id}?edit=1`;
                navigate(href);
              }}>Resume Writing</Button>
            </div>
          </div>
          <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-gradient-to-tr from-cyan-400/40 via-fuchsia-500/30 to-pink-500/30 dark:from-cyan-400/20 dark:via-fuchsia-500/16 dark:to-pink-500/16 blur-3xl"></div>
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-gradient-to-tr from-emerald-300/40 via-cyan-400/30 to-indigo-400/30 dark:from-emerald-300/20 dark:via-cyan-400/16 dark:to-indigo-400/16 blur-3xl"></div>
        </section>

        {poems.length > 0 && (
        <div className="mx-auto w-full max-w-2xl px-4">
          <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full">
              <Input
                ref={searchRef}
                type="search"
                aria-label="Search your writing"
                placeholder="Search by title, tag, or content"
                data-variant="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                }}
              />
            </div>
            <Select value={sort} onValueChange={(v) => { setSort(v); }}>
              <SelectTrigger aria-label="Sort writing" className="w-full sm:w-48 rounded-2xl border border-white/30 dark:border-white/10 bg-white/40 dark:bg-white/10 backdrop-blur-md focus:ring-0 focus:ring-offset-0 focus:outline-none shadow-sm hover:brightness-105">
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

        <input ref={importRef} type="file" accept=".doc,.docx,application/json,text/plain" multiple className="hidden" onChange={(e) => {
          const fs = e.target.files;
          if (fs && fs.length) onImportFiles(fs);
          e.currentTarget.value = "";
        }} />

        <Dialog open={openForm} onOpenChange={(v) => { setOpenForm(v); if (!v) setEditing(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit piece" : "Add a new piece"}</DialogTitle>
              <DialogDescription>Provide title, type, date, and status. If Poem, add tags; if Book, add a genre. After creating, a full-screen editor opens to write your work.</DialogDescription>
            </DialogHeader>
            <form ref={formRef} className="grid gap-3" onSubmit={onSubmit}>
              <Input ref={titleRef} name="title" placeholder="Title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0 focus:ring-offset-0" />
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3">
                    <Label className="text-sm text-muted-foreground">Type</Label>
                    <ToggleGroup type="single" value={formPieceType} onValueChange={(v) => v && setFormPieceType(v)} className="flex items-center gap-2">
                      <ToggleGroupItem id="type-poem" value="poem" variant="outline" size="sm">Poem</ToggleGroupItem>
                      <ToggleGroupItem id="type-book" value="book" variant="outline" size="sm">Book</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  <div className="flex items-center gap-3">
                    <Label className="text-sm text-muted-foreground">Status</Label>
                    <ToggleGroup type="single" value={formDraft ? 'draft' : 'completed'} onValueChange={(v) => v && setFormDraft(v === 'draft')} className="flex items-center gap-2">
                      <ToggleGroupItem id="status-draft" value="draft" variant="outline" size="sm">Draft</ToggleGroupItem>
                      <ToggleGroupItem id="status-completed" value="completed" variant="outline" size="sm">Completed</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input name="date" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full sm:w-40 focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0 focus:ring-offset-0" />
                  {formPieceType === 'poem' ? (
                    <Input name="tags" placeholder="Tags (comma separated)" value={formTags} onChange={(e) => setFormTags(e.target.value)} className="w-full focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0 focus:ring-offset-0" />
                  ) : (
                    <Input name="genre" placeholder="Genre (e.g., Fiction)" value={formGenre} onChange={(e) => setFormGenre(e.target.value)} className="w-full focus-visible:ring-0 focus-visible:ring-offset-0 focus:ring-0 focus:ring-offset-0" />
                  )}
                </div>
              </div>
                            <button type="submit" className="hidden" aria-hidden="true" />
              <DialogFooter>
                <div className="flex-1" />
                <Button type="button" variant="outline" onClick={() => importRef.current?.click()} className="gap-2"><Upload className="h-4 w-4" /> Import Pieces</Button>
                <Button
                  type="button"
                  onClick={() => {
                    const title = (titleRef.current?.value ?? formTitle).toString();
                    const draft = formDraft;
                    let tags = [];
                    if (formPieceType === "book") {
                      tags = formGenre ? normalizeTags([`genre:${formGenre}`]) : [];
                    } else {
                      tags = normalizeTags(formTags.split(",").map((t) => t.trim()).filter(Boolean));
                    }
                    const date = formDate || format(new Date(), "yyyy-MM-dd");
                    const ok = applyCreateOrEdit(title, date, tags, draft);
                    if (ok) {
                      setFormTitle("");
                      setFormDate(format(new Date(), "yyyy-MM-dd"));
                      setFormTags("");
                      setFormGenre("");
                      setFormPieceType('poem');
                      setFormDraft(false);
                    }
                  }}
                >
                  {editing ? "Save Changes" : "Create Piece"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>




        {filtered.length > 0 && (
        <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginated.map((p) => (
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
                        <DropdownMenuItem asChild><Link to={`${p.type === "book" ? "/book" : "/poem"}/${p.id}`}>Open</Link></DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(p.id)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{preview(p.content, 220)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {p.tags.filter((t) => !t.toLowerCase().startsWith("genre:")).map((t) => (
                    <Badge key={t} variant="secondary">{t}</Badge>
                  ))}
                </div>
                <div className="mt-4">
                  <Link to={`${p.type === "book" ? "/book" : "/poem"}/${p.id}`}><Button variant="outline" size="sm">Open</Button></Link>
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
              <DialogTitle>Delete piece</DialogTitle>
              <DialogDescription>Are you sure you want to delete this piece? This action cannot be undone.</DialogDescription>
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
          <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur overflow-y-auto" role="dialog" aria-modal="true" aria-label={`Edit: ${writingPoem.title}`}>
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
                  <RichEditor value={writingContent} onChange={setWritingContent} placeholder="Start writing..." />
                </Suspense>
              </div>
            </div>
          </div>
        )}


    </main>
  );
}
