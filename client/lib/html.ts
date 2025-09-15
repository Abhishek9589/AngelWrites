export function sanitizeHtml(input: string): string {
  const allowed = new Set([
    "P","BR","STRONG","B","EM","I","U","S","DEL","H1","H2","H3","H4","H5","H6",
    "UL","OL","LI","BLOCKQUOTE","CODE","PRE","A","HR"
  ]);
  const template = document.createElement("template");
  template.innerHTML = String(input || "");

  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT, null);
  const toRemove: Element[] = [];
  const toUnwrap: Element[] = [];

  // Disallow script/style/iframe etc immediately
  template.content.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((el) => toRemove.push(el));

  while (walker.nextNode()) {
    const el = walker.currentNode as Element;
    if (!allowed.has(el.tagName)) {
      toUnwrap.push(el);
      continue;
    }
    // Clean attributes
    for (const attr of Array.from(el.attributes)) {
      if (el.tagName === "A" && attr.name.toLowerCase() === "href") {
        // allow only http(s), mailto
        const href = el.getAttribute("href") || "";
        const safe = /^(https?:|mailto:)/i.test(href);
        if (!safe) el.removeAttribute("href");
      } else {
        el.removeAttribute(attr.name);
      }
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
