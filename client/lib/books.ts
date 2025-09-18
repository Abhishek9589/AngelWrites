import { sanitizeHtml } from "@/lib/html";
import { format } from "date-fns";
import { loadSiteTitle } from "@/lib/site";
import {
  AlignmentType,
  Document as DocxDocument,
  HeadingLevel,
  BorderStyle,
  Packer,
  Paragraph,
  TextRun,
  UnderlineType,
  PageBreak,
} from "docx";

function nanoid(size = 12): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-";
  const array = new Uint8Array(size);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(array);
  else for (let i = 0; i < size; i++) array[i] = Math.floor(Math.random() * 256);
  let id = "";
  for (let i = 0; i < size; i++) id += chars[array[i] % chars.length];
  return id;
}

export type Chapter = { id: string; title: string; content: string };

export type BookStatus = "draft" | "published";

export type Book = {
  id: string;
  title: string;
  description: string;
  cover?: string | null;
  content: string; // legacy HTML (kept for compatibility)
  chapters?: Chapter[];
  activeChapterId?: string | null;
  lastEdited: string; // ISO date
  createdAt: string; // ISO date
  completed?: boolean;
  genre?: string | null;
  tags?: string[];
  status?: BookStatus;
};

const STORAGE_KEY = "books:v1";
const STORAGE_LAST_OPEN = "books:lastOpened";
const STORAGE_RECENTS = "books:recent";
const STORAGE_WRITE_DAYS = "books:write:days";

function ensureChapters(b: Book): Book {
  if (b.chapters && b.chapters.length > 0) return b;
  const first: Chapter = { id: nanoid(), title: "Chapter 1", content: (b.content || "") };
  return { ...b, chapters: [first], activeChapterId: first.id };
}

export function loadBooks(): Book[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Book[];
    if (!Array.isArray(arr)) return [];
    return arr.map((b) => ensureChapters({
      ...b,
      id: b.id || nanoid(),
      title: (b.title || "Untitled Book").trim(),
      description: b.description || "",
      content: b.content || "",
      lastEdited: b.lastEdited || new Date().toISOString(),
      createdAt: b.createdAt || new Date().toISOString(),
      completed: !!b.completed,
      genre: b.genre ?? null,
      tags: Array.isArray(b.tags) ? b.tags : typeof (b as any).tags === "string" ? (b as any).tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      status: (b.status as BookStatus) || (b.completed ? "published" : "draft"),
    }));
  } catch {
    return [];
  }
}

export function saveBooks(books: Book[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

export function createBook(init?: Partial<Pick<Book, "title" | "description" | "cover" | "content" | "genre" | "tags" | "status">>): Book {
  const now = new Date();
  const chapter: Chapter = { id: nanoid(), title: "Chapter 1", content: init?.content || "" };
  return {
    id: nanoid(),
    title: (init?.title || "Untitled Book").trim() || "Untitled Book",
    description: init?.description || "",
    cover: init?.cover ?? null,
    content: init?.content || "",
    chapters: [chapter],
    activeChapterId: chapter.id,
    createdAt: now.toISOString(),
    lastEdited: now.toISOString(),
    completed: false,
    genre: init?.genre ?? null,
    tags: init?.tags ?? [],
    status: init?.status ?? "draft",
  };
}

export function upsertBook(list: Book[], book: Book): Book[] {
  const idx = list.findIndex((b) => b.id === book.id);
  const next = [...list];
  if (idx >= 0) next[idx] = { ...book };
  else next.unshift(book);
  saveBooks(next);
  return next;
}

export function updateBook(list: Book[], id: string, patch: Partial<Book>): Book[] {
  const idx = list.findIndex((b) => b.id === id);
  if (idx < 0) return list;
  const next = [...list];
  const merged: Book = { ...next[idx], ...patch } as Book;
  if (typeof patch.completed !== "undefined") {
    merged.status = patch.completed ? "published" : (merged.status || "draft");
  }
  merged.lastEdited = new Date().toISOString();
  next[idx] = merged;
  markWritingToday();
  saveBooks(next);
  return next;
}

export function deleteBook(list: Book[], id: string): Book[] {
  const next = list.filter((b) => b.id !== id);
  saveBooks(next);
  if (getLastOpenedBookId() === id) setLastOpenedBookId(null);
  return next;
}

export function duplicateBook(list: Book[], id: string): Book[] {
  const src = list.find((b) => b.id === id);
  if (!src) return list;
  const copy: Book = {
    ...src,
    id: nanoid(),
    title: `${src.title} (Copy)`,
    createdAt: new Date().toISOString(),
    lastEdited: new Date().toISOString(),
  };
  const next = [copy, ...list];
  saveBooks(next);
  return next;
}

export function setLastOpenedBookId(id: string | null) {
  if (!id) {
    localStorage.removeItem(STORAGE_LAST_OPEN);
    return;
  }
  localStorage.setItem(STORAGE_LAST_OPEN, id);
  try {
    const raw = localStorage.getItem(STORAGE_RECENTS);
    const arr = Array.isArray(raw ? JSON.parse(raw) : null) ? (JSON.parse(raw) as string[]) : [];
    const next = [id, ...arr.filter((x) => x !== id)].slice(0, 5);
    localStorage.setItem(STORAGE_RECENTS, JSON.stringify(next));
  } catch {}
}

export function getLastOpenedBookId(): string | null {
  return localStorage.getItem(STORAGE_LAST_OPEN);
}

export function getRecentBookIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_RECENTS);
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? (arr as string[]) : [];
  } catch {
    return [];
  }
}

