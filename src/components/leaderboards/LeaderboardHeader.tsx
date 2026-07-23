"use client";

import Link from "next/link";
import { ArrowLeft, UsersRound } from "lucide-react";
import { motion } from "framer-motion";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";
import type { LeaderboardTab } from "./LeaderboardTabs";

const COPY: Record<LeaderboardTab, string> = {
  global: "See how your earned points compare across PuzzleWarz.",
  weekly: "Climb this week’s rankings before the current period ends.",
  monthly: "Build your strongest month and compete for the top positions.",
  following: "Compare your progress with players you follow.",
};

export interface LeaderboardHeaderProps {
  activeTab: LeaderboardTab;
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--pw-brand-primary)]";

export default function LeaderboardHeader({ activeTab }: LeaderboardHeaderProps) {
  const reduced = useAppReducedMotion();
  return (
    <motion.header
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.25 }}
      className="space-y-5"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Link
          href="/dashboard"
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold ${FOCUS_RING}`}
          style={{
            borderColor: "var(--pw-border-default)",
            background: "var(--pw-surface-1)",
            color: "var(--pw-text-secondary)",
          }}
        >
          <ArrowLeft aria-hidden="true" size={18} />
          <span>Back to Dashboard</span>
        </Link>
        <Link
          href="/leaderboards/teams"
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${FOCUS_RING}`}
          style={{ background: "var(--pw-brand-secondary)", color: "var(--pw-bg-base)" }}
        >
          <UsersRound aria-hidden="true" size={18} />
          <span>Team Leaderboards</span>
        </Link>
      </div>
      <div>
        <p
          className="text-xs font-bold uppercase tracking-[0.18em]"
          style={{ color: "var(--pw-text-muted)" }}
        >
          PuzzleWarz Competition
        </p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl" style={{ color: "var(--pw-text-primary)" }}>
          Leaderboards
        </h1>
        <p className="mt-2 max-w-2xl text-sm sm:text-base" style={{ color: "var(--pw-text-secondary)" }}>
          {COPY[activeTab]}
        </p>
      </div>
    </motion.header>
  );
}
