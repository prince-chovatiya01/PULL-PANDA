import type { Express, Request, Response } from "express";
import { Octokit } from "@octokit/rest";
import axios from "axios";

const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://127.0.0.1:8000";

// In-memory cache for PR comment AI-review checks to prevent GitHub API rate limits (TTL: 2 minutes)
interface CacheEntry {
  aiReviewed: boolean;
  timestamp: number;
}
const aiReviewCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 2 * 60 * 1000;

function getClient(req: Request): { octokit: Octokit; token: string } {
  const token = (req.session as any)?.accessToken;

  if (!token) {
    const error: any = new Error("Not authenticated");
    error.status = 401;
    throw error;
  }

  return { octokit: new Octokit({ auth: token }), token };
}

export async function registerRoutes(app: Express): Promise<void> {
  // --------------------------
  // Current Logged-in User
  // --------------------------
  app.get("/api/user", async (req: Request, res: Response) => {
    try {
      const { octokit } = getClient(req);
      const { data: user } = await octokit.rest.users.getAuthenticated();
      res.json(user);
    } catch (error: any) {
      console.error("Error fetching user:", error);
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  // --------------------------
  // Repositories
  // --------------------------
  app.get("/api/repositories", async (req: Request, res: Response) => {
    try {
      const { octokit } = getClient(req);

      const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
        sort: "updated",
        per_page: 30,
      });

      const repositoriesWithPRCounts = await Promise.all(
        repos.map(async (repo) => {
          try {
            const { data: pullRequests } = await octokit.rest.pulls.list({
              owner: repo.owner!.login,
              repo: repo.name,
              state: "open",
            });

            return {
              id: repo.id,
              name: repo.name,
              owner: repo.owner?.login || "",
              full_name: repo.full_name,
              description: repo.description,
              private: repo.private,
              html_url: repo.html_url,
              stargazers_count: repo.stargazers_count,
              forks_count: repo.forks_count,
              language: repo.language,
              open_issues_count: repo.open_issues_count,
              open_prs_count: pullRequests.length,
              updated_at: repo.updated_at,
            };
          } catch (err) {
            return {
              id: repo.id,
              name: repo.name,
              owner: repo.owner?.login || "",
              full_name: repo.full_name,
              description: repo.description,
              private: repo.private,
              html_url: repo.html_url,
              stargazers_count: repo.stargazers_count,
              forks_count: repo.forks_count,
              language: repo.language,
              open_issues_count: repo.open_issues_count,
              open_prs_count: 0,
              updated_at: repo.updated_at,
            };
          }
        })
      );

      res.json(repositoriesWithPRCounts);
    } catch (error: any) {
      console.error("Error fetching repositories:", error);
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  // --------------------------
  // Pull Requests (Optimized N+1 with caching & concurrency)
  // --------------------------
  app.get("/api/pull-requests", async (req: Request, res: Response) => {
    try {
      const { octokit } = getClient(req);

      const repoFilter = req.query.repo as string | undefined;
      const ownerFilter = req.query.owner as string | undefined;

      const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
        per_page: 50,
      });

      const filteredRepos = repos.slice(0, 15).filter((repo) => {
        if (repoFilter && repo.name !== repoFilter) return false;
        if (ownerFilter && repo.owner?.login !== ownerFilter) return false;
        return true;
      });

      const prPromises = filteredRepos.map(async (repo) => {
        try {
          const { data: prs } = await octokit.rest.pulls.list({
            owner: repo.owner!.login,
            repo: repo.name,
            state: "all",
            per_page: 25,
            sort: "updated",
            direction: "desc",
          });

          // Check AI reviewed status with caching
          const prsWithReviewStatus = await Promise.all(
            prs.map(async (pr) => {
              const cacheKey = `${repo.owner!.login}/${repo.name}/${pr.number}/${pr.updated_at}`;
              const cached = aiReviewCache.get(cacheKey);

              let aiReviewed = false;
              if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
                aiReviewed = cached.aiReviewed;
              } else {
                try {
                  const { data: comments } = await octokit.rest.issues.listComments({
                    owner: repo.owner!.login,
                    repo: repo.name,
                    issue_number: pr.number,
                  });

                  aiReviewed = comments.some((c) => {
                    const text = (c.body || "").toLowerCase();
                    return (
                      text.includes("ai-powered review") ||
                      text.includes("pull panda ai review") ||
                      text.includes("static analysis results") ||
                      text.includes("strategy selected:")
                    );
                  });

                  aiReviewCache.set(cacheKey, {
                    aiReviewed,
                    timestamp: Date.now(),
                  });
                } catch {
                  aiReviewed = false;
                }
              }

              return {
                id: pr.id,
                number: pr.number,
                title: pr.title,
                state: pr.state,
                merged: pr.merged_at !== null,
                html_url: pr.html_url,
                created_at: pr.created_at,
                updated_at: pr.updated_at,
                repository: repo.name,
                owner: repo.owner!.login,
                user: {
                  login: pr.user?.login || "unknown",
                  avatar_url: pr.user?.avatar_url || "",
                },
                aiReviewed,
              };
            })
          );

          return prsWithReviewStatus;
        } catch (innerErr) {
          console.error(`PR fetch error for repo ${repo.name}:`, innerErr);
          return [];
        }
      });

      const results = await Promise.all(prPromises);
      const allPRs = results.flat();

      allPRs.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      res.json(allPRs);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  // --------------------------
  // PR Reviews & Comments
  // --------------------------
  app.get(
    "/api/pull-requests/:owner/:repo/:number/reviews",
    async (req: Request, res: Response) => {
      try {
        const { octokit } = getClient(req);
        const { owner, repo, number } = req.params;
        const PR_NUMBER = parseInt(number);

        const { data: reviews } = await octokit.rest.pulls.listReviews({
          owner,
          repo,
          pull_number: PR_NUMBER,
        });

        const { data: comments } = await octokit.rest.issues.listComments({
          owner,
          repo,
          issue_number: PR_NUMBER,
        });

        const aiReviews = comments.filter((c) => {
          const body = (c.body || "").toLowerCase();
          return (
            body.includes("ai-powered review") ||
            body.includes("pull panda ai review") ||
            body.includes("static analysis") ||
            body.includes("strategy selected:")
          );
        });

        res.json({
          reviews,
          aiReviews,
          allComments: comments,
        });
      } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message });
      }
    }
  );

  // --------------------------
  // AI Engine Trigger: Review with AI
  // --------------------------
  app.post(
    "/api/pull-requests/:owner/:repo/:number/review",
    async (req: Request, res: Response) => {
      try {
        const { token } = getClient(req);
        const { owner, repo, number } = req.params;
        const prNumber = parseInt(number);

        if (isNaN(prNumber)) {
          return res.status(400).json({ error: "Invalid PR number" });
        }

        console.log(`Triggering AI review for ${owner}/${repo} #${prNumber}...`);

        const response = await axios.post(
          `${PYTHON_API_URL}/api/ai/review`,
          {
            owner,
            repo,
            pr_number: prNumber,
            token,
            post_to_github: true,
          },
          {
            timeout: 120000, // 2 minutes timeout for LLM pipeline
          }
        );

        // Invalidate cache entry for this PR so updated AI status reflects immediately
        for (const key of aiReviewCache.keys()) {
          if (key.startsWith(`${owner}/${repo}/${prNumber}/`)) {
            aiReviewCache.delete(key);
          }
        }

        res.json(response.data);
      } catch (error: any) {
        console.error("AI Review execution failed:", error?.response?.data || error.message);
        const status = error.response?.status || 500;
        const msg = error.response?.data?.detail || error.message || "AI review pipeline failed";
        res.status(status).json({ error: msg });
      }
    }
  );

  // --------------------------
  // AI Engine Intelligence Stats
  // --------------------------
  app.get("/api/ai/intelligence", async (_req: Request, res: Response) => {
    try {
      const response = await axios.get(`${PYTHON_API_URL}/api/ai/intelligence`, {
        timeout: 5000,
      });
      res.json(response.data);
    } catch (error: any) {
      // Fallback if Python engine is not actively running
      res.json({
        is_trained: false,
        total_reviews: 0,
        prompt_names: [
          "Security Focus",
          "Performance & Scaling",
          "Edge Cases & Robustness",
          "Clean Code & Architecture",
          "Comprehensive Multi-Pass",
          "Test & Reliability",
          "Maintainability"
        ],
        strategies: [],
        score_history: [],
        status: "offline",
      });
    }
  });

  // --------------------------
  // Stats
  // --------------------------
  app.get("/api/stats", async (req: Request, res: Response) => {
    try {
      const { octokit } = getClient(req);

      const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
        per_page: 50,
      });

      let totalPRs = 0;
      let openPRs = 0;
      let mergedPRs = 0;
      let closedPRs = 0;

      const prCounts = await Promise.all(
        repos.slice(0, 15).map(async (repo) => {
          try {
            const { data: prs } = await octokit.rest.pulls.list({
              owner: repo.owner!.login,
              repo: repo.name,
              state: "all",
              per_page: 50,
            });

            return {
              total: prs.length,
              open: prs.filter((pr) => pr.state === "open").length,
              merged: prs.filter((pr) => pr.merged_at).length,
              closed: prs.filter((pr) => pr.state === "closed" && !pr.merged_at).length,
            };
          } catch {
            return { total: 0, open: 0, merged: 0, closed: 0 };
          }
        })
      );

      for (const c of prCounts) {
        totalPRs += c.total;
        openPRs += c.open;
        mergedPRs += c.merged;
        closedPRs += c.closed;
      }

      res.json({
        totalPRs,
        openPRs,
        mergedPRs,
        closedPRs,
        acceptanceRate: totalPRs
          ? Math.round((mergedPRs / totalPRs) * 100)
          : 0,
        activeRepos: repos.length,
      });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });
}
