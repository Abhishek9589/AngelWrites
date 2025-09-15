import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

function getSystemPref(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export const PRESETS = [
  { key: "pastel", label: "Pastel Airy", swatch: ["#a2d2ff", "#cdb4db", "#b9fbc0"] },
  { key: "sunset", label: "Sunset Glow", swatch: ["#ffd6a5", "#ffb5a7", "#ff8a5b"] },
  { key: "ocean", label: "Ocean Breeze", swatch: ["#dbeafe", "#bbf7d0", "#22d3ee"] },
  { key: "aurora", label: "Aurora Nights", swatch: ["#ede9fe", "#a78bfa", "#22d3ee"] },
  { key: "strawberry", label: "Strawberry Milk", swatch: ["#ffe5ec", "#ffcad4", "#ff6b8a"] },
] as const;

export type PresetKey = typeof PRESETS[number]["key"];

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("theme");
    return (stored as "light" | "dark") || getSystemPref();
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Ensure the saved color preset applies globally on mount
  useEffect(() => {
    const stored = localStorage.getItem("themePreset") as PresetKey | null;
    const preset = stored || "pastel";
    document.documentElement.dataset.theme = preset;
  }, []);

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
