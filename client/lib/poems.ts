import { format } from "date-fns";

export type VersionSnapshot = {
  id: string;
  ts: number;
  title: string;
  content: string;
  date: string;
  tags: string[];
};

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
  versions?: VersionSnapshot[];
};

type AuthUser = { id: string; username: string; email: string } | null;
function getAuthUser(): AuthUser {
  try { return JSON.parse(localStorage.getItem("aw.auth") || "null"); } catch { return null; }
}

export type PoemInput = {
  title: string;
  content: string;
  date: string; // ISO date string
  tags: string[];
  draft?: boolean;
};

const LEGACY_KEYS = [
  "angelhub.poems.v1",
  "angelhub.poems",
  "angelhub.poems.v0",
  "poems",
] as const;

function storageKeyForUser(userId: string | null): string {
  return userId ? `aw:poems:${userId}` : "aw:poems:anon";
}

function parsePoems(raw: string | null): Poem[] {
  if (!raw) return [];
  try {
    const obj = JSON.parse(raw);
    if (Array.isArray(obj)) return obj as Poem[];
    if (obj && Array.isArray((obj as any).poems)) return (obj as any).poems as Poem[];
    return [];
  } catch {
    return [];
  }
}

function readLocalPoemsForKey(key: string): Poem[] {
  try {
    const raw = localStorage.getItem(key);
    return parsePoems(raw);
  } catch {
    return [];
  }
}

function writeLocalPoemsForKey(key: string, poems: Poem[]) {
  try { localStorage.setItem(key, JSON.stringify(poems)); } catch {}
}

function mergeByNewest(a: Poem[], b: Poem[]): Poem[] {
  const map = new Map<string, Poem>();
  for (const p of [...a, ...b]) {
    const prev = map.get(p.id);
    if (!prev) { map.set(p.id, p); continue; }
    const newer = (p.updatedAt || 0) >= (prev.updatedAt || 0) ? p : prev;
    map.set(p.id, newer);
  }
  return Array.from(map.values());
}

import { apiFetch, apiUrl } from "@/lib/api";

export function loadPoems(): Poem[] {
  const auth = getAuthUser();
  if (!auth) {
    // Read from anon storage and migrate any legacy keys into anon scope
    const anonKey = storageKeyForUser(null);
    let local = readLocalPoemsForKey(anonKey);
    try {
      let legacy: Poem[] = [];
      for (const k of LEGACY_KEYS) legacy = mergeByNewest(legacy, readLocalPoemsForKey(k));
      if (legacy.length) {
        local = mergeByNewest(local, legacy);
        writeLocalPoemsForKey(anonKey, local);
        [...LEGACY_KEYS].forEach((k) => { try { localStorage.removeItem(k); } catch {} });
      }
    } catch {}
    return local;
  }

  const userKey = storageKeyForUser(auth.id);

  // Start with data saved under the user key
  let local = readLocalPoemsForKey(userKey);

  // Migrate legacy keys and anon storage into the user-scoped key
  try {
    let legacy: Poem[] = [];
    for (const k of LEGACY_KEYS) legacy = mergeByNewest(legacy, readLocalPoemsForKey(k));
    legacy = mergeByNewest(legacy, readLocalPoemsForKey(storageKeyForUser(null)));
    if (legacy.length) {
      local = mergeByNewest(local, legacy);
      writeLocalPoemsForKey(userKey, local);
      // Cleanup legacy stores after migration
      [...LEGACY_KEYS, storageKeyForUser(null)].forEach((k) => { try { localStorage.removeItem(k); } catch {} });
    }
  } catch {}

  // Background sync from server and merge to local
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  apiFetch(`/api/poems`, { signal: ctrl.signal })
    .then(async (r) => {
      if (!r.ok) throw new Error("failed");
      const raw = await r.text();
      try {
        const data = raw ? JSON.parse(raw) : {};
        const remote = Array.isArray((data as any)?.poems) ? ((data as any).poems as Poem[]) : [];
        let cur = readLocalPoemsForKey(userKey);
        const merged = mergeByNewest(cur, remote);
        writeLocalPoemsForKey(userKey, merged);
      } catch {}
    })
    .catch(() => {})
    .finally(() => clearTimeout(t));

  return local;
}

export function savePoems(poems: Poem[]) {
  const auth = getAuthUser();
  const key = storageKeyForUser(auth ? auth.id : null);
  writeLocalPoemsForKey(key, poems);

  // Sync to server only if logged in
  try {
    if (!auth) return;
    const payload = { poems } as any;
    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon(apiUrl("/api/poems/bulk"), new Blob([JSON.stringify(payload)], { type: "application/json" }));
      if (!ok) throw new Error("beacon_failed");
    } else {
      apiFetch(apiUrl("/api/poems/bulk"), { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    }
  } catch {}
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

export function updatePoemWithVersion(
  poems: Poem[],
  id: string,
  patch: Partial<Poem>,
  opts?: { snapshot?: boolean; max?: number }
): Poem[] {
  const idx = poems.findIndex((p) => p.id === id);
  if (idx === -1) return poems;
  const original = poems[idx];
  const snapshotWanted = opts?.snapshot !== false;
  const max = Math.max(1, opts?.max ?? 30);

  const fieldsToTrack: (keyof Poem)[] = ["title", "content", "date", "tags"];
  const willChange = fieldsToTrack.some((k) => (patch as any)[k] !== undefined && JSON.stringify((patch as any)[k]) !== JSON.stringify((original as any)[k]));

  let versions = Array.isArray(original.versions) ? [...original.versions] : [];
  if (snapshotWanted && willChange) {
    const last = versions[versions.length - 1];
    const prevSnap: VersionSnapshot = {
      id: generateId(),
      ts: Date.now(),
      title: original.title,
      content: original.content,
      date: original.date,
      tags: [...original.tags],
    };
    const isDuplicate = last && last.title === prevSnap.title && last.content === prevSnap.content && last.date === prevSnap.date && JSON.stringify(last.tags) === JSON.stringify(prevSnap.tags);
    if (!isDuplicate) {
      versions.push(prevSnap);
      if (versions.length > max) versions = versions.slice(versions.length - max);
    }
  }

  const updated: Poem = { ...original, ...patch, versions, updatedAt: Date.now() };
  const next = [...poems];
  next[idx] = updated;
  return next;
}

export function restoreVersion(poems: Poem[], id: string, versionId: string): Poem[] {
  const idx = poems.findIndex((p) => p.id === id);
  if (idx === -1) return poems;
  const p = poems[idx];
  const versions = [...(p.versions || [])];
  const snap = versions.find((v) => v.id === versionId);
  if (!snap) return poems;
  const updated: Poem = {
    ...p,
    title: snap.title,
    content: snap.content,
    date: snap.date,
    tags: [...snap.tags],
    updatedAt: Date.now(),
  };
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
