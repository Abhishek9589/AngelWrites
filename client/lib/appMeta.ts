export const DEFAULT_APP_NAME = "AngelWrites";
export const STORAGE_KEY_APP_NAME = "app.name.v1";

export function getAppName(): string {
  try {
    const v = localStorage.getItem(STORAGE_KEY_APP_NAME);
    return (v && v.trim()) || DEFAULT_APP_NAME;
  } catch {
    return DEFAULT_APP_NAME;
  }
}

export function setAppName(name: string) {
  const val = (name || "").trim() || DEFAULT_APP_NAME;
  try {
    localStorage.setItem(STORAGE_KEY_APP_NAME, val);
  } catch {
    // ignore storage errors
  }
}

export function appNameSlug(): string {
  const base = getAppName().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "app";
}
