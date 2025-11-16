// SWE_project_website/server/index.ts
import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import session from "express-session";

import authRouter from "./auth";
import { registerRoutes } from "./routes";

import path from "path";
import { fileURLToPath } from "url";

const app = express();

// ------------ ENV ------------
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ------------ CORS ------------
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

// ------------ SESSION ------------
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Render free tier = HTTP
      sameSite: "lax",
      path: "/",
    },
  })
);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Auth
app.use("/api/auth", authRouter);

// API Routes
(async () => {
  await registerRoutes(app);

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.status || 500).json({ message: err.message });
  });

  // ---------- STATIC FRONTEND (Production Only) ----------
  const publicDir = path.join(__dirname, "..", "client-dist");

  app.use(express.static(publicDir));

  // Fallback to index.html for SPA routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  // ---------- START SERVER ----------
  const port = process.env.PORT || 5000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${port}`);
  });
})();
