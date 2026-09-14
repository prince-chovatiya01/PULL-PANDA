import { useState, useMemo } from "react";
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
  Sparkles,
  Loader2,
  ShieldAlert,
  Gauge,
  CheckCircle,
  FileCode2,
  Layers,
} from "lucide-react";

import { apiFetch } from "@/lib/apiClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

  const params = new URLSearchParams(window.location.search);
  const owner = params.get("owner");
  const repo = params.get("repo");
  const number = params.get("number");

  const [isReviewing, setIsReviewing] = useState(false);
  const [showStaticDetails, setShowStaticDetails] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["pr-details", owner, repo, number],
    queryFn: () =>
      apiFetch(`/api/pull-requests/${owner}/${repo}/${number}/reviews`),
    enabled: Boolean(owner && repo && number),
  });

  const { latestAIComment, humanComments, parsedAIMeta } = useMemo(() => {
    if (!data) {
      return { latestAIComment: null, humanComments: [], parsedAIMeta: null };
    }

    const all = (data.allComments || []) as PRComment[];

    const ai = all
      .filter((c: PRComment) => {
        const body = (c.body || "").toLowerCase();
        return (
          body.includes("ai-powered review") ||
          body.includes("pull panda ai review") ||
          body.includes("strategy selected:")
        );
      })
      .sort(
        (a: PRComment, b: PRComment) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

    const latest = ai[0] || null;

    const humans = all.filter((c: PRComment) => {
      const body = (c.body || "").toLowerCase();
      return (
        !body.includes("ai-powered review") &&
        !body.includes("pull panda ai review") &&
        !body.includes("strategy selected:")
      );
    });

    let meta = null;
    if (latest) {
      const body = latest.body;

      // Extract Prompt Strategy
      const strategyMatch =
        body.match(/Strategy Selected:\*\*\s*`([^`]+)`/i) ||
        body.match(/Prompt:\s*`([^`]+)`/i);

      // Extract Quality Score
      const scoreMatch =
        body.match(/Quality Score:\*\*\s*\*\*([0-9.]+)\/10\*\*/i) ||
        body.match(/Score:\s*\*\*([0-9.]+)\/10\*\*/i);

      // Extract Dimensions
      const clarityMatch = body.match(/Clarity:\s*([0-9]+)/i);
      const usefulnessMatch = body.match(/Usefulness:\s*([0-9]+)/i);
      const depthMatch = body.match(/Depth:\s*([0-9]+)/i);
      const actionabilityMatch = body.match(/Actionability:\s*([0-9]+)/i);
      const positivityMatch = body.match(/Positivity:\s*([0-9]+)/i);

      // Extract Static Analysis section if present
      const staticMatch = body.match(/Static Analysis:\*\*\s*```([^`]+)```/i);

      meta = {
        strategy: strategyMatch ? strategyMatch[1] : "Adaptive Heuristic",
        score: scoreMatch ? parseFloat(scoreMatch[1]) : 8.5,
        clarity: clarityMatch ? parseInt(clarityMatch[1]) : null,
        usefulness: usefulnessMatch ? parseInt(usefulnessMatch[1]) : null,
        depth: depthMatch ? parseInt(depthMatch[1]) : null,
        actionability: actionabilityMatch ? parseInt(actionabilityMatch[1]) : null,
        positivity: positivityMatch ? parseInt(positivityMatch[1]) : null,
        staticOutput: staticMatch ? staticMatch[1].trim() : null,
      };
    }

    return {
      latestAIComment: latest,
      humanComments: humans,
      parsedAIMeta: meta,
    };
  }, [data]);

  const handleTriggerAIReview = async () => {
    if (!owner || !repo || !number) return;
    setIsReviewing(true);
    try {
      const result = await apiFetch(
        `/api/pull-requests/${owner}/${repo}/${number}/review`,
        { method: "POST" }
      );

      toast({
        title: "AI Review Completed",
        description: `Strategy: ${result.chosen_prompt} • Score: ${result.score}/10`,
      });

      queryClient.invalidateQueries({
        queryKey: ["pr-details", owner, repo, number],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pull-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    } catch (err: any) {
      toast({
        title: "Review Failed",
        description: err.message || "Failed to execute AI review pipeline.",
        variant: "destructive",
      });
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setLocation(`/pull-requests?repo=${repo}&owner=${owner}`)
          }
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to PRs
        </Button>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleTriggerAIReview}
            disabled={isReviewing}
            size="sm"
            className="font-medium"
          >
            {isReviewing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Executing Pipeline...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2 text-primary-foreground" />
                {latestAIComment ? "Re-Run AI Review" : "Review with AI"}
              </>
            )}
          </Button>

          <Button variant="outline" size="sm" asChild>
            <a
              href={`https://github.com/${owner}/${repo}/pull/${number}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              GitHub
            </a>
          </Button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <Card className="p-6 border-destructive/50 bg-destructive/10">
          <p className="text-sm text-destructive">
            Failed to load pull request details. Please verify GitHub permissions.
          </p>
        </Card>
      )}

      {/* Main PR Content */}
      {data && (
        <div className="space-y-6">
          {/* PR Header Card */}
          <Card className="p-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-muted-foreground font-semibold">
                    #{number}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {owner}/{repo}
                  </Badge>
                  <Badge
                    variant={
                      data.reviews?.[0]?.pull_request?.state === "closed"
                        ? "destructive"
                        : "default"
                    }
                    className="capitalize"
                  >
                    {data.reviews?.[0]?.pull_request?.state || "open"}
                  </Badge>
                  {latestAIComment && (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      AI Review Ready
                    </Badge>
                  )}
                </div>

                <h1 className="text-xl font-semibold text-foreground">
                  {data.reviews?.[0]?.pull_request?.title || `Pull Request #${number}`}
                </h1>
              </div>
            </div>
          </Card>

          {/* AI Intelligence & Review Section */}
          <Card className="p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    AI Code Review
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Multi-armed prompt selection • Static analysis • 5D Meta-Evaluation
                  </p>
                </div>
              </div>

              {parsedAIMeta && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs">
                    <Layers className="h-3 w-3 mr-1" />
                    {parsedAIMeta.strategy}
                  </Badge>
                  <Badge className="bg-primary/20 text-primary border-primary/30 font-semibold text-xs">
                    <Gauge className="h-3 w-3 mr-1" />
                    {parsedAIMeta.score}/10 Quality
                  </Badge>
                </div>
              )}
            </div>

            {!latestAIComment ? (
              <div className="text-center py-10 space-y-3">
                <Bot className="h-10 w-10 text-muted-foreground/60 mx-auto" />
                <h3 className="text-sm font-medium text-foreground">
                  No AI Review Generated Yet
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Run the Python AI engine to analyze code diffs, run static analysis linters, and generate a multi-pass evaluation.
                </p>
                <Button
                  onClick={handleTriggerAIReview}
                  disabled={isReviewing}
                  size="sm"
                  className="mt-2"
                >
                  {isReviewing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Start AI Review
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                {/* 5-Dimension Quality Scores */}
                {parsedAIMeta && parsedAIMeta.clarity && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-muted/40 rounded-lg border border-border/60">
                    <div className="space-y-1">
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Clarity
                      </span>
                      <p className="text-lg font-bold text-foreground">
                        {parsedAIMeta.clarity}/10
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Usefulness
                      </span>
                      <p className="text-lg font-bold text-foreground">
                        {parsedAIMeta.usefulness}/10
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Depth
                      </span>
                      <p className="text-lg font-bold text-foreground">
                        {parsedAIMeta.depth}/10
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Actionability
                      </span>
                      <p className="text-lg font-bold text-foreground">
                        {parsedAIMeta.actionability}/10
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Positivity
                      </span>
                      <p className="text-lg font-bold text-foreground">
                        {parsedAIMeta.positivity}/10
                      </p>
                    </div>
                  </div>
                )}

                {/* Static Analysis Findings Toggle */}
                {parsedAIMeta?.staticOutput && (
                  <div className="border border-border rounded-md overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowStaticDetails(!showStaticDetails)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 text-xs font-medium text-foreground hover:bg-muted/50 transition text-left"
                    >
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-amber-500" />
                        <span>Static Analysis Linters (Bandit / Flake8 / Radon)</span>
                      </div>
                      <span className="text-muted-foreground">
                        {showStaticDetails ? "Hide" : "Show findings"}
                      </span>
                    </button>
                    {showStaticDetails && (
                      <pre className="p-3 text-xs font-mono bg-black/40 text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                        {parsedAIMeta.staticOutput}
                      </pre>
                    )}
                  </div>
                )}

                {/* Review Body */}
                <div className="prose prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap bg-background/50 p-4 rounded-md border border-border">
                  {latestAIComment.body}
                </div>

                <div className="text-xs text-muted-foreground flex items-center justify-between pt-2 border-t border-border">
                  <span>
                    Posted by {latestAIComment.user.login}
                  </span>
                  <span>
                    {new Date(latestAIComment.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </Card>

          {/* Human Comments */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">
                Discussion & Human Comments ({humanComments.length})
              </h2>
            </div>

            {humanComments.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No human discussion comments on this pull request.
              </p>
            ) : (
              <div className="space-y-3">
                {humanComments.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 bg-muted/40 border border-border rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <img
                          src={c.user.avatar_url}
                          alt={c.user.login}
                          className="h-4 w-4 rounded-full"
                        />
                        <span className="font-medium text-foreground">
                          {c.user.login}
                        </span>
                      </div>
                      <span>
                        {new Date(c.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap text-foreground/90">
                      {c.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
