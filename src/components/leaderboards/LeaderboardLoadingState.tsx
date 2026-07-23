import type { LeaderboardTab } from "./LeaderboardTabs";

export default function LeaderboardLoadingState({ activeTab }: { activeTab: LeaderboardTab }) {
  const period = activeTab === "weekly" || activeTab === "monthly";
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading leaderboard</span>
      {period && <div className="h-24 rounded-xl bg-[var(--pw-surface)]" aria-hidden />}
      <div className="h-32 rounded-xl bg-[var(--pw-surface)]" aria-hidden />
      <div className="overflow-hidden rounded-xl border border-[var(--pw-line)] bg-[var(--pw-surface)]" aria-hidden>
        {[0, 1, 2, 3, 4].map((item) => <div key={item} className="h-16 border-b border-[var(--pw-line)] last:border-0" />)}
      </div>
    </div>
  );
}
