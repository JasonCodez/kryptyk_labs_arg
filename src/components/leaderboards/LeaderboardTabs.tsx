"use client";

import { CalendarDays, CalendarRange, Globe2, Users } from "lucide-react";

export type LeaderboardTab = "global" | "weekly" | "monthly" | "following";

const TABS = [
  ["global", "Global", Globe2],
  ["weekly", "Weekly", CalendarDays],
  ["monthly", "Monthly", CalendarRange],
  ["following", "Following", Users],
] as const;

export default function LeaderboardTabs({ activeTab, onChange, loading = false }: {
  activeTab: LeaderboardTab;
  onChange: (tab: LeaderboardTab) => void;
  loading?: boolean;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 no-scrollbar">
      <div role="tablist" aria-label="Leaderboard views" className="flex min-w-max gap-2">
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
              aria-busy={selected && loading || undefined}
              onClick={() => { if (!selected) onChange(id); }}
              className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pw-focus)] ${selected ? "border-[var(--pw-accent)] bg-[var(--pw-accent)] text-[var(--pw-bg-base)]" : "border-[var(--pw-line)] bg-[var(--pw-surface)] text-[var(--pw-text)]"}`}
            >
              <Icon aria-hidden size={18} /> {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
