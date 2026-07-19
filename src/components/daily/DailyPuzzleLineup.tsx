"use client";

import type { ReactNode } from "react";
import Link from "next/link";

export type DailySummaryEntry = {
  dayNumber: number;
  completedToday: boolean;
  streak: number;
  available: boolean;
};

export type DailySummary = {
  word: DailySummaryEntry;
  sudoku: DailySummaryEntry;
  crossword: DailySummaryEntry;
  word_search: DailySummaryEntry;
  jigsaw: DailySummaryEntry;
};

export interface DailyPuzzleLineupProps {
  summary: DailySummary | null;
  isAuthenticated: boolean;
  debriefCompleted: boolean;
}

/* ── inline SVG icons — no icon package, decorative only ─────────────── */
function IconWord({ color }: { color: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M4 6h16M4 12h16M4 18h16" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconSudoku({ color }: { color: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="18" height="18" stroke={color} strokeWidth="1.6" />
      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" stroke={color} strokeWidth="1.2" strokeOpacity="0.6" />
    </svg>
  );
}
function IconCrossword({ color }: { color: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="18" height="18" rx="1" stroke={color} strokeWidth="1.6" />
      <path d="M8 8h3v3H8zM13 8h3v3h-3zM8 13h3v3H8z" stroke={color} strokeWidth="1.2" strokeOpacity="0.6" />
    </svg>
  );
}
function IconWordSearch({ color }: { color: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="9" cy="9" r="4.5" stroke={color} strokeWidth="1.6" />
      <path d="M13.5 14l4 4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconJigsaw({ color }: { color: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M4 4h7v7M13 4h7v7M4 13h7v7M13 13h7v7"
        stroke={color}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="7.5" r="1" fill={color} opacity="0.5" />
    </svg>
  );
}
function IconReport({ color }: { color: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M7 3h7l4 4v14a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M14 3v4h4M9 12h6M9 15h6M9 9h2" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function IconChevron({ color }: { color: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M9 5l7 7-7 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface BasePuzzle {
  slug: string;
  title: string;
  description: string;
  icon: (props: { color: string }) => ReactNode;
  color: string;
  signInRequired: boolean;
  isDebrief?: boolean;
}

interface StandardPuzzle extends BasePuzzle {
  key: keyof DailySummary;
  type: "standard";
}

interface DebriefPuzzle extends BasePuzzle {
  type: "debrief";
}

const PUZZLES: StandardPuzzle[] = [
  {
    key: "word",
    slug: "word",
    title: "Hidden Word",
    description: "Find the hidden word in six guesses.",
    icon: IconWord,
    color: "var(--pw-brand-primary)",
    signInRequired: false,
    type: "standard",
  },
  {
    key: "sudoku",
    slug: "sudoku",
    title: "Sudoku",
    description: "Complete today's number grid.",
    icon: IconSudoku,
    color: "var(--pw-brand-primary)",
    signInRequired: true,
    type: "standard",
  },
  {
    key: "crossword",
    slug: "crossword",
    title: "Crossword",
    description: "Solve today's clue set.",
    icon: IconCrossword,
    color: "var(--pw-brand-primary)",
    signInRequired: true,
    type: "standard",
  },
  {
    key: "word_search",
    slug: "word-search",
    title: "Word Trove",
    description: "Find every hidden word.",
    icon: IconWordSearch,
    color: "var(--pw-brand-primary)",
    signInRequired: true,
    type: "standard",
  },
  {
    key: "jigsaw",
    slug: "jigsaw",
    title: "Jigsaw",
    description: "Rebuild today's image.",
    icon: IconJigsaw,
    color: "var(--pw-brand-primary)",
    signInRequired: true,
    type: "standard",
  },
];

const DEBRIEF: DebriefPuzzle = {
  slug: "",
  title: "The Debrief",
  description: "Memorize the report and answer from memory.",
  icon: IconReport,
  color: "var(--pw-brand-accent)",
  signInRequired: true,
  type: "debrief",
  isDebrief: true,
};

function PuzzleRow({
  puzzle,
  entry,
  isAuthenticated,
  completedState,
}: {
  puzzle: BasePuzzle;
  entry: DailySummaryEntry | undefined;
  isAuthenticated: boolean;
  completedState: boolean;
}) {
  const Icon = puzzle.icon;
  const locked = puzzle.signInRequired && !isAuthenticated;
  const notReady = !!entry && !entry.available;
  const completed = completedState;
  const streak = entry?.streak ?? 0;

  let statusLabel = "";
  if (locked) {
    statusLabel = "Sign In to Play";
  } else if (notReady) {
    statusLabel = "Check Back Soon";
  } else if (puzzle.isDebrief) {
    statusLabel = completed ? "New Case Tomorrow" : "Open Case";
  } else {
    statusLabel = completed ? "View Result" : "Play";
  }

  return (
    <Link
      href={puzzle.slug === "" ? "/debrief" : `/daily/${puzzle.slug}`}
      className="pw-bevel pw-press flex flex-col min-[360px]:flex-row items-start min-[360px]:items-center gap-3 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        minHeight: 56,
        padding: "12px 14px",
        textDecoration: "none",
        background: completed
          ? "linear-gradient(160deg, var(--pw-surface-2), var(--pw-surface-1) 70%)"
          : locked || notReady
            ? "linear-gradient(160deg, var(--pw-surface-2), var(--pw-surface-1) 70%)"
            : `radial-gradient(180px 100px at 100% 0%, color-mix(in srgb, ${puzzle.color} 12%, transparent), transparent 60%), linear-gradient(160deg, var(--pw-surface-2), var(--pw-surface-1) 70%)`,
        border:
          completed ? "1px solid var(--pw-success-border)"
          : locked || notReady
            ? "1px solid var(--pw-border-default)"
            : `1px solid color-mix(in srgb, ${puzzle.color} 30%, transparent)`,
        outlineColor: "var(--pw-brand-secondary)",
      }}
    >
      {/* First row: icon + content */}
      <span className="flex items-start gap-3 flex-1 min-w-0">
        {/* Icon emblem */}
        <span
          aria-hidden="true"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 8,
            flexShrink: 0,
            background: `color-mix(in srgb, ${puzzle.color} 16%, transparent)`,
            border: `1px solid color-mix(in srgb, ${puzzle.color} ${completed ? "30" : "35"}%, transparent)`,
          }}
        >
          <Icon color={completed ? "var(--pw-success)" : puzzle.color} />
        </span>

        {/* Content */}
        <span className="min-w-0 flex-1">
          <span style={{ display: "block", fontWeight: 700, fontSize: 14, color: "var(--pw-text-primary)" }}>
            {puzzle.title}
          </span>
          <span style={{ display: "block", fontSize: 12, color: "var(--pw-text-muted)", marginTop: 2 }}>
            {puzzle.description}
          </span>
          {entry?.dayNumber ? (
            <span style={{ display: "block", fontSize: 11, color: "var(--pw-text-muted)", marginTop: 2 }}>
              Daily #{entry.dayNumber}
            </span>
          ) : null}
        </span>
      </span>

      {/* Second row (below 360px) / inline (360px+): Status and streak */}
      <span className="flex items-center gap-2.5 shrink-0 pl-11 mt-2 min-[360px]:pl-0 min-[360px]:mt-0">
        {streak > 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "4px 8px",
              borderRadius: 6,
              background: "color-mix(in srgb, var(--pw-gold) 14%, transparent)",
              color: "var(--pw-gold)",
              border: "1px solid color-mix(in srgb, var(--pw-gold) 35%, transparent)",
            }}
          >
            {streak} day streak
          </span>
        )}
        <span style={{ fontSize: 12, color: completed ? "var(--pw-text-muted)" : puzzle.color, fontWeight: 600, whiteSpace: "nowrap" }}>
          {statusLabel}
        </span>
        <span aria-hidden style={{ flexShrink: 0, display: "flex" }}>
          <IconChevron color={completed ? "var(--pw-text-muted)" : puzzle.color} />
        </span>
      </span>
    </Link>
  );
}

