/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

// ---- Auth ----
export interface SignUpRequest {
  username: string;
  email: string;
  password: string;
}
export interface SignInRequest {
  identifier: string; // email or username
  password: string;
}
export interface UserPublic {
  id: string;
  username: string;
  email: string;
}
export interface SignInResponse {
  ok: boolean;
  user?: UserPublic;
  message?: string;
}
export interface GenericAuthResponse {
  ok: boolean;
  message?: string;
}
export interface ChangePasswordRequest {
  identifier: string; // email or username
  currentPassword: string;
  newPassword: string;
}
export interface ChangePasswordResponse {
  ok: boolean;
  message?: string;
}

export interface ForgotInitRequest { identifier: string }
export interface ForgotInitResponse { ok: boolean; message?: string }
export interface ForgotVerifyRequest { identifier: string; code: string }
export interface ForgotVerifyResponse { ok: boolean; message?: string }
export interface ForgotResetRequest { identifier: string; code: string; newPassword: string }
export interface ForgotResetResponse { ok: boolean; message?: string }

// ---- Poems ----
export interface PoemDTO {
  id: string;
  title: string;
  content: string;
  date: string;
  tags: string[];
  favorite?: boolean;
  draft?: boolean;
  createdAt: number;
  updatedAt: number;
  versions?: Array<{ id: string; ts: number; title: string; content: string; date: string; tags: string[] }>;
}
export interface BulkPoemsRequest { poems: PoemDTO[]; ownerId?: string }

// ---- Books ----
export interface ChapterDTO { id: string; title: string; content: string }
export type BookStatus = "draft" | "published";
export interface BookDTO {
  id: string;
  title: string;
  description: string;
  cover?: string | null;
  content: string;
  chapters?: ChapterDTO[];
  activeChapterId?: string | null;
  lastEdited: string;
  createdAt: string;
  completed?: boolean;
  genre?: string | null;
  tags?: string[];
  status?: BookStatus;
}
export interface BulkBooksRequest { books: BookDTO[]; ownerId?: string }
