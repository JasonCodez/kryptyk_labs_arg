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

export default function LeaderboardHeader({ activeTab }: { activeTab: LeaderboardTab }) {
  const reduced = useAppReducedMotion();
  return (
    <motion.header
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.25 }}
      className="space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--pw-line)] bg-[var(--pw-surface)] px-4 py-2 font-semibold text-[var(--pw-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pw-focus)]">
          <ArrowLeft aria-hidden size={18} /> Back to Dashboard
        </Link>
        <Link href="/leaderboards/teams" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--pw-accent)] px-4 py-2 font-bold text-[var(--pw-bg-base)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pw-focus)]">
          <UsersRound aria-hidden size={18} /> Team Leaderboards
        </Link>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--pw-text-muted)]">PuzzleWarz Competition</p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--pw-text)] sm:text-4xl">Leaderboards</h1>
        <p className="mt-2 text-sm text-[var(--pw-text-muted)] sm:text-base">{COPY[activeTab]}</p>
      </div>
    </motion.header>
  );
}
