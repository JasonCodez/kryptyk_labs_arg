"use client";

import { CalendarDays, CalendarRange, Globe2, Users } from "lucide-react";

export type LeaderboardTab = "global" | "weekly" | "monthly" | "following";

export interface LeaderboardTabsProps {
  activeTab: LeaderboardTab;
  onChange: (tab: LeaderboardTab) => void;
  loading?: boolean;
}

const TABS: ReadonlyArray<readonly [LeaderboardTab, string, typeof Globe2]> = [
  ["global", "Global", Globe2],
  ["weekly", "Weekly", CalendarDays],
  ["monthly", "Monthly", CalendarRange],
  ["following", "Following", Users],
];

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--pw-brand-primary)]";

export default function LeaderboardTabs({ activeTab, onChange, loading = false }: LeaderboardTabsProps) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 no-scrollbar">
      <div role="tablist" aria-label="Leaderboard views" aria-busy={loading || undefined} className="flex min-w-max gap-2">
        {TABS.map(([id, label, Icon]) => {
          const selected = activeTab === id;
          return (
            <button
              key={id}
              id={`leaderboard-tab-${id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`leaderboard-panel-${id}`}
              onClick={() => {
                if (!selected) onChange(id);
              }}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${FOCUS_RING}`}
              style={
                selected
                  ? { borderColor: "var(--pw-brand-primary)", background: "var(--pw-brand-primary)", color: "var(--pw-bg-base)" }
                  : { borderColor: "var(--pw-border-default)", background: "var(--pw-surface-1)", color: "var(--pw-text-secondary)" }
              }
            >
              <Icon aria-hidden="true" size={18} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
