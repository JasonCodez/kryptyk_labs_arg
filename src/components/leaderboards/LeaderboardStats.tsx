"use client";

import { Coins, Puzzle, UsersRound } from "lucide-react";
import type { LeaderboardDisplayEntry } from "./LeaderboardRow";

export interface LeaderboardStatsProps {
  entries: LeaderboardDisplayEntry[];
}

function formatMetric(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  return value.toLocaleString();
}

const CARD_STYLE = { borderColor: "var(--pw-border-default)", background: "var(--pw-surface-1)" } as const;

export default function LeaderboardStats({ entries }: LeaderboardStatsProps) {
  if (entries.length === 0) return null;

  const topPlayers = entries.length;
  const totalPoints = entries.reduce((sum, entry) => sum + entry.points, 0);
  const puzzlesSolved = entries.reduce((sum, entry) => sum + entry.puzzlesSolved, 0);

  return (
    <div data-testid="leaderboard-stats" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      <div className="min-w-0 rounded-xl border p-4" style={CARD_STYLE}>
        <p className="mb-1 inline-flex items-center gap-1.5 text-sm" style={{ color: "var(--pw-text-muted)" }}>
          <UsersRound aria-hidden="true" size={14} />
          Top Players
        </p>
        <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--pw-text-primary)" }}>
          {formatMetric(topPlayers)}
        </p>
      </div>
      <div className="min-w-0 rounded-xl border p-4" style={CARD_STYLE}>
        <p className="mb-1 inline-flex items-center gap-1.5 text-sm" style={{ color: "var(--pw-text-muted)" }}>
          <Coins aria-hidden="true" size={14} />
          Total Points
        </p>
        <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--pw-text-primary)" }}>
          {formatMetric(totalPoints)}
        </p>
      </div>
      <div className="min-w-0 rounded-xl border p-4" style={CARD_STYLE}>
        <p className="mb-1 inline-flex items-center gap-1.5 text-sm" style={{ color: "var(--pw-text-muted)" }}>
          <Puzzle aria-hidden="true" size={14} />
          Puzzles Solved
        </p>
        <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--pw-text-primary)" }}>
          {formatMetric(puzzlesSolved)}
        </p>
      </div>
    </div>
  );
}
