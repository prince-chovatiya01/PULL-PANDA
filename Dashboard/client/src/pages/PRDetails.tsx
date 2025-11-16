// SWE_project_website/client/src/pages/PRDetails.tsx

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import {
  ExternalLink,
  ArrowLeft,
  MessageSquare,
  Bot,
} from "lucide-react";

interface PRComment {
  id: number;
  body: string;
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
}

export default function PRDetails() {
  const [, setLocation] = useLocation();

  // Read parameters from URL
  const params = new URLSearchParams(window.location.search);
  const owner = params.get("owner");
  const repo = params.get("repo");
  const number = params.get("number");

  const [latestAIComment, setLatestAIComment] = useState<PRComment | null>(null);
  const [humanComments, setHumanComments] = useState<PRComment[]>([]);

  // Fetch PR comments + reviews
  const { data, isLoading, error } = useQuery({
    queryKey: ["pr-details", owner, repo, number],
    queryFn: async () => {
      const res = await fetch(
        `http://localhost:5000/api/pull-requests/${owner}/${repo}/${number}/reviews`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load PR details");
      return res.json();
    },
  });

  // Process comments → separate AI vs Human
  useEffect(() => {
    if (!data) return;

    const all = data.allComments || [];

    // Detect AI comment
    const ai = all
      .filter((c: PRComment) =>
        c.body?.toLowerCase().includes("ai-powered review")
      )
      .sort(
        (a: PRComment, b: PRComment) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

    setLatestAIComment(ai[0] || null);

    // Human comments = everything except AI ones
    const humans = all.filter(
      (c: PRComment) =>
        !c.body?.toLowerCase().includes("ai-powered review")
    );

    setHumanComments(humans);
  }, [data]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">

      {/* Back Button */}
      <Button
        variant="outline"
        onClick={() => setLocation(`/pull-requests?repo=${repo}&owner=${owner}`)}
      >
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to {repo} PRs
      </Button>


      <h1 className="text-3xl font-semibold text-foreground">
        Pull Request Details
      </h1>

      {/* ░░ LOADING ░░ */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-8" />
          <Skeleton className="h-24" />
        </div>
      )}

      {/* ░░ ERROR ░░ */}
      {error && <p className="text-red-500">Failed to load PR details.</p>}

      {/* ░░ CONTENT ░░ */}
      {data && (
        <div className="space-y-6">

          {/* ------------------------------------------------ */}
          {/* PR SUMMARY CARD                                  */}
          {/* ------------------------------------------------ */}
          <Card className="p-5 space-y-3">
            <h2 className="text-xl font-semibold">
              {data.reviews?.[0]?.pull_request?.title ||
                `Pull Request #${number}`}
            </h2>

            <div className="text-sm text-muted-foreground">
              <p>
                Repository:{" "}
                <span className="font-medium">
                  {owner}/{repo}
                </span>
              </p>
              <p>
                PR Number: <span className="font-medium">#{number}</span>
              </p>
            </div>

            <Badge className="mt-2 capitalize">
              {data.reviews?.[0]?.pull_request?.state || "open"}
            </Badge>

            <Button variant="outline" className="mt-3" asChild>
              <a
                href={`https://github.com/${owner}/${repo}/pull/${number}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View on GitHub
              </a>
            </Button>
          </Card>

          {/* ------------------------------------------------ */}
          {/* AI REVIEW SECTION                                */}
          {/* ------------------------------------------------ */}
          <Card className="p-5">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Latest AI-Powered Review
            </h2>

            {!latestAIComment ? (
              <p className="text-muted-foreground mt-2">
                AI has not reviewed this PR yet.
              </p>
            ) : (
              <div className="mt-4">
                <p className="whitespace-pre-wrap text-sm">
                  {latestAIComment.body}
                </p>

                <div className="text-xs text-muted-foreground mt-2">
                  Posted by {latestAIComment.user.login} •{" "}
                  {new Date(latestAIComment.created_at).toLocaleString()}
                </div>
              </div>
            )}
          </Card>

          {/* ------------------------------------------------ */}
          {/* HUMAN COMMENTS                                   */}
          {/* ------------------------------------------------ */}
          <Card className="p-5 space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Human Comments
            </h2>

            {humanComments.length === 0 ? (
              <p className="text-muted-foreground">No human comments yet.</p>
            ) : (
              humanComments.map((c) => (
                <div key={c.id} className="p-3 bg-muted rounded-md">
                  <p className="text-sm whitespace-pre-wrap">{c.body}</p>

                  <div className="text-xs text-muted-foreground mt-2">
                    {c.user.login} —{" "}
                    {new Date(c.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
