import type { RequestHandler } from "express";
import { getDb } from "../lib/mongo";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { SignUpRequest, SignInRequest, SignInResponse, GenericAuthResponse, ChangePasswordRequest, ForgotInitRequest, ForgotVerifyRequest, ForgotResetRequest } from "@shared/api";
import { createMailer } from "../lib/mailer";
import { signAccessToken, setAuthCookie, clearAuthCookie } from "../lib/auth-token";

const signUpSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_\-\.]+$/),
  email: z.string().email().max(120),
  password: z.string().min(6).max(200),
});

const signInSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(6).max(200),
});

const verifySchema = z.object({
  email: z.string().email().max(120),
  code: z.string().regex(/^\d{6}$/),
});

async function ensureIndexes() {
  const db = await getDb();
  const users = db.collection("users");
  await users.createIndex({ email: 1 }, { unique: true });
  await users.createIndex({ username: 1 }, { unique: true });
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export const handleSignUp: RequestHandler = async (req, res) => {
  try {
    const body = signUpSchema.parse(req.body);
    await ensureIndexes();
    const db = await getDb();
    const users = db.collection("users");
    const emailExists = await users.findOne({ email: body.email.toLowerCase() });
    const usernameExists = await users.findOne({ username: body.username });
    if (emailExists || usernameExists) {
      let message = "User already exists";
      if (emailExists && usernameExists) message = "Email and username already in use";
      else if (emailExists) message = "Email already in use";
      else if (usernameExists) message = "Username already taken";
      const resp: GenericAuthResponse = { ok: false, message };
      return res.status(409).json(resp);
    }

    // Create OTP entry
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    const code = generateOtp();
    const codeHash = await bcrypt.hash(code, 8);
    const passwordHash = await bcrypt.hash(body.password, 10);

    // Upsert pending signup by email
    await db.collection("signup_otps").updateOne(
      { email: body.email.toLowerCase() },
      {
        $set: {
          email: body.email.toLowerCase(),
          username: body.username,
          passwordHash,
          codeHash,
          expiresAt,
          attempts: 0,
          updatedAt: now,
          createdAt: now,
        },
      },
      { upsert: true }
    );

    // Send OTP email
    try {
      const mailer = createMailer();
      await mailer.sendOtp(body.email, code);
    } catch (mailErr: any) {
      const status = (mailErr && typeof (mailErr as any).status === "number") ? (mailErr as any).status : 500;
      const message = String((mailErr && (mailErr as any).message) || "Failed to send OTP");
      return res.status(status).json({ ok: false, message });
    }

    res.json({ ok: true, message: "OTP sent" } satisfies GenericAuthResponse);
  } catch (err: any) {
    res.status(400).json({ ok: false, message: err?.message || "Invalid request" } satisfies GenericAuthResponse);
  }
};

export const handleVerifySignup: RequestHandler = async (req, res) => {
  try {
    const { email, code } = verifySchema.parse(req.body);
    const db = await getDb();
    const pending = await db.collection("signup_otps").findOne({ email: email.toLowerCase() });
    if (!pending) return res.status(400).json({ ok: false, message: "No pending signup" });
    if (pending.expiresAt && new Date(pending.expiresAt) < new Date()) return res.status(400).json({ ok: false, message: "OTP expired" });

    const ok = await bcrypt.compare(code, pending.codeHash || "");
    if (!ok) {
      await db.collection("signup_otps").updateOne({ _id: pending._id }, { $inc: { attempts: 1 }, $set: { updatedAt: new Date() } });
      return res.status(401).json({ ok: false, message: "Invalid OTP" });
    }

    // Create user
    await ensureIndexes();
    const users = db.collection("users");
    const emailExists = await users.findOne({ email: email.toLowerCase() });
    const usernameExists = await users.findOne({ username: pending.username });
    if (emailExists || usernameExists) {
      await db.collection("signup_otps").deleteOne({ _id: pending._id });
      let message = "User already exists";
      if (emailExists && usernameExists) message = "Email and username already in use";
      else if (emailExists) message = "Email already in use";
      else if (usernameExists) message = "Username already taken";
      return res.status(409).json({ ok: false, message });
    }
    const now = new Date();
    const r = await users.insertOne({
      username: pending.username,
      email: email.toLowerCase(),
      passwordHash: pending.passwordHash,
      createdAt: now,
      updatedAt: now,
    });
    await db.collection("auth_events").insertOne({ type: "signup_verified", userId: r.insertedId, ts: now });
    await db.collection("signup_otps").deleteOne({ _id: pending._id });

    res.json({ ok: true, message: "Signup verified" } satisfies GenericAuthResponse);
  } catch (err: any) {
    res.status(400).json({ ok: false, message: err?.message || "Invalid request" } satisfies GenericAuthResponse);
  }
};

export const handleSignIn: RequestHandler = async (req, res) => {
  try {
    const body = signInSchema.parse(req.body);
    const db = await getDb();
    const users = db.collection("users");
    const q = body.identifier.includes("@") ? { email: body.identifier.toLowerCase() } : { username: body.identifier };
    const user = await users.findOne(q);
    if (!user) return res.status(401).json({ ok: false, message: "Invalid credentials" } satisfies SignInResponse);
    const ok = await bcrypt.compare(body.password, user.passwordHash || "");
    const now = new Date();
    await db.collection("auth_events").insertOne({ type: "signin", userId: user._id, ts: now, ok });
    if (!ok) return res.status(401).json({ ok: false, message: "Invalid credentials" } satisfies SignInResponse);
    const pub = { id: String(user._id), username: user.username, email: user.email };
    const token = signAccessToken(pub);
    setAuthCookie(res, token, 7 * 24 * 60 * 60);
    res.json({ ok: true, user: pub } satisfies SignInResponse);
  } catch (err: any) {
    res.status(400).json({ ok: false, message: err?.message || "Invalid request" } satisfies SignInResponse);
  }
};

const changePasswordSchema = z.object({
  identifier: z.string().min(1),
  currentPassword: z.string().min(6).max(200),
  newPassword: z.string().min(6).max(200),
});

export const handleChangePassword: RequestHandler = async (req, res) => {
  try {
    const body = changePasswordSchema.parse(req.body);
    const db = await getDb();
    const users = db.collection("users");
    const q = body.identifier.includes("@") ? { email: body.identifier.toLowerCase() } : { username: body.identifier };
    const user = await users.findOne(q);
    if (!user) return res.status(404).json({ ok: false, message: "User not found" } satisfies GenericAuthResponse);

    const ok = await bcrypt.compare(body.currentPassword, user.passwordHash || "");
    if (!ok) return res.status(401).json({ ok: false, message: "Current password is incorrect" } satisfies GenericAuthResponse);

    const newHash = await bcrypt.hash(body.newPassword, 10);
    const now = new Date();
    await users.updateOne({ _id: user._id }, { $set: { passwordHash: newHash, updatedAt: now } });
    await db.collection("auth_events").insertOne({ type: "password_change", userId: user._id, ts: now });

    res.json({ ok: true, message: "Password updated" } satisfies GenericAuthResponse);
  } catch (err: any) {
    res.status(400).json({ ok: false, message: err?.message || "Invalid request" } satisfies GenericAuthResponse);
  }
};

const forgotInitSchema = z.object({ identifier: z.string().min(1) });
const forgotVerifySchema = z.object({ identifier: z.string().min(1), code: z.string().regex(/^\d{6}$/) });
const forgotResetSchema = z.object({ identifier: z.string().min(1), code: z.string().regex(/^\d{6}$/), newPassword: z.string().min(6).max(200) });

async function findEmailByIdentifier(identifier: string): Promise<string | null> {
  const db = await getDb();
  const users = db.collection("users");
  if (identifier.includes("@")) {
    const u = await users.findOne({ email: identifier.toLowerCase() });
    return u ? u.email : null;
  }
  const u = await users.findOne({ username: identifier });
  return u ? u.email : null;
}

export const handleForgotInit: RequestHandler = async (req, res) => {
  try {
    const body = forgotInitSchema.parse(req.body);
    const email = await findEmailByIdentifier(body.identifier);
    const isEmail = body.identifier.includes("@");
    if (!email) {
      return res.status(404).json({ ok: false, message: isEmail ? "No email found." : "No username found." });
    }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    const code = generateOtp();
    const codeHash = await bcrypt.hash(code, 8);

    const db = await getDb();
    await db.collection("forgot_otps").updateOne(
      { email: email.toLowerCase() },
      { $set: { email: email.toLowerCase(), codeHash, expiresAt, attempts: 0, updatedAt: now, createdAt: now } },
      { upsert: true }
    );

    try {
      const mailer = createMailer();
      await mailer.sendOtp(email, code);
    } catch (mailErr: any) {
      const status = (mailErr && typeof (mailErr as any).status === "number") ? (mailErr as any).status : 500;
      const message = String((mailErr && (mailErr as any).message) || "Failed to send OTP");
      return res.status(status).json({ ok: false, message });
    }

    res.json({ ok: true, message: "OTP sent" });
  } catch (err: any) {
    res.status(400).json({ ok: false, message: err?.message || "Invalid request" });
  }
};

export const handleForgotVerify: RequestHandler = async (req, res) => {
  try {
    const body = forgotVerifySchema.parse(req.body);
    const email = await findEmailByIdentifier(body.identifier);
    if (!email) return res.status(404).json({ ok: false, message: "No account found" });

    const db = await getDb();
    const pending = await db.collection("forgot_otps").findOne({ email: email.toLowerCase() });
    if (!pending) return res.status(400).json({ ok: false, message: "No pending request" });
    if (pending.expiresAt && new Date(pending.expiresAt) < new Date()) return res.status(400).json({ ok: false, message: "Invalid or expired OTP." });

    const ok = await bcrypt.compare(body.code, pending.codeHash || "");
    if (!ok) {
      await db.collection("forgot_otps").updateOne({ _id: pending._id }, { $inc: { attempts: 1 }, $set: { updatedAt: new Date() } });
      return res.status(401).json({ ok: false, message: "Invalid or expired OTP." });
    }

    res.json({ ok: true, message: "OTP verified" });
  } catch (err: any) {
    res.status(400).json({ ok: false, message: err?.message || "Invalid request" });
  }
};

export const handleForgotReset: RequestHandler = async (req, res) => {
  try {
    const body = forgotResetSchema.parse(req.body);
    const email = await findEmailByIdentifier(body.identifier);
    if (!email) return res.status(404).json({ ok: false, message: "No account found" });

    const db = await getDb();
    const pending = await db.collection("forgot_otps").findOne({ email: email.toLowerCase() });
    if (!pending) return res.status(400).json({ ok: false, message: "No pending request" });
    if (pending.expiresAt && new Date(pending.expiresAt) < new Date()) return res.status(400).json({ ok: false, message: "Invalid or expired OTP." });

    const ok = await bcrypt.compare(body.code, pending.codeHash || "");
    if (!ok) return res.status(401).json({ ok: false, message: "Invalid or expired OTP." });

    const users = db.collection("users");
    const newHash = await bcrypt.hash(body.newPassword, 10);
    const now = new Date();
    await users.updateOne({ email: email.toLowerCase() }, { $set: { passwordHash: newHash, updatedAt: now } });
    await db.collection("auth_events").insertOne({ type: "password_reset_forgot", email: email.toLowerCase(), ts: now });
    await db.collection("forgot_otps").deleteOne({ _id: pending._id });

    res.json({ ok: true, message: "Password changed successfully." });
  } catch (err: any) {
    res.status(400).json({ ok: false, message: err?.message || "Invalid request" });
  }
};

export const handleSignOut: RequestHandler = async (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true, message: "signed_out" });
};
