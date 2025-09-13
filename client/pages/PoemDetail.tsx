import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Poem,
  formatDate,
  loadPoems,
  savePoems,
  updatePoem,
  deletePoem,
  normalizeTags,
} from "@/lib/poems";
import { exportPoemsToDOCX, exportPoemsToPDF } from "@/lib/exporters";
import { ArrowLeft, Edit, Star, StarOff, Trash, FileDown } from "lucide-react";
import { format } from "date-fns";

export default function PoemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [poems, setPoems] = useState<Poem[]>(() => loadPoems());
  const [openEdit, setOpenEdit] = useState(false);

  useEffect(() => { savePoems(poems); }, [poems]);

  const poem = useMemo(() => poems.find((p) => p.id === id) || null, [poems, id]);
  useEffect(() => { if (!poem) console.warn("Poem not found for id", id); }, [poem, id]);

  if (!poem) {
    return (
      <div className="container py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:underline"><ArrowLeft className="h-4 w-4" /> Back</Link>
        <h1 className="mt-6 text-2xl font-semibold">Poem not found</h1>
      </div>
    );
  }

  const toggleFavorite = () => setPoems((prev) => updatePoem(prev, poem.id, { favorite: !poem.favorite }));
  const onDelete = () => {
    if (!confirm("Delete this poem?")) return;
    setPoems((prev) => deletePoem(prev, poem.id));
    navigate("/");
  };

  const onEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") || "").trim();
    const content = String(fd.get("content") || "").trim();
    const date = String(fd.get("date") || poem.date);
    const tags = normalizeTags(String(fd.get("tags") || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean));
    setPoems((prev) => updatePoem(prev, poem.id, { title, content, date, tags }));
    setOpenEdit(false);
  };

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:underline"><ArrowLeft className="h-4 w-4" /> Back</Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => exportPoemsToPDF([poem], `${poem.title}.pdf`)} className="gap-2"><FileDown className="h-4 w-4" /> PDF</Button>
          <Button variant="outline" onClick={() => exportPoemsToDOCX([poem], `${poem.title}.docx`)} className="gap-2"><FileDown className="h-4 w-4" /> DOCX</Button>
          <Button variant="ghost" onClick={toggleFavorite} aria-label={poem.favorite ? "Unfavorite" : "Favorite"}>
            {poem.favorite ? <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" /> : <StarOff className="h-4 w-4" />}
          </Button>
          <Dialog open={openEdit} onOpenChange={setOpenEdit}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><Edit className="h-4 w-4" /> Edit</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit poem</DialogTitle>
                <DialogDescription>Update the poem details.</DialogDescription>
              </DialogHeader>
              <form className="grid gap-3" onSubmit={onEditSubmit}>
                <Input name="title" defaultValue={poem.title} required />
                <Textarea name="content" defaultValue={poem.content} required rows={10} />
                <div className="flex gap-3">
                  <Input name="date" type="date" className="w-40" defaultValue={poem.date || format(new Date(), "yyyy-MM-dd")} />
                  <Input name="tags" defaultValue={poem.tags.join(", ")} />
                </div>
                <DialogFooter>
                  <Button type="submit">Save</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button variant="destructive" className="gap-2" onClick={onDelete}><Trash className="h-4 w-4" /> Delete</Button>
        </div>
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
        <div className="prose prose-neutral dark:prose-invert mt-6 whitespace-pre-wrap leading-7">
          {poem.content}
        </div>
      </article>
    </div>
  );
}
