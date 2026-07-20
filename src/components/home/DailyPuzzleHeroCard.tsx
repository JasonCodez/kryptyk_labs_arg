"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Flame, Check, ArrowRight } from "lucide-react";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";
import PressableCard from "@/components/ui/PressableCard";

type DailyEntry = { dayNumber: number; completedToday: boolean; streak: number; available: boolean };
type DailySummary = {
  word: DailyEntry;
  sudoku: DailyEntry;
  crossword: DailyEntry;
  word_search: DailyEntry;
  jigsaw: DailyEntry;
};

/** Stable display order + player-facing labels — API keys are untouched. */
const DAILY_TYPES: Array<{ key: keyof DailySummary; label: string }> = [
  { key: "word", label: "Hidden Word" },
  { key: "sudoku", label: "Sudoku" },
  { key: "crossword", label: "Crossword" },
  { key: "word_search", label: "Word Trove" },
  { key: "jigsaw", label: "Jigsaw" },
];

type FetchStatus = "loading" | "ready" | "failed";

/**
 * Lightweight status/CTA summary for today's 5 daily puzzle types — pulls the
 * existing /api/daily/summary aggregate rather than embedding a playable game
 * inline (that's what the old homepage hero did, which is why it needed
 * min-height:100dvh hacks to fit above the fold).
 */
export default function DailyPuzzleHeroCard() {
  const [status, setStatus] = useState<FetchStatus>("loading");
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const reduceMotion = useAppReducedMotion();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/daily/summary")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Daily summary request failed"))))
      .then((data: DailySummary) => {
        if (cancelled) return;
        setSummary(data);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const entries = summary ? DAILY_TYPES.map(({ key }) => summary[key]) : [];
  const availableEntries = entries.filter((e) => e.available);
  const availableCount = availableEntries.length;
  const completedCount = availableEntries.filter((e) => e.completedToday).length;
  const bestStreak = entries.reduce((max, e) => Math.max(max, e.streak), 0);
  const allDone = status === "ready" && availableCount > 0 && completedCount === availableCount;

  const headline = allDone ? "Daily set complete." : "Your daily puzzle run starts here.";

  const statusText =
    status === "loading"
      ? "Checking today’s progress…"
      : status === "ready" && availableCount > 0
        ? `${completedCount} of ${availableCount} complete today`
        : "Five daily puzzles are ready to play";

  const ctaLabel = allDone ? "View Results" : completedCount > 0 ? "Continue Daily Run" : "Start Daily Run";

  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 32, delay: reduceMotion ? 0 : 0.08 }}
      data-testid="home-daily-card"
    >
      <PressableCard
        href="/daily"
        accent="secondary"
        padding="lg"
        bevel
        style={{
          boxShadow:
            "0 0 24px -8px color-mix(in srgb, var(--pw-brand-secondary) 40%, transparent), 0 12px 28px rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -6px 14px rgba(0,0,0,0.12)",
        }}
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--pw-brand-secondary)" }}>
            <CalendarDays aria-hidden="true" size={14} strokeWidth={2.5} />
            Daily Puzzles
          </p>
          {bestStreak > 0 && (
            <div
              className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: "color-mix(in srgb, var(--pw-brand-secondary) 14%, transparent)", color: "var(--pw-brand-secondary)", border: "1px solid color-mix(in srgb, var(--pw-brand-secondary) 30%, transparent)" }}
            >
              <Flame aria-hidden="true" size={13} strokeWidth={2.5} />
              {bestStreak} day streak
            </div>
          )}
        </div>

        <h2 className="text-xl font-extrabold mb-1.5" style={{ color: "var(--pw-text-primary)" }}>
          {headline}
        </h2>
        <p className="text-sm mb-4" style={{ color: "var(--pw-text-secondary)" }}>
          Hidden Word, Sudoku, Crossword, Word Trove, and Jigsaw &mdash; refreshed every day.
        </p>

        <div
          data-testid="daily-progress-segments"
          role="progressbar"
          aria-label="Daily puzzle completion"
          aria-valuemin={status === "ready" ? 0 : undefined}
          aria-valuemax={status === "ready" ? availableCount : undefined}
          aria-valuenow={status === "ready" ? completedCount : undefined}
          aria-valuetext={status === "ready" ? `${completedCount} of ${availableCount} daily puzzles complete` : undefined}
          className="flex gap-1.5 mb-2"
        >
          {DAILY_TYPES.map(({ key, label }) => {
            const entry = summary?.[key];
            const segmentState = !entry || !entry.available ? "unavailable" : entry.completedToday ? "completed" : "incomplete";
            return (
              <span
                key={key}
                title={label}
                aria-hidden="true"
                className="h-2 flex-1 rounded-full flex items-center justify-center"
                style={{
                  background:
                    segmentState === "completed"
                      ? "var(--pw-success)"
                      : segmentState === "incomplete"
                        ? "color-mix(in srgb, var(--pw-brand-secondary) 55%, transparent)"
                        : "var(--pw-border-subtle)",
                }}
              >
                {segmentState === "completed" && <Check aria-hidden="true" size={9} strokeWidth={3} color="var(--pw-bg-base)" />}
              </span>
            );
          })}
        </div>
        <p className="text-sm mb-4" style={{ color: "var(--pw-text-secondary)" }}>
          {statusText}
        </p>

        {/* Styled to match GameButton's primary skeu look (gradient, gloss,
            breathing pulse via .game-btn--primary) without actually rendering a
            nested <button> — this whole card is already an <a> via
            PressableCard, and a real <button> inside an <a> is invalid HTML and
            risks swallowing the card's own click/tap handling. */}
        <div
          className={`relative inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-extrabold uppercase tracking-wide game-text-stroke game-text-pop border-b-4 shadow-skeu-raised-sm overflow-hidden game-btn--primary${reduceMotion ? "" : " animate-candy-breathe"}`}
        >
          <span className="game-gloss-overlay" aria-hidden />
          {!reduceMotion && <span className="absolute inset-0 rounded-[inherit] animate-candy-spark" aria-hidden />}
          <span className="relative">{ctaLabel}</span>
          <ArrowRight aria-hidden="true" size={15} strokeWidth={2.5} className="relative" />
        </div>
      </PressableCard>
    </motion.div>
  );
}
