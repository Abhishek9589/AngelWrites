import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import {
  Poem,
  loadPoems,
  searchPoems,
  sortPoems,
  SortOption,
  toJSON,
  download,
  createPoem,
  savePoems,
} from "@/lib/poems";
import { exportPoemsToDOCX, exportPoemsToPDF } from "@/lib/exporters";
import { Download, FileDown, FileJson, FileText, Search, Upload, Trash2, FileType } from "lucide-react";
import * as mammoth from "mammoth";

export default function Manage() {
  const [poems, setPoems] = useState<Poem[]>(() => loadPoems());
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  const jsonFileRef = useRef<HTMLInputElement>(null);
  const docxFileRef = useRef<HTMLInputElement>(null);

  const backupAllJSON = () => download("angelhub-backup.json", toJSON(loadPoems()), "application/json");
  const exportSelectedJSON = () => {
    if (selected.size === 0) return alert("Select poems first.");
    const list = poems.filter((p) => selected.has(p.id));
    download("angelhub-selected.json", toJSON(list), "application/json");
  };

  async function exportSelectedPDF() {
    if (selected.size === 0) return alert("Select poems first.");
    const list = poems.filter((p) => selected.has(p.id));
    await exportPoemsToPDF(list);
  }
  async function exportSelectedDOCX() {
    if (selected.size === 0) return alert("Select poems first.");
    const list = poems.filter((p) => selected.has(p.id));
    await exportPoemsToDOCX(list);
  }

  async function onImportJSON(file: File) {
    const text = await file.text();
    try {
      const obj = JSON.parse(text);
      const imported: Poem[] = Array.isArray(obj) ? obj : Array.isArray(obj.poems) ? obj.poems : [];
      if (!imported.length) throw new Error("No poems found");
      const map = new Map<string, Poem>(poems.map((p) => [p.id, p]));
      for (const p of imported) map.set(p.id, p);
      const next = Array.from(map.values());
      setPoems(next);
      alert(`Imported ${imported.length} poems from JSON`);
    } catch (e) {
      alert("Import failed. Please provide a valid angelhub JSON file.");
    }
  }

  async function onImportDOCX(files: FileList) {
    const arr = Array.from(files);
    if (!arr.length) return;
    const created: Poem[] = [];
    for (const file of arr) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const title = file.name.replace(/\.docx$/i, "");
        const poem = createPoem({
          title,
          content: (result.value || "").trim(),
          date: format(new Date(), "yyyy-MM-dd"),
          tags: [],
        });
        created.push(poem);
      } catch (e) {
        console.error("Failed to import DOCX", file.name, e);
      }
    }
    if (created.length) {
      setPoems((prev) => [...created, ...prev]);
      alert(`Imported ${created.length} poem(s) from DOCX`);
    } else {
      alert("No poems imported from DOCX files.");
    }
  }

  function deleteSelected() {
    if (selected.size === 0) return alert("Select poems first.");
    if (!confirm(`Delete ${selected.size} selected poem(s)? This cannot be undone.`)) return;
    setPoems((prev) => prev.filter((p) => !selected.has(p.id)));
    setSelected(new Set());
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
          <Button variant="outline" onClick={backupAllJSON} className="gap-2"><FileJson className="h-4 w-4" /> Backup JSON (All)</Button>
          <Button variant="outline" onClick={exportSelectedJSON} className="gap-2"><FileJson className="h-4 w-4" /> JSON (Selected)</Button>
          <input ref={jsonFileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportJSON(f); e.currentTarget.value = ""; }} />
          <Button variant="secondary" onClick={() => jsonFileRef.current?.click()} className="gap-2"><Upload className="h-4 w-4" /> Import JSON</Button>
          <input ref={docxFileRef} type="file" accept=".docx" multiple className="hidden" onChange={(e) => { const fs = e.target.files; if (fs) onImportDOCX(fs); e.currentTarget.value = ""; }} />
          <Button variant="secondary" onClick={() => docxFileRef.current?.click()} className="gap-2"><Upload className="h-4 w-4" /> Import DOCX</Button>
          <Button onClick={exportSelectedPDF} className="gap-2"><FileDown className="h-4 w-4" /> PDF (Selected)</Button>
          <Button onClick={exportSelectedDOCX} className="gap-2"><FileDown className="h-4 w-4" /> DOCX (Selected)</Button>
          <Button variant="destructive" onClick={deleteSelected} className="gap-2"><Trash2 className="h-4 w-4" /> Delete Selected</Button>
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
    </div>
  );
}
