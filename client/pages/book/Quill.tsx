import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/ui/loading";
import { POET_SARCASTIC_MESSAGES } from "@/lib/messages";
import {
  Book,
  BookStatus,
  Chapter,
  exportBookToDOCX,
  exportBooksJSON,
  getLastOpenedBookId,
  loadBooks,
  saveBooks,
  setLastOpenedBookId,
  updateBook,
} from "@/lib/books";
import { useNavigate } from "react-router-dom";
import EditorFooterStats from "@/components/EditorFooterStats";
import { Plus, Trash2, ArrowUp, ArrowDown, Edit2, MoreHorizontal, FileDown, FileJson } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";
import { useDialog } from "@/lib/dialogs";

const RichEditor = lazy(() => import("@/components/RichEditor"));

function nid(size = 12): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-";
  const array = new Uint8Array(size);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(array);
  else for (let i = 0; i < size; i++) array[i] = Math.floor(Math.random() * 256);
  let id = "";
  for (let i = 0; i < size; i++) id += chars[array[i] % chars.length];
  return id;
}

export default function BookQuill() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[]>(() => loadBooks());
  const [bookId, setBookId] = useState<string | null>(() => getLastOpenedBookId());

  const current = useMemo(() => books.find((b) => b.id === bookId) || null, [books, bookId]);

  // Ensure chapters exist (migration)
  useEffect(() => {
    if (!current) return;
    if (!current.chapters || current.chapters.length === 0) {
      const first: Chapter = { id: nid(), title: "Chapter 1", content: current.content || "" };
      setBooks((prev) => updateBook(prev, current.id, { chapters: [first], activeChapterId: first.id }));
    }
  }, [current?.id]);

  useEffect(() => {
    saveBooks(books);
  }, [books]);
  useEffect(() => {
    const reload = () => setBooks(loadBooks());
    window.addEventListener("aw-auth-changed", reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("aw-auth-changed", reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  // Load last opened book if navigated directly
  useEffect(() => {
    const id = getLastOpenedBookId();
    if (!id) return;
    setBookId(id);
  }, []);

  // Ensure books are refreshed from storage if we have an id but not the book yet
  useEffect(() => {
    if (bookId && !current) {
      const stored = loadBooks();
      setBooks(stored);
    }
  }, [bookId, current]);

  // Keep last opened synced while in Quill
  useEffect(() => {
    if (current) setLastOpenedBookId(current.id);
  }, [current?.id]);

  const chapterId = current?.activeChapterId || (current?.chapters && current.chapters[0]?.id) || null;
  const chapter = current?.chapters?.find((c) => c.id === chapterId) || null;
  const [value, setValue] = useState<string>(chapter?.content || "");
  const valueRef = useRef<string>(value);

  // Saving state + last saved indicator
  const [saving, setSaving] = useState(false);

  // Metadata dialog state
  const [metaOpen, setMetaOpen] = useState(false);
  const [metaStatus, setMetaStatus] = useState<"draft" | "completed" | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);
  const genreRef = useRef<HTMLInputElement>(null);
  const tagsRef = useRef<HTMLInputElement>(null);

  // Keep editor value in sync when chapter changes
  useEffect(() => {
    setValue(chapter?.content || "");
    valueRef.current = chapter?.content || "";
    setSaving(false);
  }, [chapterId]);

  // Autosave editor content
  useEffect(() => {
    if (!current || !chapter) return;
    setSaving(true);
    const t = window.setTimeout(() => {
      if (valueRef.current !== value) valueRef.current = value;
      if (value !== chapter.content) {
        const nextChapters = (current.chapters || []).map((c) => (c.id === chapter.id ? { ...c, content: value } : c));
        setBooks((prev) => updateBook(prev, current.id, { chapters: nextChapters }));
      }
      setSaving(false);
    }, 800);
    return () => window.clearTimeout(t);
  }, [value, chapter?.id, current?.id]);

  if (!current) {
    return (
      <main className="container py-10">
        <div className="rounded-2xl border p-6 glass-soft">
          <h2 className="text-lg font-semibold">Quill</h2>
          <p className="text-sm text-muted-foreground mt-1">Select a book from Library to begin writing in Quill.</p>
          <div className="mt-4"><Button onClick={() => navigate("/book/library")}>Open Library</Button></div>
        </div>
      </main>
    );
  }

  const chapters = current.chapters || [];

  const addChapter = () => {
    const idx = chapters.length + 1;
    const ch: Chapter = { id: nid(), title: `Chapter ${idx}`, content: "" };
    setBooks((prev) => updateBook(prev, current.id, { chapters: [...chapters, ch], activeChapterId: ch.id }));
  };
  const deleteChapter = (id: string) => {
    if (chapters.length <= 1) return; // keep at least one
    const next = chapters.filter((c) => c.id !== id);
    const nextActive = next[0]?.id || null;
    setBooks((prev) => updateBook(prev, current.id, { chapters: next, activeChapterId: nextActive }));
  };
  const { prompt: promptDialog } = useDialog();
  const renameChapter = async (id: string) => {
    const currentTitle = chapters.find((c) => c.id === id)?.title || "";
    const title = await promptDialog("Chapter title", currentTitle, "Rename Chapter");
    if (title == null) return;
    const next = chapters.map((c) => (c.id === id ? { ...c, title: title.trim() || c.title } : c));
    setBooks((prev) => updateBook(prev, current.id, { chapters: next }));
  };
  const moveChapter = (id: string, dir: -1 | 1) => {
    const i = chapters.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= chapters.length) return;
    const next = [...chapters];
    const [sp] = next.splice(i, 1);
    next.splice(j, 0, sp);
    setBooks((prev) => updateBook(prev, current.id, { chapters: next }));
  };

  const lastSavedLabel = current.lastEdited ? `Last saved ${formatDistanceToNow(new Date(current.lastEdited), { addSuffix: true })}` : "";

  return (
    <main className="container book-mode lg:h-[calc(100vh-8rem)] py-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-700">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate">{current.title}</h1>
          <div className="text-xs text-muted-foreground h-4">{saving ? "Saving…" : lastSavedLabel}</div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2"><MoreHorizontal className="h-4 w-4" /> Quick Actions</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportBookToDOCX(current, `${current.title}.docx`)}><FileDown className="h-4 w-4 mr-2" /> Export DOCX</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportBooksJSON([current], `${current.title}.json`)}><FileJson className="h-4 w-4 mr-2" /> Export JSON</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setMetaStatus(current.completed ? "completed" : "draft"); setMetaOpen(true); }}>Edit Metadata</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={() => navigate("/book/library")}>Library</Button>
          <Button onClick={() => { if (chapter) setBooks((prev) => updateBook(prev, current.id, { chapters: chapters.map((c) => c.id === chapter.id ? { ...c, content: value } : c) })); setLastOpenedBookId(current.id); }}>Save</Button>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-4 lg:h-[calc(100%-3rem)]">
        <aside className="col-span-12 lg:col-span-3 xl:col-span-2 rounded-2xl border p-3 glass-soft overflow-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-muted-foreground">Chapters</div>
            <Button size="sm" variant="outline" className="h-8 px-3" onClick={addChapter}><Plus className="h-4 w-4" /></Button>
          </div>
          <nav className="space-y-1">
            {chapters.map((c, idx) => (
              <div key={c.id} className={`group rounded-xl border px-3 py-2 ${c.id === chapterId ? "bg-primary/10 border-primary/30" : "hover:bg-accent"}`}>
                <button className="w-full text-left" onClick={() => setBooks((prev) => updateBook(prev, current.id, { activeChapterId: c.id }))}>
                  <div className="text-sm font-medium line-clamp-1">{c.title}</div>
                </button>
                <div className="mt-1 flex items-center gap-1 opacity-80">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveChapter(c.id, -1)} disabled={idx === 0}><ArrowUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveChapter(c.id, 1)} disabled={idx === chapters.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => renameChapter(c.id)}><Edit2 className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteChapter(c.id)} disabled={chapters.length <= 1}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <section className="col-span-12 lg:col-span-9 xl:col-span-10">
          {!chapter ? (
            <div className="rounded-2xl border p-6 glass-soft h-full">
              <div className="text-sm text-muted-foreground">No chapter selected.</div>
            </div>
          ) : (
            <div className="h-full rounded-2xl">
              <Suspense fallback={<LoadingScreen fullscreen={false} messages={POET_SARCASTIC_MESSAGES} />}>
                <RichEditor value={value} onChange={(v) => setValue(v)} placeholder="Begin your chapter..." />
              </Suspense>
            </div>
          )}
        </section>
      </div>

      <EditorFooterStats content={value} />

      <Dialog open={metaOpen} onOpenChange={(v) => setMetaOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Metadata</DialogTitle>
            <DialogDescription>Update the book details for exports and organization.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input ref={titleRef} defaultValue={current.title} placeholder="Title" />
            <Input ref={descRef} defaultValue={current.description || ""} placeholder="Short description" />
            <Input ref={genreRef} defaultValue={current.genre || ""} placeholder="Genre" />
            <Input ref={tagsRef} defaultValue={(current.tags || []).join(", ")} placeholder="Tags (comma-separated)" />
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select defaultValue={(current.completed ? "completed" : "draft")} onValueChange={(v) => setMetaStatus(v as any)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMetaOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              const title = (titleRef.current?.value || current.title).toString();
              const description = (descRef.current?.value || current.description || "").toString();
              const genre = (genreRef.current?.value || current.genre || "").toString() || null;
              const tags = (tagsRef.current?.value || (current.tags || []).join(",")).split(",").map((t) => t.trim()).filter(Boolean);
              const selected = metaStatus ?? (current.completed ? "completed" : "draft");
              const completed = selected === "completed";
              const status: BookStatus = completed ? "published" : "draft";
              setBooks((prev) => updateBook(prev, current.id, { title, description, genre, tags, status, completed }));
              setMetaOpen(false);
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
