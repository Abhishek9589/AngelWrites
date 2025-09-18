import { Poem } from "./poems";
import { sanitizeHtml } from "./html";
import {
  AlignmentType,
  Document as DocxDocument,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  UnderlineType,
  PageBreak,
  BorderStyle,
} from "docx";

const SPACING = { line: 408, lineRule: "auto" } as const;

function escapeText(text: string): string {
  return String(text || "");
}

function runsFromInline(node: Node, styles?: Partial<{ bold: boolean; italics: boolean; strike: boolean; code: boolean; href?: string }>): TextRun[] {
  const style = styles || {};
  const out: TextRun[] = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const t = child.textContent || "";
      if (t.length) {
        out.push(
          new TextRun({
            text: escapeText(t),
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

  const spacing = SPACING;

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
    } as const;
    const children = runsFromInline(el);
    paragraphs.push(new Paragraph({ heading: level[tag as keyof typeof level], children, spacing }));
  } else if (tag === "UL" || tag === "OL") {
    const isOrdered = tag === "OL";
    const items = Array.from(el.children).filter((c) => c.tagName === "LI") as HTMLElement[];
    items.forEach((li) => {
      const children = runsFromInline(li);
      if (isOrdered) {
        paragraphs.push(
          new Paragraph({
            children,
            numbering: { reference: "ol", level: 0 },
            spacing,
          }),
        );
      } else {
        paragraphs.push(new Paragraph({ children, bullet: { level: 0 }, spacing }));
      }
    });
  } else if (tag === "BLOCKQUOTE") {
    const inner = runsFromInline(el);
    paragraphs.push(
      new Paragraph({
        children: inner,
        spacing,
        indent: { left: 720 },
        border: { left: { color: "CCCCCC", space: 1, size: 6, style: BorderStyle.SINGLE } },
      }),
    );
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
    // Flatten block children inside div
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
  // Ensure at least one empty paragraph if nothing
  return out.length ? out : [new Paragraph("")];
}

function buildDocumentChildren(poems: Poem[]): Paragraph[] {
  const children: Paragraph[] = [];
  poems.forEach((p, idx) => {
    if (idx > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    const title = new Paragraph({ text: p.title, heading: HeadingLevel.HEADING_1, spacing: SPACING });
    const metaText = `${new Date(p.date).toDateString()}${p.tags.length ? " • " + p.tags.join(", ") : ""}`;
    const meta = new Paragraph({ children: [new TextRun({ text: metaText, italics: true })], spacing: SPACING });
    children.push(title);
    children.push(meta);
    children.push(new Paragraph({}));
    children.push(...buildParagraphsFromHTML(p.content));
  });
  return children;
}

export async function exportPoemsToDOCX(poems: Poem[], filename = "angelhub-poems.docx") {
  const doc = new DocxDocument({
    numbering: {
      config: [
        {
          reference: "ol",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {},
        children: buildDocumentChildren(poems),
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function createDOCXBlobForPoem(p: Poem): Promise<Blob> {
  const doc = new DocxDocument({
    numbering: {
      config: [
        {
          reference: "ol",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {},
        children: buildDocumentChildren([p]),
      },
    ],
  });
  return await Packer.toBlob(doc);
}
