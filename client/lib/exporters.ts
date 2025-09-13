import { Poem } from "./poems";
import jsPDF from "jspdf";
import { Document, HeadingLevel, Packer, Paragraph, TextRun, PageBreak } from "docx";

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

export async function exportPoemsToPDF(poems: Poem[], filename = "angelhub-poems.pdf") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  const width = pageWidth - margin * 2;
  poems.forEach((p, idx) => {
    if (idx > 0) doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(p.title, margin, 64, { maxWidth: width });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const meta = `${new Date(p.date).toDateString()} ${p.tags.length ? "• " + p.tags.join(", ") : ""}`;
    doc.text(meta, margin, 84, { maxWidth: width });

    doc.setFontSize(12);
    const content = wrap(p.content, 100);
    doc.text(content, margin, 120, { maxWidth: width, lineHeightFactor: 1.4 });
  });
  doc.save(filename);
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

  const doc = new Document({
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
