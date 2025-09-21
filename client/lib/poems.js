import { format } from "date-fns";

/**
 * @typedef {Object} VersionSnapshot
 * @property {string} id
 * @property {number} ts
 * @property {string} title
 * @property {string} content
 * @property {string} date
 * @property {string[]} tags
 */

/**
 * @typedef {Object} Poem
 * @property {string} id
 * @property {string} title
 * @property {string} content
 * @property {string} date
 * @property {string[]} tags
 * @property {boolean} favorite
 * @property {boolean=} draft
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {VersionSnapshot[]=} versions
 * @property {string=} type
 */

/**
 * @typedef {Object} PoemInput
 * @property {string} title
 * @property {string} content
 * @property {string} date
 * @property {string[]} tags
 * @property {boolean=} draft
 * @property {string=} type
 */

const STORAGE_KEY = "angelhub.poems.v1";
const STORAGE_FALLBACK_KEYS = [
  "angelhub.poems.v1",
  "angelhub.poems",
  "angelhub.poems.v0",
  "poems",
];

const STORAGE_LAST_OPEN_POEM = "poems:lastOpened";

export function loadPoems() {
  try {
    let raw = null;
    let usedKey = null;
    for (const k of STORAGE_FALLBACK_KEYS) {
      raw = localStorage.getItem(k);
      if (raw) { usedKey = k; break; }
    }
    if (!raw) return [];

    let parsed = [];
    try {
      const obj = JSON.parse(raw);
      if (Array.isArray(obj)) parsed = obj;
      else if (obj && Array.isArray(obj.poems)) parsed = obj.poems;
      else parsed = [];
    } catch {
      parsed = [];
    }

    if (!Array.isArray(parsed)) parsed = [];

    // Normalize entries and backfill fields for legacy items
    const migrated = parsed.map((p) => {
      const anyp = p || {};
      const tags = Array.isArray(anyp.tags) ? anyp.tags.filter((t) => typeof t === "string").map((t) => t.trim()).filter(Boolean) : [];
      const hasGenre = tags.some((t) => t.toLowerCase().startsWith("genre:"));
      const type = anyp.type === "book" || anyp.type === "poem" ? anyp.type : (hasGenre ? "book" : "poem");
      const title = typeof anyp.title === "string" ? anyp.title : "Untitled";
      const content = typeof anyp.content === "string" ? anyp.content : "";
      const dateRaw = typeof anyp.date === "string" ? anyp.date : "";
      let date = dateRaw;
      try {
        const d = new Date(dateRaw || Date.now());
        if (!isNaN(d.getTime())) date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      } catch {
        date = new Date().toISOString().slice(0, 10);
      }
      const favorite = !!anyp.favorite;
      const draft = !!anyp.draft;
      const createdAt = typeof anyp.createdAt === "number" ? anyp.createdAt : Date.now();
      const updatedAt = typeof anyp.updatedAt === "number" ? anyp.updatedAt : createdAt;
      const versions = Array.isArray(anyp.versions) ? anyp.versions : undefined;
      return { id: String(anyp.id || generateId()), title, content, date, tags, favorite, draft, createdAt, updatedAt, versions, type };
    });

    // Migrate to current key if read from a fallback
    if (usedKey && usedKey !== STORAGE_KEY) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch {}
    }

    return migrated;
  } catch (e) {
    console.error("Failed to load poems", e);
    return [];
  }
}

export function savePoems(poems) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(poems));
  } catch (e) {
    console.error("Failed to save poems", e);
  }
}

export function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createPoem(input) {
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
    type: input.type ?? "poem",
  };
}

export function upsertPoem(poems, poem) {
  const idx = poems.findIndex((p) => p.id === poem.id);
  const next = [...poems];
  if (idx === -1) next.unshift(poem);
  else next[idx] = { ...poem, updatedAt: Date.now() };
  return next;
}

export function setLastOpenedPoemId(id) {
  try {
    if (!id) localStorage.removeItem(STORAGE_LAST_OPEN_POEM);
    else localStorage.setItem(STORAGE_LAST_OPEN_POEM, id);
  } catch {}
}

export function getLastOpenedPoemId() { try { return localStorage.getItem(STORAGE_LAST_OPEN_POEM); } catch { return null; } }

