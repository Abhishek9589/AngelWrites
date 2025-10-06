import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RichEditor from "@/components/RichEditor";
import { sanitizeHtml } from "@/lib/html";
import {
  formatDate,
  loadPoems,
  savePoems,
  updatePoem,
  updatePoemWithVersion,
  deletePoem,
  setLastOpenedPoemId,
  normalizeTags,
} from "@/lib/poems";
import { exportPoemsToDOCX } from "@/lib/exporters";
import BackButton from "@/components/BackButton";
import { Edit, Star, StarOff, Trash, FileDown, BookText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parse, isValid } from "date-fns";

/**
 * @typedef {{ id: string, title:string, content:string, date:string, tags:string[], favorite?:boolean, type?:string }} Poem
 */

export default function BookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [poems, setPoems] = useState(() => loadPoems());
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editDateText, setEditDateText] = useState("");
  const [editContent, setEditContent] = useState("");
  const [renaming, setRenaming] = useState(false);
  const titleInputRef = useRef(null);
  const [showNewChapter, setShowNewChapter] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState(null);
  const [selectedChapterTitle, setSelectedChapterTitle] = useState("");
  const [editBaseHtml, setEditBaseHtml] = useState("");
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [selectedViewChapterId, setSelectedViewChapterId] = useState(null);
  const [editType, setEditType] = useState("book");
  const [editGenre, setEditGenre] = useState("");
  // Pending quick actions when opening editor from sidebar
  const pendingOpenChapterIdRef = useRef(null);
  const pendingDeleteChapterIdRef = useRef(null);
  // Chapter delete dialog state
  const [openDeleteChapter, setOpenDeleteChapter] = useState(false);
  const [pendingDeleteChapterId, setPendingDeleteChapterId] = useState(null);

  useEffect(() => { savePoems(poems); }, [poems]);

  const book = useMemo(() => poems.find((p) => p.id === id) || null, [poems, id]);
  useEffect(() => { if (!book) console.warn("Book not found for id", id); }, [book, id]);
  useEffect(() => { if (book) setLastOpenedPoemId(book.id); }, [book?.id]);

  // Auto-open editor from query param ?edit=1
  useEffect(() => {
    if (!book) return;
    const sp = new URLSearchParams(location.search);
    const ed = sp.get("edit");
    if ((ed === "1" || ed === "true") && !openEdit) setOpenEdit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id]);

  useEffect(() => {
    if (book && openEdit) {
      setEditTitle(book.title);
      const d = book.date ? new Date(book.date) : new Date();
      setEditDateText(format(d, "dd/MM/yyyy"));
      const built = buildChapters(book.content);
      setEditBaseHtml(built.html);
      setSelectedChapterId(null);
      setSelectedChapterTitle("");
      setEditContent("");
      setEditType(book.type === "poem" ? "poem" : "book");
      setRenaming(false);
      setShowNewChapter(false);
      setEditContent(built.html);
      const genreTag = (book.tags || []).find((t) => t.toLowerCase().startsWith("genre:"));
      setEditGenre(genreTag ? genreTag.slice(6).trim() : "");
      // Apply any pending quick actions from sidebar
      if (pendingOpenChapterIdRef.current) {
        const cid = pendingOpenChapterIdRef.current;
        pendingOpenChapterIdRef.current = null;
        handleSelectChapter(cid);
      }
      if (pendingDeleteChapterIdRef.current) {
        const delId = pendingDeleteChapterIdRef.current;
        pendingDeleteChapterIdRef.current = null;
        setSelectedViewChapterId(delId);
        setSelectedChapterId(delId);
        setTimeout(() => handleDeleteChapter(), 0);
      }
    }
  }, [book, openEdit]);

  // Autosave all fields every 30 seconds while editing
  useEffect(() => {
    if (!book || !openEdit) return;
    const interval = window.setInterval(() => {
      let merged = editBaseHtml || book.content;
      if (selectedChapterId) {
        merged = replaceChapterSection(merged, selectedChapterId, selectedChapterTitle, editContent);
      } else if (editContent) {
        merged = editContent;
      }
      let iso = book.date;
      const m = editDateText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) {
        const d = parse(`${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3]}`, "dd/MM/yyyy", new Date());
        if (isValid(d)) iso = format(d, "yyyy-MM-dd");
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(editDateText)) {
        iso = editDateText;
      }
      const nextType = editType;
      const nextTitle = editTitle.trim();
      const nonGenre = (book.tags || []).filter((t) => !t.toLowerCase().startsWith("genre:"));
      const nextTags = nextType === "book" && editGenre.trim() ? normalizeTags([...nonGenre, `genre:${editGenre}`]) : nonGenre;
      const changed = merged !== book.content || nextTitle !== book.title || iso !== book.date || nextType !== book.type || JSON.stringify(nextTags) !== JSON.stringify(book.tags);
      if (changed) {
        setPoems((prev) => updatePoemWithVersion(prev, book.id, { title: nextTitle, content: merged, date: iso, type: nextType, tags: nextTags }, { snapshot: true, max: 30 }));
        setEditBaseHtml(merged);
      }
    }, 30000);
    return () => window.clearInterval(interval);
  }, [book, openEdit, editBaseHtml, selectedChapterId, selectedChapterTitle, editContent, editTitle, editDateText, editType, editGenre]);

  // Lock background scroll when the editor overlay is open
  useEffect(() => {
    if (!openEdit) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [openEdit]);

  if (!book) {
    return (
      <div className="container py-10">
        <BackButton />
        <h1 className="mt-6 text-2xl font-semibold">Item not found</h1>
      </div>
    );
  }

  const toggleFavorite = () => setPoems((prev) => prev.map((it) => (it.id === book.id ? { ...it, favorite: !book.favorite } : it)));
  const confirmDelete = () => {
    const next = poems.filter((p) => p.id !== book.id);
    setPoems(next);
    savePoems(next);
    setOpenDelete(false);
    navigate("/");
  };

  const saveEdits = () => {
    // convert DD/MM/YYYY to ISO yyyy-MM-dd
    const m = editDateText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    let iso = book.date;
    if (m) {
      const d = parse(`${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3]}`, "dd/MM/yyyy", new Date());
      if (isValid(d)) iso = format(d, "yyyy-MM-dd");
    }
    let merged = editBaseHtml || book.content;
    if (selectedChapterId) merged = replaceChapterSection(merged, selectedChapterId, selectedChapterTitle, editContent);
    else if (editContent) merged = editContent;
    const prevType = book.type === "poem" ? "poem" : "book";
    const nextType = editType;
    const nonGenre = (book.tags || []).filter((t) => !t.toLowerCase().startsWith("genre:"));
    const nextTags = nextType === "book" && editGenre.trim() ? normalizeTags([...nonGenre, `genre:${editGenre}`]) : nonGenre;
    setPoems((prev) => updatePoem(prev, book.id, { title: editTitle.trim(), content: merged, date: iso, type: nextType, tags: nextTags }));
    if (nextType === "book") {
      setSelectedViewChapterId(selectedChapterId || viewChapters.toc[0]?.id || null);
    }
    setOpenEdit(false);
    if (prevType !== nextType) {
      if (nextType === "poem") navigate(`/poem/${book.id}`, { replace: true });
    }
  };


  /**
   * @typedef {{id:string, text:string, level:number}} TocItem
   */
  // Build chapters list from content headings and inject anchor ids
  const buildChapters = (html) => {
    const clean = sanitizeHtml(html || "");
    const template = document.createElement("template");
    template.innerHTML = clean;
    const used = new Set();
    let seq = 0;
    let toc = [];
    const headings = Array.from(template.content.querySelectorAll("h1,h2,h3"));
    const slug = (t) => t.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "chapter";
    headings.forEach((el, i) => {
      const txt = (el.textContent || "").trim();
      const idBase = el.id || `ch-${i}-${slug(txt)}`;
      let id = idBase;
      let k = 1;
      while (used.has(id)) { id = `${id}-${k++}`; }
      used.add(id);
      el.id = id;
      const level = Number(el.tagName.substring(1)) || 1;
      const createdAttr = Number(el.getAttribute("data-created"));
      const created = Number.isFinite(createdAttr) && createdAttr > 0 ? createdAttr : (seq++);
      if (!el.hasAttribute("data-created")) el.setAttribute("data-created", String(created));
      toc.push({ id, text: txt || `Chapter ${i + 1}`, level, created, index: i });
    });
    // Sort by first created (oldest first); fallback to original order
    toc = toc.sort((a, b) => (a.created - b.created) || (a.index - b.index));
    // Drop helper fields
    const simple = toc.map(({ id, text, level }) => ({ id, text, level }));
    return { toc: simple, html: template.innerHTML };
  };
  const viewChapters = useMemo(() => buildChapters(book.content), [book.content]);
  const selectedViewHtml = useMemo(() => {
    if (!selectedViewChapterId) return null;
    const { title, level, content } = extractChapterSection(viewChapters.html, selectedViewChapterId);
    return `<h${level} id="${selectedViewChapterId}">${escapeHtml(title)}</h${level}>${content}`;
  }, [selectedViewChapterId, viewChapters.html]);
  const baseChapters = useMemo(() => buildChapters(editBaseHtml || book.content), [editBaseHtml, book.content]);

  // Ensure preview defaults to first chapter when available and stays valid
  useEffect(() => {
    const toc = viewChapters.toc;
    if (!toc || toc.length === 0) {
      if (selectedViewChapterId) setSelectedViewChapterId(null);
      return;
    }
    const ids = new Set(toc.map((c) => c.id));
    if (!selectedViewChapterId || !ids.has(selectedViewChapterId)) {
      setSelectedViewChapterId(toc[0].id);
    }
  }, [viewChapters.html]);

  function extractChapterSection(html, chapterId) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    const heading = template.content.querySelector(`#${CSS.escape(chapterId)}`);
    if (!heading) return { title: "", level: 1, content: html };
    const level = Number(heading.tagName.substring(1)) || 1;
    const title = (heading.textContent || "").trim();
    const parts = [];
    let node = heading.nextSibling;
    while (node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node;
        const tag = el.tagName.toUpperCase();
        if (tag === "H1" || tag === "H2" || tag === "H3") {
          const nextLevel = Number(tag.substring(1)) || 1;
          if (nextLevel <= level) break;
        }
      }
      const div = document.createElement("div");
      div.appendChild(node.cloneNode(true));
      parts.push(div.innerHTML);
      node = node.nextSibling;
    }
    return { title, level, content: parts.join("") };
  }

  function replaceChapterSection(html, chapterId, newTitle, newContent) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    const heading = template.content.querySelector(`#${CSS.escape(chapterId)}`);
    if (!heading) return newContent || html;
    const level = Number(heading.tagName.substring(1)) || 1;
    // Update heading text
    heading.textContent = newTitle || heading.textContent || "";
    // Remove existing section content until next heading of same or higher level
    let node = heading.nextSibling;
    const toRemove = [];
    while (node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node;
        const tag = el.tagName.toUpperCase();
        if (tag === "H1" || tag === "H2" || tag === "H3") {
          const nextLevel = Number(tag.substring(1)) || 1;
          if (nextLevel <= level) break;
        }
      }
      toRemove.push(node);
      node = node.nextSibling;
    }
    toRemove.forEach((n) => n.parentNode && n.parentNode.removeChild(n));
    // Insert new content nodes after heading
    const wrapper = document.createElement("div");
    wrapper.innerHTML = newContent || "";
    const parent = heading.parentNode;
    const after = heading.nextSibling;
    Array.from(wrapper.childNodes).forEach((child) => parent.insertBefore(child, after));
    return (template.innerHTML || "").trim();
  }

  function deleteChapterSection(html, chapterId) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    const heading = template.content.querySelector(`#${CSS.escape(chapterId)}`);
    if (!heading) return html || "";
    const level = Number(heading.tagName.substring(1)) || 1;
    // Collect nodes to remove: the heading itself and all following siblings
    // until the next heading of same or higher level.
    const toRemove = [heading];
    let node = heading.nextSibling;
    while (node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node;
        const tag = el.tagName.toUpperCase();
        if (tag === "H1" || tag === "H2" || tag === "H3") {
          const nextLevel = Number(tag.substring(1)) || 1;
          if (nextLevel <= level) break;
        }
      }
      toRemove.push(node);
      node = node.nextSibling;
    }
    toRemove.forEach((n) => n.parentNode && n.parentNode.removeChild(n));
    return (template.innerHTML || "").trim();
  }

  function performDeleteChapter(targetId) {
    const id = targetId || selectedChapterId || selectedViewChapterId;
    if (!id) return;
    if (openEdit) {
      const merged = deleteChapterSection(editBaseHtml || book.content, id);
      setEditBaseHtml(merged);
      if (selectedChapterId === id) {
        setSelectedChapterId(null);
        setSelectedChapterTitle("");
      }
      setShowNewChapter(false);
      setEditContent(merged);
    } else {
      const built = buildChapters(book.content);
      const merged = deleteChapterSection(built.html, id);
      // Persist to poems and save immediately, mirroring book/poem delete flow
      setPoems((prev) => {
        const next = updatePoem(prev, book.id, { content: merged });
        savePoems(next);
        return next;
      });
      // Keep local edit HTML in sync so future edits reflect deletion immediately
      setEditBaseHtml(merged);
      // Update current preview selection
      const nextView = buildChapters(merged);
      const has = nextView.toc.some((c) => c.id === selectedViewChapterId);
      if (!has) setSelectedViewChapterId(nextView.toc[0]?.id || null);
    }
  }

  function handleDeleteChapter(targetId) {
    const id = targetId || selectedViewChapterId || selectedChapterId;
    if (!id) return;
    setPendingDeleteChapterId(id);
    setOpenDeleteChapter(true);
  }

  function commitRenameChapterTitle() {
    if (!selectedChapterId) return;
    const t = selectedChapterTitle.trim();
    if (!t) return;
    const merged = replaceChapterSection(editBaseHtml || book.content, selectedChapterId, t, editContent);
    setEditBaseHtml(merged);
  }

  function handleSelectChapter(id) {
    const { title, content } = extractChapterSection(baseChapters.html, id);
    setSelectedChapterId(id);
    setSelectedChapterTitle(title);
    setEditContent(content);

  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function slugify(t) {
    return t.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "chapter";
  }

  function handleCreateChapter() {
    const title = newChapterTitle.trim();
    if (!title) return;
    let base = slugify(title);
    let id = `ch-new-${base}`;
    const used = new Set(baseChapters.toc.map((c) => c.id));
    let k = 1;
    while (used.has(id)) { id = `ch-new-${base}-${k++}`; }
    const heading = `<h2 id="${id}" data-created="${Date.now()}">${escapeHtml(title)}</h2>`;
    const merged = (editBaseHtml || book.content || "") + heading;
    setEditBaseHtml(merged);
    setSelectedChapterId(id);
    setSelectedChapterTitle(title);
    setEditContent("");
    setNewChapterTitle("");

  }

  useEffect(() => {
    if (selectedViewChapterId) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedViewChapterId]);

  return (
    <div className="container py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="sm:hidden w-full flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <BackButton />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="gap-2 border-2 border-primary focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                onClick={() => exportPoemsToDOCX([book], `${book.title}.docx`)}
              >
                <FileDown className="h-4 w-4" /> DOCX
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFavorite}
                aria-label={book.favorite ? "Unfavorite" : "Favorite"}
              >
                {book.favorite ? (
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

        <div className="hidden sm:flex w-full items-center justify-between gap-2">
          <BackButton />
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <div className="rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100 text-xs px-2 py-0.5 flex items-center gap-1">
              <BookText className="h-3.5 w-3.5" /> Book
            </div>
            <Button
              variant="outline"
              onClick={() => exportPoemsToDOCX([book], `${book.title}.docx`)}
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
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFavorite}
              aria-label={book.favorite ? "Unfavorite" : "Favorite"}
            >
              {book.favorite ? (
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
              <DialogTitle>Delete book</DialogTitle>
              <DialogDescription>Are you sure you want to delete this book? This action cannot be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenDelete(false)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={openDeleteChapter} onOpenChange={setOpenDeleteChapter}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete chapter</DialogTitle>
              <DialogDescription>Are you sure you want to delete this chapter? This action cannot be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenDeleteChapter(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  performDeleteChapter(pendingDeleteChapterId);
                  setOpenDeleteChapter(false);
                  setPendingDeleteChapterId(null);
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6">
        <h1 className="text-3xl font-extrabold tracking-tight">{book.title}</h1>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <div className="rounded-md bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100 px-2 py-0.5">Book</div>
          <span className="text-muted-foreground">{formatDate(book.date)}</span>
          {(() => { const g = (book.tags || []).find((t) => t.toLowerCase().startsWith("genre:")); return g ? <Badge variant="secondary">{g.slice(6).trim()}</Badge> : null; })()}
        </div>
        <div className="mt-6 flex flex-col md:flex-row gap-6">
          <aside className="w-full md:w-[30%]">
            <div className="rounded-2xl glass p-4">
              <h3 className="font-semibold cursor-pointer hover:underline" onClick={() => setSelectedViewChapterId(null)} title="Show whole document">Chapters</h3>
              <ul className="mt-2 space-y-1">
                {viewChapters.toc.length > 0 ? viewChapters.toc.map((c, idx) => (
                  <li key={c.id} className="group flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedViewChapterId(c.id)}
                      className={`flex-1 min-w-0 text-left text-sm hover:underline ${selectedViewChapterId === c.id ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      <span className="truncate">{c.text || `Chapter ${idx + 1}`}</span>
                    </button>
                    <div className="shrink-0 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Rename chapter"
                        onClick={() => {
                          pendingOpenChapterIdRef.current = c.id;
                          setOpenEdit(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        aria-label="Delete chapter"
                        onClick={() => handleDeleteChapter(c.id)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                )) : (
                  <li className="text-sm text-muted-foreground">No chapters</li>
                )}
              </ul>
            </div>
          </aside>
          <section className="w-full md:w-[70%]">
            <div className="prose prose-neutral dark:prose-invert leading-7" dangerouslySetInnerHTML={{ __html: selectedViewHtml ?? viewChapters.html }} />
          </section>
        </div>
      </div>

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
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:items-center md:gap-2">
                  {/* Type selector removed per request */}

                  {editType === "book" && (
                    <div className="flex items-center gap-2">
                      <Select
                        value={showNewChapter ? "__new__" : (selectedChapterId ?? "__all__")}
                        onValueChange={(v) => {
                          if (v === "__all__") {
                            setSelectedChapterId(null);
                            setSelectedChapterTitle("");
                            setShowNewChapter(false);
                            setNewChapterTitle("");
                            setEditContent(editBaseHtml || book.content);
                          } else if (v === "__new__") {
                            setShowNewChapter(true);
                            setSelectedChapterId(null);
                            setSelectedChapterTitle("");
                            setNewChapterTitle("");
                          } else {
                            handleSelectChapter(v);
                            setShowNewChapter(false);
                            setNewChapterTitle("");
                          }
                        }}
                      >
                        <SelectTrigger className="w-[280px]">
                          {showNewChapter ? (
                            <input
                              value={newChapterTitle}
                              onChange={(e) => setNewChapterTitle(e.target.value)}
                              placeholder="New chapter title"
                              className="flex-1 min-w-0 bg-transparent outline-none text-sm pr-6"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const t = newChapterTitle.trim();
                                  if (t) { handleCreateChapter(); setShowNewChapter(false); }
                                  else { setShowNewChapter(false); setNewChapterTitle(""); }
                                } else if (e.key === " " || e.code === "Space" || e.key === "Spacebar") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setNewChapterTitle((prev) => prev + " ");
                                } else {
                                  e.stopPropagation();
                                }
                              }}
                              onKeyUp={(e) => {
                                if (e.key === " " || e.code === "Space" || e.key === "Spacebar") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }
                              }}
                              onBlur={() => {
                                const t = newChapterTitle.trim();
                                if (t) { handleCreateChapter(); setShowNewChapter(false); }
                                else { setShowNewChapter(false); setNewChapterTitle(""); }
                              }}
                            />
                          ) : selectedChapterId ? (
                            <input
                              value={selectedChapterTitle}
                              onChange={(e) => setSelectedChapterTitle(e.target.value)}
                              placeholder="Chapter title"
                              className="flex-1 min-w-0 bg-transparent outline-none text-sm pr-6"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  commitRenameChapterTitle();
                                  e.currentTarget.blur();
                                } else if (e.key === " " || e.code === "Space" || e.key === "Spacebar") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedChapterTitle((prev) => prev + " ");
                                } else {
                                  e.stopPropagation();
                                }
                              }}
                              onKeyUp={(e) => {
                                if (e.key === " " || e.code === "Space" || e.key === "Spacebar") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }
                              }}
                              onBlur={() => commitRenameChapterTitle()}
                            />
                          ) : (
                            <span className="text-muted-foreground">Whole document</span>
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Whole document</SelectItem>
                          {baseChapters.toc.map((c, idx) => (
                            <SelectItem key={c.id} value={c.id}>{c.text || `Chapter ${idx + 1}`}</SelectItem>
                          ))}
                          <SelectItem value="__new__">Add new chapter…</SelectItem>
                        </SelectContent>
                      </Select>

                      {null}

                    </div>
                  )}

                  {editType === "book" && (
                    <Input
                      placeholder="Genre (e.g., Fiction)"
                      value={editGenre}
                      onChange={(e) => setEditGenre(e.target.value)}
                      className="w-[200px]"
                    />
                  )}
                  <div className="relative">
                    <Input
                      type="date"
                      value={editDateText}
                      onChange={(e) => setEditDateText(e.target.value)}
                      className="w-[160px]"
                    />
                  </div>
                  <div className="flex items-center gap-2 md:ml-2">
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
                placeholder="Write your book..."
              />
            </div>


          </div>
        </div>
      )}
    </div>
  );
}
