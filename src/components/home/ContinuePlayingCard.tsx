"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
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
        className="rounded-[20px] animate-pulse"
        style={{ height: 112, background: "var(--pw-surface-1)", border: "1px solid var(--pw-border-subtle)" }}
      />
    );
  }

  if (!puzzle) return null;

  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
    >
      <PressableCard href={`/puzzles/${puzzle.id}`} accent="primary" padding="md">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--pw-brand-primary)" }}>
              ▶ Continue Playing
            </p>
            <h3 className="text-lg font-extrabold truncate" style={{ color: "var(--pw-text-primary)" }}>
              {puzzle.title}
            </h3>
            <p className="text-sm mt-0.5" style={{ color: "var(--pw-text-secondary)" }}>
              {puzzle.category?.name ?? "Puzzle"} &middot; {puzzle.difficulty}
            </p>
          </div>
          <div
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold shadow-skeu-pill"
            style={{ background: "var(--pw-brand-primary)", color: "var(--pw-text-on-primary)" }}
          >
            Resume
          </div>
        </div>
        <div
          className="mt-4 h-1.5 w-full rounded-full overflow-hidden"
          role="progressbar"
          aria-label="Puzzle progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, Math.round(puzzle.completionPercentage))}
          style={{ background: "color-mix(in srgb, var(--pw-brand-primary) 14%, transparent)" }}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(100, Math.round(puzzle.completionPercentage))}%`, background: "var(--pw-brand-primary)" }}
          />
        </div>
      </PressableCard>
    </motion.div>
  );
}
