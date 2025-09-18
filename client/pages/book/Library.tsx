import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Book,
  BookStatus,
  createBook,
  deleteBook,
  duplicateBook,
  exportBookToDOCX,
  exportBooksJSON,
  getBookWordCount,
  getLastOpenedBookId,
  getWritingDays,
  loadBooks,
  saveBooks,
  setLastOpenedBookId,
  updateBook,
} from "@/lib/books";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";
import { BookOpen, MoreHorizontal, NotebookPen, Plus, Trash2, Copy, FileDown, FileJson, FileText, Hash, Clock, ArrowDownAZ, ArrowUpAZ, ArrowDown01, ArrowUp10, CheckCircle, FileEdit, Tag, Heart, Rocket, Wand2, Search, ListFilter, Minus } from "lucide-react";

function computeStreak(days: string[]): number {
  const set = new Set(days);
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 3650; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (set.has(key)) streak++;
    else break;
  }
  return streak;
}

export default function BookLibrary() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[]>(() => loadBooks());
  const [editing, setEditing] = useState<Book | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const genreRef = useRef<HTMLInputElement>(null);
  const tagsRef = useRef<HTMLInputElement>(null);
  const [metaStatusLib, setMetaStatusLib] = useState<"draft" | "completed" | null>(null);

  // UI state
  const [sort, setSort] = useState<"title_asc" | "title_desc" | "date_desc" | "date_asc" | "wc_desc" | "wc_asc">(() => {
    const v = localStorage.getItem("books:sort") as any;
    if (v === "lastEdited") return "date_desc";
    if (v === "title") return "title_asc";
    if (v === "wordCount") return "wc_desc";
    if (v === "status") return "title_asc";
    const allowed = new Set(["title_asc","title_desc","date_desc","date_asc","wc_desc","wc_asc"]);
    return allowed.has(v) ? (v as any) : "date_desc";
  });
  const [filterStatus, setFilterStatus] = useState<"all" | "drafts" | "completed">(() => {
    const v = localStorage.getItem("books:filter:status") as any;
    return v === "inprogress" ? "all" : (v || "all");
  });
  const [filterGenre, setFilterGenre] = useState<string>(() => localStorage.getItem("books:filter:genre") || "all");
  const [filterTags, setFilterTags] = useState<string>(() => localStorage.getItem("books:filter:tags") || "");

  useEffect(() => { saveBooks(books); }, [books]);

  useEffect(() => { localStorage.setItem("books:sort", sort); }, [sort]);
  useEffect(() => { localStorage.setItem("books:filter:status", filterStatus); }, [filterStatus]);
  useEffect(() => { localStorage.setItem("books:filter:genre", filterGenre); }, [filterGenre]);
  useEffect(() => { localStorage.setItem("books:filter:tags", filterTags); }, [filterTags]);

  const onCreate = () => {
    const b = createBook({ title: "Untitled Book" });
    setBooks((prev) => {
      const next = [b, ...prev];
      saveBooks(next);
      return next;
    });
    setLastOpenedBookId(b.id);
    navigate("/book/quill");
  };

  const lastId = getLastOpenedBookId();

  const stats = useMemo(() => {
    const total = books.length;
    const chapters = books.reduce((sum, b) => sum + (b.chapters?.length || 0), 0);
    const totalWords = books.reduce((sum, b) => sum + getBookWordCount(b), 0);
    const streak = computeStreak(getWritingDays());
    return { total, chapters, totalWords, streak };
  }, [books]);

  const genres = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => { if (b.genre) set.add(b.genre); });
    return Array.from(set);
  }, [books]);

  const filteredSorted = useMemo(() => {
    const tags = filterTags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    const byFilter = books.filter((b) => {
      if (filterStatus === "drafts" && (b.status !== "draft")) return false;
      if (filterStatus === "completed" && !b.completed) return false;
      if (filterGenre !== "all" && filterGenre && b.genre !== filterGenre) return false;
      if (tags.length) {
        const setTags = new Set((b.tags || []).map((t) => t.toLowerCase()));
        for (const t of tags) if (!setTags.has(t)) return false;
      }
      return true;
    });
    const withWc = byFilter.map((b) => ({ b, wc: getBookWordCount(b) }));
    withWc.sort((a, c) => {
      if (sort === "date_desc") return new Date(c.b.lastEdited).getTime() - new Date(a.b.lastEdited).getTime();
      if (sort === "date_asc") return new Date(a.b.lastEdited).getTime() - new Date(c.b.lastEdited).getTime();
      if (sort === "title_asc") return a.b.title.localeCompare(c.b.title);
      if (sort === "title_desc") return c.b.title.localeCompare(a.b.title);
      if (sort === "wc_desc") return c.wc - a.wc;
      if (sort === "wc_asc") return a.wc - c.wc;
      return 0;
    });
    return withWc.map((x) => x.b);
  }, [books, filterStatus, filterGenre, filterTags, sort]);

  return (
    <main className="container book-mode py-10 animate-in fade-in-0 slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Library</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button className="gap-2" onClick={onCreate}><Plus className="h-4 w-4" /> New Book</Button>
        </div>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Card><CardContent className="p-5"><div className="flex items-center gap-3"><BookOpen className="h-5 w-5" /><div><div className="text-sm text-muted-foreground">Total Books</div><div className="text-2xl font-semibold">{stats.total}</div></div></div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-3"><Hash className="h-5 w-5" /><div><div className="text-sm text-muted-foreground">Chapters Written</div><div className="text-2xl font-semibold">{stats.chapters}</div></div></div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-3"><FileText className="h-5 w-5" /><div><div className="text-sm text-muted-foreground">Total Words</div><div className="text-2xl font-semibold">{stats.totalWords}</div></div></div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-3"><Clock className="h-5 w-5" /><div><div className="text-sm text-muted-foreground">Streak</div><div className="text-2xl font-semibold">{stats.streak} days</div></div></div></CardContent></Card>
      </section>

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Sort by</label>
          <Select value={sort.startsWith("wc_") ? "date_desc" : sort} onValueChange={(v) => setSort(v as any)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Sort by" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="title_asc"><span className="flex items-center gap-2"><ArrowDownAZ className="h-4 w-4" /> A to Z</span></SelectItem>
              <SelectItem value="title_desc"><span className="flex items-center gap-2"><ArrowUpAZ className="h-4 w-4" /> Z to A</span></SelectItem>
              <SelectItem value="date_desc"><span className="flex items-center gap-2"><ArrowDown01 className="h-4 w-4" /> Newest</span></SelectItem>
              <SelectItem value="date_asc"><span className="flex items-center gap-2"><ArrowUp10 className="h-4 w-4" /> Oldest</span></SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Filter status</label>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all"><span className="flex items-center gap-2"><ListFilter className="h-4 w-4" /> All</span></SelectItem>
              <SelectItem value="drafts"><span className="flex items-center gap-2"><FileEdit className="h-4 w-4" /> Drafts</span></SelectItem>
              <SelectItem value="completed"><span className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Completed</span></SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Filter genre</label>
          <Select value={filterGenre} onValueChange={(v) => setFilterGenre(v)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="All genres" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all"><span className="flex items-center gap-2"><Tag className="h-4 w-4" /> All</span></SelectItem>
              {genres.map((g) => (
                <SelectItem key={g} value={g}>
                  <span className="flex items-center gap-2">
                    {(() => { const n = g.toLowerCase(); if (n.includes("fantasy")) return <Wand2 className="h-4 w-4" />; if (n.includes("romance")) return <Heart className="h-4 w-4" />; if (n.includes("mystery") || n.includes("thriller") || n.includes("crime")) return <Search className="h-4 w-4" />; if (n.includes("sci") || n.includes("science") || n.includes("space")) return <Rocket className="h-4 w-4" />; return <Tag className="h-4 w-4" />; })()}
                    {g}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Word count</label>
          <Select value={sort.startsWith("wc_") ? sort : "none"} onValueChange={(v) => setSort(v === "none" ? "date_desc" : (v as any))}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Word count" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none"><span className="flex items-center gap-2"><Minus className="h-4 w-4" /> None</span></SelectItem>
              <SelectItem value="wc_desc"><span className="flex items-center gap-2"><ArrowDown01 className="h-4 w-4" /> Highest to Lowest</span></SelectItem>
              <SelectItem value="wc_asc"><span className="flex items-center gap-2"><ArrowUp10 className="h-4 w-4" /> Lowest to Highest</span></SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Filter tags (comma-separated)</label>
          <Input value={filterTags} onChange={(e) => setFilterTags(e.target.value)} placeholder="e.g. fantasy, draft" />
        </div>
      </div>

      {filteredSorted.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground">No books match your filters.</div>
      ) : (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSorted.map((b) => (
            <Card key={b.id} className="group relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-3 justify-between">
                  <div className="flex items-start gap-3">
                    <img src={b.cover || "/placeholder.svg"} alt="Cover" className="h-16 w-12 object-cover rounded-md border" />
                    <div>
                      <div className="text-base font-semibold leading-tight line-clamp-1">{b.title}</div>
                      <div className="text-[11px] text-muted-foreground">Last edited {formatDistanceToNow(new Date(b.lastEdited), { addSuffix: true })}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {b.status ? <Badge variant={b.status === "published" ? "default" : "secondary"}>{b.status}</Badge> : null}
                        {b.completed ? <Badge variant="secondary">Completed</Badge> : <Badge variant="outline">In-progress</Badge>}
                        {b.genre ? <Badge variant="outline">{b.genre}</Badge> : null}
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" aria-label="Actions"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setLastOpenedBookId(b.id); navigate("/book/quill"); }}><NotebookPen className="h-4 w-4 mr-2" /> Open</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditing(b)}>Edit Metadata</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportBookToDOCX(b, `${b.title}.docx`)}><FileDown className="h-4 w-4 mr-2" /> Export (DOCX)</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportBooksJSON([b], `${b.title}.json`)}><FileJson className="h-4 w-4 mr-2" /> Export (JSON)</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setBooks((prev) => duplicateBook(prev, b.id))}><Copy className="h-4 w-4 mr-2" /> Duplicate</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(b.id)}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{b.description || "No description"}</p>
                {lastId === b.id && (
                  <div className="mt-3"><Badge variant="secondary">Last opened</Badge></div>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={() => { setLastOpenedBookId(b.id); navigate("/book/quill"); }}>Write</Button>
                  <div className="text-xs text-muted-foreground">{getBookWordCount(b)} words</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Metadata</DialogTitle>
            <DialogDescription>Update the book details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input ref={titleRef} defaultValue={editing?.title || ""} placeholder="Title" />
            <Input ref={descRef} defaultValue={editing?.description || ""} placeholder="Short description" />
            <Input ref={coverRef} defaultValue={editing?.cover || ""} placeholder="Cover image URL" />
            <Input ref={genreRef} defaultValue={editing?.genre || ""} placeholder="Genre" />
            <Input ref={tagsRef} defaultValue={(editing?.tags || []).join(", ")} placeholder="Tags (comma-separated)" />
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select defaultValue={(editing?.completed ? "completed" : "draft")} onValueChange={(v) => setMetaStatusLib(v as any)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => {
              if (!editing) return;
              const title = (titleRef.current?.value || editing.title).toString();
              const description = (descRef.current?.value || editing.description).toString();
              const cover = (coverRef.current?.value || editing.cover || "").toString() || null;
              const genre = (genreRef.current?.value || editing.genre || "").toString() || null;
              const tags = (tagsRef.current?.value || (editing.tags || []).join(",")).split(",").map((t) => t.trim()).filter(Boolean);
              const selected = metaStatusLib ?? (editing.completed ? "completed" : "draft");
              const completed = selected === "completed";
              const status: BookStatus = completed ? "published" : "draft";
              setBooks((prev) => updateBook(prev, editing.id, { title, description, cover, genre, tags, status, completed }));
              setEditing(null);
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete book</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (!deleteId) return; setBooks((prev) => deleteBook(prev, deleteId)); setDeleteId(null); }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
