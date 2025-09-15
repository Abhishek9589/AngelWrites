const TITLE_KEY = "angelhub.site.title";

export function loadSiteTitle(): string {
  try {
    const t = localStorage.getItem(TITLE_KEY);
    const val = (t ?? "").trim();
    return val || "AngelWrites";
  } catch {
    return "AngelWrites";
  }
}

export function saveSiteTitle(title: string) {
  try {
    const t = title.trim();
    if (t) localStorage.setItem(TITLE_KEY, t);
  } catch {
    /* ignore */
  }
}
