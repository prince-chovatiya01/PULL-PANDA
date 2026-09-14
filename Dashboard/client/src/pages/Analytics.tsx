import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { StatsCard } from "@/components/StatsCard";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Target,
  Users,
  RefreshCw,
  GitBranch,
  BarChart3,
  Bot,
  Brain,
  Sparkles,
  Layers,
  Award,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import type { Stats, PullRequest } from "@/lib/api";
import { apiFetch } from "@/lib/apiClient";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// Helper: ms → "Xm Ys" or "Xd Yh"
function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${totalSeconds % 60}s`;
  return `${totalSeconds}s`;
}

const STATUS_COLORS: Record<string, string> = {
  Merged: "#8b5cf6",
  Open: "#22c55e",
  Closed: "#ef4444",
};

interface AIIntelligenceData {
  is_trained: boolean;
  total_reviews: number;
  prompt_names: string[];
  strategies: Array<{
    name: string;
    times_selected: number;
    average_score: number;
    best_score: number;
  }>;
  score_history: number[];
}

export default function Analytics() {
  const params = new URLSearchParams(window.location.search);
  const repoFilter = params.get("repo");
  const ownerFilter = params.get("owner");

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery<Stats>({
    queryKey: ["/api/stats"],
    queryFn: () => apiFetch("/api/stats"),
  });

  const {
    data: prs,
    isLoading: prsLoading,
    error: prsError,
  } = useQuery<PullRequest[]>({
    queryKey: ["/api/pull-requests"],
    queryFn: () => apiFetch("/api/pull-requests"),
  });

  const {
    data: aiIntelligence,
    isLoading: aiIntelLoading,
  } = useQuery<AIIntelligenceData>({
    queryKey: ["/api/ai/intelligence"],
    queryFn: () => apiFetch("/api/ai/intelligence"),
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/pull-requests"] });
    queryClient.invalidateQueries({ queryKey: ["/api/ai/intelligence"] });
  };

  const {
    totalPRs,
    openPRs,
    mergedPRs,
    closedPRs,
    activeRepos,
    aiReviewedCount,
    aiCoverage,
    prStatusData,
    prVolumeTimeline,
    aiReviewTimeline,
    topContributors,
    repoPrCounts,
    bestRepo,
  } = useMemo(() => {
    const result = {
      filteredPrs: [] as PullRequest[],
      totalPRs: 0,
      openPRs: 0,
      mergedPRs: 0,
      closedPRs: 0,
      activeRepos: 0,
      aiReviewedCount: 0,
      aiCoverage: 0,
      prStatusData: [] as { name: string; value: number }[],
      prVolumeTimeline: [] as { date: string; count: number }[],
      aiReviewTimeline: [] as { date: string; count: number }[],
      topContributors: [] as { name: string; prs: number; merged: number }[],
      repoPrCounts: [] as { name: string; count: number }[],
      bestRepo: null as
        | {
            name: string;
            total: number;
            merged: number;
            aiCoverage: number;
            avgMergeMs: number;
          }
        | null,
    };

    if (!prs) return result;

    const filtered = prs.filter((pr) => {
      if (repoFilter && pr.repository !== repoFilter) return false;
      if (ownerFilter && pr.owner !== ownerFilter) return false;
      return true;
    });

    result.filteredPrs = filtered;
    const totalPRs = filtered.length;
    result.totalPRs = totalPRs;

    let open = 0;
    let merged = 0;
    let closed = 0;
    let aiReviewed = 0;

    const repoSet = new Set<string>();
    const prVolumeMap: Record<string, number> = {};
    const aiVolumeMap: Record<string, number> = {};

    const contributorMap: Record<
      string,
      { prs: number; merged: number }
    > = {};

    const repoStatsMap: Record<
      string,
      {
        total: number;
        merged: number;
        aiReviewed: number;
        mergeTimes: number[];
      }
    > = {};

    for (const pr of filtered) {
      repoSet.add(pr.repository);

      if (pr.merged) merged++;
      else if (pr.state === "open") open++;
      else closed++;

      if (pr.aiReviewed) {
        aiReviewed++;
        const day = pr.updated_at ? pr.updated_at.slice(0, 10) : pr.created_at.slice(0, 10);
        aiVolumeMap[day] = (aiVolumeMap[day] || 0) + 1;
      }

      const createdDay = pr.created_at.slice(0, 10);
      prVolumeMap[createdDay] = (prVolumeMap[createdDay] || 0) + 1;

      const user = pr.user?.login || "unknown";
      if (!contributorMap[user]) {
        contributorMap[user] = { prs: 0, merged: 0 };
      }
      contributorMap[user].prs++;
      if (pr.merged) contributorMap[user].merged++;

      if (!repoStatsMap[pr.repository]) {
        repoStatsMap[pr.repository] = {
          total: 0,
          merged: 0,
          aiReviewed: 0,
          mergeTimes: [],
        };
      }
      const repoStat = repoStatsMap[pr.repository];

      repoStat.total++;
      if (pr.merged) {
        repoStat.merged++;
        const created = new Date(pr.created_at).getTime();
        const updated = new Date(pr.updated_at).getTime();
        if (updated > created) {
          repoStat.mergeTimes.push(updated - created);
        }
      }
      if (pr.aiReviewed) repoStat.aiReviewed++;
    }

    result.openPRs = open;
    result.mergedPRs = merged;
    result.closedPRs = closed;
    result.activeRepos = repoSet.size || stats?.activeRepos || 0;
    result.aiReviewedCount = aiReviewed;
    result.aiCoverage = totalPRs > 0 ? Math.round((aiReviewed / totalPRs) * 100) : 0;

    result.prStatusData = [
      { name: "Merged", value: merged },
      { name: "Open", value: open },
      { name: "Closed", value: closed },
    ];

    result.prVolumeTimeline = Object.entries(prVolumeMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    result.aiReviewTimeline = Object.entries(aiVolumeMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    result.topContributors = Object.entries(contributorMap)
      .map(([name, d]) => ({ name, prs: d.prs, merged: d.merged }))
      .sort((a, b) => b.prs - a.prs)
      .slice(0, 5);

    result.repoPrCounts = Object.entries(repoStatsMap)
      .map(([name, stat]) => ({ name, count: stat.total }))
      .sort((a, b) => b.count - a.count);

    let best = null as typeof result.bestRepo;

    for (const [name, stat] of Object.entries(repoStatsMap)) {
      const aiCoverageRepo =
        stat.total > 0 ? (stat.aiReviewed / stat.total) * 100 : 0;
      const avgMergeMs =
        stat.mergeTimes.length > 0
          ? stat.mergeTimes.reduce((a, b) => a + b, 0) /
            stat.mergeTimes.length
          : 0;

      if (
        !best ||
        stat.merged > best.merged ||
        (stat.merged === best.merged && aiCoverageRepo > best.aiCoverage)
      ) {
        best = {
          name,
          total: stat.total,
          merged: stat.merged,
          aiCoverage: Math.round(aiCoverageRepo),
          avgMergeMs,
        };
      }
    }

    result.bestRepo = best;
    return result;
  }, [prs, repoFilter, ownerFilter, stats]);

  const isLoading = statsLoading || prsLoading;
  const hasError = statsError || prsError;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Analytics & Insights
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {repoFilter
              ? `Metrics for repository: ${ownerFilter}/${repoFilter}`
              : "Repository activity and AI code review performance"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {prs && prs.length > 0 && (
            <select
              className="bg-card border border-border text-foreground text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
              value={repoFilter && ownerFilter ? `${ownerFilter}/${repoFilter}` : "all"}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "all") {
                  window.location.href = "/analytics";
                  return;
                }
                const [owner, repo] = val.split("/");
                window.location.href = `/analytics?owner=${owner}&repo=${repo}`;
              }}
            >
              <option value="all">All Repositories</option>
              {Array.from(
                new Set(prs.map((pr) => `${pr.owner}/${pr.repository}`))
              ).map((pair) => (
                <option key={pair} value={pair}>
                  {pair}
                </option>
              ))}
            </select>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {hasError && (
        <ErrorState
          title="Failed to load analytics"
          message="Unable to fetch analytics data from GitHub. Please try again."
          onRetry={handleRefresh}
        />
      )}

      {/* TOP STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : (
          <>
            <StatsCard
              title="Total PRs"
              value={totalPRs}
              icon={Activity}
              trend={`${openPRs} open • ${mergedPRs} merged`}
            />
            <StatsCard
              title="AI Review Coverage"
              value={totalPRs === 0 ? "—" : `${aiCoverage}%`}
              icon={Target}
              trend={
                totalPRs === 0
                  ? "No PRs yet"
                  : `${aiReviewedCount} of ${totalPRs} PRs reviewed`
              }
            />
            <StatsCard
              title="AI Reviews Completed"
              value={aiReviewedCount}
              icon={Bot}
              trend={
                aiReviewedCount === 0
                  ? "No AI reviews yet"
                  : `Across ${activeRepos} active ${activeRepos === 1 ? "repository" : "repositories"}`
              }
            />
            <StatsCard
              title="Active Repositories"
              value={activeRepos}
              icon={GitBranch}
              trend={repoFilter ? "Filtered repository" : "Total monitored repos"}
            />
          </>
        )}
      </div>

      {/* AI ENGINE INTELLIGENCE CARD */}
      <Card className="p-6 border-primary/20 bg-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                Prompt Selection Intelligence
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                  ML Model
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">
                Iterative multi-armed selector with RandomForest reinforcement
              </p>
            </div>
          </div>

          {aiIntelligence && (
            <div className="flex items-center gap-2">
              <Badge variant={aiIntelligence.is_trained ? "default" : "secondary"} className="text-xs font-mono">
                {aiIntelligence.is_trained ? "Trained (Active RL)" : "Cold-Start Heuristic"}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {aiIntelligence.total_reviews} reviews indexed
              </Badge>
            </div>
          )}
        </div>

        {aiIntelLoading ? (
          <Skeleton className="h-32" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(aiIntelligence?.strategies || []).map((strat) => (
              <div
                key={strat.name}
                className="p-3 rounded-lg border border-border bg-background/50 flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium text-foreground truncate">
                    {strat.name}
                  </span>
                  <Badge variant="secondary" className="text-[10px] font-mono shrink-0">
                    {strat.times_selected} run{strat.times_selected === 1 ? "" : "s"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/40 text-xs">
                  <span className="text-muted-foreground text-[11px]">Avg Score:</span>
                  <span className="font-semibold text-primary">
                    {strat.average_score > 0 ? `${strat.average_score}/10` : "Untested"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* STATUS PIE CHART */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-card-foreground">
                PR Status Distribution
              </h3>
              <p className="text-xs text-muted-foreground">
                Breakdown of open, merged, and closed pull requests
              </p>
            </div>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </div>
          {isLoading ? (
            <Skeleton className="h-64" />
          ) : totalPRs === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No PR data available for this selection.
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={prStatusData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {prStatusData.map((entry) => (
                      <Cell
                        key={`cell-${entry.name}`}
                        fill={STATUS_COLORS[entry.name] || "#6b7280"}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* PR VOLUME CHART */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-card-foreground">
                PR Creation Activity
              </h3>
              <p className="text-xs text-muted-foreground">
                Daily pull request creation volume
              </p>
            </div>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          {isLoading ? (
            <Skeleton className="h-64" />
          ) : prVolumeTimeline.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              Not enough PR activity to plot.
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={prVolumeTimeline}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="PRs Created"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI REVIEWS TIMELINE */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-card-foreground">
                AI Reviews Over Time
              </h3>
              <p className="text-xs text-muted-foreground">
                Daily AI code-review delivery volume
              </p>
            </div>
            <Target className="h-4 w-4 text-muted-foreground" />
          </div>

          {isLoading ? (
            <Skeleton className="h-64" />
          ) : aiReviewTimeline.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No AI review activity detected yet.
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={aiReviewTimeline}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="AI Reviews"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* REPOSITORIES PR COUNT */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-card-foreground">
                PRs per Repository
              </h3>
              <p className="text-xs text-muted-foreground">
                Distribution of pull requests across repos
              </p>
            </div>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </div>

          {isLoading ? (
            <Skeleton className="h-64" />
          ) : repoPrCounts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No repository PR data for this selection.
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={repoPrCounts}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Total PRs" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TOP CONTRIBUTORS */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-card-foreground">
                Active Contributors
              </h3>
              <p className="text-xs text-muted-foreground">
                Most active authors by pull request volume
              </p>
            </div>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>

          {isLoading ? (
            <Skeleton className="h-40" />
          ) : topContributors.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No contributor data for this selection.
            </p>
          ) : (
            <div className="space-y-3">
              {topContributors.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {c.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.prs} PR{c.prs === 1 ? "" : "s"} • {c.merged} merged
                    </p>
                  </div>
                  <div className="w-28 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{
                        width: `${
                          (c.prs / (topContributors[0]?.prs || c.prs || 1)) * 100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* BEST PERFORMING REPO */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-card-foreground">
                Lead Repository
              </h3>
              <p className="text-xs text-muted-foreground">
                Highest merge completion and AI review integration
              </p>
            </div>
            <Target className="h-4 w-4 text-muted-foreground" />
          </div>

          {isLoading ? (
            <Skeleton className="h-40" />
          ) : !bestRepo ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Not enough data to determine a lead repo yet.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-semibold text-foreground">
                  {bestRepo.name}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {bestRepo.merged} of {bestRepo.total} PRs merged ({Math.round((bestRepo.merged / (bestRepo.total || 1)) * 100)}% merge rate)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground">AI Review Coverage</p>
                  <p className="text-base font-semibold text-foreground mt-0.5">
                    {bestRepo.aiCoverage}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg Time to Merge</p>
                  <p className="text-base font-semibold text-foreground mt-0.5">
                    {bestRepo.avgMergeMs ? formatDuration(bestRepo.avgMergeMs) : "—"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
