import type { Request, Response } from "express";

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlJson(obj: any): string {
  return b64url(JSON.stringify(obj));
}
function b64urlToJson<T = any>(b64: string): T {
  const pad = (s: string) => s + "===".slice((s.length % 4) || 4);
  const json = Buffer.from(pad(b64).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  return JSON.parse(json) as T;
}

import { createHmac } from "node:crypto";

function hmacSHA256(data: string, secret: string): string {
  const key = createHmac("sha256", secret);
  key.update(data);
  return b64url(key.digest());
}

export type AccessPayload = { sub: string; username: string; email: string; iat: number; exp: number };

function getAccessSecret(): string {
  const s = process.env.JWT_ACCESS_SECRET;
  if (!s) throw new Error("JWT_ACCESS_SECRET is not set");
  return s;
}

export function signAccessToken(user: { id: string; username: string; email: string }, ttlSeconds = 7 * 24 * 60 * 60): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload: AccessPayload = { sub: user.id, username: user.username, email: user.email, iat: now, exp: now + ttlSeconds };
  const head = b64urlJson(header);
  const body = b64urlJson(payload);
  const sig = hmacSHA256(`${head}.${body}`, getAccessSecret());
  return `${head}.${body}.${sig}`;
}

export function verifyAccessToken(token: string): AccessPayload {
  const [head, body, sig] = token.split(".");
  if (!head || !body || !sig) throw new Error("malformed_token");
  const expected = hmacSHA256(`${head}.${body}`, getAccessSecret());
  if (expected !== sig) throw new Error("invalid_signature");
  const payload = b64urlToJson<AccessPayload>(body);
  const now = Math.floor(Date.now() / 1000);
  if ((payload as any).exp && payload.exp < now) throw new Error("token_expired");
  return payload;
}

export function readCookie(req: Request, name: string): string | null {
  const raw = req.headers["cookie"];
  if (!raw) return null;
  const parts = String(raw).split(/;\s*/);
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (decodeURIComponent(k) === name) return decodeURIComponent(v || "");
  }
  return null;
}

export function setAuthCookie(res: Response, token: string, maxAgeSec: number) {
  const env = (process.env.NODE_ENV || "").toLowerCase();
  const sameSite = ((process.env.AUTH_COOKIE_SAMESITE || "Lax").toLowerCase() === "none") ? "None" : "Lax";
  const mustSecure = sameSite === "None";
  const secure = mustSecure || env === "production";
  const cookie = [
    `aw.access=${encodeURIComponent(token)}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=${sameSite}`,
    `Max-Age=${Math.max(1, Math.floor(maxAgeSec))}`,
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
  res.setHeader("Set-Cookie", cookie);
}

export function clearAuthCookie(res: Response) {
  const env = (process.env.NODE_ENV || "").toLowerCase();
  const sameSite = ((process.env.AUTH_COOKIE_SAMESITE || "Lax").toLowerCase() === "none") ? "None" : "Lax";
  const mustSecure = sameSite === "None";
  const secure = mustSecure || env === "production";
  const cookie = [
    `aw.access=`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=${sameSite}`,
    `Max-Age=0`,
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
  res.setHeader("Set-Cookie", cookie);
}

export function getAuthUser(req: Request): { id: string; username: string; email: string } | null {
  try {
    const t = readCookie(req, "aw.access");
    if (!t) return null;
    const p = verifyAccessToken(t);
    return { id: p.sub, username: p.username, email: p.email };
  } catch {
    return null;
  }
}
