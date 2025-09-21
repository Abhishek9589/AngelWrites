import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  loadPoems,
  searchPoems,
  sortPoems,
  toJSON,
  download,
  savePoems,
  formatDate,
} from "@/lib/poems";
import { createDOCXBlobForPoem } from "@/lib/exporters";
import { FileDown, FileJson, Trash2 } from "lucide-react";
import JSZip from "jszip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import Themes from "./Themes";

export default function Manage() {
  const [poems, setPoems] = useState(() => loadPoems());
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [selected, setSelected] = useState(new Set());
  const [openDelete, setOpenDelete] = useState(false);
  const [showThemes, setShowThemes] = useState(false);

  useEffect(() => { savePoems(poems); }, [poems]);

  const filtered = useMemo(() => sortPoems(searchPoems(poems, query), sort), [poems, query, sort]);
  const allChecked = selected.size > 0 && filtered.every((p) => selected.has(p.id));

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => p.id)));
  };

  const exportSelectedJSON = () => {
    if (selected.size === 0) return toast.info("Select poems first.");
    const list = poems.filter((p) => selected.has(p.id));
    download("AngelWrites-selected.json", toJSON(list), "application/json");
  };

  function sanitize(name, ext) {
    const base = name.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 80) || "poem";
    return `${base}.${ext}`;
  }
  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportSelectedDOCXZip() {
    if (selected.size === 0) return toast.info("Select poems first.");
    const list = poems.filter((p) => selected.has(p.id));

    // If only one poem is selected, download the individual DOCX directly (no zip)
    if (list.length === 1) {
      const p = list[0];
      const blob = await createDOCXBlobForPoem(p);
      downloadBlob(sanitize(p.title, "docx"), blob);
      return;
    }

    const zip = new JSZip();
    for (const p of list) {
      const blob = await createDOCXBlobForPoem(p);
      zip.file(sanitize(p.title, "docx"), blob);
    }
    const out = await zip.generateAsync({ type: "blob" });
    downloadBlob("poems-docx.zip", out);
  }

  function deleteSelected() {
    if (selected.size === 0) return toast.info("Select poems first.");
    setOpenDelete(true);
  }
  function confirmDelete() {
    setPoems((prev) => prev.filter((p) => !selected.has(p.id)));
    setSelected(new Set());
    setOpenDelete(false);
  }

  if (showThemes) {
    return (
      <main className="container py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold gradient-text">Themes</h1>
          <Button variant="outline" onClick={() => setShowThemes(false)}>Back to Manage</Button>
        </div>
        <div className="mt-4">
          <Themes />
        </div>
      </main>
    );
  }

  return (
    <div className="container py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold gradient-text">Manage</h1>
        <Button variant="outline" onClick={() => setShowThemes(true)}>Themes</Button>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-96">
            <Input type="search" placeholder="Search poems and books" data-variant="search" value={query} onChange={(e) => setQuery(e.target.value)} />
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
        {filtered.map((p) => (
          <Card
            key={p.id}
            role="button"
            tabIndex={0}
            aria-pressed={selected.has(p.id)}
            onClick={() => toggle(p.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(p.id); } }}
            className={selected.has(p.id) ? "ring-2 ring-ring bg-white/60 dark:bg-white/15" : ""}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold tracking-tight line-clamp-1">{p.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(p.date)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-sm text-muted-foreground py-8">No item found</div>
        )}
      </section>

      <p className="mt-3 text-xs text-muted-foreground">Tip: Click cards to select. Use Select All to toggle.</p>

      <Dialog open={openDelete} onOpenChange={setOpenDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete selected</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selected.size} selected poem{selected.size === 1 ? "" : "s"}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
