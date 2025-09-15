import { format } from "date-fns";

export type Poem = {
  id: string;
  title: string;
  content: string;
  date: string; // ISO string (yyyy-MM-dd)
  tags: string[];
  favorite: boolean;
  draft?: boolean;
  createdAt: number;
  updatedAt: number;
};

export type PoemInput = {
  title: string;
  content: string;
  date: string; // ISO date string
  tags: string[];
  draft?: boolean;
};

const STORAGE_KEY = "angelhub.poems.v1";

export function loadPoems(): Poem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Poem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to load poems", e);
    return [];
  }
}

export function savePoems(poems: Poem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(poems));
  } catch (e) {
    console.error("Failed to save poems", e);
  }
}

export function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createPoem(input: PoemInput): Poem {
  const now = Date.now();
  return {
    id: generateId(),
    title: input.title.trim(),
    content: input.content.trim(),
    date: input.date,
    tags: normalizeTags(input.tags),
    favorite: false,
    draft: !!input.draft,
    createdAt: now,
    updatedAt: now,
  };
}

export function upsertPoem(poems: Poem[], poem: Poem): Poem[] {
  const idx = poems.findIndex((p) => p.id === poem.id);
  const next = [...poems];
  if (idx === -1) next.unshift(poem);
  else next[idx] = { ...poem, updatedAt: Date.now() };
  return next;
}

export function updatePoem(poems: Poem[], id: string, patch: Partial<Poem>): Poem[] {
  const idx = poems.findIndex((p) => p.id === id);
  if (idx === -1) return poems;
  const updated: Poem = { ...poems[idx], ...patch, updatedAt: Date.now() };
  const next = [...poems];
  next[idx] = updated;
  return next;
}

export function deletePoem(poems: Poem[], id: string): Poem[] {
  return poems.filter((p) => p.id !== id);
}

export type SortOption = "newest" | "oldest" | "alpha" | "ztoa";

export function sortPoems(poems: Poem[], sort: SortOption): Poem[] {
  const arr = [...poems];
  switch (sort) {
    case "oldest":
      return arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    case "alpha":
      return arr.sort((a, b) => a.title.localeCompare(b.title));
    case "ztoa":
      return arr.sort((a, b) => b.title.localeCompare(a.title));
    case "newest":
    default:
      return arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}

export function stripHtml(input: string): string {
  return String(input || "").replace(/<[^>]*>/g, " ");
}

export function searchPoems(poems: Poem[], query: string): Poem[] {
  const q = query.trim().toLowerCase();
  if (!q) return poems;
  return poems.filter((p) =>
    p.title.toLowerCase().includes(q) ||
    stripHtml(p.content).toLowerCase().includes(q) ||
    p.tags.some((t) => t.toLowerCase().includes(q)),
  );
}

export function filterByTags(poems: Poem[], tags: string[]): Poem[] {
  if (!tags.length) return poems;
  const set = new Set(tags.map((t) => t.toLowerCase()));
  return poems.filter((p) => p.tags.some((t) => set.has(t.toLowerCase())));
}

export function allTags(poems: Poem[]): string[] {
  const set = new Set<string>();
  poems.forEach((p) => p.tags.forEach((t) => set.add(t)));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function normalizeTags(tags: string[]): string[] {
  return tags
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.replace(/\s+/g, " "))
    .map((t) => (t.length > 30 ? t.slice(0, 30) : t));
}

export function preview(text: string, max = 140): string {
  const stripped = stripHtml(text);
  const trimmed = stripped.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? trimmed.slice(0, max - 1) + "…" : trimmed;
}

export function formatDate(iso: string) {
  try {
    return format(new Date(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

export type Stats = {
  total: number;
  tagCounts: { tag: string; count: number }[];
  timeline: { period: string; count: number }[]; // e.g. 2025-09
};

export function computeStats(poems: Poem[]): Stats {
  const total = poems.length;
  const tagMap = new Map<string, number>();
  const timeMap = new Map<string, number>();
  for (const p of poems) {
    p.tags.forEach((t) => tagMap.set(t, (tagMap.get(t) || 0) + 1));
    const d = new Date(p.date);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    timeMap.set(period, (timeMap.get(period) || 0) + 1);
  }
  const tagCounts = Array.from(tagMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
  const timeline = Array.from(timeMap.entries())
    .map(([period, count]) => ({ period, count }))
    .sort((a, b) => a.period.localeCompare(b.period));
  return { total, tagCounts, timeline };
}

export function toJSON(poems: Poem[]): string {
  return JSON.stringify({ version: 1, poems }, null, 2);
}

export function fromJSON(json: string): Poem[] {
  const obj = JSON.parse(json);
  if (Array.isArray(obj)) return obj as Poem[];
  if (obj && Array.isArray(obj.poems)) return obj.poems as Poem[];
  throw new Error("Invalid JSON format");
}

export function toCSV(poems: Poem[]): string {
  const headers = ["id", "title", "content", "date", "tags", "favorite", "draft", "createdAt", "updatedAt"];
  const rows = poems.map((p) => [
    escapeCsv(p.id),
    escapeCsv(p.title),
    escapeCsv(p.content),
    escapeCsv(p.date),
    escapeCsv(p.tags.join("|")),
    String(!!p.favorite),
    String(!!p.draft),
    String(p.createdAt),
    String(p.updatedAt),
  ]);
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

function escapeCsv(value: string) {
  const v = String(value ?? "");
  if (v.includes(",") || v.includes("\n") || v.includes("\"")) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

export function download(filename: string, contents: string, type = "text/plain") {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
