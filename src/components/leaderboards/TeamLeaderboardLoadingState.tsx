import { Skeleton } from "@/components/Skeleton";

const BORDER_STYLE = { borderColor: "var(--pw-border-default)" };

export default function TeamLeaderboardLoadingState() {
  return (
    <section role="status" aria-label="Loading team leaderboard" data-testid="team-leaderboard-loading" className="space-y-6">
      <span className="sr-only">Loading team leaderboard</span>

      {/* Current-team rank summary */}
      <Skeleton className="h-28 rounded-xl sm:h-32" />

      {/* Featured teams */}
      <div className="grid min-w-0 gap-3 sm:grid-cols-3" aria-hidden="true">
        {[0, 1, 2].map((card) => (
          <div key={card} className="flex flex-col gap-3 rounded-xl border p-4 sm:p-5" style={BORDER_STYLE}>
            <Skeleton className="h-3 w-16 rounded" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <Skeleton className="h-3 flex-1 rounded" />
            </div>
            <Skeleton className="h-3 w-full rounded" />
          </div>
        ))}
      </div>

      {/* Standard team rows */}
      <div className="overflow-hidden rounded-xl border" style={BORDER_STYLE} aria-hidden="true">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-center gap-3 border-b p-3 last:border-0" style={BORDER_STYLE}>
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <Skeleton className="h-3 flex-1 rounded" />
            <Skeleton className="h-3 w-12 shrink-0 rounded" />
          </div>
        ))}
      </div>

      {/* Statistics */}
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4" aria-hidden="true">
        {[0, 1, 2].map((card) => (
          <div key={card} className="min-w-0 rounded-xl border p-4" style={BORDER_STYLE}>
            <Skeleton className="mb-2 h-3 w-20 rounded" />
            <Skeleton className="h-6 w-16 rounded" />
          </div>
        ))}
      </div>
    </section>
  );
}
