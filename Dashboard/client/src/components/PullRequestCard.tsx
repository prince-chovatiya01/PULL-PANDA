import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  ThumbsUp,
  Sparkles,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface PullRequestCardProps {
  id?: number;
  number: number;
  title: string;
  author: {
    name: string;
    avatar: string;
  };
  status: "open" | "merged" | "closed";
  createdAt: Date;
  repository: string;
  owner: string;
  url: string;
  aiReviewed?: boolean;
  aiReview?: {
    sentiment: "approved" | "changes_requested" | "commented";
    summary: string;
  };
  staticAnalysis?: {
    issues: number;
    warnings: number;
  };
}

const statusConfig = {
  open: { color: "bg-chart-1", label: "Open", variant: "default" as const },
  merged: {
    color: "bg-chart-3",
    label: "Merged",
    variant: "secondary" as const,
  },
  closed: {
    color: "bg-destructive",
    label: "Closed",
    variant: "destructive" as const,
  },
};

const sentimentIcons = {
  approved: CheckCircle2,
  changes_requested: AlertCircle,
  commented: ThumbsUp,
};

export function PullRequestCard(props: PullRequestCardProps) {
  const {
    number,
    title,
    author,
    status,
    createdAt,
    repository,
    owner,
    url,
    aiReviewed,
    aiReview,
    staticAnalysis,
  } = props;

  const [expanded, setExpanded] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const statusInfo = statusConfig[status];
  const SentimentIcon = aiReview ? sentimentIcons[aiReview.sentiment] : null;

  const openDetails = () => {
    setLocation(
      `/pr-details?owner=${owner}&repo=${repository}&number=${number}`
    );
  };

  const handleReviewWithAI = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsReviewing(true);
    try {
      const res = await apiFetch(
        `/api/pull-requests/${owner}/${repository}/${number}/review`,
        { method: "POST" }
      );
      toast({
        title: "AI Review Completed",
        description: `Strategy: ${res.chosen_prompt} • Quality Score: ${res.score}/10`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pull-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["pr-details", owner, repository, String(number)] });
    } catch (err: any) {
      toast({
        title: "Review Failed",
        description: err.message || "Failed to run AI review pipeline.",
        variant: "destructive",
      });
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <Card
      className="p-4 cursor-pointer hover:bg-accent/40 transition border-border"
      onClick={openDetails}
      data-testid={`card-pr-${number}`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          {/* AI Review Status Indicator */}
          <div className="flex flex-col items-center pt-1">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                aiReviewed ? "bg-emerald-500 ring-2 ring-emerald-500/20" : "bg-amber-500/80"
              }`}
              title={aiReviewed ? "AI Reviewed" : "Pending AI Review"}
            />
          </div>

          {/* MAIN CONTENT */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-medium text-foreground mb-1">
                  {title}
                </h3>

                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                  <span className="font-mono font-medium text-foreground/80">#{number}</span>
                  <span>•</span>
                  <span>{repository}</span>
                  <span>•</span>
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={author.avatar} />
                      <AvatarFallback>{author.name[0] || "U"}</AvatarFallback>
                    </Avatar>
                    <span>{author.name}</span>
                  </div>
                  <span>•</span>
                  <span>
                    {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2 shrink-0">
                {aiReviewed && (
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Reviewed
                  </Badge>
                )}
                <Badge variant={statusInfo.variant}>
                  {statusInfo.label}
                </Badge>
              </div>
            </div>

            {/* AI Review Sentiment + Static Analysis */}
            {(aiReview || staticAnalysis) && (
              <div className="flex items-center gap-2 mb-2">
                {aiReview && SentimentIcon && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <SentimentIcon className="h-3.5 w-3.5" />
                    <span className="capitalize">
                      {aiReview.sentiment.replace("_", " ")}
                    </span>
                  </div>
                )}

                {staticAnalysis && (
                  <>
                    {staticAnalysis.issues > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {staticAnalysis.issues} issue{staticAnalysis.issues !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    {staticAnalysis.warnings > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {staticAnalysis.warnings} warning{staticAnalysis.warnings !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Expandable AI Review Summary */}
            {aiReview && (
              <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="h-7 px-2 text-xs"
                  data-testid={`button-expand-review-${number}`}
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Hide AI Review
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      Show AI Review
                    </>
                  )}
                </Button>

                {expanded && (
                  <div className="mt-2 p-3 bg-muted/60 border border-border rounded-md text-xs text-muted-foreground leading-relaxed">
                    {aiReview.summary}
                  </div>
                )}
              </div>
            )}

            {/* Actions Bar */}
            <div
              className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-border/40"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                {status === "open" && (
                  <Button
                    variant={aiReviewed ? "secondary" : "default"}
                    size="sm"
                    className="h-8 text-xs font-medium"
                    onClick={handleReviewWithAI}
                    disabled={isReviewing}
                  >
                    {isReviewing ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 mr-1.5 text-primary-foreground" />
                        {aiReviewed ? "Re-Review with AI" : "Review with AI"}
                      </>
                    )}
                  </Button>
                )}
              </div>

              <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  GitHub
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
