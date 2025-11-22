// SWE_project_website/server/index.ts
import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import session from "express-session";

import authRouter from "./auth.js";
import { registerRoutes } from "./routes.js";

const app = express();

// ------------ ENV ------------
const FRONTEND_URL = process.env.FRONTEND_URL || "*"; // Allow Vercel domain later

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
      secure: false, // Railway free tier = HTTP
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

  // ❗ REMOVE STATIC FRONTEND — FRONTEND IS ON VERCEL
  // ❗ Do NOT serve frontend from backend
  // ❗ This backend is API only

  // Root check (important for Railway health-check)
  app.get("/", (req, res) => {
    res.json({ status: "Backend running", env: "production" });
  });

  // ---------- START SERVER ----------
  const port = parseInt(process.env.PORT || "5000", 10);
  app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${port}`);
  });
})();
