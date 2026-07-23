"use client";

import LeaderboardRow, { type LeaderboardDisplayEntry } from "./LeaderboardRow";

export interface LeaderboardListProps {
  entries: LeaderboardDisplayEntry[];
  pointsLabel: string;
}

function isTopThree(rank: number): boolean {
  return rank >= 1 && rank <= 3;
}

export default function LeaderboardList({ entries, pointsLabel }: LeaderboardListProps) {
  // Partition by the authoritative server rank only — never by array index or
  // by sorting — so a rank-4 entry at index 0 is never mistaken for first place.
  const featuredEntries = entries.filter((entry) => isTopThree(entry.rank));
  const standardEntries = entries.filter((entry) => !isTopThree(entry.rank));

  const featuredColumns =
    featuredEntries.length === 1 ? "sm:grid-cols-1" : featuredEntries.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";

  return (
    <div data-testid="leaderboard-list" className="flex flex-col gap-6">
      {featuredEntries.length > 0 && (
        <section aria-labelledby="leaderboard-featured-heading">
          <h2
            id="leaderboard-featured-heading"
            className="mb-3 text-xs font-bold uppercase tracking-wide"
            style={{ color: "var(--pw-text-muted)" }}
          >
            Top competitors
          </h2>
          <ul className={`grid min-w-0 gap-3 ${featuredColumns}`}>
            {featuredEntries.map((entry) => (
              <LeaderboardRow key={entry.userId} entry={entry} pointsLabel={pointsLabel} variant="featured" />
            ))}
          </ul>
        </section>
      )}

      {standardEntries.length > 0 && (
        <section aria-labelledby="leaderboard-standard-heading">
          <h2
            id="leaderboard-standard-heading"
            className="mb-3 text-xs font-bold uppercase tracking-wide"
            style={{ color: "var(--pw-text-muted)" }}
          >
            Rankings
          </h2>
          <ul className="min-w-0 overflow-hidden rounded-xl border" style={{ borderColor: "var(--pw-border-default)" }}>
            {standardEntries.map((entry) => (
              <LeaderboardRow key={entry.userId} entry={entry} pointsLabel={pointsLabel} variant="standard" />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
