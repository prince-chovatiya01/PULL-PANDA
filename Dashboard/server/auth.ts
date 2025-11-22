// // SWE_project_website/server/auth.ts
// import dotenv from "dotenv";
// dotenv.config(); // MUST be first

// import express, { Request, Response } from "express";
// import axios from "axios";
// import { Octokit } from "@octokit/rest";
// import session from "express-session";

// declare module "express-session" {
//   interface SessionData {
//     accessToken?: string;
//   }
// }

// const router = express.Router();

// console.log("AUTH ENV TEST:", process.env.GITHUB_CLIENT_ID, process.env.GITHUB_REDIRECT_URI);

// /* ------------------------------------------------------
//    STEP 1 — LOGIN ROUTE
//    Forces GitHub to prompt login + consent every time.
// -------------------------------------------------------- */
// router.get("/github", (_req: Request, res: Response) => {
//   const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
//   const REDIRECT_URI = process.env.GITHUB_REDIRECT_URI;

//   if (!CLIENT_ID || !REDIRECT_URI) {
//     return res.status(500).send("GitHub OAuth is not configured.");
//   }

//   const authUrl =
//     `https://github.com/login/oauth/authorize` +
//     `?client_id=${CLIENT_ID}` +
//     `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
//     `&scope=repo,user` +
//     `&prompt=consent` +
//     `&force_verify=true`;  // <--- THE KEY FIX

//   res.redirect(authUrl);
// });

// /* ------------------------------------------------------
//    STEP 2 — CALLBACK ROUTE
//    GitHub sends ?code=XYZ → we exchange it for access token
// -------------------------------------------------------- */
// router.get("/github/callback", async (req: Request, res: Response) => {
//   const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
//   const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
//   const REDIRECT_URI = process.env.GITHUB_REDIRECT_URI;
//   const FRONTEND_URL = process.env.FRONTEND_URL;

//   if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI || !FRONTEND_URL) {
//     console.error("❌ Missing OAuth ENV vars in callback");
//     return res.status(500).send("OAuth configuration incomplete.");
//   }

//   const code = req.query.code as string;

//   if (!code) {
//     console.error("❌ OAuth Callback Error: Missing code");
//     return res.status(400).send("Missing 'code' parameter from GitHub OAuth.");
//   }

//   try {
//     const tokenResponse = await axios.post(
//       "https://github.com/login/oauth/access_token",
//       {
//         client_id: CLIENT_ID,
//         client_secret: CLIENT_SECRET,
//         code,
//         redirect_uri: REDIRECT_URI
//       },
//       { headers: { Accept: "application/json" } }
//     );

//     const accessToken = tokenResponse.data.access_token;

//     if (!accessToken) {
//       console.error("❌ Failed to exchange OAuth code:", tokenResponse.data);
//       return res.status(401).send("GitHub OAuth token exchange failed.");
//     }

//     // Save token in session
//     req.session.accessToken = accessToken;

//     console.log("✔ OAuth success — redirecting to frontend:", FRONTEND_URL);
//     return res.redirect(FRONTEND_URL);

//   } catch (err) {
//     console.error("❌ OAuth callback exchange failed:", err);
//     return res.status(500).send("GitHub OAuth failed during token exchange.");
//   }
// });

// /* ------------------------------------------------------
//    STEP 3 — CHECK AUTH STATE
//    Used by ProtectedRoute (frontend)
// -------------------------------------------------------- */
// router.get("/me", async (req: Request, res: Response) => {
//   if (!req.session.accessToken) {
//     return res.status(401).json({ error: "Not authenticated" });
//   }

//   try {
//     const octokit = new Octokit({ auth: req.session.accessToken });
//     const { data: user } = await octokit.rest.users.getAuthenticated();
//     return res.json(user);

//   } catch (err) {
//     console.error("❌ Token invalid — clearing session:", err);
//     delete req.session.accessToken;
//     return res.status(401).json({ error: "Token invalid, please log in again." });
//   }
// });

// /* ------------------------------------------------------
//    STEP 4 — LOGOUT
// -------------------------------------------------------- */
// router.post("/logout", (req: Request, res: Response) => {
//   req.session.destroy(() => {
//     res.clearCookie("connect.sid", {
//       path: "/",
//       sameSite: "none",
//       secure: false
//     });
//     console.log("✔ Logged out successfully.");
//     return res.json({ message: "Logged out" });
//   });
// });

// export default router;


// SWE_project_website/server/auth.ts

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

/* -----------------------------------------------------
   🔥 HARDCODED CONSTANTS (NO .env USED ANYWHERE)
------------------------------------------------------ */
const GITHUB_CLIENT_ID = "Ov23liVEZWJtiA8Tsd7Z";
const GITHUB_CLIENT_SECRET = "1e8141bec9497d83b1f8e2de88712b9d9cd69177";

const SESSION_SECRET = "supersecret";

const RAILWAY_URL = "https://pr-review-agent-test-production-5d0a.up.railway.app";
const REDIRECT_URI = `${RAILWAY_URL}/auth/github/callback`;

const FRONTEND_URL = "http://localhost:3000";

console.log("AUTH CONFIG:");
console.log("CLIENT ID:", GITHUB_CLIENT_ID);
console.log("REDIRECT URI:", REDIRECT_URI);

/* -----------------------------------------------------
   EXPRESS SESSION (HARD CODED SECRET TOO)
------------------------------------------------------ */
router.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      sameSite: "lax",
    },
  })
);

/* ------------------------------------------------------
   STEP 1 — LOGIN ROUTE
-------------------------------------------------------- */
router.get("/github", (_req: Request, res: Response) => {
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
        redirect_uri: REDIRECT_URI
      },
      { headers: { Accept: "application/json" } }
    );

    const accessToken = tokenRes.data.access_token;

    if (!accessToken) {
      console.error("Token exchange failed:", tokenRes.data);
      return res.status(401).send("Token exchange failed.");
    }

    req.session.accessToken = accessToken;

    console.log("✔ OAuth SUCCESS — redirecting to:", FRONTEND_URL);
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
      secure: false
    });
    return res.json({ message: "Logged out" });
  });
});

export default router;
