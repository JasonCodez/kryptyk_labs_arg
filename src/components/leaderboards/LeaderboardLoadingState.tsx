import type { LeaderboardTab } from "./LeaderboardTabs";

export interface LeaderboardLoadingStateProps {
  activeTab: LeaderboardTab;
}

const SKELETON_STYLE = { background: "var(--pw-surface-2)" };
const BORDER_STYLE = { borderColor: "var(--pw-border-default)" };

export default function LeaderboardLoadingState({ activeTab }: LeaderboardLoadingStateProps) {
  const isPeriod = activeTab === "weekly" || activeTab === "monthly";
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading leaderboard</span>

      {isPeriod && (
        <div className="grid gap-3 sm:grid-cols-[220px_1fr]" aria-hidden="true">
          <div className="h-24 rounded-xl" style={SKELETON_STYLE} />
          <div className="h-24 rounded-xl" style={SKELETON_STYLE} />
        </div>
      )}

      <div className="h-28 rounded-xl sm:h-32" style={SKELETON_STYLE} aria-hidden="true" />

      <div className="overflow-hidden rounded-xl border" style={BORDER_STYLE} aria-hidden="true">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="flex items-center gap-3 border-b p-3 last:border-0" style={BORDER_STYLE}>
            <div className="h-8 w-8 shrink-0 rounded-full" style={SKELETON_STYLE} />
            <div className="h-3 flex-1 rounded" style={SKELETON_STYLE} />
            <div className="h-3 w-12 shrink-0 rounded" style={SKELETON_STYLE} />
          </div>
        ))}
      </div>
    </div>
  );
}
