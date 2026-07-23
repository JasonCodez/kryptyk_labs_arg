import { Skeleton } from "@/components/Skeleton";

const BORDER_STYLE = { borderColor: "var(--pw-border-default)" };

export default function TeamDetailLoadingState() {
  return (
    <section role="status" aria-label="Loading team details" data-testid="team-detail-loading" className="space-y-6">
      <span className="sr-only">Loading team details</span>

      {/* Hero navigation line */}
      <Skeleton className="h-6 w-40 rounded" />

      {/* Team identity hero */}
      <div className="rounded-2xl border p-5 sm:p-8" style={BORDER_STYLE} aria-hidden="true">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 shrink-0 rounded-full sm:h-16 sm:w-16" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-6 w-2/3 rounded" />
            <Skeleton className="h-4 w-1/2 rounded" />
          </div>
        </div>
        {/* Action-row placeholders */}
        <div className="mt-5 flex flex-wrap gap-2">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </div>

      {/* Five statistics cards */}
      <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-5" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((card) => (
          <div key={card} className="min-w-0 rounded-xl border p-4" style={BORDER_STYLE}>
            <Skeleton className="mb-2 h-3 w-16 rounded" />
            <Skeleton className="h-6 w-14 rounded" />
          </div>
        ))}
      </div>

      {/* Top-contributors panel */}
      <div className="rounded-xl border p-5 sm:p-6" style={BORDER_STYLE} aria-hidden="true">
        <Skeleton className="mb-4 h-5 w-40 rounded" />
        <div className="space-y-2">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Recent-activity panel */}
      <div className="rounded-xl border p-5 sm:p-6" style={BORDER_STYLE} aria-hidden="true">
        <Skeleton className="mb-4 h-5 w-36 rounded" />
        <div className="space-y-2">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-10 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Member-roster panel */}
      <div className="rounded-xl border p-5 sm:p-6" style={BORDER_STYLE} aria-hidden="true">
        <Skeleton className="mb-4 h-5 w-28 rounded" />
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="flex items-center gap-3 rounded-lg border p-3" style={BORDER_STYLE}>
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <Skeleton className="h-3 flex-1 rounded" />
              <Skeleton className="h-3 w-16 shrink-0 rounded" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
