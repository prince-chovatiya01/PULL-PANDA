import express, { Request, Response } from "express";
import axios from "axios";
import { Octokit } from "@octokit/rest";
import session from "express-session";

declare module "express-session" {
  interface SessionData {
    accessToken?: string;
  }
}

const router = express.Router();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "pull-panda-session-secret";

// Determine host URL and frontend URL
const APP_URL = process.env.APP_URL || process.env.RAILWAY_URL || "http://localhost:5000";
const REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || `${APP_URL}/api/auth/github/callback`;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
  console.warn("⚠️ Warning: GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET environment variables are not set.");
}

router.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  })
);

/* ------------------------------------------------------
   STEP 1 — LOGIN ROUTE
-------------------------------------------------------- */
router.get("/github", (_req: Request, res: Response) => {
  if (!GITHUB_CLIENT_ID) {
    return res.status(500).send("GitHub Client ID is not configured. Check environment variables.");
  }

  const authUrl =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${GITHUB_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=repo,user` +
    `&prompt=consent` +
    `&force_verify=true`;

  res.redirect(authUrl);
});

/* ------------------------------------------------------
   STEP 2 — CALLBACK ROUTE
-------------------------------------------------------- */
router.get("/github/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string;

  if (!code) return res.status(400).send("Missing OAuth code.");

  try {
    const tokenRes = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
      },
      { headers: { Accept: "application/json" } }
    );

    const accessToken = tokenRes.data.access_token;

    if (!accessToken) {
      console.error("Token exchange failed:", tokenRes.data);
      return res.status(401).send("Token exchange failed.");
    }

    req.session.accessToken = accessToken;

    return res.redirect(FRONTEND_URL);
  } catch (err) {
    console.error("❌ OAuth callback failed:", err);
    return res.status(500).send("OAuth failed.");
  }
});

/* ------------------------------------------------------
   STEP 3 — CHECK AUTH STATE
-------------------------------------------------------- */
router.get("/me", async (req: Request, res: Response) => {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const octokit = new Octokit({ auth: req.session.accessToken });
    const { data: user } = await octokit.rest.users.getAuthenticated();
    return res.json(user);
  } catch (err) {
    delete req.session.accessToken;
    return res.status(401).json({ error: "Token invalid. Log in again." });
  }
});

/* ------------------------------------------------------
   STEP 4 — LOGOUT
-------------------------------------------------------- */
router.post("/logout", (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid", {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return res.json({ message: "Logged out" });
  });
});

export default router;
