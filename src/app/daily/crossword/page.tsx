"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import CrosswordPuzzle, {
  type CrosswordPresentationState,
  type CrosswordPuzzleHandle,
} from "@/components/puzzle/CrosswordPuzzle";
import PuzzlePlayShell from "@/components/app-shell/PuzzlePlayShell";
import { PuzzleHeaderCrosswordActions } from "@/components/app-shell/PuzzleHeader";
import { useDailyPuzzle } from "@/hooks/useDailyPuzzle";
import DailyCompletionHandoff from "@/components/onboarding/DailyCompletionHandoff";
import DailyPuzzleResult from "@/components/daily/DailyPuzzleResult";

export default function DailyCrosswordPage() {
  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";
  const onboardingUserId = session?.user
    ? (session.user as { id?: string }).id || session.user.email || null
    : null;
  const { loading, available, dayNumber, streak, streakDay, completedToday, nextReward, content, submitCompletion } =
    useDailyPuzzle("crossword");
  const [crosswordData, setCrosswordData] = useState<Record<string, unknown> | null>(null);
  const [reward, setReward] = useState<{ points: number; xp: number } | null>(null);
  const [solved, setSolved] = useState(false);
  const crosswordRef = useRef<CrosswordPuzzleHandle | null>(null);
  const [presentation, setPresentation] = useState<CrosswordPresentationState | null>(null);

  const formattedElapsed = (() => {
    const totalSeconds = Math.max(0, Math.floor((presentation?.elapsedMs ?? 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  })();

  useEffect(() => {
    if (!content?.puzzleId) return;
    let cancelled = false;
    fetch(`/api/puzzles/${content.puzzleId}`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((puzzle) => {
        if (!cancelled && puzzle?.data) setCrosswordData(puzzle.data as Record<string, unknown>);
      });
    return () => {
      cancelled = true;
    };
  }, [content?.puzzleId]);

  const isDone = completedToday || solved;

  return (
    <PuzzlePlayShell
      backHref="/daily"
      title="Daily Crossword"
      subtitle={`#${dayNumber || "---"}${streak > 0 ? ` · 🔥 ${streak}` : ""}`}
      progress={<span aria-label={`Elapsed time ${formattedElapsed}`}>{formattedElapsed}</span>}
      actions={<PuzzleHeaderCrosswordActions
        onClues={() => crosswordRef.current?.openClueSheet()}
        onHelp={() => crosswordRef.current?.openInstructions()}
      />}
      contentMode="fixed"
      contentClassName="pw-crossword-shell-content"
    >
      <div className="crossword-daily-stage flex flex-col items-center px-3 pt-4 pb-6">
        {!isAuthenticated ? (
          <div className="mt-16 text-center">
            <p className="text-white font-bold mb-3">Sign in to play the daily crossword</p>
            <Link href="/auth/signin" className="px-5 py-2 rounded-lg text-sm font-bold inline-block" style={{ background: "#FDE74C", color: "#020202" }}>
              Sign in
            </Link>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 mt-20" style={{ color: "#3891A6" }}>
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading today&apos;s puzzle…</span>
          </div>
        ) : !available || !content?.puzzleId ? (
          <p className="mt-16 text-sm" style={{ color: "#AB9F9D" }}>Today&apos;s crossword isn&apos;t ready yet — check back soon.</p>
        ) : isDone ? (
          <DailyPuzzleResult
            puzzleName="Crossword"
            dayNumber={dayNumber}
            streak={streak}
            streakDay={streakDay}
            reward={reward}
            nextReward={nextReward}
          >
            <DailyCompletionHandoff userId={onboardingUserId} completed />
          </DailyPuzzleResult>
        ) : !crosswordData ? (
          <div className="flex items-center gap-2 mt-20" style={{ color: "#3891A6" }}>
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="w-full max-w-4xl">
            {nextReward && (
              <p className="text-xs text-center mb-3" style={{ color: "#DDDBF1" }}>
                Day {nextReward.streakDay} reward: +{nextReward.points} pts · +{nextReward.xp} xp
              </p>
            )}
            <CrosswordPuzzle
              ref={crosswordRef}
              puzzleId={content.puzzleId}
              crosswordData={crosswordData}
              displayMode="app-shell"
              onPresentationChange={setPresentation}
              onSolved={async () => {
                const result = await submitCompletion();
                if (result?.reward) setReward(result.reward);
                setSolved(true);
              }}
            />
          </div>
        )}
      </div>
    </PuzzlePlayShell>
  );
}
