export const API_BASE = (import.meta as any).env?.VITE_API_BASE ? String((import.meta as any).env.VITE_API_BASE).replace(/\/$/, "") : "";

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}

export function apiFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" || input instanceof URL ? (String(input).startsWith("/") ? apiUrl(String(input)) : String(input)) : input;
  const opts: RequestInit = { credentials: "include", ...(init || {}) };
  return fetch(url as any, opts);
}