export function updatePoem(poems, id, patch) {
  const idx = poems.findIndex((p) => p.id === id);
  if (idx === -1) return poems;
  const updated = { ...poems[idx], ...patch, updatedAt: Date.now() };
  const next = [...poems];
  next[idx] = updated;
  return next;
}

export function updatePoemWithVersion(poems, id, patch, opts) {
  const idx = poems.findIndex((p) => p.id === id);
  if (idx === -1) return poems;
  const original = poems[idx];
  const snapshotWanted = !(opts && opts.snapshot === false);
  const max = Math.max(1, (opts && opts.max) || 30);

  const fieldsToTrack = ["title", "content", "date", "tags"];
  const willChange = fieldsToTrack.some((k) => patch[k] !== undefined && JSON.stringify(patch[k]) !== JSON.stringify(original[k]));

  let versions = Array.isArray(original.versions) ? [...original.versions] : [];
  if (snapshotWanted && willChange) {
    const last = versions[versions.length - 1];
    const prevSnap = {
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

  const updated = { ...original, ...patch, versions, updatedAt: Date.now() };
  const next = [...poems];
  next[idx] = updated;
  return next;
}

export function restoreVersion(poems, id, versionId) {
  const idx = poems.findIndex((p) => p.id === id);
  if (idx === -1) return poems;
  const p = poems[idx];
  const versions = [...(p.versions || [])];
  const snap = versions.find((v) => v.id === versionId);
  if (!snap) return poems;
  const updated = {
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

export function deletePoem(poems, id) { return poems.filter((p) => p.id !== id); }

export function sortPoems(poems, sort) {
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

export function stripHtml(input) { return String(input || "").replace(/<[^>]*>/g, " "); }

export function searchPoems(poems, query) {
  const q = query.trim().toLowerCase();
  if (!q) return poems;
  return poems.filter((p) =>
    p.title.toLowerCase().includes(q) ||
    stripHtml(p.content).toLowerCase().includes(q) ||
    p.tags.some((t) => t.toLowerCase().includes(q)),
  );
}

export function filterByTags(poems, tags) {
  if (!tags.length) return poems;
  const set = new Set(tags.map((t) => t.toLowerCase()));
  return poems.filter((p) => p.tags.some((t) => set.has(t.toLowerCase())));
}

export function allTags(poems) { const set = new Set(); poems.forEach((p) => p.tags.forEach((t) => set.add(t))); return Array.from(set).sort((a, b) => a.localeCompare(b)); }

export function normalizeTags(tags) { return tags.map((t) => t.trim()).filter(Boolean).map((t) => t.replace(/\s+/g, " ")).map((t) => (t.length > 30 ? t.slice(0, 30) : t)); }

export function preview(text, max = 140) { const stripped = stripHtml(text); const trimmed = stripped.replace(/\s+/g, " ").trim(); return trimmed.length > max ? trimmed.slice(0, max - 1) + "…" : trimmed; }

export function formatDate(iso) { try { return format(new Date(iso), "MMM d, yyyy"); } catch { return iso; } }

export function computeStats(poems) {
  const total = poems.length;
  const tagMap = new Map();
  const timeMap = new Map();
  for (const p of poems) {
    p.tags.forEach((t) => tagMap.set(t, (tagMap.get(t) || 0) + 1));
    const d = new Date(p.date);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    timeMap.set(period, (timeMap.get(period) || 0) + 1);
  }
  const tagCounts = Array.from(tagMap.entries()).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
  const timeline = Array.from(timeMap.entries()).map(([period, count]) => ({ period, count })).sort((a, b) => a.period.localeCompare(b.period));
  return { total, tagCounts, timeline };
}

export function toJSON(poems) { return JSON.stringify({ version: 1, poems }, null, 2); }

export function fromJSON(json) { const obj = JSON.parse(json); if (Array.isArray(obj)) return obj; if (obj && Array.isArray(obj.poems)) return obj.poems; throw new Error("Invalid JSON format"); }

export function toCSV(poems) {
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

function escapeCsv(value) { const v = String(value ?? ""); if (v.includes(",") || v.includes("\n") || v.includes("\"")) { return '"' + v.replace(/"/g, '""') + '"'; } return v; }

export function download(filename, contents, type = "text/plain") { const blob = new Blob([contents], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
