"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CircleCheckBig, Star, Sparkles, CalendarClock, ChevronLeft, Flame, CalendarDays } from "lucide-react";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";
import Card from "@/components/ui/Card";

export interface DailyResultReward {
  points: number;
  xp: number;
}

export interface DailyNextReward extends DailyResultReward {
  streakDay: number;
}

export type DailyPuzzleResultName = "Sudoku" | "Crossword" | "Word Trove" | "Jigsaw";

export interface DailyPuzzleResultProps {
  puzzleName: DailyPuzzleResultName;
  dayNumber: number;
  streak: number;
  streakDay: number;
  reward?: DailyResultReward | null;
  nextReward?: DailyNextReward | null;
  children?: ReactNode;
}

function streakLabel(streak: number): string {
  if (streak <= 0) return "No active streak";
  if (streak === 1) return "1 day streak";
  return `${streak} day streak`;
}

/**
 * Shared premium completion-results experience for the four standard Daily
 * puzzles (Sudoku, Crossword, Word Trove, Jigsaw). Purely presentational —
 * every value it renders is passed in from the page's existing
 * `useDailyPuzzle` status/completion-response state; it makes no requests of
 * its own.
 */
export default function DailyPuzzleResult({
  puzzleName,
  dayNumber,
  streak,
  streakDay,
  reward = null,
  nextReward = null,
  children,
}: DailyPuzzleResultProps) {
  // Accepted for prop-contract parity with useDailyPuzzle; the completion
  // summary already communicates streak + Daily number without it (see
  // Section 5 of the result spec).
  void streakDay;
  const reduceMotion = useAppReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Mount-only: focus should move to the result heading once, when the
    // puzzle transitions into this result view, not on every rerender.
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const heading = dayNumber > 0 ? `Daily ${puzzleName} #${dayNumber}` : `Daily ${puzzleName}`;

  return (
    <div
      className="h-full min-h-0 w-full overflow-y-auto px-4 py-6"
      style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom, 0px))" }}
    >
      <motion.div
        className="mx-auto flex w-full max-w-lg flex-col items-center gap-5"
        initial={reduceMotion ? undefined : { opacity: 0, y: 8, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25 }}
      >
        <section aria-labelledby="daily-result-heading" className="w-full">
          <Card accent="success" padding="lg" bevel>
            <div className="flex flex-col items-center gap-3 text-center">
              <CircleCheckBig aria-hidden="true" size={40} strokeWidth={2} color="var(--pw-success)" />

              <p
                className="text-xs font-extrabold uppercase tracking-widest"
                style={{ color: "var(--pw-success)" }}
              >
                Daily Challenge Complete
              </p>

              <h2
                id="daily-result-heading"
                ref={headingRef}
                tabIndex={-1}
                className="break-words text-xl font-extrabold outline-none"
                style={{ color: "var(--pw-text-primary)" }}
              >
                {heading}
              </h2>

              <p className="max-w-xs text-sm" style={{ color: "var(--pw-text-secondary)" }}>
                {reward
                  ? "Today’s challenge is complete and your reward has been recorded."
                  : "You’ve already completed today’s challenge."}
              </p>

              <ul
                aria-label="Completion summary"
                className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-sm"
                style={{ color: "var(--pw-text-secondary)" }}
              >
                <li className="inline-flex items-center gap-1.5">
                  <CircleCheckBig aria-hidden="true" size={14} />
                  <span>Completed</span>
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <Flame aria-hidden="true" size={14} />
                  <span>{streakLabel(streak)}</span>
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <CalendarDays aria-hidden="true" size={14} />
                  <span>Daily #{dayNumber}</span>
                </li>
              </ul>

              {reward && (
                <div
                  className="w-full rounded-xl p-4"
                  style={{
                    background: "color-mix(in srgb, var(--pw-success) 10%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--pw-success) 30%, transparent)",
                  }}
                >
                  <p
                    className="mb-2 text-xs font-extrabold uppercase tracking-widest"
                    style={{ color: "var(--pw-success)" }}
                  >
                    Reward earned
                  </p>
                  <dl className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
                    <div className="flex flex-col items-center">
                      <dt
                        className="inline-flex items-center gap-1 text-xs font-semibold"
                        style={{ color: "var(--pw-text-muted)" }}
                      >
                        <Star aria-hidden="true" size={13} />
                        <span>Points</span>
                      </dt>
                      <dd
                        className="text-lg font-extrabold tabular-nums"
                        style={{ color: "var(--pw-text-primary)" }}
                      >
                        +{reward.points}
                      </dd>
                    </div>
                    <div className="flex flex-col items-center">
                      <dt
                        className="inline-flex items-center gap-1 text-xs font-semibold"
                        style={{ color: "var(--pw-text-muted)" }}
                      >
                        <Sparkles aria-hidden="true" size={13} />
                        <span>XP</span>
                      </dt>
                      <dd
                        className="text-lg font-extrabold tabular-nums"
                        style={{ color: "var(--pw-text-primary)" }}
                      >
                        +{reward.xp}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}

              {nextReward && (
                <div
                  className="w-full rounded-xl p-4"
                  style={{ background: "var(--pw-surface-2)", border: "1px solid var(--pw-border-default)" }}
                >
                  <p
                    className="mb-2 text-xs font-extrabold uppercase tracking-widest"
                    style={{ color: "var(--pw-text-muted)" }}
                  >
                    Next streak reward
                  </p>
                  <p className="mb-1 text-sm font-bold" style={{ color: "var(--pw-text-primary)" }}>
                    Day {nextReward.streakDay}
                  </p>
                  <p className="text-sm tabular-nums" style={{ color: "var(--pw-text-secondary)" }}>
                    {nextReward.points} Points &middot; {nextReward.xp} XP
                  </p>
                </div>
              )}

              <p
                className="inline-flex items-center gap-1.5 text-xs"
                style={{ color: "var(--pw-text-muted)" }}
              >
                <CalendarClock aria-hidden="true" size={14} />
                <span>A fresh challenge arrives at the next Daily reset.</span>
              </p>

              <Link
                href="/daily"
                className="game-btn game-btn--secondary game-text-stroke game-text-pop border-b-4 shadow-skeu-raised-sm relative inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl px-6 text-sm font-extrabold uppercase tracking-wide"
                style={{ minHeight: 48 }}
              >
                <span className="game-gloss-overlay" aria-hidden />
                <ChevronLeft aria-hidden="true" size={16} className="relative" />
                <span className="relative">Back to Daily Arena</span>
              </Link>
            </div>
          </Card>
        </section>

        {children}
      </motion.div>
    </div>
  );
}
