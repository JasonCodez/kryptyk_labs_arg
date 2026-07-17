"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { prefersReducedMotion } from "@/lib/juice";
import PressableCard from "@/components/ui/PressableCard";

type DailyEntry = { dayNumber: number; completedToday: boolean; streak: number; available: boolean };
type DailySummary = {
  word: DailyEntry;
  sudoku: DailyEntry;
  crossword: DailyEntry;
  word_search: DailyEntry;
  jigsaw: DailyEntry;
};

/**
 * Lightweight status/CTA summary for today's 5 daily puzzle types — pulls the
 * existing /api/daily/summary aggregate rather than embedding a playable game
 * inline (that's what the old homepage hero did, which is why it needed
 * min-height:100dvh hacks to fit above the fold).
 */
export default function DailyPuzzleHeroCard() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const reduceMotion = useReducedMotion() || prefersReducedMotion();

  useEffect(() => {
    fetch("/api/daily/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  const entries = summary ? Object.values(summary) : [];
  const availableEntries = entries.filter((e) => e.available);
  const completedCount = availableEntries.filter((e) => e.completedToday).length;
  const bestStreak = entries.reduce((max, e) => Math.max(max, e.streak), 0);
  const allDone = availableEntries.length > 0 && completedCount === availableEntries.length;

  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 32, delay: reduceMotion ? 0 : 0.08 }}
    >
      <PressableCard
        href="/daily"
        accent="gold"
        padding="lg"
        bevel
        style={{
          boxShadow:
            "0 0 24px -8px rgba(255,201,60,0.4), 0 12px 28px rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -6px 14px rgba(0,0,0,0.12)",
        }}
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--pw-gold)" }}>
              📅 Daily Puzzles
            </p>
            <h3 className="text-xl font-extrabold" style={{ color: "var(--pw-text)" }}>
              {allDone ? "All done for today!" : "A fresh set every day"}
            </h3>
          </div>
          {bestStreak > 0 && (
            <div
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: "rgba(255,201,60,0.14)", color: "var(--pw-gold)", border: "1px solid rgba(255,201,60,0.3)" }}
            >
              🔥 {bestStreak}
            </div>
          )}
        </div>
        <p className="text-sm mb-4" style={{ color: "var(--pw-text-dim)" }}>
          Hidden Word, Sudoku, Crossword, Word Trove & Jigsaw
          {summary ? ` — ${completedCount}/${availableEntries.length} complete today` : ""}
        </p>
        {/* Styled to match GameButton's pink/skeu look (gradient, gloss, breathing
            pulse) without actually rendering a nested <button> — this whole card
            is already an <a> via PressableCard, and a real <button> inside an <a>
            is invalid HTML and risks swallowing the card's own click/tap handling. */}
        <div
          className="relative inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-extrabold uppercase tracking-wide game-text-stroke game-text-pop border-b-4 shadow-skeu-raised-sm animate-candy-breathe overflow-hidden"
          style={{
            backgroundImage: "linear-gradient(160deg, #FF8FC7 0%, #FF4FA3 45%, #C7157A 100%)",
            borderColor: "#A80F63",
            color: "#ffffff",
          }}
        >
          <span className="game-gloss-overlay" aria-hidden />
          <span className="absolute inset-0 rounded-[inherit] animate-candy-spark" aria-hidden />
          <span className="relative">{allDone ? "View Results" : "Play Now"} &rarr;</span>
        </div>
      </PressableCard>
    </motion.div>
  );
}
