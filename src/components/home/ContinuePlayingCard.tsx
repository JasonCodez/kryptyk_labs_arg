"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Play, ArrowRight } from "lucide-react";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";
import PressableCard from "@/components/ui/PressableCard";

interface ActivePuzzle {
  id: string;
  title: string;
  category: { id: string; name: string } | null;
  difficulty: string;
  completionPercentage: number;
  attempts: number;
}

const clampProgress = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

/**
 * The primary home-screen hero when a signed-in player has a puzzle in progress.
 * Self-contained: renders nothing for guests, nothing while nothing is in progress,
 * and a fixed-height skeleton while its own fetch is in flight so the Daily Puzzle
 * card below it doesn't jump once this resolves.
 */
export default function ContinuePlayingCard() {
  const { status } = useSession();
  const [puzzle, setPuzzle] = useState<ActivePuzzle | null>(null);
  const [loading, setLoading] = useState(true);
  const reduceMotion = useAppReducedMotion();

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    fetch("/api/user/continue-playing")
      .then((r) => (r.ok ? r.json() : { puzzle: null }))
      .then((data) => { if (!cancelled) setPuzzle(data.puzzle ?? null); })
      .catch(() => { if (!cancelled) setPuzzle(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [status]);

  if (status === "loading" || status === "unauthenticated") return null;

  if (loading) {
    return (
      <div
        data-testid="home-continue-skeleton"
        role="status"
        aria-label="Checking for a puzzle in progress…"
        className={`rounded-[20px]${reduceMotion ? "" : " animate-pulse"}`}
        style={{ height: 136, background: "var(--pw-surface-1)", border: "1px solid var(--pw-border-subtle)" }}
      />
    );
  }

  if (!puzzle) return null;

  const progress = clampProgress(puzzle.completionPercentage);

  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      data-testid="home-continue-card"
    >
      <PressableCard href={`/puzzles/${puzzle.id}`} accent="primary" padding="md">
        <div className="flex items-start justify-between gap-3 mb-3">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--pw-brand-primary)" }}>
            <Play aria-hidden="true" size={14} strokeWidth={2.5} />
            Continue Playing
          </p>
          <span
            className="shrink-0 px-2.5 py-1 rounded-full text-xs font-bold tabular-nums"
            style={{ background: "color-mix(in srgb, var(--pw-brand-primary) 16%, transparent)", color: "var(--pw-brand-primary)" }}
          >
            {progress}%
          </span>
        </div>

        <h3 className="text-lg font-extrabold leading-snug mb-1" style={{ color: "var(--pw-text-primary)" }}>
          {puzzle.title}
        </h3>
        <p className="text-sm mb-3" style={{ color: "var(--pw-text-secondary)" }}>
          {puzzle.category?.name ?? "Puzzle"} &middot; {puzzle.difficulty}
        </p>

        <div
          className="h-1.5 w-full rounded-full overflow-hidden"
          role="progressbar"
          aria-label="Puzzle progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          style={{ background: "color-mix(in srgb, var(--pw-brand-primary) 14%, transparent)" }}
        >
          <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "var(--pw-brand-primary)" }} />
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-sm font-bold" style={{ color: "var(--pw-text-primary)" }}>
          Resume puzzle
          <ArrowRight aria-hidden="true" size={15} strokeWidth={2.5} />
        </div>
      </PressableCard>
    </motion.div>
  );
}