function toDayString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function markWritingToday() {
  try {
    const today = toDayString(new Date());
    const raw = localStorage.getItem(STORAGE_WRITE_DAYS);
    const arr = Array.isArray(raw ? JSON.parse(raw) : null) ? (JSON.parse(raw) as string[]) : [];
    if (!arr.includes(today)) {
      arr.push(today);
      localStorage.setItem(STORAGE_WRITE_DAYS, JSON.stringify(arr));
    }
  } catch {}
}

export function getWritingDays(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_WRITE_DAYS);
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? (arr as string[]) : [];
  } catch {
    return [];
  }
}

// ---- Export helpers (DOCX) ----
function runsFromInline(node: Node, styles?: Partial<{ bold: boolean; italics: boolean; strike: boolean; code: boolean; href?: string }>): TextRun[] {
  const style = styles || {};
  const out: TextRun[] = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const t = child.textContent || "";
      if (t.length) {
        out.push(
          new TextRun({
            text: t,
            bold: !!style.bold,
            italics: !!style.italics,
            strike: !!style.strike,
            font: style.code ? "Courier New" : undefined,
            color: style.href ? "1155CC" : undefined,
            underline: style.href ? { type: UnderlineType.SINGLE } : undefined,
          }),
        );
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      const tag = el.tagName;
      if (tag === "BR") {
        out.push(new TextRun({ break: 1 }));
        return;
      }
      const nextStyle = { ...style } as any;
      if (tag === "STRONG" || tag === "B") nextStyle.bold = true;
      if (tag === "EM" || tag === "I") nextStyle.italics = true;
      if (tag === "S" || tag === "DEL") nextStyle.strike = true;
      if (tag === "CODE") nextStyle.code = true;
      if (tag === "A") {
        const href = (el.getAttribute("href") || "").trim();
        if (href) nextStyle.href = href;
      }
      out.push(...runsFromInline(el, nextStyle));
    }
  });
  return out;
}

