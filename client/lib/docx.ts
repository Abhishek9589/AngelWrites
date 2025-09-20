import { renderAsync } from "docx-preview";

function cleanHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html || "";
  // Strip style attributes and MS Office junk tags
  div.querySelectorAll("[style]").forEach((el) => el.removeAttribute("style"));
  div.querySelectorAll("o\\:p").forEach((el) => el.parentElement?.removeChild(el));
  // Remove empty paragraphs
  div.querySelectorAll("p").forEach((p) => { if ((p.textContent || "").trim() === "") p.remove(); });
  return div.innerHTML.trim();
}

export async function docxArrayBufferToHTML(arrayBuffer: ArrayBuffer): Promise<string> {
  // Prefer mammoth for clean, semantic HTML
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.convertToHtml({ arrayBuffer }, {
      includeDefaultStyleMap: true,
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
      ],
    } as any);
    return cleanHtml(result.value || "");
  } catch {
    // Fallback to docx-preview rendering if mammoth fails
    const container = document.createElement("div");
    await renderAsync(arrayBuffer, container, undefined, {
      inWrapper: false,
      ignoreHeight: true,
      ignoreWidth: true,
      className: "docx",
      breakPages: false,
    });
    return cleanHtml(container.innerHTML || "");
  }
}
