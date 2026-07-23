"use client";

import { CircleCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";
import type { LeaderboardTab } from "./LeaderboardTabs";

export interface LeaderboardRankSummaryProps {
  activeTab: LeaderboardTab;
  rank: number | null;
  points: number | null;
  puzzlesSolved: number | null;
  followingCount?: number;
}

const RANK_LABEL: Record<LeaderboardTab, string> = {
  global: "Your Global Rank",
  weekly: "Your Weekly Rank",
  monthly: "Your Monthly Rank",
  following: "Your Following Rank",
};

const UNRANKED_COPY: Record<LeaderboardTab, string> = {
  global: "Solve a puzzle to enter the global rankings.",
  weekly: "Solve a puzzle this week to enter the rankings.",
  monthly: "Solve a puzzle this month to enter the rankings.",
  following: "Solve a puzzle to enter this leaderboard.",
};

function isValidNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export default function LeaderboardRankSummary({
  activeTab,
  rank,
  points,
  puzzlesSolved,
  followingCount = 0,
}: LeaderboardRankSummaryProps) {
  const reduced = useAppReducedMotion();
  const isPeriod = activeTab === "weekly" || activeTab === "monthly";
  const ranked = isValidNumber(rank) && rank > 0;
  const rewardZone = isPeriod && ranked && rank <= 50;
  const pointsLabel = isPeriod ? "Period points" : "Earned points";

  const unrankedCopy =
    activeTab === "following" && followingCount === 0
      ? "Follow another player to build your comparison group."
      : UNRANKED_COPY[activeTab];

  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.2 }}
      className="rounded-xl border p-4 sm:p-6"
      style={{ borderColor: "var(--pw-border-default)", background: "var(--pw-surface-1)" }}
      aria-labelledby="leaderboard-rank-summary-title"
    >
      <p
        id="leaderboard-rank-summary-title"
        className="text-xs font-bold uppercase tracking-wide"
        style={{ color: "var(--pw-text-muted)" }}
      >
        {RANK_LABEL[activeTab]}
      </p>

      {ranked ? (
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-3xl font-bold tabular-nums sm:text-4xl" style={{ color: "var(--pw-text-primary)" }}>
              #{rank}
            </p>
            {rewardZone && (
              <p className="mt-2 inline-flex items-center gap-1 text-sm font-bold" style={{ color: "var(--pw-success)" }}>
                <CircleCheck aria-hidden="true" size={17} />
                <span>Reward zone</span>
              </p>
            )}
            {activeTab === "following" && (
              <p className="mt-2 text-sm" style={{ color: "var(--pw-text-muted)" }}>
                Following {followingCount.toLocaleString()} {followingCount === 1 ? "player" : "players"}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums sm:text-4xl" style={{ color: "var(--pw-text-primary)" }}>
              {isValidNumber(points) ? points.toLocaleString() : "0"}
            </p>
            <p className="text-sm" style={{ color: "var(--pw-text-muted)" }}>{pointsLabel}</p>
            <p className="mt-1 text-sm tabular-nums" style={{ color: "var(--pw-text-muted)" }}>
              {isValidNumber(puzzlesSolved) ? puzzlesSolved.toLocaleString() : "0"} puzzles solved
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-3xl font-bold sm:text-4xl" style={{ color: "var(--pw-text-primary)" }}>Unranked</p>
          <p className="mt-2 text-sm" style={{ color: "var(--pw-text-muted)" }}>{unrankedCopy}</p>
          {activeTab === "following" && followingCount > 0 && (
            <p className="mt-2 text-sm" style={{ color: "var(--pw-text-muted)" }}>
              Following {followingCount.toLocaleString()} {followingCount === 1 ? "player" : "players"}
            </p>
          )}
        </div>
      )}
    </motion.section>
  );
}