function paragraphFromElement(el: HTMLElement): Paragraph[] {
  const tag = el.tagName;
  const paragraphs: Paragraph[] = [];
  const spacing = { line: 408, lineRule: "auto" } as const;

  if (tag === "P") {
    const children = runsFromInline(el);
    paragraphs.push(new Paragraph({ children, spacing }));
  } else if (tag === "H1" || tag === "H2" || tag === "H3" || tag === "H4" || tag === "H5" || tag === "H6") {
    const level = {
      H1: HeadingLevel.HEADING_1,
      H2: HeadingLevel.HEADING_2,
      H3: HeadingLevel.HEADING_3,
      H4: HeadingLevel.HEADING_4,
      H5: HeadingLevel.HEADING_5,
      H6: HeadingLevel.HEADING_6,
    };
    const children = runsFromInline(el);
    paragraphs.push(new Paragraph({ heading: level[tag], children, spacing }));
  } else if (tag === "UL" || tag === "OL") {
    const isOrdered = tag === "OL";
    const items = Array.from(el.children).filter((c) => c.tagName === "LI") as HTMLElement[];
    items.forEach((li) => {
      const children = runsFromInline(li);
      if (isOrdered) {
        paragraphs.push(new Paragraph({ children, numbering: { reference: "ol", level: 0 }, spacing }));
      } else {
        paragraphs.push(new Paragraph({ children, bullet: { level: 0 }, spacing }));
      }
    });
  } else if (tag === "BLOCKQUOTE") {
    const inner = runsFromInline(el);
    paragraphs.push(new Paragraph({ children: inner, spacing, indent: { left: 720 }, border: { left: { color: "CCCCCC", space: 1, size: 6, style: BorderStyle.SINGLE } } }));
  } else if (tag === "PRE") {
    const text = el.textContent || "";
    const lines = text.split(/\r?\n/);
    const runs: TextRun[] = [];
    lines.forEach((ln, i) => {
      if (i > 0) runs.push(new TextRun({ break: 1 }));
      runs.push(new TextRun({ text: ln, font: "Courier New" }));
    });
    paragraphs.push(new Paragraph({ children: runs, spacing }));
  } else if (tag === "HR") {
    paragraphs.push(new Paragraph({ thematicBreak: true }));
  } else if (tag === "DIV") {
    Array.from(el.childNodes).forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        const t = (n.textContent || "").trim();
        if (t) paragraphs.push(new Paragraph({ children: [new TextRun({ text: t })], spacing }));
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        paragraphs.push(...paragraphFromElement(n as HTMLElement));
      }
    });
  }

  return paragraphs;
}

function buildParagraphsFromHTML(html: string): Paragraph[] {
  const container = document.createElement("div");
  container.innerHTML = sanitizeHtml(html || "");
  const out: Paragraph[] = [];
  Array.from(container.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent || "").trim();
      if (t) out.push(new Paragraph({ children: [new TextRun({ text: t })] }));
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      out.push(...paragraphFromElement(node as HTMLElement));
    }
  });
  return out.length ? out : [new Paragraph("")];
}

export async function createDOCXBlobForBook(book: Book): Promise<Blob> {
  const doc = new DocxDocument({
    numbering: {
      config: [
        { reference: "ol", levels: [{ level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START }] },
      ],
    },
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({ text: book.title, heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun({ text: format(new Date(book.lastEdited), "PPP"), italics: true })] }),
          new Paragraph({}),
          ...(book.chapters && book.chapters.length
            ? book.chapters.flatMap((ch, idx) => [
                ...(idx > 0 ? [new Paragraph({ children: [new PageBreak()] })] : []),
                new Paragraph({ text: ch.title, heading: HeadingLevel.HEADING_2 }),
                ...buildParagraphsFromHTML(ch.content),
              ])
            : buildParagraphsFromHTML(book.content)),
        ],
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  return blob;
}

function sanitizeFilename(name: string, ext: string) {
  const base = String(name || "").replace(/[\\\/:*?"<>|]/g, "_").trim().slice(0, 80) || "book";
  return `${base}.${ext}`;
}

export async function exportBookToDOCX(book: Book, filename = sanitizeFilename(book.title, "docx")) {
  const blob = await createDOCXBlobForBook(book);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function download(filename: string, data: string | Blob, mime = "application/octet-stream") {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportBooksJSON(books: Book[], filename = sanitizeFilename(`${loadSiteTitle()}-books`, "json")) {
  download(filename, JSON.stringify({ books }, null, 2), "application/json");
}

export function getBookWordCount(book: Book): number {
  const html = (book.chapters && book.chapters.length ? book.chapters.map((c) => c.content).join("\n") : book.content) || "";
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}


function escapeXml(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}


export function importBooksFromJSON(list: Book[], json: string): Book[] {
  try {
    const obj = JSON.parse(json);
    const imported: Book[] = Array.isArray(obj) ? obj : Array.isArray(obj.books) ? obj.books : [];
    const map = new Map<string, Book>(list.map((b) => [b.id, b]));
    imported.forEach((b) => map.set(b.id, b));
    const next = Array.from(map.values());
    saveBooks(next);
    return next;
  } catch {
    return list;
  }
}
