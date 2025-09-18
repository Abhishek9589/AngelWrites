import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Book,
  exportBookToDOCX,
  exportBooksJSON,
  getBookWordCount,
  loadBooks,
  saveBooks,
  createDOCXBlobForBook,
} from "@/lib/books";
import JSZip from "jszip";
import { FileDown, FileJson, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { loadSiteTitle } from "@/lib/site";

function sanitizeFilename(name: string, ext: string) {
  const base = name.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 80) || "book";
  return `${base}.${ext}`;
}

function textFromHTML(html: string): string {
  return (html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function matchesQuery(b: Book, q: string): boolean {
  if (!q) return true;
  const qq = q.toLowerCase().trim();
  if (!qq) return true;
  if (b.title.toLowerCase().includes(qq)) return true;
  if ((b.description || "").toLowerCase().includes(qq)) return true;
  if ((b.genre || "").toLowerCase().includes(qq)) return true;
  if ((b.tags || []).some((t) => t.toLowerCase().includes(qq))) return true;
  const html = b.chapters && b.chapters.length ? b.chapters.map((c) => c.content).join("\n") : b.content;
  if (textFromHTML(html).includes(qq)) return true;
  return false;
}

export default function BookManage() {
  const [books, setBooks] = useState<Book[]>(() => loadBooks());
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openDelete, setOpenDelete] = useState(false);

  useEffect(() => { saveBooks(books); }, [books]);

  const filtered = useMemo(() => {
    const base = books.filter((b) => matchesQuery(b, query));
    // newest edited first
    return base.sort((a, b) => new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime());
  }, [books, query]);

  const allChecked = selected.size > 0 && filtered.every((b) => selected.has(b.id));

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(filtered.map((b) => b.id)));
  };

  const exportSelectedJSON = () => {
    if (selected.size === 0) return toast.info("Select books first.");
    const list = books.filter((b) => selected.has(b.id));
    const site = loadSiteTitle();
    exportBooksJSON(list, sanitizeFilename(`${site}-books-selected`, "json"));
  };


  async function exportSelectedDOCXZip() {
    if (selected.size === 0) return toast.info("Select books first.");
    const list = books.filter((b) => selected.has(b.id));

    if (list.length === 1) {
      const b = list[0];
      exportBookToDOCX(b, sanitizeFilename(b.title, "docx"));
      return;
    }

    const zip = new JSZip();
    for (const b of list) {
      const blob = await createDOCXBlobForBook(b);
      zip.file(sanitizeFilename(b.title, "docx"), blob);
    }
    const out = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(out);
    const a = document.createElement("a");
    a.href = url;
    a.download = "books-docx.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function deleteSelected() {
    if (selected.size === 0) return toast.info("Select books first.");
    setOpenDelete(true);
  }
  function confirmDelete() {
    setBooks((prev) => prev.filter((b) => !selected.has(b.id)));
    setSelected(new Set());
    setOpenDelete(false);
  }

  return (
    <main className="container book-mode py-10 animate-in fade-in-0 slide-in-from-bottom-2 duration-700">
      <h1 className="text-2xl font-bold">Manage</h1>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-96">
            <Input type="search" placeholder="Search books" data-variant="search" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Button variant="outline" onClick={toggleAll} className="shrink-0">{allChecked ? "Clear" : "Select All"}</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={exportSelectedJSON} className="gap-2 border-2 border-primary"><FileJson className="h-4 w-4" /> JSON</Button>
          <Button variant="outline" onClick={exportSelectedDOCXZip} className="gap-2 border-2 border-primary"><FileDown className="h-4 w-4" /> DOCX</Button>
          <Button variant="destructive" onClick={deleteSelected}><Trash2 className="h-4 w-4" aria-label="Delete" /></Button>
        </div>
      </div>


      <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((b) => (
          <Card
            key={b.id}
            role="button"
            tabIndex={0}
            aria-pressed={selected.has(b.id)}
            onClick={() => toggle(b.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(b.id); } }}
            className={selected.has(b.id) ? "ring-2 ring-ring bg-white/60 dark:bg-white/15" : ""}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <img src={b.cover || "/placeholder.svg"} alt="Cover" className="h-16 w-12 object-cover rounded-md border" />
                  <div>
                    <h3 className="font-semibold tracking-tight line-clamp-1">{b.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(b.lastEdited).toLocaleDateString()}</p>
                    <div className="mt-1 text-xs text-muted-foreground">{getBookWordCount(b)} words</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {(b.tags || []).map((t) => (<Badge key={t} variant="secondary" className="text-xs">{t}</Badge>))}
                      {b.genre ? <Badge variant="outline" className="text-xs">{b.genre}</Badge> : null}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-sm text-muted-foreground py-8">No books found</div>
        )}
      </section>

      <p className="mt-3 text-xs text-muted-foreground">Tip: Click cards to select. Use Select All to toggle.</p>

      <Dialog open={openDelete} onOpenChange={setOpenDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete selected</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selected.size} selected book{selected.size === 1 ? "" : "s"}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
