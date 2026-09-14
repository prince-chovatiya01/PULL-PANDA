import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import session from "express-session";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import authRouter from "./auth.js";
import { registerRoutes } from "./routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || "*";

app.use(
  cors({
    origin: FRONTEND_URL === "*" ? true : FRONTEND_URL,
    credentials: true,
  })
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "pull-panda-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Health / root status
app.get("/api/health", (_req, res) => {
  res.json({ status: "healthy", service: "Pull Panda Dashboard API" });
});

// Auth & API routes
app.use("/api/auth", authRouter);

(async () => {
  await registerRoutes(app);

  // Serve production build if present
  const publicDir = path.resolve(__dirname, "../public");
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get("*", (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith("/api")) {
        return next();
      }
      res.sendFile(path.join(publicDir, "index.html"));
    });
  } else {
    app.get("/", (_req, res) => {
      res.json({ status: "Backend running", env: process.env.NODE_ENV || "development" });
    });
  }

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.status || 500).json({ message: err.message });
  });

  const port = parseInt(process.env.PORT || "5000", 10);
  app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Pull Panda Dashboard running on port ${port}`);
  });
})();
