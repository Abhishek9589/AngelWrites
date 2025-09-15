import { useEffect, useMemo, useState } from "react";
import { PRESETS, PresetKey, ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function getInitialPreset(): PresetKey {
  const stored = localStorage.getItem("themePreset") as PresetKey | null;
  return stored || (document.documentElement.dataset.theme as PresetKey) || "pastel";
}

function applyPreset(preset: PresetKey) {
  const root = document.documentElement;
  root.dataset.theme = preset;
  localStorage.setItem("themePreset", preset);
}

export default function Themes() {
  const [active, setActive] = useState<PresetKey>(() => getInitialPreset());

  useEffect(() => {
    // Sync with current document on mount
    const current = (document.documentElement.dataset.theme as PresetKey) || "pastel";
    setActive(current);
  }, []);

  const items = useMemo(() => PRESETS, []);
  const [hovering, setHovering] = useState<PresetKey | null>(null);
  const applyPreview = (key: PresetKey | null) => {
    if (!key) document.documentElement.dataset.theme = active;
    else document.documentElement.dataset.theme = key;
  };

  return (
    <main className="container py-10 animate-in fade-in-0 slide-in-from-bottom-2 duration-700">
      <section className="relative overflow-hidden rounded-3xl p-6 md:p-8 glass mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Themes</h1>
          <p className="mt-2 text-sm text-muted-foreground">Pick a color palette. Your choice is saved and applies across the app. Use the toggle to switch Light/Dark.</p>
        </div>
        <ThemeToggle />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((p) => (
          <Card
            key={p.key}
            className={cn("overflow-hidden group bg-transparent", active === p.key && "ring-2 ring-ring")}
            style={{ background: `linear-gradient(135deg, ${p.swatch[0]}, ${p.swatch[1]}, ${p.swatch[2]})` }}
            onMouseEnter={() => { setHovering(p.key as PresetKey); applyPreview(p.key as PresetKey); }}
            onMouseLeave={() => { setHovering(null); applyPreview(null); }}
          >
            <CardContent className="p-0">
              <div className="p-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">{p.label}</h3>
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
                    applyPreset(p.key as PresetKey);
                    setActive(p.key as PresetKey);
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
