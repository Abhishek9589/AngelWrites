import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Library, NotebookPen, Plus, FileText, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Book,
  BookStatus,
  createBook,
  getBookWordCount,
  getLastOpenedBookId,
  getRecentBookIds,

  loadBooks,
  saveBooks,
  setLastOpenedBookId,
} from "@/lib/books";
import { formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { docxArrayBufferToHTML } from "@/lib/docx";
import { importBooksFromJSON } from "@/lib/books";


export default function BookHome() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[]>(() => loadBooks());

  useEffect(() => {
    saveBooks(books);
  }, [books]);


  const lastId = getLastOpenedBookId();
  const last = books.find((b) => b.id === lastId) || null;

  const recents = useMemo(() => {
    const ids = getRecentBookIds();
    const map = new Map(books.map((b) => [b.id, b] as const));
    return ids.map((id) => map.get(id)).filter(Boolean).slice(0, 5) as Book[];
  }, [books]);

  // New Book dialog state
  const [openNew, setOpenNew] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const genreRef = useRef<HTMLInputElement>(null);
  const tagsRef = useRef<HTMLInputElement>(null);
  const [newStatus, setNewStatus] = useState<"draft" | "completed">("draft");
  const importRef = useRef<HTMLInputElement>(null);
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null);
  const [coverUrlInput, setCoverUrlInput] = useState<string>("");

  const onCreate = () => {
    const title = (titleRef.current?.value || "Untitled Book").toString();
    const description = (descRef.current?.value || "").toString();
    const cover = (coverDataUrl || coverUrlInput || null);
    const genre = (genreRef.current?.value || "").toString() || null;
    const tags = (tagsRef.current?.value || "").split(",").map((t) => t.trim()).filter(Boolean);
    const completed = newStatus === "completed";
    const status: BookStatus = completed ? "published" : "draft";
    const b = createBook({ title, description, cover, genre, tags, status });
    if (completed) { b.completed = true; }
    setBooks((prev) => {
      const next = [b, ...prev];
      saveBooks(next);
      return next;
    });
    setLastOpenedBookId(b.id);
    setOpenNew(false);
    navigate("/book/quill");
  };

  async function onImportFiles(files: FileList) {
    const arr = Array.from(files);
    let base = books;
    let jsonCount = 0;
    const created: Book[] = [];
    for (const file of arr) {
      const name = file.name || "";
      const isJSON = file.type === "application/json" || /\.json$/i.test(name);
      const isDOCX = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || /\.docx$/i.test(name);
      try {
        if (isJSON) {
          const text = await file.text();
          try {
            const obj = JSON.parse(text);
            const imported: Book[] = Array.isArray(obj) ? obj : Array.isArray(obj.books) ? obj.books : [];
            jsonCount += imported.length;
          } catch {}
          base = importBooksFromJSON(base, text);
        } else if (isDOCX) {
          const ab = await file.arrayBuffer();
          const html = await docxArrayBufferToHTML(ab);
          const title = name.replace(/\.docx$/i, "");
          const b = createBook({ title, content: html });
          created.push(b);
        }
      } catch {}
    }
    if (created.length || jsonCount) {
      const next = created.length ? [...created, ...base] : base;
      setBooks(next);
      saveBooks(next);
      toast.success(`${jsonCount ? `Imported ${jsonCount} from JSON. ` : ""}${created.length ? `Created ${created.length} book${created.length === 1 ? "" : "s"} from DOCX.` : ""}`.trim());
    } else {
      toast.info("No supported files were imported.");
    }
    if (importRef.current) importRef.current.value = "";
  }

  return (
    <main className="container book-mode py-10 animate-in fade-in-0 slide-in-from-bottom-2 duration-700">
      <section className="relative overflow-hidden rounded-3xl p-8 md:p-12 mb-6 glass">
        <div className="relative z-10">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight gradient-text">Book Hub</h1>
          <p className="mt-2 md:mt-3 max-w-2xl text-sm md:text-base text-muted-foreground">Start a new book, continue where you left off, or open your library. Your progress is saved locally and can be exported anytime.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button className="gap-2" onClick={() => setOpenNew(true)}><Plus className="h-4 w-4" /> Start New Book</Button>
            <Button variant="outline" className="gap-2" onClick={() => importRef.current?.click()}><Upload className="h-4 w-4" /> Import</Button>
            <Link to="/book/library"><Button variant="outline" className="gap-2"><Library className="h-4 w-4" /> Open Library</Button></Link>
            <Button variant="outline" className="gap-2" disabled={!last} onClick={() => navigate("/book/quill")}>{last ? <><NotebookPen className="h-4 w-4" /> Resume: {last.title}</> : <><NotebookPen className="h-4 w-4" /> Resume Last Book</>}</Button>
          </div>
        </div>
        <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-gradient-to-tr from-cyan-400/40 via-fuchsia-500/30 to-pink-500/30 dark:from-cyan-400/20 dark:via-fuchsia-500/16 dark:to-pink-500/16 blur-3xl"></div>
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-gradient-to-tr from-emerald-300/40 via-cyan-400/30 to-indigo-400/30 dark:from-emerald-300/20 dark:via-cyan-400/16 dark:to-indigo-400/16 blur-3xl"></div>
      </section>

      {recents.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Recently Opened</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recents.map((b) => (
              <Card key={b.id} className="group">
                <CardContent className="p-4 flex items-start gap-3">
                  <img src={b.cover || "/placeholder.svg"} alt="Cover" className="h-16 w-12 object-cover rounded-md border" />
                  <div className="min-w-0">
                    <div className="text-base font-semibold leading-tight line-clamp-1">{b.title}</div>
                    <div className="text-[11px] text-muted-foreground">Last edited {formatDistanceToNow(new Date(b.lastEdited), { addSuffix: true })}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setLastOpenedBookId(b.id); navigate("/book/quill"); }}>Open</Button>
                      <div className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" /> {getBookWordCount(b)} words</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}


      <input ref={importRef} type="file" multiple accept=".json,application/json,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(e) => { if (e.target.files) onImportFiles(e.target.files); }} />

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Book</DialogTitle>
            <DialogDescription>Create a fresh project with your metadata.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input ref={titleRef} placeholder="Title" />
            <Input ref={descRef} placeholder="Short description" />
            <div className="grid gap-2">
              <label className="text-xs text-muted-foreground">Cover</label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" className="gap-2" onClick={() => coverFileRef.current?.click()}><Upload className="h-4 w-4" /> From device</Button>
                <Input ref={coverRef} placeholder="Cover image URL" value={coverUrlInput} onChange={(e) => setCoverUrlInput(e.target.value)} />
              </div>
              {(coverDataUrl || coverUrlInput) && (
                <div className="flex items-center gap-3">
                  <img src={coverDataUrl || coverUrlInput} alt="Cover preview" className="h-20 w-16 object-cover rounded-md border" />
                  <Button type="button" variant="ghost" onClick={() => { setCoverDataUrl(null); setCoverUrlInput(""); }}>Clear</Button>
                </div>
              )}
              <input ref={coverFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setCoverDataUrl(reader.result as string);
                reader.readAsDataURL(file);
                if (coverFileRef.current) coverFileRef.current.value = "";
              }} />
            </div>
            <Input ref={genreRef} placeholder="Genre" />
            <Input ref={tagsRef} placeholder="Tags (comma-separated)" />
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select defaultValue="draft" onValueChange={(v) => setNewStatus(v as any)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancel</Button>
            <Button onClick={onCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
