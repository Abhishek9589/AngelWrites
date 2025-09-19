import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { pingMongo } from "./lib/mongo";
import { handleSignIn, handleSignUp, handleVerifySignup, handleChangePassword, handleForgotInit, handleForgotVerify, handleForgotReset, handleSignOut } from "./routes/auth";
import { bulkUpsertPoems, bulkUpsertBooks, listPoems, listBooks } from "./routes/content";

export function createServer() {
  const app = express();

  // Middleware
  const isProd = (process.env.NODE_ENV || "").toLowerCase() === "production";
  const origins = (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  app.use(cors({
    origin(origin, cb) {
      if (!isProd) return cb(null, true);
      if (!origin) return cb(null, true);
      if (!origins.length) return cb(null, true);
      if (origins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS not allowed"), false as any);
    },
    credentials: true,
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Auth
  app.post("/api/auth/signup", handleSignUp);
  app.post("/api/auth/signup/verify", handleVerifySignup);
  app.post("/api/auth/signin", handleSignIn);
  app.post("/api/auth/signout", handleSignOut);
  app.post("/api/auth/password/change", handleChangePassword);
  app.post("/api/auth/forgot/init", handleForgotInit);
  app.post("/api/auth/forgot/verify", handleForgotVerify);
  app.post("/api/auth/forgot/reset", handleForgotReset);

  // Content sync
  app.post("/api/poems/bulk", bulkUpsertPoems);
  app.get("/api/poems", listPoems);
  app.post("/api/books/bulk", bulkUpsertBooks);
  app.get("/api/books", listBooks);

  // Health check for Render
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // Database health check
  app.get("/api/db/ping", async (_req, res) => {
    try {
      const info = await pingMongo();
      res.json({ status: "ok", ...info });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err?.message || String(err) });
    }
  });

  return app;
}
