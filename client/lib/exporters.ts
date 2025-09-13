import { Poem } from "./poems";
import React from "react";
import { Document, Page, Text, StyleSheet, pdf } from "@react-pdf/renderer";
import { Document as DocxDocument, HeadingLevel, Packer, Paragraph, TextRun, PageBreak } from "docx";

function wrap(text: string, max = 85) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > max) {
      lines.push(line.trim());
      line = w;
    } else {
      line = (line + " " + w).trim();
    }
  }
  if (line) lines.push(line.trim());
  return lines.join("\n");
}

const styles = StyleSheet.create({
  page: { padding: 48 },
  title: { fontSize: 18, fontWeight: 700 },
  meta: { fontSize: 10, color: '#6b7280', marginTop: 6 },
  content: { fontSize: 12, lineHeight: 1.4, marginTop: 14 },
});

function getPDFElement(poems: Poem[]) {
  return React.createElement(
    Document,
    null,
    poems.map((p) =>
      React.createElement(
        Page,
        { key: p.id, size: "A4", style: styles.page, wrap: true },
        React.createElement(Text, { style: styles.title }, p.title),
        React.createElement(
          Text,
          { style: styles.meta },
          `${new Date(p.date).toDateString()}${p.tags.length ? " • " + p.tags.join(", ") : ""}`,
        ),
        React.createElement(Text, { style: styles.content }, p.content),
      ),
    ),
  );
}

export async function exportPoemsToPDF(poems: Poem[], filename = "angelhub-poems.pdf") {
  const blob = await pdf(getPDFElement(poems)).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function createPDFBlobForPoem(p: Poem): Promise<Blob> {
  return await pdf(getPDFElement([p])).toBlob();
}

export async function exportPoemsToDOCX(poems: Poem[], filename = "angelhub-poems.docx") {
  const children: Paragraph[] = [] as any;
  poems.forEach((p, idx) => {
    if (idx > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      new Paragraph({
        text: p.title,
        heading: HeadingLevel.HEADING_1,
      }),
    );
    const meta = `${new Date(p.date).toDateString()}${p.tags.length ? " • " + p.tags.join(", ") : ""}`;
    children.push(new Paragraph({ children: [new TextRun({ text: meta, italics: true })] }));
    children.push(new Paragraph({}));
    p.content.split(/\n\n+/).forEach((para) => {
      children.push(new Paragraph({ children: [new TextRun({ text: para })] }));
      children.push(new Paragraph({}));
    });
  });

  const doc = new DocxDocument({
    sections: [
      {
        properties: {},
        children,
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
  const children: Paragraph[] = [] as any;
  children.push(new Paragraph({ text: p.title, heading: HeadingLevel.HEADING_1 }));
  const meta = `${new Date(p.date).toDateString()}${p.tags.length ? " • " + p.tags.join(", ") : ""}`;
  children.push(new Paragraph({ children: [new TextRun({ text: meta, italics: true })] }));
  children.push(new Paragraph({}));
  p.content.split(/\n\n+/).forEach((para) => {
    children.push(new Paragraph({ children: [new TextRun({ text: para })] }));
    children.push(new Paragraph({}));
  });
  const doc = new DocxDocument({ sections: [{ properties: {}, children }] });
  return await Packer.toBlob(doc);
}
