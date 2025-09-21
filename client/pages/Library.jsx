import { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { loadPoems, savePoems, updatePoem, preview as previewPoem, formatDate as formatPoemDate, createPoem, sortPoems, generateId } from "@/lib/poems";
import { useIsMobile } from "@/hooks/use-mobile";
import { Star, StarOff, BookText, PenSquare, Layers, ArrowDownAZ, ArrowUpAZ, History, CheckCircle2, FileClock, ListFilter, Upload } from "lucide-react";
import { toast } from "sonner";

export default function Library() {
  const [poems, setPoems] = useState(() => loadPoems());
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("edited_desc");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const importRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const isMobile = useIsMobile();
  const [page, setPage] = useState(1);

  useEffect(() => { savePoems(poems); }, [poems]);

  // Refresh from storage when page gains focus or storage changes
  useEffect(() => {
    const refresh = () => setPoems(loadPoems());
    window.addEventListener("storage", refresh);
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refresh();
    });
    return () => {
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Reset to first page when filters/sorts change or breakpoint changes
  useEffect(() => { setPage(1); }, [query, typeFilter, statusFilter, sortKey, favoritesOnly, isMobile]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = poems.filter((p) => {
      const matchesQuery = !q || p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q));
      if (!matchesQuery) return false;
      const effectiveType = p.type === "book" || p.type === "poem" ? p.type : "poem";
      const matchesType = typeFilter === "all" || effectiveType === typeFilter;
      const isDraft = !!p.draft;
      const matchesStatus = statusFilter === "all" || (statusFilter === "draft" ? isDraft : !isDraft);
      const matchesFav = !favoritesOnly || !!p.favorite;
      return matchesType && matchesStatus && matchesFav;
    });

    // Sort
    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "alpha":
          return a.title.localeCompare(b.title);
        case "ztoa":
          return b.title.localeCompare(a.title);
        case "edited_asc":
          return (a.updatedAt || 0) - (b.updatedAt || 0);
        case "edited_desc":
        default:
          return (b.updatedAt || 0) - (a.updatedAt || 0);
      }
    });

    return list;
  }, [poems, query, typeFilter, statusFilter, sortKey, favoritesOnly]);

  const toggleFavorite = (p) => setPoems((prev) => prev.map((it) => (it.id === p.id ? { ...it, favorite: !p.favorite } : it)));

  const pageSize = isMobile ? 10 : 15;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);

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
              if (typeof it.date !== "string" || !/\d{4}-\d{2}-\d{2}/.test(it.date)) it.date = new Date().toISOString().slice(0, 10);
              it.type = it.type === "book" ? "book" : "poem";
              importedMap.set(it.id, it);
            });
            jsonCount += imported.length;
          } catch (e) {
            // Show console error for easier debugging and user-facing message
            console.error("Failed to import JSON file", file.name, e);
            toast.error(`Failed to import JSON file: ${file.name}: ${e?.message || "Invalid JSON"}`);
          }
        } else if (isDOCX) {
          try {
            const arrayBuffer = await file.arrayBuffer();
            let docxModule;
            try {
              docxModule = await import("@/lib/docx");
            } catch (e) {
              console.error("Failed to load docx helper", e);
              throw e;
            }
            const { docxArrayBufferToHTML } = docxModule;
            const html = await docxArrayBufferToHTML(arrayBuffer);
            const { sanitizeHtml } = await import("@/lib/html");
            const title = file.name.replace(/\.docx$/i, "");
            const poem = createPoem({ title, content: sanitizeHtml(html), date: new Date().toISOString().slice(0, 10), tags: [], type: "poem" });
            created.push(poem);
          } catch (e) {
            console.error("Failed to import DOCX file", file.name, e);
            toast.error(`Failed to import DOCX file: ${file.name}: ${e?.message || "Parsing error"}`);
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
        const sorted = sortPoems(combined, "edited_desc");
        savePoems(sorted);
        return sorted;
      });
      const parts = [];
      if (jsonCount) parts.push(`JSON: ${jsonCount}`);
      if (created.length) parts.push(`DOCX: ${created.length}`);
      toast.success(`Imported ${parts.join(" and ")}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="container py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-extrabold gradient-text">Library</h1>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Input type="search" placeholder="Search poems and books" data-variant="search" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><span className="inline-flex items-center gap-2"><Layers className="h-4 w-4" /> All</span></SelectItem>
                <SelectItem value="book"><span className="inline-flex items-center gap-2"><BookText className="h-4 w-4" /> Book</span></SelectItem>
                <SelectItem value="poem"><span className="inline-flex items-center gap-2"><PenSquare className="h-4 w-4" /> Poem</span></SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alpha"><span className="inline-flex items-center gap-2"><ArrowDownAZ className="h-4 w-4" /> A to Z</span></SelectItem>
                <SelectItem value="ztoa"><span className="inline-flex items-center gap-2"><ArrowUpAZ className="h-4 w-4" /> Z to A</span></SelectItem>
                <SelectItem value="edited_desc"><span className="inline-flex items-center gap-2"><History className="h-4 w-4" /> Last edited</span></SelectItem>
                <SelectItem value="edited_asc"><span className="inline-flex items-center gap-2"><FileClock className="h-4 w-4" /> First edited</span></SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><span className="inline-flex items-center gap-2"><ListFilter className="h-4 w-4" /> All</span></SelectItem>
                <SelectItem value="draft"><span className="inline-flex items-center gap-2"><PenSquare className="h-4 w-4" /> Draft</span></SelectItem>
                <SelectItem value="completed"><span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Completed</span></SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={favoritesOnly ? "default" : "outline"}
              onClick={() => setFavoritesOnly((v) => !v)}
              className="gap-2"
              aria-pressed={favoritesOnly}
              aria-label="Toggle favorites"
            >
              {favoritesOnly ? (
                <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
              ) : (
                <StarOff className="h-4 w-4" />
              )}
              Favorites
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => importRef.current?.click()} disabled={importing}>
              <Upload className="h-4 w-4" /> Import
            </Button>
          </div>
        </div>
      </div>
      <input ref={importRef} type="file" accept=".doc,.docx,application/json,text/plain" multiple className="hidden" onChange={(e) => { const fs = e.target.files; if (fs && fs.length) onImportFiles(fs); e.currentTarget.value = ""; }} />

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
                  <p className="mt-1 text-xs text-muted-foreground">{formatPoemDate(p.date)}</p>
                </div>
                <button
                  className={`rounded-full p-2 transition ${p.favorite ? "text-yellow-500" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => toggleFavorite(p)}
                  aria-label={p.favorite ? "Unfavorite" : "Favorite"}
                >
                  {p.favorite ? <Star className="h-4 w-4 fill-yellow-500" /> : <StarOff className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{previewPoem(p.content, 160)}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.tags.filter((t) => !t.toLowerCase().startsWith("genre:")).map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
              <div className="mt-4">
                <Link to={`${p.type === "book" ? "/book" : "/poem"}/${p.id}`}><Button variant="outline" size="sm">Open</Button></Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {totalPages > 1 && (
        <div className="fixed bottom-2 left-1/2 z-40 -translate-x-1/2 w-[min(95vw,420px)] sm:bottom-4 sm:left-auto sm:right-4 sm:translate-x-0 sm:w-auto">
          <div className="flex items-center gap-2 rounded-md border bg-background/95 px-3 py-2 shadow-lg w-full sm:w-auto justify-center sm:justify-start">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <label htmlFor="libPageInput" className="sr-only">Page</label>
              <input
                id="libPageInput"
                type="number"
                min={1}
                max={totalPages}
                value={currentPage}
                onKeyDown={(e) => { if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault(); }}
                onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) setPage(Math.min(Math.max(1, n), totalPages)); }}
                onBlur={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) setPage(Math.min(Math.max(1, n), totalPages)); }}
                onKeyUp={(e) => { if (e.key === "Enter") { const n = Number(e.target.value); if (!Number.isNaN(n)) setPage(Math.min(Math.max(1, n), totalPages)); } }}
                className="w-14 rounded-2xl border bg-background px-2 py-1 text-center text-sm"
              />
              <span>/ {totalPages}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">No items found.</p>
      )}
    </div>
  );
}
