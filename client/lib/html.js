export function sanitizeHtml(input) {
  const allowed = new Set([
    "P","BR","STRONG","B","EM","I","U","S","DEL","H1","H2","H3","H4","H5","H6",
    "UL","OL","LI","BLOCKQUOTE","CODE","PRE","A","HR","SPAN"
  ]);
  const allowedStyleProps = new Set(["color","background-color","font-size","font-family","text-align","text-decoration","font-weight","font-style"]);
  const safeStyleValue = (prop, val) => {
    if (!val) return false;
    const s = String(val).trim();
    // Basic safeguard: allow typical CSS values only
    if (!/^[#a-zA-Z0-9_\-.,%()\s\"']+$/.test(s)) return false;
    // Disallow url() and expressions
    if (/url\s*\(/i.test(s) || /expression\s*\(/i.test(s)) return false;
    if (prop === "font-size") return /^(\d+(\.\d+)?)(px|rem|em|%)$/.test(s);
    return true;
  };

  const template = document.createElement("template");
  template.innerHTML = String(input || "");

  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT, null);
  const toRemove = [];
  const toUnwrap = [];

  // Disallow script/style/iframe etc immediately
  template.content.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((el) => toRemove.push(el));

  while (walker.nextNode()) {
    const el = walker.currentNode;
    if (!allowed.has(el.tagName)) {
      toUnwrap.push(el);
      continue;
    }
    // Snapshot attributes we may want to preserve
    const prevHref = el.tagName === "A" ? el.getAttribute("href") : null;
    const prevStyle = el.getAttribute("style");
    const prevDataFontSize = el.getAttribute("data-font-size");

    // Remove all attributes first
    for (const attr of Array.from(el.attributes)) {
      el.removeAttribute(attr.name);
    }

    // Restore sanitized style
    if (prevStyle) {
      const parts = prevStyle.split(";").map((p) => p.trim()).filter(Boolean);
      const kept = [];
      for (const part of parts) {
        const [rawProp, ...rest] = part.split(":");
        const prop = (rawProp || "").trim().toLowerCase();
        const val = rest.join(":").trim();
        if (allowedStyleProps.has(prop) && safeStyleValue(prop, val)) kept.push(`${prop}: ${val}`);
      }
      if (kept.length) el.setAttribute("style", kept.join("; "));
    }

    // Restore safe href on anchors
    if (el.tagName === "A" && typeof prevHref === "string") {
      if (/^(https?:|mailto:)/i.test(prevHref)) el.setAttribute("href", prevHref);
    }

    // Preserve data-font-size for interoperability (non-executable)
    if (typeof prevDataFontSize === "string" && safeStyleValue("font-size", prevDataFontSize)) {
      el.setAttribute("data-font-size", prevDataFontSize);
    }
  }

  // Remove disallowed nodes entirely
  toRemove.forEach((el) => el.remove());
  // Unwrap nodes not allowed but keep their children
  toUnwrap.forEach((el) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  });

  return template.innerHTML.trim();
}
