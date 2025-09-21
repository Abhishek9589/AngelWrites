import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { getLastOpenedPoemId, loadPoems } from "@/lib/poems";

export default function Quill() {
  const navigate = useNavigate();

  useEffect(() => {
    const id = getLastOpenedPoemId();
    const poems = loadPoems();
    const item = id ? poems.find((p) => p.id === id) : undefined;
    if (item && id) {
      if ((item.type ?? "poem") === "book") {
        navigate(`/book/${id}`, { replace: true });
      } else {
        navigate(`/poem/${id}?edit=1`, { replace: true });
      }
    }
  }, [navigate]);

  return (
    <main className="container py-10">
      <div className="rounded-2xl border p-6 glass-soft">
        <h2 className="text-lg font-semibold">Quill</h2>
        <p className="text-sm text-muted-foreground mt-1">No recent item to edit. Create or open to start writing.</p>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => navigate("/")}>Go to Home</Button>
        </div>
      </div>
    </main>
  );
}
