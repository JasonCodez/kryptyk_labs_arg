"use client";

import Link from "next/link";
import {
  WholeWord,
  Grid3X3,
  SquarePen,
  Search,
  Puzzle as PuzzleIcon,
  FileText,
  Flame,
  CircleCheck,
  CircleDashed,
  LayoutGrid,
  LockKeyhole,
  Clock3,
  ChevronRight,
  PartyPopper,
  type LucideIcon,
} from "lucide-react";
import Card from "@/components/ui/Card";
import PressableCard from "@/components/ui/PressableCard";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";

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
  summary: DailySummary;
  isAuthenticated: boolean;
  debriefCompleted: boolean;
}

type DailyCardState = "playable" | "completed" | "sign-in-required" | "not-ready";

interface BasePuzzle {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
  signInRequired: boolean;
  isDebrief?: boolean;
}

interface StandardPuzzle extends BasePuzzle {
  key: keyof DailySummary;
}

const PUZZLES: StandardPuzzle[] = [
  {
    key: "word",
    slug: "word",
    title: "Hidden Word",
    description: "Find the hidden word in six guesses.",
    icon: WholeWord,
    signInRequired: false,
  },
  {
    key: "sudoku",
    slug: "sudoku",
    title: "Sudoku",
    description: "Complete today's number grid.",
    icon: Grid3X3,
    signInRequired: true,
  },
  {
    key: "crossword",
    slug: "crossword",
    title: "Crossword",
    description: "Solve today's clue set.",
    icon: SquarePen,
    signInRequired: true,
  },
  {
    key: "word_search",
    slug: "word-search",
    title: "Word Trove",
    description: "Find every hidden word.",
    icon: Search,
    signInRequired: true,
  },
  {
    key: "jigsaw",
    slug: "jigsaw",
    title: "Jigsaw",
    description: "Rebuild today's image.",
    icon: PuzzleIcon,
    signInRequired: true,
  },
];

const DEBRIEF: BasePuzzle = {
  slug: "",
  title: "The Debrief",
  description: "Memorize the report and answer from memory.",
  icon: FileText,
  signInRequired: true,
  isDebrief: true,
};

function cardHref(puzzle: BasePuzzle): string {
  return puzzle.slug === "" ? "/debrief" : `/daily/${puzzle.slug}`;
}

function getCardState(puzzle: BasePuzzle, entry: DailySummaryEntry | undefined, isAuthenticated: boolean, completed: boolean): DailyCardState {
  const signedOut = puzzle.signInRequired && !isAuthenticated;
  if (signedOut) return "sign-in-required";
  if (puzzle.isDebrief) return completed ? "completed" : "playable";
  if (entry && !entry.available) return "not-ready";
  if (completed) return "completed";
  return "playable";
}

const STATE_META: Record<DailyCardState, { label: string; accent: "primary" | "success" | "neutral" }> = {
  playable: { label: "Ready", accent: "primary" },
  completed: { label: "Completed", accent: "success" },
  "sign-in-required": { label: "Sign In Required", accent: "neutral" },
  "not-ready": { label: "Not Available", accent: "neutral" },
};

function getActionText(puzzle: BasePuzzle, state: DailyCardState): string {
  if (state === "sign-in-required") return "Sign In to Play";
  if (state === "not-ready") return "Check Back Soon";
  if (puzzle.isDebrief) return state === "completed" ? "New Case Tomorrow" : "Open Case";
  return state === "completed" ? "View Result" : "Play";
}

function pluralizeDayStreak(streak: number): string {
  return `${streak} day streak`;
}

