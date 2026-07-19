"use client";

import { useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import PuzzlePlayShell from "@/components/app-shell/PuzzlePlayShell";
import { PuzzleHeaderActions } from "@/components/app-shell/PuzzleHeader";
import SudokuPuzzle, { type SudokuPresentationState, type SudokuPuzzleHandle } from "@/components/puzzle/SudokuPuzzle";
import { useDailyPuzzle } from "@/hooks/useDailyPuzzle";
import DailyCompletionHandoff from "@/components/onboarding/DailyCompletionHandoff";

const formatElapsed = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

export default function DailySudokuPage() {
  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";
  const onboardingUserId = session?.user
    ? (session.user as { id?: string }).id || session.user.email || null
    : null;
  const { loading, available, dayNumber, streak, completedToday, content, submitCompletion } = useDailyPuzzle("sudoku");
  const sudokuRef = useRef<SudokuPuzzleHandle>(null);
  const [presentation, setPresentation] = useState<SudokuPresentationState | null>(null);
  const [solved, setSolved] = useState(false);
  const [reward, setReward] = useState<{ points: number; xp: number } | null>(null);

  const grid = useMemo(() => { try { return content?.puzzleGrid ? JSON.parse(content.puzzleGrid) as number[][] : null; } catch { return null; } }, [content?.puzzleGrid]);
  const solution = useMemo(() => { try { return content?.solutionGrid ? JSON.parse(content.solutionGrid) as number[][] : null; } catch { return null; } }, [content?.solutionGrid]);
  const isDone = completedToday || solved;

  return (
    <PuzzlePlayShell
      backHref="/daily"
      title="Daily Sudoku"
      subtitle={`#${dayNumber || "---"}${streak > 0 ? ` · 🔥 ${streak}` : ""}`}
      progress={presentation ? formatElapsed(presentation.timeMs) : "0:00"}
      actions={<PuzzleHeaderActions onHelp={() => sudokuRef.current?.openInstructions()} helpLabel="How to play Sudoku" />}
      contentMode="fixed"
      contentClassName="pw-sudoku-shell-content"
    >
      {!isAuthenticated ? (
        <div className="sudoku-status-card"><p>Sign in to play the daily Sudoku.</p><Link href="/auth/signin" className="sudoku-dialog-primary">Sign in</Link></div>
      ) : loading ? (
        <div className="sudoku-status-card" role="status"><span className="sudoku-spinner" />Loading today&apos;s puzzle…</div>
      ) : !available || !grid || !solution ? (
        <div className="sudoku-status-card">Today&apos;s Sudoku isn&apos;t ready yet. Check back soon.</div>
      ) : isDone ? (
        <>
          <section className="sudoku-result-card"><span aria-hidden>✓</span><h2>Solved for today!</h2>{reward && <p>+{reward.points} pts · +{reward.xp} xp</p>}<p>Come back tomorrow for a new puzzle.</p></section>
          <DailyCompletionHandoff userId={onboardingUserId} completed />
        </>
      ) : (
        <SudokuPuzzle
          ref={sudokuRef}
          puzzleId={`daily-sudoku-${dayNumber}`}
          puzzle={grid}
          solution={solution}
          mode="daily"
          displayMode="app-shell"
          onPresentationChange={setPresentation}
          onComplete={async () => {
            const result = await submitCompletion();
            if (!result) return { success: false, error: "Daily completion could not be recorded. Try again." };
            if (result.reward) setReward(result.reward);
            return { success: true };
          }}
          onCelebrationComplete={() => setSolved(true)}
        />
      )}
    </PuzzlePlayShell>
  );
}
