import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import RichEditor from "@/components/RichEditor";
import { sanitizeHtml } from "@/lib/html";
import {
  Poem,
  formatDate,
  loadPoems,
  savePoems,
  updatePoem,
  updatePoemWithVersion,
  restoreVersion,
  deletePoem,
  normalizeTags,
} from "@/lib/poems";
import { exportPoemsToDOCX } from "@/lib/exporters";
import BackButton from "@/components/BackButton";
import { Edit, Star, StarOff, Trash, FileDown, Pencil } from "lucide-react";
import { format, parse, isValid } from "date-fns";

export default function PoemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [poems, setPoems] = useState<Poem[]>(() => loadPoems());
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);

  // Local edit state for full-screen editor
  const [editTitle, setEditTitle] = useState("");
  const [editDateText, setEditDateText] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");
  const [renaming, setRenaming] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { savePoems(poems); }, [poems]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const metaS = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
      if (openEdit) {
        if (metaS) { e.preventDefault(); saveEdits(); return; }
        if (e.key === "Escape") { e.preventDefault(); setOpenEdit(false); return; }
      } else {
        if (e.key.toLowerCase() === "e") { e.preventDefault(); setOpenEdit(true); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openEdit, editTitle, editDateText, editContent]);

  const poem = useMemo(() => poems.find((p) => p.id === id) || null, [poems, id]);
  useEffect(() => { if (!poem) console.warn("Poem not found for id", id); }, [poem, id]);

  useEffect(() => {
    if (poem && openEdit) {
      setEditTitle(poem.title);
      const d = poem.date ? new Date(poem.date) : new Date();
      setEditDateText(format(d, "dd/MM/yyyy"));
      setEditContent(poem.content);
      setEditTags((poem.tags || []).join(", "));
      setRenaming(false);
    }
  }, [poem, openEdit]);

  // Autosave content while editing (debounced)
  useEffect(() => {
    if (!poem || !openEdit) return;
    if (editContent === poem.content) return;
    const t = window.setTimeout(() => {
      setPoems((prev) => updatePoemWithVersion(prev, poem.id, { content: editContent }, { snapshot: true, max: 30 }));
    }, 800);
    return () => window.clearTimeout(t);
  }, [editContent, openEdit, poem]);

  // Lock background scroll when the editor overlay is open
  useEffect(() => {
    if (!openEdit) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [openEdit]);

  if (!poem) {
    return (
      <div className="container py-10">
        <BackButton />
        <h1 className="mt-6 text-2xl font-semibold">Poem not found</h1>
      </div>
    );
  }

  const toggleFavorite = () => setPoems((prev) => updatePoem(prev, poem.id, { favorite: !poem.favorite }));
  const confirmDelete = () => {
    setPoems((prev) => prev.filter((p) => p.id !== poem.id));
    setOpenDelete(false);
    navigate("/");
  };

  const saveEdits = () => {
    // convert DD/MM/YYYY to ISO yyyy-MM-dd
    const m = editDateText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    let iso = poem.date;
    if (m) {
      const d = parse(`${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3]}`, "dd/MM/yyyy", new Date());
      if (isValid(d)) iso = format(d, "yyyy-MM-dd");
    }
    const tags = normalizeTags(editTags.split(",").map((t) => t.trim()).filter(Boolean));
    setPoems((prev) => updatePoem(prev, poem.id, { title: editTitle.trim(), content: editContent, date: iso, tags }));
    setOpenEdit(false);
  };

  return (
    <div className="container py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Mobile layout: 2 rows */}
        <div className="sm:hidden w-full flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <BackButton />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="gap-2 border-2 border-primary focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                onClick={() => setOpenHistory(true)}
              >
                History
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFavorite}
                aria-label={poem.favorite ? "Unfavorite" : "Favorite"}
              >
                {poem.favorite ? (
                  <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                ) : (
                  <StarOff className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => exportPoemsToDOCX([poem], `${poem.title}.docx`)}
              className="gap-2 border-2 border-primary focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <FileDown className="h-4 w-4" /> DOCX
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-2 border-primary focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              onClick={() => setOpenEdit(true)}
            >
              <Edit className="h-4 w-4" /> Edit
            </Button>
            <Button
              variant="destructive"
              size="icon"
              aria-label="Delete"
              onClick={() => setOpenDelete(true)}
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Desktop layout */}
        <div className="hidden sm:flex w-full items-center justify-between gap-2">
          <BackButton />
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => exportPoemsToDOCX([poem], `${poem.title}.docx`)}
              className="gap-2 border-2 border-primary focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <FileDown className="h-4 w-4" /> DOCX
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-2 border-primary focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              onClick={() => setOpenEdit(true)}
            >
              <Edit className="h-4 w-4" /> Edit
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-2 border-primary focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              onClick={() => setOpenHistory(true)}
            >
              History
            </Button>
            <Button
              variant="destructive"
              size="icon"
              aria-label="Delete"
              onClick={() => setOpenDelete(true)}
            >
              <Trash className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFavorite}
              aria-label={poem.favorite ? "Unfavorite" : "Favorite"}
            >
              {poem.favorite ? (
                <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
              ) : (
                <StarOff className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <Dialog open={openDelete} onOpenChange={setOpenDelete}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete poem</DialogTitle>
              <DialogDescription>Are you sure you want to delete this poem? This action cannot be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenDelete(false)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <article className="mx-auto mt-6 max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight">{poem.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{formatDate(poem.date)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {poem.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
        </div>
        {poem.draft && (
          <div className="mt-2 inline-block rounded-md bg-yellow-100 text-yellow-900 text-[10px] px-2 py-0.5 dark:bg-yellow-900 dark:text-yellow-100">Draft</div>
        )}
        <div className="prose prose-neutral dark:prose-invert mt-6 leading-7" dangerouslySetInnerHTML={{ __html: sanitizeHtml(poem.content) }} />
      </article>

      {openEdit && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-xl overflow-y-auto">
          <div className="container mx-auto flex min-h-full flex-col gap-3 py-4">
            <div className="rounded-2xl glass px-4 py-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {!renaming ? (
                    <h2 className="text-xl md:text-2xl font-extrabold truncate gradient-text" title={editTitle}>{editTitle}</h2>
                  ) : (
                    <Input
                      ref={titleInputRef}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="max-w-xl text-lg md:text-xl"
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Rename"
                    onClick={() => {
                      setRenaming((v) => !v);
                      setTimeout(() => titleInputRef.current?.focus(), 0);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:items-center md:gap-2">
                  <div className="relative">
                    <Input
                      type="date"
                      value={editDateText}
                      onChange={(e) => setEditDateText(e.target.value)}
                      className="w-[160px]"
                    />
                  </div>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">#</span>
                    <Input
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="tags, comma, separated"
                      className="pl-7 w-[260px] md:w-[300px]"
                    />
                  </div>
                  <div className="flex items-center gap-2 md:ml-2">
                    <span className="hidden md:inline text-xs text-muted-foreground">Autosaving…</span>
                    <Button variant="outline" onClick={() => setOpenEdit(false)}>Close</Button>
                    <Button onClick={saveEdits}>Save</Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 pb-16">
              <RichEditor
                value={editContent}
                onChange={setEditContent}
                placeholder="Edit your poem..."
              />
            </div>

            <EditorFooterStats content={editContent} />
          </div>
        </div>
      )}
      <Dialog open={openHistory} onOpenChange={setOpenHistory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Version history</DialogTitle>
            <DialogDescription>Restore an earlier version of this poem.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto space-y-2">
            {(poem.versions || []).slice().reverse().map((v) => (
              <div key={v.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-muted-foreground">{new Date(v.ts).toLocaleString()}</div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPoems((prev) => restoreVersion(prev, poem.id, v.id));
                        setOpenHistory(false);
                      }}
                    >
                      Restore
                    </Button>
                  </div>
                </div>
                <div className="mt-2 line-clamp-3 text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: v.content }} />
              </div>
            ))}
            {(poem.versions || []).length === 0 && (
              <div className="text-sm text-muted-foreground">No versions yet. Versions are created automatically while editing.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditorFooterStats({ content }: { content: string }) {
  const withoutTags = String(content || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
  const text = withoutTags.replace(/\s+/g, " ").trim();
  const words = text ? text.split(" ").length : 0;
  const chars = text.length;

  return (
    <div className="sticky bottom-3 z-50 mx-auto max-w-3xl">
      <div className="glass-soft rounded-full px-4 py-2 text-xs flex items-center justify-between gap-4">
        <span className="text-muted-foreground">{words} words</span>
        <span className="text-muted-foreground">{chars} characters</span>
      </div>
    </div>
  );
}