/**
 * Compact mobile-first Daily Puzzle Lineup replacing the six card grid. One row
 * per puzzle at 320px; two columns at 669px+, three at 981px+. Preserves all game
 * state, auth requirements, and day/streak tracking.
 */
export default function DailyPuzzleLineup({
  summary,
  isAuthenticated,
  debriefCompleted,
}: DailyPuzzleLineupProps) {
  if (!summary) return null;

  return (
    <section aria-labelledby="daily-lineup-heading" className="w-full max-w-5xl">
      <h2
        id="daily-lineup-heading"
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--pw-text-secondary)",
          margin: "0 0 12px",
        }}
      >
        Today&rsquo;s Challenges
      </h2>

      <div className="grid gap-2.5 grid-cols-1 min-[669px]:grid-cols-2 min-[981px]:grid-cols-3">
        {PUZZLES.map((puzzle) => {
          const entry = summary[puzzle.key];
          return (
            <PuzzleRow
              key={puzzle.key}
              puzzle={puzzle}
              entry={entry}
              isAuthenticated={isAuthenticated}
              completedState={entry?.completedToday ?? false}
            />
          );
        })}
        {/* The Debrief — separate system (no dayNumber/streak), so rendered separately. */}
        <PuzzleRow
          key="debrief"
          puzzle={DEBRIEF}
          entry={undefined}
          isAuthenticated={isAuthenticated}
          completedState={debriefCompleted}
        />
      </div>
    </section>
  );
}
