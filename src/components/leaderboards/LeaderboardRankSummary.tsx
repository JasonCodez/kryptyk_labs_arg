"use client";

import { CircleCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";
import type { LeaderboardTab } from "./LeaderboardTabs";

const LABEL: Record<LeaderboardTab, string> = {
  global: "Your Global Rank", weekly: "Your Weekly Rank", monthly: "Your Monthly Rank", following: "Your Following Rank",
};
const EMPTY: Record<LeaderboardTab, string> = {
  global: "Solve a puzzle to enter the global rankings.",
  weekly: "Solve a puzzle this week to enter the rankings.",
  monthly: "Solve a puzzle this month to enter the rankings.",
  following: "Solve a puzzle to enter this leaderboard.",
};

function validNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export default function LeaderboardRankSummary({ activeTab, rank, points, puzzlesSolved, followingCount = 0 }: {
  activeTab: LeaderboardTab; rank: number | null; points: number | null; puzzlesSolved: number | null; followingCount?: number;
}) {
  const reduced = useAppReducedMotion();
  const ranked = validNumber(rank) && rank > 0;
  const rewardZone = (activeTab === "weekly" || activeTab === "monthly") && ranked && rank <= 50;
  const emptyCopy = activeTab === "following" && followingCount === 0
    ? "Follow another player to build your comparison group."
    : EMPTY[activeTab];
  return (
    <motion.section initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.2 }} className="pw-surface pw-bevel p-4 sm:p-6" aria-labelledby="rank-summary-title">
      <p id="rank-summary-title" className="text-xs font-bold uppercase tracking-wide text-[var(--pw-text-muted)]">{LABEL[activeTab]}</p>
      {ranked ? (
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-3xl font-bold text-[var(--pw-text)]">#{rank}</p>
            {rewardZone && <p className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-[var(--pw-success)]"><CircleCheck aria-hidden size={17} /> Reward zone</p>}
            {activeTab === "following" && <p className="mt-2 text-sm text-[var(--pw-text-muted)]">Following {followingCount.toLocaleString()} {followingCount === 1 ? "player" : "players"}</p>}
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-[var(--pw-text)]">{validNumber(points) ? points.toLocaleString() : "0"}</p>
            <p className="text-sm text-[var(--pw-text-muted)]">{activeTab === "weekly" || activeTab === "monthly" ? "Period points" : "Earned points"}</p>
            <p className="mt-1 text-sm text-[var(--pw-text-muted)]">{validNumber(puzzlesSolved) ? puzzlesSolved.toLocaleString() : "0"} puzzles solved</p>
          </div>
        </div>
      ) : <p className="mt-3 text-sm text-[var(--pw-text-muted)]">{emptyCopy}</p>}
    </motion.section>
  );
}
