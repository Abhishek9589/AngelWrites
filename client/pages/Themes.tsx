import { useEffect, useMemo, useState } from "react";
import { PRESETS, PresetKey, ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";

function getMode(): "light" | "dark" {
  const root = document.documentElement;
  return root.classList.contains("dark") ? "dark" : "light";
}

function getStoredPreset(ctx: "poem" | "book"): PresetKey {
  const key = `themePreset_${ctx}`;
  const stored = localStorage.getItem(key) as PresetKey | null;
  const validKeys = PRESETS.map((p) => p.key) as PresetKey[];
  if (stored && validKeys.includes(stored)) return stored;
  return "pastel" as PresetKey;
}

function applyPresetFor(_mode: "light" | "dark", ctx: "poem" | "book", preset: PresetKey) {
  const storageKey = `themePreset_${ctx}`;
  localStorage.setItem(storageKey, preset);
  const currentCtx = document.location.pathname.startsWith("/book") ? "book" : "poem";
  if (currentCtx === ctx) {
    document.documentElement.dataset.theme = preset;
  }
}

export default function Themes() {
  const location = useLocation();
  const currentCtx: "poem" | "book" = location.pathname.startsWith("/book") ? "book" : "poem";
  const [mode, setMode] = useState<"light" | "dark">(() => getMode());
  const [activePoem, setActivePoem] = useState<PresetKey>(() => getStoredPreset("poem"));
  const [activeBook, setActiveBook] = useState<PresetKey>(() => getStoredPreset("book"));

  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      const nextMode = root.classList.contains("dark") ? "dark" : "light";
      setMode(nextMode);
      const poemPreset = getStoredPreset("poem");
      const bookPreset = getStoredPreset("book");
      setActivePoem(poemPreset);
      setActiveBook(bookPreset);
      root.dataset.theme = currentCtx === "book" ? bookPreset : poemPreset;
    };

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "class") update();
      }
    });
    observer.observe(root, { attributes: true });
    update();
    return () => observer.disconnect();
  }, [currentCtx]);

  useEffect(() => {
    const preset = currentCtx === "book" ? activeBook : activePoem;
    document.documentElement.dataset.theme = preset;
  }, [currentCtx, activeBook, activePoem]);

  const items = useMemo(() => PRESETS, []);
  const active = currentCtx === "book" ? activeBook : activePoem;

  const applyPreview = (key: PresetKey | null) => {
    if (!key) document.documentElement.dataset.theme = active;
    else document.documentElement.dataset.theme = key;
  };

  return (
    <main className="container py-10 animate-in fade-in-0 slide-in-from-bottom-2 duration-700">
      <section className="relative overflow-hidden rounded-3xl p-6 md:p-8 glass mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Themes</h1>
          <p className="mt-2 text-sm text-muted-foreground">Only common themes are available. Selection is saved per Poem/Book; the toggle only switches Light/Dark for the selected theme.</p>
        </div>
        <ThemeToggle />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((p) => (
          <Card
            key={p.key}
            className={cn(
              "overflow-hidden group bg-transparent",
              active === p.key && "ring-2 ring-ring"
            )}
            style={{ background: `linear-gradient(135deg, ${p.swatch[0]}, ${p.swatch[1]}, ${p.swatch[2]})` }}
            onMouseEnter={() => applyPreview(p.key as PresetKey)}
            onMouseLeave={() => applyPreview(null)}
          >
            <CardContent className="p-0">
              <div className="p-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-900">{p.label}</h3>
                  <div className="mt-2 flex items-center gap-1">
                    {p.swatch.map((c, i) => (
                      <span key={i} className="h-4 w-6 rounded-md border border-black/10 dark:border-white/10" style={{ background: c }} />
                    ))}
                  </div>
                </div>
                {active === p.key ? <Badge variant="secondary">Active</Badge> : null}
              </div>

              <div className="p-4 flex items-center justify-end gap-2">
                <Button
                  variant={active === p.key ? "default" : "outline"}
                  onClick={() => {
                    applyPresetFor(mode, currentCtx, p.key as PresetKey);
                    if (currentCtx === "book") setActiveBook(p.key as PresetKey);
                    else setActivePoem(p.key as PresetKey);
                  }}
                >
                  Use Theme
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
