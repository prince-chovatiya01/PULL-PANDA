import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PullRequestCard } from "@/components/PullRequestCard";
import { SearchBar } from "@/components/SearchBar";
import { FilterBar } from "@/components/FilterBar";
import { ErrorState } from "@/components/ErrorState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import type { PullRequest } from "@/lib/api";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";

export default function PullRequests() {
  const params = new URLSearchParams(window.location.search);

  const repoFilter = params.get("repo");
  const ownerFilter = params.get("owner");

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isBatchReviewing, setIsBatchReviewing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  const [filters, setFilters] = useState([
    { id: "open", label: "Open", active: true },
    { id: "merged", label: "Merged", active: false },
    { id: "closed", label: "Closed", active: false },
  ]);

  const { data: prs, isLoading, error, isRefetching } = useQuery<PullRequest[]>({
    queryKey: ['/api/pull-requests', repoFilter, ownerFilter],
    queryFn: () => {
      const path =
        repoFilter && ownerFilter
          ? `/api/pull-requests?repo=${repoFilter}&owner=${ownerFilter}`
          : `/api/pull-requests`;

      return apiFetch(path);
    },
  });

  const handleFilterToggle = (id: string) => {
    setFilters(filters.map((f) => (f.id === id ? { ...f, active: !f.active } : f)));
  };

  const handleClearFilters = () => {
    setFilters(filters.map((f) => ({ ...f, active: false })));
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: ['/api/pull-requests', repoFilter, ownerFilter],
    });
  };

  const filteredPRs = useMemo(() => {
    if (!prs) return [];

    const activeFilters = filters.filter((f) => f.active).map((f) => f.id);

    return prs.filter((pr) => {
      const matchesSearch =
        pr.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pr.repository.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pr.user.login.toLowerCase().includes(searchQuery.toLowerCase());

      const prStatus = pr.merged ? "merged" : pr.state;

      const matchesFilter =
        activeFilters.length === 0 || activeFilters.includes(prStatus);

      return matchesSearch && matchesFilter;
    });
  }, [prs, searchQuery, filters]);

  // Pending open PRs count
  const pendingPRs = useMemo(() => {
    if (!prs) return [];
    return prs.filter((pr) => pr.state === "open" && !pr.aiReviewed);
  }, [prs]);

  const handleBatchReview = async () => {
    if (pendingPRs.length === 0) return;
    setIsBatchReviewing(true);
    setBatchProgress({ current: 0, total: pendingPRs.length });

    let completed = 0;
    for (let i = 0; i < pendingPRs.length; i++) {
      const pr = pendingPRs[i];
      setBatchProgress({ current: i + 1, total: pendingPRs.length });
      try {
        await apiFetch(`/api/pull-requests/${pr.owner}/${pr.repository}/${pr.number}/review`, {
          method: "POST",
        });
        completed++;
      } catch (err: any) {
        console.error(`Failed to review PR #${pr.number}:`, err);
      }
    }

    setIsBatchReviewing(false);
    setBatchProgress(null);
    toast({
      title: "Batch Review Finished",
      description: `Successfully analyzed and commented on ${completed} of ${pendingPRs.length} pull requests.`,
    });

    queryClient.invalidateQueries({ queryKey: ['/api/pull-requests'] });
    queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Pull Requests {repoFilter ? `for ${repoFilter}` : ""}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {repoFilter
                  ? `Showing PRs from the ${repoFilter} repository`
                  : "All pull requests across your repositories"}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Batch Review Button */}
              {pendingPRs.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleBatchReview}
                  disabled={isBatchReviewing}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                >
                  {isBatchReviewing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Reviewing {batchProgress?.current}/{batchProgress?.total}...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Review All Pending ({pendingPRs.length})
                    </>
                  )}
                </Button>
              )}

              {/* Back Button */}
              {repoFilter && (
                <Button variant="outline" size="sm" onClick={() => setLocation("/")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              )}

              {/* Refresh */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefetching}
                data-testid="button-refresh-prs"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search pull requests by title, repository, author..."
            />
            <FilterBar
              filters={filters}
              onFilterToggle={handleFilterToggle}
              onClearAll={handleClearFilters}
            />
          </div>

          {error ? (
            <ErrorState
              title="Failed to load pull requests"
              message="Unable to fetch pull requests from GitHub."
              onRetry={handleRefresh}
            />
          ) : isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPRs.map((pr) => (
                <PullRequestCard
                  key={pr.id}
                  number={pr.number}
                  title={pr.title}
                  author={{
                    name: pr.user.login,
                    avatar: pr.user.avatar_url,
                  }}
                  status={(pr.merged ? "merged" : pr.state) as
                    | "open"
                    | "merged"
                    | "closed"}
                  createdAt={new Date(pr.created_at)}
                  repository={pr.repository}
                  owner={pr.owner}
                  url={pr.html_url}
                  aiReviewed={pr.aiReviewed}
                />
              ))}
            </div>
          )}

          {!isLoading && !error && filteredPRs.length === 0 && (
            <div className="text-center py-12 border border-dashed border-border rounded-lg">
              <p className="text-muted-foreground text-sm">
                {searchQuery || filters.some((f) => f.active)
                  ? "No pull requests found matching current search/filters."
                  : "No pull requests found in monitored repositories."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
