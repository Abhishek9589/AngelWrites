import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Poem,
  loadPoems,
  searchPoems,
  sortPoems,
  SortOption,
  toJSON,
  download,
  savePoems,
} from "@/lib/poems";
import { createDOCXBlobForPoem, createPDFBlobForPoem } from "@/lib/exporters";
import { FileDown, FileJson, Search, Trash2 } from "lucide-react";
import JSZip from "jszip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Manage() {
  const [poems, setPoems] = useState<Poem[]>(() => loadPoems());
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openDelete, setOpenDelete] = useState(false);

  useEffect(() => { savePoems(poems); }, [poems]);

  const filtered = useMemo(() => sortPoems(searchPoems(poems, query), sort), [poems, query, sort]);
  const allChecked = selected.size > 0 && filtered.every((p) => selected.has(p.id));

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => p.id)));
  };

  const exportSelectedJSON = () => {
    if (selected.size === 0) return alert("Select poems first.");
    const list = poems.filter((p) => selected.has(p.id));
    download("angelhub-selected.json", toJSON(list), "application/json");
  };

  function sanitize(name: string, ext: string) {
    const base = name.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 80) || "poem";
    return `${base}.${ext}`;
  }
  function downloadBlob(filename: string, blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportSelectedPDFZip() {
    if (selected.size === 0) return alert("Select poems first.");
    const list = poems.filter((p) => selected.has(p.id));

    // If only one poem is selected, download the individual PDF directly (no zip)
    if (list.length === 1) {
      const p = list[0];
      const blob = await createPDFBlobForPoem(p);
      downloadBlob(sanitize(p.title, "pdf"), blob);
      return;
    }

    const zip = new JSZip();
    for (const p of list) {
      const blob = await createPDFBlobForPoem(p);
      zip.file(sanitize(p.title, "pdf"), blob);
    }
    const out = await zip.generateAsync({ type: "blob" });
    downloadBlob("poems-pdf.zip", out);
  }

  async function exportSelectedDOCXZip() {
    if (selected.size === 0) return alert("Select poems first.");
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
    if (selected.size === 0) return alert("Select poems first.");
    setOpenDelete(true);
  }
  function confirmDelete() {
    setPoems((prev) => prev.filter((p) => !selected.has(p.id)));
    setSelected(new Set());
    setOpenDelete(false);
  }

  return (
    <div className="container py-10">
      <h1 className="text-2xl font-semibold">Manage</h1>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search poems" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={exportSelectedJSON} className="gap-2"><FileJson className="h-4 w-4" /> JSON</Button>
          <Button variant="outline" onClick={exportSelectedPDFZip} className="gap-2"><FileDown className="h-4 w-4" /> PDF</Button>
          <Button variant="outline" onClick={exportSelectedDOCXZip} className="gap-2"><FileDown className="h-4 w-4" /> DOCX</Button>
          <Button variant="destructive" onClick={deleteSelected}><Trash2 className="h-4 w-4" aria-label="Delete" /></Button>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-3 w-12"><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
              <th className="p-3">Title</th>
              <th className="p-3 hidden md:table-cell">Date</th>
              <th className="p-3 hidden sm:table-cell">Tags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3"><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} /></td>
                <td className="p-3 font-medium">{p.title}</td>
                <td className="p-3 hidden md:table-cell">{new Date(p.date).toLocaleDateString()}</td>
                <td className="p-3 hidden sm:table-cell truncate max-w-[20ch]">{p.tags.join(", ")}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td className="p-6 text-center text-muted-foreground" colSpan={4}>No poems found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">Tip: Use the checkboxes to select poems for actions above.</p>

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
