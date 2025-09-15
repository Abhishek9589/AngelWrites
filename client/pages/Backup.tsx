import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadPoems, Poem, searchPoems, sortPoems, SortOption, toJSON, download } from "@/lib/poems";
import { exportPoemsToDOCX } from "@/lib/exporters";
import { Download, FileDown, Upload } from "lucide-react";
import { toast } from "sonner";

export default function Backup() {
  // Deprecated page, kept for backward compatibility. Please use /manage.
  const [poems, setPoems] = useState<Poem[]>(() => loadPoems());
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    // refresh from storage when visiting
    setPoems(loadPoems());
  }, []);

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

  const importRef = useRef<HTMLInputElement>(null);
  const doExportJSON = () => download("AngelWrites-backup.json", toJSON(filtered), "application/json");

  async function exportSelectedDOCX() {
    const list = poems.filter((p) => selected.has(p.id));
    await exportPoemsToDOCX(list.length ? list : filtered);
  }

  async function onImport(file: File) {
    const text = await file.text();
    try {
      const obj = JSON.parse(text);
      const imported: Poem[] = Array.isArray(obj) ? obj : Array.isArray(obj.poems) ? obj.poems : [];
      if (!imported.length) throw new Error("No poems found");
      const map = new Map<string, Poem>(poems.map((p) => [p.id, p]));
      for (const p of imported) map.set(p.id, p);
      const next = Array.from(map.values());
      localStorage.setItem("angelhub.poems.v1", JSON.stringify(next));
      setPoems(next);
      toast.success(`Imported ${imported.length} poems`);
    } catch {
      toast.error("Import failed. Please provide a valid angelhub JSON file.");
    }
  }

  return (
    <div className="container py-10">
      <h1 className="text-2xl font-semibold">Backup (Deprecated)</h1>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-96">
          <Input type="search" placeholder="Search poems" data-variant="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={doExportJSON} className="gap-2"><Download className="h-4 w-4" /> JSON</Button>
          <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.currentTarget.value = ""; }} />
          <Button variant="secondary" onClick={() => importRef.current?.click()} className="gap-2"><Upload className="h-4 w-4" /> Import JSON</Button>
          <Button onClick={exportSelectedDOCX} className="gap-2"><FileDown className="h-4 w-4" /> DOCX</Button>
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

      <p className="mt-3 text-xs text-muted-foreground">Tip: Select none to export all filtered poems. Select some to export only those.</p>
    </div>
  );
}