function DailyCard({
  puzzle,
  entry,
  isAuthenticated,
  completed,
}: {
  puzzle: BasePuzzle;
  entry: DailySummaryEntry | undefined;
  isAuthenticated: boolean;
  completed: boolean;
}) {
  const Icon = puzzle.icon;
  const state = getCardState(puzzle, entry, isAuthenticated, completed);
  const meta = STATE_META[state];
  const actionText = getActionText(puzzle, state);
  const streak = entry?.streak ?? 0;

  return (
    <PressableCard href={cardHref(puzzle)} accent={meta.accent} padding="md">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex items-center justify-center shrink-0 rounded-lg"
          style={{
            width: 36,
            height: 36,
            background: "color-mix(in srgb, var(--pw-brand-primary) 16%, transparent)",
            border: "1px solid color-mix(in srgb, var(--pw-brand-primary) 30%, transparent)",
          }}
        >
          <Icon aria-hidden="true" size={18} color="var(--pw-text-primary)" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm" style={{ color: "var(--pw-text-primary)" }}>{puzzle.title}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--pw-text-muted)" }}>{puzzle.description}</p>
          {entry?.dayNumber ? (
            <p className="text-[11px] mt-1" style={{ color: "var(--pw-text-muted)" }}>Daily #{entry.dayNumber}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span
          className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg"
          style={{
            background: `color-mix(in srgb, var(--pw-${meta.accent === "success" ? "success" : meta.accent === "primary" ? "brand-primary" : "text-secondary"}) 16%, transparent)`,
            color: meta.accent === "success" ? "var(--pw-success)" : meta.accent === "primary" ? "var(--pw-brand-primary-light)" : "var(--pw-text-secondary)",
          }}
        >
          {state === "completed" && <CircleCheck aria-hidden="true" size={11} />}
          {state === "sign-in-required" && <LockKeyhole aria-hidden="true" size={11} />}
          {state === "not-ready" && <Clock3 aria-hidden="true" size={11} />}
          {meta.label}
        </span>
        {streak > 0 && (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg"
            style={{ background: "color-mix(in srgb, var(--pw-gold) 14%, transparent)", color: "var(--pw-gold)" }}
          >
            <Flame aria-hidden="true" size={11} />
            {pluralizeDayStreak(streak)}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="text-xs font-bold" style={{ color: "var(--pw-text-secondary)" }}>{actionText}</span>
        <ChevronRight aria-hidden="true" size={16} color="var(--pw-text-muted)" />
      </div>
    </PressableCard>
  );
}

function RecommendedCTA({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="game-btn--primary shadow-skeu-raised min-h-14 px-6 rounded-2xl inline-flex items-center justify-center font-extrabold uppercase tracking-wide game-text-stroke game-text-pop focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ textDecoration: "none" }}
    >
      {label}
    </Link>
  );
}

interface Recommendation {
  puzzle: BasePuzzle;
  entry: DailySummaryEntry | undefined;
}

function getRecommendation(
  summary: DailySummary,
  isAuthenticated: boolean,
  debriefCompleted: boolean
): Recommendation | null {
  for (const puzzle of PUZZLES) {
    const entry = summary[puzzle.key];
    const accessible = !puzzle.signInRequired || isAuthenticated;
    if (accessible && entry?.available && !entry.completedToday) {
      return { puzzle, entry };
    }
  }
  if (isAuthenticated && !debriefCompleted) {
    return { puzzle: DEBRIEF, entry: undefined };
  }
  return null;
}

export default function DailyPuzzleLineup({ summary, isAuthenticated, debriefCompleted }: DailyPuzzleLineupProps) {
  const reduceMotion = useAppReducedMotion();

  const completedCount = PUZZLES.filter((p) => summary[p.key]?.completedToday).length + (debriefCompleted ? 1 : 0);
  const totalChallenges = 6;
  const remainingCount = totalChallenges - completedCount;
  const completionPercentage = Math.round((completedCount / totalChallenges) * 100);
  const allComplete = completedCount === totalChallenges;
  const recommendation = allComplete ? null : getRecommendation(summary, isAuthenticated, debriefCompleted);

  const progressFillToken = allComplete ? "var(--pw-success)" : "var(--pw-brand-primary)";
  const overviewAccent = allComplete ? "success" : completedCount > 0 ? "primary" : "neutral";

  const guestBlocked = !isAuthenticated && !recommendation && !allComplete;

  return (
    <div className="w-full">
      <Card accent={overviewAccent} padding="lg" className="mb-8 max-w-5xl mx-auto">
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div
                className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl text-center"
                style={{ background: "var(--pw-surface-2)", border: "1px solid var(--pw-border-subtle)" }}
              >
                <CircleCheck aria-hidden="true" size={16} style={{ color: "var(--pw-brand-primary)" }} />
                <span className="text-base font-extrabold" style={{ color: "var(--pw-text-primary)" }}>{completedCount}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--pw-text-secondary)" }}>Complete</span>
              </div>
              <div
                className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl text-center"
                style={{ background: "var(--pw-surface-2)", border: "1px solid var(--pw-border-subtle)" }}
              >
                <CircleDashed aria-hidden="true" size={16} style={{ color: "var(--pw-brand-primary)" }} />
                <span className="text-base font-extrabold" style={{ color: "var(--pw-text-primary)" }}>{remainingCount}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--pw-text-secondary)" }}>Remaining</span>
              </div>
              <div
                className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl text-center"
                style={{ background: "var(--pw-surface-2)", border: "1px solid var(--pw-border-subtle)" }}
              >
                <LayoutGrid aria-hidden="true" size={16} style={{ color: "var(--pw-brand-primary)" }} />
                <span className="text-base font-extrabold" style={{ color: "var(--pw-text-primary)" }}>{totalChallenges}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--pw-text-secondary)" }}>Challenges</span>
              </div>
            </div>
            <div
              role="progressbar"
              aria-label="Today’s Daily Puzzle progress"
              aria-valuemin={0}
              aria-valuemax={totalChallenges}
              aria-valuenow={completedCount}
              className="h-2 w-full rounded-full overflow-hidden"
              style={{ background: "color-mix(in srgb, var(--pw-text-secondary) 18%, transparent)" }}
            >
              <div
                className={reduceMotion ? "h-full rounded-full" : "h-full rounded-full transition-all duration-500"}
                style={{ width: `${completionPercentage}%`, background: progressFillToken }}
              />
            </div>
          </div>

          <div>
            {allComplete ? (
              <div>
                <h2 className="inline-flex items-center gap-1.5 text-sm font-extrabold mb-1.5" style={{ color: "var(--pw-success)" }}>
                  <PartyPopper aria-hidden="true" size={16} />
                  Today&rsquo;s lineup complete
                </h2>
                <p className="text-sm" style={{ color: "var(--pw-text-secondary)" }}>
                  You cleared all six Daily challenges. A fresh lineup arrives at the next reset.
                </p>
              </div>
            ) : recommendation ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--pw-brand-primary)" }}>
                  Play Next
                </p>
                <h2 className="text-lg font-extrabold mb-1" style={{ color: "var(--pw-text-primary)" }}>
                  {recommendation.puzzle.title}
                </h2>
                <p className="text-xs mb-2" style={{ color: "var(--pw-text-secondary)" }}>
                  {recommendation.puzzle.description}
                </p>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {recommendation.entry?.dayNumber ? (
                    <span className="text-xs font-semibold" style={{ color: "var(--pw-text-secondary)" }}>
                      Daily #{recommendation.entry.dayNumber}
                    </span>
                  ) : null}
                  {recommendation.entry && recommendation.entry.streak > 0 ? (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg"
                      style={{ background: "color-mix(in srgb, var(--pw-gold) 14%, transparent)", color: "var(--pw-gold)" }}
                    >
                      <Flame aria-hidden="true" size={11} />
                      {pluralizeDayStreak(recommendation.entry.streak)}
                    </span>
                  ) : null}
                </div>
                <RecommendedCTA
                  href={cardHref(recommendation.puzzle)}
                  label={recommendation.puzzle.isDebrief ? "Open case" : "Play now"}
                />
              </div>
            ) : (
              <div>
                <h2 className="text-sm font-bold mb-1.5" style={{ color: "var(--pw-text-primary)" }}>
                  No challenge is ready to play
                </h2>
                <p className="text-xs mb-2" style={{ color: "var(--pw-text-secondary)" }}>
                  {guestBlocked
                    ? "Sign in to access the rest of today’s lineup."
                    : "Check back after the next Daily reset."}
                </p>
                {guestBlocked && (
                  <Link
                    href="/auth/signin"
                    className="text-xs font-bold underline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ color: "var(--pw-brand-primary)" }}
                  >
                    Sign in
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      <h2 className="text-xl font-extrabold mb-4 max-w-5xl mx-auto" style={{ color: "var(--pw-text-primary)" }}>
        Today&rsquo;s Challenges
      </h2>

      <div
        data-testid="daily-lineup-grid"
        className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto"
      >
        {PUZZLES.map((puzzle) => {
          const entry = summary[puzzle.key];
          return (
            <DailyCard
              key={puzzle.key}
              puzzle={puzzle}
              entry={entry}
              isAuthenticated={isAuthenticated}
              completed={entry?.completedToday ?? false}
            />
          );
        })}
        <DailyCard
          key="debrief"
          puzzle={DEBRIEF}
          entry={undefined}
          isAuthenticated={isAuthenticated}
          completed={debriefCompleted}
        />
      </div>
    </div>
  );
}
