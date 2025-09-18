import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "react-router-dom";

function getSystemPref(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export const POEM_PRESETS = [
  { key: "pastel", label: "Pastel Airy", swatch: ["#a2d2ff", "#cdb4db", "#b9fbc0"] },
  { key: "sunset", label: "Sunset Glow", swatch: ["#ffd6a5", "#ffb5a7", "#ff8a5b"] },
  { key: "ocean", label: "Ocean Breeze", swatch: ["#dbeafe", "#bbf7d0", "#22d3ee"] },
  { key: "aurora", label: "Aurora Nights", swatch: ["#ede9fe", "#a78bfa", "#22d3ee"] },
  { key: "strawberry", label: "Strawberry Milk", swatch: ["#ffe5ec", "#ffcad4", "#ff6b8a"] },
] as const;

export const BOOK_PRESETS = [
  { key: "pastel", label: "Pastel Airy", swatch: ["#a2d2ff", "#cdb4db", "#b9fbc0"] },
  { key: "sunset", label: "Sunset Glow", swatch: ["#ffd6a5", "#ffb5a7", "#ff8a5b"] },
  { key: "ocean", label: "Ocean Breeze", swatch: ["#dbeafe", "#bbf7d0", "#22d3ee"] },
  { key: "aurora", label: "Aurora Nights", swatch: ["#ede9fe", "#a78bfa", "#22d3ee"] },
  { key: "strawberry", label: "Strawberry Milk", swatch: ["#ffe5ec", "#ffcad4", "#ff6b8a"] },
] as const;

export const PRESETS = POEM_PRESETS;

export type PresetKey = typeof PRESETS[number]["key"];

function getContext(pathname: string): "poem" | "book" {
  return pathname.startsWith("/book") ? "book" : "poem";
}

function getContextPreset(context: "poem" | "book"): PresetKey {
  const key = `themePreset_${context}`;
  const stored = localStorage.getItem(key) as PresetKey | null;
  const validKeys = (context === "book" ? BOOK_PRESETS : POEM_PRESETS).map((p) => p.key) as PresetKey[];
  if (stored && validKeys.includes(stored)) return stored;
  return "pastel" as PresetKey;
}

export function ThemeToggle() {
  const location = useLocation();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("theme");
    return (stored as "light" | "dark") || getSystemPref();
  });

  // Migrate legacy keys to a single preset per context
  useEffect(() => {
    const system = getSystemPref();
    const contexts: Array<"poem" | "book"> = ["poem", "book"];
    const legacySingle = localStorage.getItem("themePreset") as PresetKey | null;
    const legacyLight = localStorage.getItem("themePresetLight") as PresetKey | null;
    const legacyDark = localStorage.getItem("themePresetDark") as PresetKey | null;

    contexts.forEach((ctx) => {
      const unifiedKey = `themePreset_${ctx}`;
      if (!localStorage.getItem(unifiedKey)) {
        const perLight = localStorage.getItem(`themePresetLight_${ctx}`) as PresetKey | null;
        const perDark = localStorage.getItem(`themePresetDark_${ctx}`) as PresetKey | null;
        const chosen = (legacySingle || (system === "dark" ? perDark : perLight) || perLight || perDark || "pastel") as PresetKey;
        localStorage.setItem(unifiedKey, chosen);
      }
    });

    // Clean up old keys (non-destructive for now)
    localStorage.removeItem("themePreset");
    localStorage.removeItem("themePresetLight");
    localStorage.removeItem("themePresetDark");
  }, []);

  // Apply dark class; keep the selected preset per context regardless of mode
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("theme", theme);
    const ctx = getContext(location.pathname);
    root.dataset.theme = getContextPreset(ctx);
  }, [theme, location.pathname]);

  // Initial apply on mount
  useEffect(() => {
    const ctx = getContext(location.pathname);
    document.documentElement.dataset.theme = getContextPreset(ctx);
  }, [location.pathname]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle light/dark"
        onClick={toggle}
        className="transition-colors hover:bg-primary/15 hover:text-primary"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </div>
  );
}
